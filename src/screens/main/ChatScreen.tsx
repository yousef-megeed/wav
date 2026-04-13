import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio, type AVPlaybackStatus } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AudioWaveform } from "../../components/AudioWaveform";
import { APP_COLORS } from "../../constants/theme";
import {
  buildPreviewWaveformMeta,
  buildWaveformFromMeteringSamples,
} from "../../services/WaveformService";

type ChatScreenProps = {
  onBack?: () => void;
  collaboratorName?: string;
  collaboratorAvatarUrl?: string;
  collaboratorDetails?: ChatCollaboratorDetails | null;
  isCollaboratorActive?: boolean;
  messages?: ChatMessage[];
  isLoading?: boolean;
  onSendMessage?: (content: string) => void | Promise<void>;
  onOpenCollaboratorProfile?: () => void;
  onSendAudioMessage?: (input: {
    uri: string;
    kind: "voice-note" | "audio-file";
    name?: string;
    mimeType?: string;
    durationMs?: number | null;
    waveformAmplitudes?: number[] | null;
    waveformCoverageMs?: number | null;
    waveformSource?: "preview" | "canonical" | "metering" | null;
  }) => void | Promise<void>;
};

export type ChatMessage = {
  id: string;
  kind:
    | "incoming"
    | "outgoing"
    | "incoming-voice"
    | "outgoing-voice"
    | "incoming-audio-file"
    | "outgoing-audio-file";
  text?: string | null;
  time: string;
  audioUrl?: string;
  fileName?: string;
  durationMs?: number;
  waveformAmplitudes?: number[];
  waveformCoverageMs?: number;
  waveformSource?: "preview" | "canonical" | "metering";
};

export type ChatCollaboratorTrack = {
  id: string;
  title: string;
  genre: string;
  durationSec: number;
  previewUrl?: string;
  waveformAmplitudes?: number[];
};

export type ChatCollaboratorDetails = {
  role?: string | null;
  location?: string | null;
  bio?: string | null;
  genres?: string[];
  isVerified?: boolean;
  trackPreviews?: ChatCollaboratorTrack[];
};

const palette = {
  background: APP_COLORS.background,
  surfaceContainerLow: APP_COLORS.surface,
  surfaceContainerHigh: APP_COLORS.surfaceHigher,
  textPrimary: APP_COLORS.textPrimary,
  textSecondary: APP_COLORS.textSecondary,
  primary: APP_COLORS.primary,
  primaryDim: APP_COLORS.primaryDim,
};

const initialMessages: ChatMessage[] = [
  {
    id: "msg-1",
    kind: "incoming",
    text: "Hey! I just finished the baseline for that new track. Want to hear the rough cut?",
    time: "11:42 AM",
  },
  {
    id: "msg-2",
    kind: "outgoing",
    text: "Absolutely. Drop the audio file here. I'm ready to layer some synth on top.",
    time: "11:45 AM",
  },
  {
    id: "msg-3",
    kind: "incoming-voice",
    time: "11:46 AM",
  },
];

const collaboratorImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAOVMtw_W-qpWQ6oyfcSBlo2yEwak0iLziRp79oxExg9pKW8tZSMNd8RjhKZpyICw753lannDx6DkjWSN86-p6X3pESu2mClJoka61ioKRh5IKqtkGKWEVuzF6mkZsC9qwXfYdmb6Hyws-1hHTpzW17TQY5jyqDroIYZjiagAMB3FwR93CyftL9Tz01MEYZWp89zQiyoaYngfvUDnNvb4U0EMDeTafRiy5rW98X2R-qI9DeX-AKPWTqsyZq3wbUp-sBh8prSOBOxoZk";

const METERING_SAMPLE_INTERVAL_MS = 80;

export function ChatScreen({
  onBack,
  collaboratorName,
  collaboratorAvatarUrl,
  collaboratorDetails,
  isCollaboratorActive,
  messages,
  isLoading,
  onSendMessage,
  onOpenCollaboratorProfile,
  onSendAudioMessage,
}: ChatScreenProps) {
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const formatTrackDuration = (durationSec: number) => {
    const total = Math.max(0, Math.floor(durationSec));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const profileSoundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingMeteringRef = useRef<number[]>([]);
  const isAtBottomRef = useRef(true);
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] =
    useState<ChatMessage[]>(initialMessages);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sendProgress, setSendProgress] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{
    kind: "voice-note" | "audio-file";
    uri: string;
    name?: string;
    mimeType?: string;
    durationMs?: number;
    waveformAmplitudes?: number[];
    waveformCoverageMs?: number;
    waveformSource?: "preview" | "canonical" | "metering";
    isExtractingWaveform?: boolean;
  } | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [activeAudioPositionMs, setActiveAudioPositionMs] = useState(0);
  const [activeAudioDurationMs, setActiveAudioDurationMs] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isProfilePreviewVisible, setIsProfilePreviewVisible] = useState(false);
  const [activeProfileTrackId, setActiveProfileTrackId] = useState<
    string | null
  >(null);
  const [isProfileTrackPlaying, setIsProfileTrackPlaying] = useState(false);
  const [isProfileTrackLoading, setIsProfileTrackLoading] = useState(false);
  const [profileTrackPositionMs, setProfileTrackPositionMs] = useState(0);
  const [profileTrackDurationMs, setProfileTrackDurationMs] = useState(0);
  const [savingAudioId, setSavingAudioId] = useState<string | null>(null);
  const [saveProgress, setSaveProgress] = useState<number | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const contentBottomInset = useMemo(
    () => Math.max(insets.bottom + 24, 24),
    [insets.bottom],
  );
  const collaboratorDisplayName = collaboratorName ?? "Marcus Miller";
  const resolvedCollaboratorAvatar =
    collaboratorAvatarUrl?.trim() || collaboratorImage;
  const visibleMessages = messages ?? localMessages;
  const orderedPortfolioTracks = useMemo(() => {
    const tracks = collaboratorDetails?.trackPreviews ?? [];
    if (tracks.length <= 1) {
      return tracks;
    }

    const [signature, ...rest] = tracks;
    return [signature, ...rest.filter((track) => track.id !== signature.id)];
  }, [collaboratorDetails?.trackPreviews]);

  const swipeBackResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          if (!onBack) {
            return false;
          }
          const { dx, dy } = gestureState;
          return dx > 10 && Math.abs(dx) > Math.abs(dy) * 1.3;
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!onBack) {
            return;
          }

          const { dx, vx, dy } = gestureState;
          const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.1;
          const qualifiesByDistance = dx > 85;
          const qualifiesByVelocity = dx > 45 && vx > 0.35;

          if (isHorizontal && (qualifiesByDistance || qualifiesByVelocity)) {
            onBack();
          }
        },
      }),
    [onBack],
  );

  const getMessageSenderName = (kind: ChatMessage["kind"]) => {
    if (kind.startsWith("incoming")) {
      return collaboratorDisplayName;
    }
    return "You";
  };

  useEffect(() => {
    if (isAtBottomRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [visibleMessages.length]);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync();
      soundRef.current = null;
      void profileSoundRef.current?.unloadAsync();
      profileSoundRef.current = null;
    };
  }, []);

  const releaseProfileTrack = useCallback(async () => {
    if (!profileSoundRef.current) {
      return;
    }

    profileSoundRef.current.setOnPlaybackStatusUpdate(null);
    await profileSoundRef.current.unloadAsync();
    profileSoundRef.current = null;
  }, []);

  const onProfileTrackPlaybackStatus = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) {
        if (status.error) {
          setIsProfileTrackLoading(false);
          setIsProfileTrackPlaying(false);
        }
        return;
      }

      setIsProfileTrackLoading(Boolean(status.isBuffering));
      setIsProfileTrackPlaying(Boolean(status.isPlaying));
      setProfileTrackPositionMs(status.positionMillis ?? 0);
      setProfileTrackDurationMs(status.durationMillis ?? 0);

      if (status.didJustFinish) {
        setIsProfileTrackPlaying(false);
        setProfileTrackPositionMs(0);
      }
    },
    [],
  );

  const toggleProfileTrack = useCallback(
    async (track: ChatCollaboratorTrack) => {
      if (!track.previewUrl) {
        return;
      }

      if (activeProfileTrackId === track.id && profileSoundRef.current) {
        const status = await profileSoundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await profileSoundRef.current.pauseAsync();
          return;
        }
        await profileSoundRef.current.playAsync();
        return;
      }

      setIsProfileTrackLoading(true);
      try {
        await soundRef.current?.pauseAsync();
        await releaseProfileTrack();

        const { sound } = await Audio.Sound.createAsync(
          { uri: track.previewUrl },
          { shouldPlay: true, progressUpdateIntervalMillis: 50 },
        );
        sound.setOnPlaybackStatusUpdate(onProfileTrackPlaybackStatus);
        profileSoundRef.current = sound;
        setActiveProfileTrackId(track.id);
        setProfileTrackPositionMs(0);
        setProfileTrackDurationMs((track.durationSec ?? 0) * 1000);
      } finally {
        setIsProfileTrackLoading(false);
      }
    },
    [
      activeProfileTrackId,
      onProfileTrackPlaybackStatus,
      releaseProfileTrack,
      soundRef,
    ],
  );

  const seekProfileTrackToRatio = useCallback(
    async (track: ChatCollaboratorTrack, ratio: number) => {
      if (!track.previewUrl) {
        return;
      }

      const clampedRatio = Math.max(0, Math.min(1, ratio));
      if (!profileSoundRef.current || activeProfileTrackId !== track.id) {
        await toggleProfileTrack(track);
      }

      if (!profileSoundRef.current) {
        return;
      }

      const totalDuration =
        profileTrackDurationMs > 0
          ? profileTrackDurationMs
          : (track.durationSec ?? 0) * 1000;
      if (!totalDuration) {
        return;
      }

      const nextPosition = Math.floor(totalDuration * clampedRatio);
      void profileSoundRef.current.setPositionAsync(nextPosition);
    },
    [activeProfileTrackId, profileTrackDurationMs, toggleProfileTrack],
  );

  const jumpToBottom = () => {
    isAtBottomRef.current = true;
    setIsAtBottom(true);
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const handleOpenCollaboratorProfile = () => {
    if (onOpenCollaboratorProfile) {
      onOpenCollaboratorProfile();
      return;
    }
    setIsProfilePreviewVisible(true);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const nextIsAtBottom = distanceFromBottom < 48;

    if (nextIsAtBottom !== isAtBottomRef.current) {
      isAtBottomRef.current = nextIsAtBottom;
      setIsAtBottom(nextIsAtBottom);
    }
  };

  const probeAudioDuration = async (
    uri: string,
  ): Promise<number | undefined> => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
      );
      const status = await sound.getStatusAsync();
      await sound.unloadAsync();
      if (!status.isLoaded || typeof status.durationMillis !== "number") {
        return undefined;
      }
      return status.durationMillis;
    } catch {
      return undefined;
    }
  };

  const onPlaybackStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    setActiveAudioPositionMs(status.positionMillis ?? 0);
    setActiveAudioDurationMs(status.durationMillis ?? 0);
    setIsAudioPlaying(Boolean(status.isPlaying));

    if (status.didJustFinish) {
      setIsAudioPlaying(false);
      setActiveAudioPositionMs(0);
    }
  };

  const toggleTrackPlayback = async (audioId: string, audioUrl?: string) => {
    if (!audioUrl) {
      return;
    }

    try {
      if (soundRef.current && activeAudioId === audioId) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await soundRef.current.pauseAsync();
          return;
        }

        await soundRef.current.playAsync();
        return;
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 50 },
        onPlaybackStatus,
      );
      soundRef.current = sound;
      setActiveAudioId(audioId);
      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setActiveAudioPositionMs(status.positionMillis ?? 0);
        setActiveAudioDurationMs(status.durationMillis ?? 0);
        setIsAudioPlaying(Boolean(status.isPlaying));
      }
    } catch {
      // Ignore playback failures and keep chat responsive.
    }
  };

  const seekActiveTrackToRatio = async (ratio: number) => {
    if (!soundRef.current || !activeAudioDurationMs) {
      return;
    }

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const nextPosition = Math.floor(activeAudioDurationMs * clampedRatio);
    void soundRef.current.setPositionAsync(nextPosition);
  };

  const runSendingProgress = () => {
    setSendProgress(4);
    const timer = setInterval(() => {
      setSendProgress((current) => {
        const baseline = current ?? 4;
        if (baseline >= 92) {
          return baseline;
        }
        return baseline + Math.max(2, Math.floor((92 - baseline) * 0.08));
      });
    }, 180);
    return timer;
  };

  const getDownloadFileName = (message: ChatMessage): string => {
    if (message.fileName?.trim()) {
      return message.fileName.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    const fromUrl = message.audioUrl?.split("?")[0]?.split("/").pop();
    if (fromUrl?.trim()) {
      return fromUrl.trim().replace(/[^a-zA-Z0-9._-]/g, "_");
    }

    return `audio-${Date.now()}.mp3`;
  };

  const handleSaveAudioFile = async (message: ChatMessage) => {
    if (!message.audioUrl) {
      return;
    }

    setSavingAudioId(message.id);
    setSaveProgress(0);

    try {
      const rootDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      if (!rootDir) {
        throw new Error("Could not access local storage directory");
      }

      const targetUri = `${rootDir}${getDownloadFileName(message)}`;
      const download = FileSystem.createDownloadResumable(
        message.audioUrl,
        targetUri,
        {},
        (progress) => {
          const total = progress.totalBytesExpectedToWrite;
          if (total > 0) {
            setSaveProgress((progress.totalBytesWritten / total) * 100);
          } else {
            setSaveProgress(null);
          }
        },
      );

      const result = await download.downloadAsync();
      if (!result?.uri) {
        throw new Error("Download did not return a file URI");
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri, {
          dialogTitle: "Save audio file",
          mimeType: "audio/*",
        });
      }

      Alert.alert(
        "Audio ready",
        canShare
          ? "Download completed. Choose where to save it from the share sheet."
          : `Saved to: ${result.uri}`,
      );
    } catch (error: unknown) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Could not save audio file",
      );
    } finally {
      setSavingAudioId(null);
      setSaveProgress(null);
    }
  };

  const handlePickAudioFile = async () => {
    if (!onSendAudioMessage || isSendingAudio) {
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/*"],
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return;
    }

    const picked = result.assets[0];
    const durationMs = await probeAudioDuration(picked.uri);
    const previewWaveformMeta = buildPreviewWaveformMeta(durationMs);

    // Show pending attachment immediately. Canonical waveform is filled by worker.
    const initialAttachment = {
      kind: "audio-file" as const,
      uri: picked.uri,
      name: picked.name,
      mimeType: picked.mimeType ?? undefined,
      durationMs,
      waveformAmplitudes: undefined,
      waveformCoverageMs: previewWaveformMeta.waveformCoverageMs ?? undefined,
      waveformSource: previewWaveformMeta.waveformSource,
      isExtractingWaveform: false,
    };
    setPendingAttachment(initialAttachment);
  };

  const startRecording = async () => {
    if (!onSendAudioMessage || isSendingAudio || isRecording) {
      return;
    }

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });

    const recording = new Audio.Recording();
    recordingMeteringRef.current = [];
    recording.setProgressUpdateInterval(METERING_SAMPLE_INTERVAL_MS);
    recording.setOnRecordingStatusUpdate((status) => {
      if (!status.canRecord || typeof status.metering !== "number") {
        return;
      }
      recordingMeteringRef.current.push(status.metering);
    });

    const recordingPreset = Audio.RecordingOptionsPresets.HIGH_QUALITY as any;
    await recording.prepareToRecordAsync({
      ...recordingPreset,
      android: {
        ...recordingPreset.android,
        isMeteringEnabled: true,
      },
      ios: {
        ...recordingPreset.ios,
        isMeteringEnabled: true,
      },
    } as any);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording || !onSendAudioMessage || isSendingAudio) {
      return;
    }

    setIsSendingAudio(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        staysActiveInBackground: false,
      });

      if (uri) {
        const durationMs = await probeAudioDuration(uri);
        const waveformAmplitudes = buildWaveformFromMeteringSamples(
          recordingMeteringRef.current,
        );
        console.log("[ChatScreen] Voice recording waveform extracted:", {
          duration: durationMs,
          metering: {
            samples: recordingMeteringRef.current.length,
            min: Math.min(...recordingMeteringRef.current),
            max: Math.max(...recordingMeteringRef.current),
            avg:
              recordingMeteringRef.current.reduce((a, b) => a + b, 0) /
              recordingMeteringRef.current.length,
          },
          amplitudes: waveformAmplitudes,
        });
        setPendingAttachment({
          kind: "voice-note",
          uri,
          name: `voice-${Date.now()}.m4a`,
          mimeType: "audio/m4a",
          durationMs,
          waveformAmplitudes,
          waveformCoverageMs: durationMs,
          waveformSource: "metering",
        });
      }
    } finally {
      setIsSendingAudio(false);
    }
  };

  const handleMicPress = async () => {
    if (isRecording) {
      await stopRecording();
      return;
    }

    await startRecording();
  };

  const sendMessage = async () => {
    if (pendingAttachment) {
      const timer = runSendingProgress();
      setIsSendingAudio(true);
      try {
        if (onSendAudioMessage) {
          await onSendAudioMessage({
            uri: pendingAttachment.uri,
            kind: pendingAttachment.kind,
            name: pendingAttachment.name,
            mimeType: pendingAttachment.mimeType,
            durationMs: pendingAttachment.durationMs,
            waveformAmplitudes: pendingAttachment.waveformAmplitudes,
            waveformCoverageMs: pendingAttachment.waveformCoverageMs,
            waveformSource: pendingAttachment.waveformSource,
          });
        } else {
          setLocalMessages((previous) => [
            ...previous,
            {
              id: `msg-${previous.length + 1}`,
              kind:
                pendingAttachment.kind === "voice-note"
                  ? "outgoing-voice"
                  : "outgoing-audio-file",
              time: "Now",
              audioUrl: pendingAttachment.uri,
              fileName: pendingAttachment.name,
              durationMs: pendingAttachment.durationMs,
              waveformAmplitudes: pendingAttachment.waveformAmplitudes,
              waveformCoverageMs: pendingAttachment.waveformCoverageMs,
              waveformSource: pendingAttachment.waveformSource,
            },
          ]);
        }

        setSendProgress(100);
        setPendingAttachment(null);
      } finally {
        clearInterval(timer);
        setTimeout(() => {
          setSendProgress(null);
        }, 240);
        setIsSendingAudio(false);
      }

      requestAnimationFrame(() => {
        jumpToBottom();
      });
      return;
    }

    const next = draft.trim();
    if (!next) {
      return;
    }

    if (onSendMessage) {
      await onSendMessage(next);
    } else {
      setLocalMessages((previous) => [
        ...previous,
        {
          id: `msg-${previous.length + 1}`,
          kind: "outgoing",
          text: next,
          time: "Now",
        },
      ]);
    }
    setDraft("");

    requestAnimationFrame(() => {
      jumpToBottom();
    });
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        {...swipeBackResponder.panHandlers}
      >
        <View style={styles.flex}>
          <View style={[styles.headerWrap, { paddingTop: insets.top + 2 }]}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Pressable
                  onPress={onBack}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={22}
                    color={palette.primary}
                  />
                </Pressable>

                <View>
                  <Text style={styles.headerName}>
                    {collaboratorDisplayName}
                  </Text>
                  <Text style={styles.headerStatus}>
                    {isCollaboratorActive ? "Active Now" : "Offline"}
                  </Text>
                </View>
              </View>

              <View style={styles.headerRight}>
                <Pressable
                  onPress={handleOpenCollaboratorProfile}
                  style={({ pressed }) => [
                    styles.headerAvatarWrap,
                    pressed && styles.pressed,
                  ]}
                >
                  <Image
                    source={{ uri: resolvedCollaboratorAvatar }}
                    style={styles.headerAvatar}
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.chatContent,
              { paddingBottom: contentBottomInset },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={handleScroll}
          >
            <View style={styles.dayMarkerWrap}>
              <Text style={styles.dayMarkerText}>Today</Text>
            </View>

            {isLoading && visibleMessages.length === 0 ? (
              <View style={styles.loadingMessagesWrap}>
                <ActivityIndicator color={palette.primary} />
                <Text style={styles.loadingMessagesText}>
                  Loading messages...
                </Text>
              </View>
            ) : null}

            {visibleMessages.map((message) => {
              if (message.kind === "incoming") {
                return (
                  <View key={message.id} style={styles.messageWrapIncoming}>
                    <View style={styles.bubbleIncoming}>
                      <Text style={styles.messageText}>{message.text}</Text>
                      <Text style={styles.senderLabel}>
                        {getMessageSenderName(message.kind)}
                      </Text>
                    </View>
                    <Text style={styles.timeIncoming}>{message.time}</Text>
                  </View>
                );
              }

              if (
                message.kind === "incoming-voice" ||
                message.kind === "outgoing-voice" ||
                message.kind === "incoming-audio-file" ||
                message.kind === "outgoing-audio-file"
              ) {
                const isOutgoingAudio =
                  message.kind === "outgoing-voice" ||
                  message.kind === "outgoing-audio-file";
                const isVoice =
                  message.kind === "incoming-voice" ||
                  message.kind === "outgoing-voice";
                const isActive = activeAudioId === message.id;
                const messageDurationMs =
                  message.durationMs ?? message.waveformCoverageMs ?? 0;
                const durationMs = isActive
                  ? activeAudioDurationMs
                  : messageDurationMs;
                const positionMs = isActive ? activeAudioPositionMs : 0;
                const progressRatio =
                  durationMs > 0 ? positionMs / durationMs : 0;
                const isSavingThisMessage = savingAudioId === message.id;
                return (
                  <View
                    key={message.id}
                    style={
                      isOutgoingAudio
                        ? styles.messageWrapOutgoing
                        : styles.messageWrapIncoming
                    }
                  >
                    <View
                      style={[
                        styles.bubbleIncoming,
                        styles.audioBubble,
                        isOutgoingAudio && styles.audioBubbleOutgoing,
                      ]}
                    >
                      <View style={styles.audioRow}>
                        <Pressable
                          onPress={() =>
                            void toggleTrackPlayback(
                              message.id,
                              message.audioUrl,
                            )
                          }
                          style={({ pressed }) => [
                            styles.audioPlayButton,
                            isOutgoingAudio && styles.audioPlayButtonOutgoing,
                            pressed && styles.pressed,
                          ]}
                        >
                          <MaterialIcons
                            name={
                              isActive && isAudioPlaying
                                ? "pause"
                                : "play-arrow"
                            }
                            size={22}
                            color={
                              isOutgoingAudio ? "#39008c" : palette.primary
                            }
                          />
                        </Pressable>

                        <View style={styles.audioMetaWrap}>
                          <AudioWaveform
                            amplitudes={message.waveformAmplitudes}
                            seedKey={`chat-${message.id}`}
                            progressRatio={progressRatio}
                            onSeekRatio={
                              isActive
                                ? (ratio) => {
                                    void seekActiveTrackToRatio(ratio);
                                  }
                                : undefined
                            }
                            height={24}
                            playedColor="rgba(186,158,255,0.9)"
                            unplayedColor="rgba(255,255,255,0.16)"
                          />
                          <View style={styles.audioTimesRow}>
                            <Text style={styles.audioMetaText}>
                              {`${formatDuration(positionMs)} / ${formatDuration(durationMs)}`}
                            </Text>
                            <Text style={styles.audioMetaText}>
                              {isVoice
                                ? "Voice message"
                                : (message.fileName ?? "Audio file")}
                            </Text>
                          </View>
                          <Text style={styles.audioSenderLabel}>
                            {getMessageSenderName(message.kind)}
                          </Text>

                          {!isVoice ? (
                            <View style={styles.audioFileActionsRow}>
                              <Pressable
                                onPress={() =>
                                  void handleSaveAudioFile(message)
                                }
                                disabled={
                                  savingAudioId !== null && !isSavingThisMessage
                                }
                                style={({ pressed }) => [
                                  styles.saveButton,
                                  savingAudioId !== null &&
                                    !isSavingThisMessage &&
                                    styles.disabledButton,
                                  pressed && styles.pressed,
                                ]}
                              >
                                {isSavingThisMessage ? (
                                  <ActivityIndicator
                                    size="small"
                                    color={palette.primary}
                                  />
                                ) : (
                                  <MaterialIcons
                                    name="download"
                                    size={16}
                                    color={palette.primary}
                                  />
                                )}
                                <Text style={styles.saveButtonText}>
                                  {isSavingThisMessage
                                    ? `Saving${saveProgress !== null ? ` ${Math.round(saveProgress)}%` : "..."}`
                                    : "Save file"}
                                </Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                    <Text
                      style={
                        isOutgoingAudio
                          ? styles.timeOutgoing
                          : styles.timeIncoming
                      }
                    >
                      {message.time}
                    </Text>
                  </View>
                );
              }

              return (
                <View key={message.id} style={styles.messageWrapOutgoing}>
                  <LinearGradient
                    colors={[palette.primary, palette.primaryDim]}
                    start={{ x: 0.1, y: 0 }}
                    end={{ x: 0.9, y: 1 }}
                    style={styles.bubbleOutgoing}
                  >
                    <Text style={styles.messageTextOutgoing}>
                      {message.text}
                    </Text>
                    <Text style={styles.senderLabel}>You</Text>
                  </LinearGradient>
                  <Text style={styles.timeOutgoing}>{message.time}</Text>
                </View>
              );
            })}
          </ScrollView>

          {!isAtBottom ? (
            <View
              style={[
                styles.jumpWrap,
                { bottom: Math.max(insets.bottom + 82, 82) },
              ]}
            >
              <Pressable
                onPress={jumpToBottom}
                style={({ pressed }) => [
                  styles.jumpButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="keyboard-double-arrow-down"
                  size={17}
                  color={palette.primary}
                />
                <Text style={styles.jumpText}>Jump to bottom</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composerOuter}>
            <View
              style={[
                styles.composerWrap,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
            >
              {pendingAttachment ? (
                <View style={styles.pendingWrap}>
                  <View style={styles.pendingHeaderRow}>
                    <View style={styles.pendingTypeRow}>
                      <MaterialIcons
                        name={
                          pendingAttachment.kind === "voice-note"
                            ? "keyboard-voice"
                            : "audiotrack"
                        }
                        size={16}
                        color={palette.primary}
                      />
                      <Text style={styles.pendingTitle}>
                        {pendingAttachment.kind === "voice-note"
                          ? "Voice message"
                          : (pendingAttachment.name ?? "Audio file")}
                      </Text>
                    </View>

                    <Pressable
                      onPress={() => {
                        if (activeAudioId === "__pending__") {
                          void soundRef.current?.stopAsync();
                          setActiveAudioId(null);
                          setIsAudioPlaying(false);
                          setActiveAudioPositionMs(0);
                        }
                        setPendingAttachment(null);
                      }}
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                      <MaterialIcons
                        name="close"
                        size={18}
                        color={palette.textSecondary}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.pendingAudioRow}>
                    <Pressable
                      onPress={() =>
                        void toggleTrackPlayback(
                          "__pending__",
                          pendingAttachment.uri,
                        )
                      }
                      style={({ pressed }) => [
                        styles.audioPlayButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MaterialIcons
                        name={
                          activeAudioId === "__pending__" && isAudioPlaying
                            ? "pause"
                            : "play-arrow"
                        }
                        size={22}
                        color={palette.primary}
                      />
                    </Pressable>

                    <View style={styles.audioMetaWrap}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <AudioWaveform
                            amplitudes={pendingAttachment.waveformAmplitudes}
                            seedKey="chat-pending-attachment"
                            progressRatio={
                              activeAudioId === "__pending__" &&
                              activeAudioDurationMs > 0
                                ? activeAudioPositionMs / activeAudioDurationMs
                                : 0
                            }
                            onSeekRatio={
                              activeAudioId === "__pending__"
                                ? (ratio) => {
                                    void seekActiveTrackToRatio(ratio);
                                  }
                                : undefined
                            }
                            height={24}
                            playedColor="rgba(186,158,255,0.9)"
                            unplayedColor="rgba(255,255,255,0.16)"
                          />
                        </View>
                        {pendingAttachment.isExtractingWaveform ? (
                          <ActivityIndicator
                            size="small"
                            color={palette.primary}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.audioMetaText}>
                        {`${formatDuration(
                          activeAudioId === "__pending__"
                            ? activeAudioPositionMs
                            : 0,
                        )} / ${formatDuration(
                          activeAudioId === "__pending__"
                            ? activeAudioDurationMs
                            : (pendingAttachment.durationMs ?? 0),
                        )}`}
                      </Text>
                    </View>
                  </View>

                  {sendProgress !== null ? (
                    <View style={styles.sendProgressWrap}>
                      <View style={styles.sendProgressTrack}>
                        <View
                          style={[
                            styles.sendProgressFill,
                            {
                              width: `${Math.max(0, Math.min(100, sendProgress))}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.sendProgressLabel}>
                        Uploading {Math.round(sendProgress)}%
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.composerShell}>
                <Pressable
                  onPress={() => void handlePickAudioFile()}
                  style={({ pressed }) => [
                    styles.composerIconButton,
                    (isSendingAudio || !onSendAudioMessage) &&
                      styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                  disabled={isSendingAudio || !onSendAudioMessage}
                >
                  <MaterialIcons
                    name="add"
                    size={22}
                    color={palette.textSecondary}
                  />
                </Pressable>

                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={`Message ${collaboratorDisplayName}...`}
                  placeholderTextColor="rgba(173,170,170,0.4)"
                  style={styles.composerInput}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={() => void sendMessage()}
                />

                <Pressable
                  onPress={() => void handleMicPress()}
                  style={({ pressed }) => [
                    styles.composerIconButton,
                    (isSendingAudio || !onSendAudioMessage) &&
                      styles.disabledButton,
                    isRecording && styles.recordingButton,
                    pressed && styles.pressed,
                  ]}
                  disabled={isSendingAudio || !onSendAudioMessage}
                >
                  <MaterialIcons
                    name={isRecording ? "stop" : "mic"}
                    size={21}
                    color={
                      isRecording ? palette.primary : palette.textSecondary
                    }
                  />
                </Pressable>

                <Pressable
                  onPress={() => void sendMessage()}
                  style={({ pressed }) => [
                    styles.sendButton,
                    (isSendingAudio ||
                      (draft.trim().length === 0 && !pendingAttachment)) &&
                      styles.disabledButton,
                    pressed && styles.pressed,
                  ]}
                  disabled={
                    isSendingAudio ||
                    (draft.trim().length === 0 && !pendingAttachment)
                  }
                >
                  {isSendingAudio ? (
                    <ActivityIndicator size="small" color="#39008c" />
                  ) : (
                    <MaterialIcons name="send" size={18} color="#39008c" />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={isProfilePreviewVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setIsProfilePreviewVisible(false);
          void releaseProfileTrack();
          setActiveProfileTrackId(null);
          setIsProfileTrackPlaying(false);
          setProfileTrackPositionMs(0);
        }}
      >
        <SafeAreaView style={styles.profileScreenSafeArea}>
          <View style={styles.profileScreenHeader}>
            <View>
              <Text style={styles.profileScreenTitle}>Profile</Text>
              <Text style={styles.profileScreenSubtitle}>
                Collaborator view
              </Text>
            </View>

            <Pressable
              onPress={() => {
                setIsProfilePreviewVisible(false);
                void releaseProfileTrack();
                setActiveProfileTrackId(null);
                setIsProfileTrackPlaying(false);
                setProfileTrackPositionMs(0);
              }}
              style={({ pressed }) => [
                styles.profileScreenCloseButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="close"
                size={22}
                color={palette.textPrimary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.profileScreenScroll}
            contentContainerStyle={styles.profileScreenScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileHeroSection}>
              <Image
                source={{ uri: resolvedCollaboratorAvatar }}
                style={styles.profileModalAvatar}
              />
              <Text style={styles.profileModalName}>
                {collaboratorDisplayName}
              </Text>
              <Text style={styles.profileModalStatus}>
                {isCollaboratorActive ? "Active now" : "Offline"}
              </Text>

              <View style={styles.profileMetaRow}>
                <Text style={styles.profileMetaText}>
                  {collaboratorDetails?.role?.trim() || "Collaborator"}
                </Text>
                <Text style={styles.profileMetaDot}>•</Text>
                <Text style={styles.profileMetaText}>
                  {collaboratorDetails?.location?.trim() ||
                    "Location unavailable"}
                </Text>
              </View>
            </View>

            <View style={styles.profileSectionCard}>
              <Text style={styles.profileSectionLabel}>Bio</Text>
              <Text style={styles.profileSectionBody}>
                {collaboratorDetails?.bio?.trim() || "No bio shared yet."}
              </Text>
            </View>

            <View style={styles.profileSectionCard}>
              <Text style={styles.profileSectionLabel}>Genres</Text>
              {collaboratorDetails?.genres?.length ? (
                <View style={styles.profileGenresRow}>
                  {collaboratorDetails.genres.map((genre) => (
                    <View
                      key={`genre-${genre}`}
                      style={styles.profileGenreChip}
                    >
                      <Text style={styles.profileGenreText}>{genre}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.profileSectionBodyMuted}>
                  No genres added yet.
                </Text>
              )}
            </View>

            <View style={styles.profileSectionCard}>
              <Text style={styles.profileSectionLabel}>Portfolio</Text>
              {orderedPortfolioTracks.length ? (
                <View style={styles.profileTrackList}>
                  {orderedPortfolioTracks.map((track, index) => {
                    const isActiveTrack = activeProfileTrackId === track.id;
                    const canPlayTrack = Boolean(track.previewUrl);
                    const activeDuration =
                      profileTrackDurationMs > 0
                        ? profileTrackDurationMs
                        : (track.durationSec ?? 0) * 1000;
                    return (
                      <View key={track.id} style={styles.profileTrackItem}>
                        <Text style={styles.profileTrackTitle}>
                          {index === 0
                            ? `Signature: ${track.title}`
                            : track.title}
                        </Text>
                        <Text style={styles.profileTrackMeta}>
                          {`${track.genre} · ${formatTrackDuration(track.durationSec)}`}
                        </Text>

                        <AudioWaveform
                          amplitudes={track.waveformAmplitudes}
                          seedKey={`chat-profile-${track.id}`}
                          progressRatio={
                            isActiveTrack && activeDuration > 0
                              ? profileTrackPositionMs / activeDuration
                              : 0
                          }
                          onSeekRatio={
                            canPlayTrack
                              ? (ratio) => {
                                  void seekProfileTrackToRatio(track, ratio);
                                }
                              : undefined
                          }
                          height={26}
                          playedColor="rgba(186,158,255,0.86)"
                          unplayedColor="rgba(255,255,255,0.2)"
                        />

                        <View style={styles.profileTrackActionsRow}>
                          <Text style={styles.profileTrackProgressText}>
                            {isActiveTrack
                              ? `${formatDuration(profileTrackPositionMs)} / ${formatDuration(activeDuration)}`
                              : `00:00 / ${formatDuration((track.durationSec ?? 0) * 1000)}`}
                          </Text>

                          <Pressable
                            onPress={() => void toggleProfileTrack(track)}
                            disabled={!canPlayTrack || isProfileTrackLoading}
                            style={({ pressed }) => [
                              styles.profileTrackPlayButton,
                              (!canPlayTrack || isProfileTrackLoading) &&
                                styles.disabledButton,
                              pressed && styles.pressed,
                            ]}
                          >
                            <MaterialIcons
                              name={
                                isActiveTrack && isProfileTrackPlaying
                                  ? "pause"
                                  : "play-arrow"
                              }
                              size={16}
                              color={palette.primary}
                            />
                            <Text style={styles.profileTrackPlayText}>
                              {!canPlayTrack
                                ? "No preview"
                                : isActiveTrack && isProfileTrackPlaying
                                  ? "Pause"
                                  : "Play"}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.profileSectionBodyMuted}>
                  No portfolio tracks shared yet.
                </Text>
              )}
            </View>

            <View style={styles.profileBottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  flex: {
    flex: 1,
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  headerWrap: {
    backgroundColor: "rgba(8,8,8,0.56)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
  },
  headerRow: {
    height: 64,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  headerStatus: {
    marginTop: 2,
    color: "rgba(186,158,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  headerAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerAvatar: {
    width: "100%",
    height: "100%",
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chatContent: {
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  dayMarkerWrap: {
    alignSelf: "center",
    marginVertical: 10,
    backgroundColor: palette.surfaceContainerLow,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  dayMarkerText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "rgba(173,170,170,0.45)",
    fontFamily: "Inter_500Medium",
  },
  loadingMessagesWrap: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  loadingMessagesText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  messageWrapIncoming: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    gap: 4,
  },
  messageWrapOutgoing: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    gap: 4,
  },
  bubbleIncoming: {
    backgroundColor: palette.surfaceContainerLow,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  bubbleOutgoing: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  audioBubble: {
    width: "100%",
    minWidth: 260,
  },
  audioBubbleOutgoing: {
    backgroundColor: "rgba(186,158,255,0.16)",
  },
  messageText: {
    color: palette.textPrimary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  senderLabel: {
    marginTop: 8,
    color: "rgba(186,158,255,0.74)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  messageTextOutgoing: {
    color: "#2b006e",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_500Medium",
  },
  timeIncoming: {
    marginLeft: 2,
    color: "rgba(173,170,170,0.52)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  timeOutgoing: {
    marginRight: 2,
    textAlign: "right",
    color: "rgba(173,170,170,0.52)",
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  audioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  audioPlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(186,158,255,0.2)",
  },
  audioPlayButtonOutgoing: {
    backgroundColor: palette.primary,
  },
  audioMetaWrap: {
    flex: 1,
    gap: 6,
  },
  audioTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  audioMetaText: {
    color: palette.textSecondary,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  audioSenderLabel: {
    color: "rgba(186,158,255,0.74)",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  jumpWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 11,
  },
  jumpButton: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(32,31,31,0.82)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  jumpText: {
    color: palette.primary,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  composerOuter: {
    backgroundColor: "rgba(8,8,8,0.56)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.04)",
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(8,8,8,0.56)",
  },
  pendingWrap: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    backgroundColor: palette.surfaceContainerHigh,
    padding: 10,
    marginBottom: 10,
    gap: 8,
  },
  pendingHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pendingTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  pendingTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  pendingAudioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sendProgressWrap: {
    gap: 5,
  },
  sendProgressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  sendProgressFill: {
    height: "100%",
    backgroundColor: palette.primary,
  },
  sendProgressLabel: {
    color: palette.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  audioFileActionsRow: {
    marginTop: 2,
    alignItems: "flex-start",
  },
  saveButton: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.35)",
    backgroundColor: "rgba(186,158,255,0.08)",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveButtonText: {
    color: palette.primary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  composerShell: {
    minHeight: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: palette.surfaceContainerHigh,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 2,
  },
  composerInput: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  composerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledButton: {
    opacity: 0.45,
  },
  recordingButton: {
    backgroundColor: "rgba(186,158,255,0.16)",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.95 }],
  },
  profileScreenSafeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  profileScreenHeader: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(8,8,8,0.66)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  profileScreenTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    letterSpacing: -0.4,
    fontFamily: "Inter_700Bold",
  },
  profileScreenSubtitle: {
    marginTop: 1,
    color: palette.textSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.9,
    fontFamily: "Inter_500Medium",
  },
  profileScreenCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  profileScreenScroll: {
    flex: 1,
  },
  profileScreenScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 10,
  },
  profileHeroSection: {
    alignItems: "center",
    paddingVertical: 6,
    gap: 6,
  },
  profileModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  profileModalCard: {
    width: "100%",
    maxWidth: 320,
    maxHeight: "84%",
    borderRadius: 20,
    backgroundColor: palette.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  profileModalScroll: {
    width: "100%",
  },
  profileModalScrollContent: {
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 10,
  },
  profileModalAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  profileModalName: {
    marginTop: 4,
    color: palette.textPrimary,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  profileModalStatus: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  profileMetaDot: {
    color: palette.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  profileMetaText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  profileSectionCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    gap: 8,
  },
  profileSectionLabel: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
  profileSectionBody: {
    color: palette.textPrimary,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  profileSectionBodyMuted: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  profileGenresRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  profileGenreChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.26)",
    backgroundColor: "rgba(186,158,255,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  profileGenreText: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Inter_600SemiBold",
  },
  profileTrackList: {
    gap: 7,
  },
  profileTrackItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 2,
  },
  profileTrackTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  profileTrackMeta: {
    color: palette.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  profileTrackActionsRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  profileTrackProgressText: {
    color: palette.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  profileTrackPlayButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.35)",
    backgroundColor: "rgba(186,158,255,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileTrackPlayText: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_700Bold",
  },
  profileBottomSpacer: {
    height: 20,
  },
  profileModalCloseButton: {
    marginTop: 10,
    minWidth: 96,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(186,158,255,0.12)",
  },
  profileModalCloseText: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
