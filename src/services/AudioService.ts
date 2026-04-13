// Handles audio configuration and playback orchestration.
import { ServiceError } from "@/src/errors";
import { Audio } from "expo-av";

let activeSound: Audio.Sound | null = null;

export class AudioService {
  public async configure(): Promise<void> {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playsInSilentModeIOS: true,
      });
    } catch (error: unknown) {
      throw new ServiceError("Failed to configure audio", undefined, error);
    }
  }

  public async createSound(uri: string): Promise<Audio.Sound> {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false, progressUpdateIntervalMillis: 200 },
      );
      return sound;
    } catch (error: unknown) {
      throw new ServiceError("Failed to create sound", { uri }, error);
    }
  }

  public async stopActiveSound(): Promise<void> {
    try {
      if (!activeSound) return;
      await activeSound.stopAsync();
      activeSound = null;
    } catch (error: unknown) {
      throw new ServiceError("Failed to stop active sound", undefined, error);
    }
  }

  public async setActiveSound(sound: Audio.Sound): Promise<void> {
    try {
      if (activeSound && activeSound !== sound) {
        await activeSound.stopAsync();
      }
      activeSound = sound;
    } catch (error: unknown) {
      throw new ServiceError("Failed to set active sound", undefined, error);
    }
  }
}
