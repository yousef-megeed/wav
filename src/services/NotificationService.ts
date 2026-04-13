// Handles push registration and local notification side effects.
import { EAS_PROJECT_ID } from "@/src/config/env";
import { APP_COLORS } from "@/src/constants/theme";
import { ServiceError } from "@/src/errors";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  public async registerForPushNotifications(): Promise<string | null> {
    const projectId =
      EAS_PROJECT_ID ||
      (Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId);

    try {
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: APP_COLORS.primary,
        });
      }

      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.status !== "granted") {
        const asked = await Notifications.requestPermissionsAsync();
        if (asked.status !== "granted") {
          return null;
        }
      }

      if (!projectId) {
        throw new Error(
          "No Expo projectId found. Add EXPO_PUBLIC_EAS_PROJECT_ID to .env and restart the app.",
        );
      }

      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      if (!tokenResponse.data) {
        throw new Error("No Expo push token returned.");
      }

      return tokenResponse.data;
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to register push notifications",
        {
          projectIdPresent: Boolean(projectId),
        },
        error,
      );
    }
  }

  public async notifyLocal(title: string, body: string): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: null,
      });
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to schedule local notification",
        { title },
        error,
      );
    }
  }

  public async sendPushToToken(input: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: input.token,
          title: input.title,
          body: input.body,
          data: input.data,
          sound: "default",
          priority: "high",
        }),
      });

      if (!response.ok) {
        throw new Error(`Expo push send failed with status ${response.status}`);
      }

      const result = (await response.json()) as {
        data?: { status?: string; message?: string };
        errors?: Array<{ message?: string }>;
      };

      if (result.errors?.length) {
        throw new Error(result.errors[0]?.message ?? "Expo push send error");
      }

      if (result.data?.status === "error") {
        throw new Error(
          result.data.message ?? "Expo push ticket returned error",
        );
      }
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to send push notification",
        { token: input.token },
        error,
      );
    }
  }
}
