// Renders a timed splash screen and routes to auth landing.
import { Screen } from "@/src/components/common/Screen";
import { APP_SPACING, APP_TYPE_SCALE } from "@/src/config/theme";
import { useThemeMode } from "@/src/hooks";
import type { RootStackWithAuthParamList } from "@/src/navigation";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export const SplashScreen = () => {
  const { colors } = useThemeMode();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackWithAuthParamList>>();

  useEffect(() => {
    const timeout = setTimeout(() => {
      navigation.replace("Auth");
    }, 1200);
    return () => clearTimeout(timeout);
  }, [navigation]);

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>WAV</Text>
        <ActivityIndicator color={colors.accent} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: APP_SPACING.xs,
  },
  title: {
    fontSize: APP_TYPE_SCALE.hero,
    fontWeight: "800",
    letterSpacing: 3,
  },
});
