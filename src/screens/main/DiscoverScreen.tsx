import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio, AVPlaybackStatus } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AudioWaveform } from "../../components/AudioWaveform";
import { MainBottomNav } from "../../components/MainBottomNav";
import { withDefaultAvatar } from "../../config/constants";
import { APP_COLORS } from "../../constants/theme";

type DiscoverProfile = {
  id: string;
  name: string;
  role: string;
  city: string;
  verified: boolean;
  imageUrl: string;
  bio?: string | null;
  genres?: string[];
  tracks?: DiscoverTrack[];
  signatureTrack?: DiscoverTrack | null;
};

type DiscoverTrack = {
  id: string;
  title: string;
  genre: string;
  durationSec: number;
  previewUrl?: string | null;
  waveformAmplitudes?: number[];
};

type DiscoverScreenProps = {
  profiles?: DiscoverProfile[];
  isLoadingProfiles?: boolean;
  onSwipe?: (profileId: string, direction: "left" | "right") => void;
  onOpenMatches?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
};

type DiscoverRoleFilter = "all" | string;
type SwipeFeedback = "liked" | "passed";

const palette = {
  background: APP_COLORS.backgroundStrong,
  surfaceContainerLow: APP_COLORS.surfaceLow,
  surfaceContainerHigh: APP_COLORS.surfaceHigh,
  surfaceContainerHighest: APP_COLORS.surfaceHighest,
  onSurface: APP_COLORS.textPrimary,
  onSurfaceVariant: APP_COLORS.textSecondary,
  primary: APP_COLORS.primaryStrong,
  primaryDim: APP_COLORS.primaryDimStrong,
  onPrimary: APP_COLORS.white,
  error: APP_COLORS.error,
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const SWIPE_THRESHOLD = 120;
const SWIPE_OUT_X = SCREEN_WIDTH + 120;

const DEFAULT_PROFILES: DiscoverProfile[] = [
  {
    id: "julian-vane",
    name: "Julian Vane",
    role: "Producer",
    city: "Berlin, Germany",
    verified: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDr20gFZDCBbMIiy5u-wvEDdEuUHnKWzYgRZDvjJJAQqLT287TOSNRSz2zw5virtC6YgNIvTznX8gFj8ttzJ5DOd5DRbMWrPjJpCPG-3GIIgMtWNS3o_GpKnu3wxwWDNSc2W4HcaiBiG2XCYlfE7V5BDVYCl3uVUFZyJWSQ0LFXqUbocuQck5DHhMoMNJ-dKT6YCiZThlk_CF5gbHvaakmsytqK_PtE5nhNzwzRck3up7uqJTAKMopjAiqwvVo3lorNyCG1o1MPCP2W",
  },
  {
    id: "naomi-k",
    name: "Naomi K",
    role: "Vocalist",
    city: "London, UK",
    verified: true,
    imageUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1600&auto=format&fit=crop",
  },
  {
    id: "renzo-arc",
    name: "Renzo Arc",
    role: "Mix Engineer",
    city: "Milan, Italy",
    verified: false,
    imageUrl:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1600&auto=format&fit=crop",
  },
];

export function DiscoverScreen({
  profiles,
  isLoadingProfiles,
  onSwipe,
  onOpenMatches,
  onOpenProfile,
  onOpenSettings,
}: DiscoverScreenProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const [activeIndex, setActiveIndex] = useState(0);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [detailProfile, setDetailProfile] = useState<DiscoverProfile | null>(
    null,
  );
  const [currentTrackKey, setCurrentTrackKey] = useState<string | null>(null);
  const [isTrackPlaying, setIsTrackPlaying] = useState(false);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [roleFilter, setRoleFilter] = useState<DiscoverRoleFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [swipeFeedback, setSwipeFeedback] = useState<SwipeFeedback | null>(
    null,
  );
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackRequestIdRef = useRef(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeFeedbackOpacity = useRef(new Animated.Value(0)).current;
  const swipeFeedbackScale = useRef(new Animated.Value(0.95)).current;
  const baseProfiles = profiles ?? DEFAULT_PROFILES;
  const availableRoles = useMemo(
    () =>
      Array.from(new Set(baseProfiles.map((profile) => profile.role))).sort(),
    [baseProfiles],
  );
  const activeProfiles = useMemo(
    () =>
      baseProfiles.filter((profile) => {
        const roleMatches = roleFilter === "all" || profile.role === roleFilter;
        const verifiedMatches = !verifiedOnly || profile.verified;
        return roleMatches && verifiedMatches;
      }),
    [baseProfiles, roleFilter, verifiedOnly],
  );

  const buildTrackKey = (profileId: string, trackId: string) =>
    `${profileId}:${trackId}`;

  const releaseSound = async () => {
    if (!soundRef.current) return;
    soundRef.current.setOnPlaybackStatusUpdate(null);
    await soundRef.current.unloadAsync();
    soundRef.current = null;
  };

  const onPlaybackUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setIsTrackLoading(false);
        setIsTrackPlaying(false);
      }
      return;
    }

    setIsTrackLoading(status.isBuffering);
    setIsTrackPlaying(status.isPlaying);

    setPositionMillis(status.positionMillis);
    if (status.durationMillis) {
      setDurationMillis(status.durationMillis);
    }

    if (status.didJustFinish) {
      setIsTrackPlaying(false);
      setPositionMillis(0);
    }
  };

  const playTrack = async (profileId: string, track: DiscoverTrack) => {
    if (!track.previewUrl) return;
    const trackKey = buildTrackKey(profileId, track.id);
    const requestId = ++playbackRequestIdRef.current;

    if (currentTrackKey === trackKey && soundRef.current) {
      if (isTrackPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
      return;
    }

    setIsTrackLoading(true);
    try {
      await releaseSound();
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.previewUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 50 },
      );

      if (playbackRequestIdRef.current !== requestId) {
        await sound.unloadAsync();
        return;
      }

      sound.setOnPlaybackStatusUpdate(onPlaybackUpdate);
      soundRef.current = sound;
      setCurrentTrackKey(trackKey);
      setPositionMillis(0);
      setDurationMillis((track.durationSec ?? 0) * 1000);
    } finally {
      if (playbackRequestIdRef.current === requestId) {
        setIsTrackLoading(false);
      }
    }
  };

  const seekTrack = async (
    profileId: string,
    track: DiscoverTrack,
    ratio: number,
  ) => {
    if (!track.previewUrl) return;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const trackKey = buildTrackKey(profileId, track.id);

    if (!soundRef.current || currentTrackKey !== trackKey) {
      await playTrack(profileId, track);
    }

    if (!soundRef.current) return;
    const fallbackDuration = Math.max(0, (track.durationSec ?? 0) * 1000);
    const totalDuration =
      durationMillis > 0 ? durationMillis : fallbackDuration;
    if (!totalDuration) return;

    const nextPosition = Math.floor(totalDuration * clampedRatio);
    void soundRef.current.setPositionAsync(nextPosition);
  };

  useEffect(() => {
    setActiveIndex(0);
    pan.setValue({ x: 0, y: 0 });
  }, [activeProfiles.length, pan]);

  useEffect(() => {
    void Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
    });

    return () => {
      void releaseSound();
    };
  }, []);

  useEffect(() => {
    if (!detailProfile?.tracks?.length) {
      setCurrentTrackKey(null);
      setIsTrackPlaying(false);
      setPositionMillis(0);
      setDurationMillis(0);
      void releaseSound();
    }
  }, [detailProfile?.tracks?.length]);

  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-14deg", "0deg", "14deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const passOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const resetCard = () => {
    pan.setValue({ x: 0, y: 0 });
  };

  const advanceCard = () => {
    if (activeProfiles.length === 0) {
      resetCard();
      return;
    }

    setActiveIndex((prev) => (prev + 1) % activeProfiles.length);
    resetCard();
  };

  const swipeOut = (direction: "left" | "right") => {
    const swiped = activeProfiles[activeIndex];

    setSwipeFeedback(direction === "right" ? "liked" : "passed");
    swipeFeedbackOpacity.setValue(0);
    swipeFeedbackScale.setValue(0.95);
    Animated.sequence([
      Animated.parallel([
        Animated.timing(swipeFeedbackOpacity, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.spring(swipeFeedbackScale, {
          toValue: 1,
          friction: 6,
          tension: 90,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(260),
      Animated.timing(swipeFeedbackOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setSwipeFeedback(null);
      }
    });

    Animated.timing(pan, {
      toValue: { x: direction === "right" ? SWIPE_OUT_X : -SWIPE_OUT_X, y: 0 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      if (swiped) {
        onSwipe?.(swiped.id, direction);
      }
      advanceCard();
    });
  };

  const openProfileDetail = (profile: DiscoverProfile) => {
    void releaseSound();
    setCurrentTrackKey(null);
    setIsTrackPlaying(false);
    setPositionMillis(0);
    setDetailProfile(profile);
    setIsDetailVisible(true);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return "00:00";
    const min = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const sec = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${min}:${sec}`;
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
        onPanResponderMove: (_, gesture) => {
          pan.setValue({ x: gesture.dx, y: gesture.dy * 0.3 });
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > SWIPE_THRESHOLD) {
            swipeOut("right");
            return;
          }

          if (gesture.dx < -SWIPE_THRESHOLD) {
            swipeOut("left");
            return;
          }

          if (Math.abs(gesture.dx) < 8 && Math.abs(gesture.dy) < 8) {
            const tapped = activeProfiles[activeIndex];
            if (tapped) {
              openProfileDetail(tapped);
            }
            return;
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 60,
            useNativeDriver: false,
          }).start();
        },
      }),
    [pan, swipeOut],
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  const active = activeProfiles[activeIndex];
  const activeSignatureTrack =
    active?.signatureTrack ?? active?.tracks?.[0] ?? null;
  const detailOrderedTracks = detailProfile
    ? detailProfile.signatureTrack
      ? [
          detailProfile.signatureTrack,
          ...(detailProfile.tracks ?? []).filter(
            (track) => track.id !== detailProfile.signatureTrack?.id,
          ),
        ]
      : (detailProfile.tracks ?? [])
    : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>WAV</Text>
        </View>

        <Pressable
          onPress={() => setIsFilterVisible(true)}
          style={({ pressed }) => [
            styles.iconButton,
            pressed && styles.pressed,
          ]}
        >
          <MaterialIcons
            name="tune"
            size={22}
            color={
              roleFilter !== "all" || verifiedOnly
                ? palette.primary
                : palette.onSurface
            }
          />
        </Pressable>
      </View>

      <View style={styles.main}>
        <View pointerEvents="none" style={styles.bgGlowLeft} />
        <View pointerEvents="none" style={styles.bgGlowRight} />

        <View style={styles.stackWrap}>
          <View style={styles.stackBack} />
          <View style={styles.stackMid} />

          {swipeFeedback ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.swipeFeedbackTag,
                swipeFeedback === "liked"
                  ? styles.swipeFeedbackLike
                  : styles.swipeFeedbackPass,
                {
                  opacity: swipeFeedbackOpacity,
                  transform: [{ scale: swipeFeedbackScale }],
                },
              ]}
            >
              <Text
                style={[
                  styles.swipeFeedbackText,
                  swipeFeedback === "liked"
                    ? styles.swipeFeedbackTextLike
                    : styles.swipeFeedbackTextPass,
                ]}
              >
                {swipeFeedback === "liked" ? "LIKED" : "PASSED"}
              </Text>
            </Animated.View>
          ) : null}

          {isLoadingProfiles ? (
            <View style={[styles.card, styles.emptyCard]}>
              <ActivityIndicator color={palette.primary} size="large" />
              <Text style={styles.emptyText}>Loading collaborators...</Text>
            </View>
          ) : !active ? (
            <View style={[styles.card, styles.emptyCard]}>
              <MaterialIcons
                name="check-circle"
                size={40}
                color={palette.primary}
              />
              <Text style={styles.emptyText}>
                You have seen all available profiles.
              </Text>
            </View>
          ) : (
            <Animated.View
              {...panResponder.panHandlers}
              style={[
                styles.card,
                {
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { rotate },
                  ],
                },
              ]}
            >
              <View style={styles.imageArea}>
                <Image
                  source={{ uri: withDefaultAvatar(active.imageUrl) }}
                  style={styles.coverImage}
                />
                <LinearGradient
                  colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]}
                  style={styles.imageTopShade}
                />

                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{active.role}</Text>
                </View>

                <View style={styles.audioBars}>
                  <View
                    style={[styles.audioBar, { height: 14, opacity: 0.55 }]}
                  />
                  <View
                    style={[styles.audioBar, { height: 22, opacity: 0.8 }]}
                  />
                  <View
                    style={[styles.audioBar, { height: 12, opacity: 0.5 }]}
                  />
                  <View style={[styles.audioBar, { height: 30, opacity: 1 }]} />
                  <View
                    style={[styles.audioBar, { height: 18, opacity: 0.7 }]}
                  />
                </View>

                <Animated.View
                  style={[styles.likeTag, { opacity: likeOpacity }]}
                >
                  <Text style={styles.likeTagText}>LIKE</Text>
                </Animated.View>
                <Animated.View
                  style={[styles.passTag, { opacity: passOpacity }]}
                >
                  <Text style={styles.passTagText}>PASS</Text>
                </Animated.View>
              </View>

              <View style={styles.cardBody}>
                <View>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{active.name}</Text>
                    {active.verified ? (
                      <MaterialIcons
                        name="verified"
                        size={18}
                        color={palette.primary}
                      />
                    ) : null}
                  </View>

                  <View style={styles.locationRow}>
                    <MaterialIcons
                      name="location-on"
                      size={16}
                      color={palette.onSurfaceVariant}
                    />
                    <Text style={styles.locationText}>{active.city}</Text>
                  </View>

                  <View style={styles.signatureWrap}>
                    <Text style={styles.signatureLabel}>Signature Track</Text>
                    <Text style={styles.signatureTitle} numberOfLines={1}>
                      {active.signatureTrack?.title ?? "No signature track yet"}
                    </Text>
                    {active.signatureTrack ? (
                      <Text style={styles.signatureMeta}>
                        {active.signatureTrack.genre} ·{" "}
                        {formatDuration(active.signatureTrack.durationSec)}
                      </Text>
                    ) : null}
                  </View>

                  {!!active.genres?.length ? (
                    <View style={styles.genreChipsRow}>
                      {active.genres.slice(0, 3).map((genre) => (
                        <View
                          key={`${active.id}-${genre}`}
                          style={styles.genreChip}
                        >
                          <Text style={styles.genreChipText}>{genre}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => {
                      if (active && activeSignatureTrack) {
                        void playTrack(active.id, activeSignatureTrack);
                      }
                    }}
                    disabled={!activeSignatureTrack || isTrackLoading}
                    style={({ pressed }) => [
                      styles.listenBtn,
                      (!activeSignatureTrack || isTrackLoading) &&
                        styles.listenBtnDisabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <LinearGradient
                      colors={[palette.primary, palette.primaryDim]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.listenGradient}
                    >
                      <MaterialIcons
                        name={
                          active &&
                          activeSignatureTrack &&
                          currentTrackKey ===
                            buildTrackKey(active.id, activeSignatureTrack.id) &&
                          isTrackPlaying
                            ? "pause"
                            : "play-arrow"
                        }
                        size={20}
                        color={palette.onPrimary}
                      />
                      <Text style={styles.listenText}>
                        {active &&
                        activeSignatureTrack &&
                        currentTrackKey ===
                          buildTrackKey(active.id, activeSignatureTrack.id) &&
                        isTrackPlaying
                          ? "Pause"
                          : "Listen"}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.swipePanelWrap, { paddingBottom: insets.bottom + 78 }]}
      >
        <View style={styles.swipePanel}>
          <Pressable
            onPress={() => swipeOut("left")}
            style={({ pressed }) => [
              styles.choiceBtn,
              styles.passChoiceBtn,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="close" size={18} color={palette.error} />
            <Text style={styles.passChoiceText}>PASS</Text>
          </Pressable>

          <Pressable
            onPress={() => swipeOut("right")}
            style={({ pressed }) => [
              styles.choiceBtn,
              styles.likeChoiceBtn,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="bolt" size={16} color={palette.primary} />
            <Text style={styles.likeChoiceText}>LIKE</Text>
          </Pressable>
        </View>
      </View>

      <MainBottomNav
        activeTab="discover"
        bottomInset={insets.bottom}
        onOpenMatches={onOpenMatches}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
      />

      <Modal
        visible={isFilterVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsFilterVisible(false)}
      >
        <View style={styles.filterOverlay}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={() => setIsFilterVisible(false)}
          />

          <View style={styles.filterSheet}>
            <View style={styles.filterHeaderRow}>
              <Text style={styles.filterTitle}>Filters</Text>
              <Pressable
                onPress={() => setIsFilterVisible(false)}
                style={({ pressed }) => [
                  styles.filterCloseButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={palette.onSurface}
                />
              </Pressable>
            </View>

            <Text style={styles.filterLabel}>Role</Text>
            <View style={styles.filterChipWrap}>
              <Pressable
                onPress={() => setRoleFilter("all")}
                style={({ pressed }) => [
                  styles.filterChip,
                  roleFilter === "all" && styles.filterChipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    roleFilter === "all" && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {availableRoles.map((role) => (
                <Pressable
                  key={role}
                  onPress={() => setRoleFilter(role)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    roleFilter === role && styles.filterChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      roleFilter === role && styles.filterChipTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.filterLabel}>Verification</Text>
            <Pressable
              onPress={() => setVerifiedOnly((prev) => !prev)}
              style={({ pressed }) => [
                styles.verifiedToggle,
                verifiedOnly && styles.verifiedToggleActive,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name={verifiedOnly ? "check-circle" : "radio-button-unchecked"}
                size={18}
                color={
                  verifiedOnly ? palette.primary : palette.onSurfaceVariant
                }
              />
              <Text
                style={[
                  styles.verifiedToggleText,
                  verifiedOnly && styles.verifiedToggleTextActive,
                ]}
              >
                Show verified profiles only
              </Text>
            </Pressable>

            <View style={styles.filterActionsRow}>
              <Pressable
                onPress={() => {
                  setRoleFilter("all");
                  setVerifiedOnly(false);
                }}
                style={({ pressed }) => [
                  styles.filterResetButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.filterResetText}>Reset</Text>
              </Pressable>

              <Pressable
                onPress={() => setIsFilterVisible(false)}
                style={({ pressed }) => [
                  styles.filterApplyButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.filterApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isDetailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setIsDetailVisible(false)}
      >
        <SafeAreaView style={styles.detailFullScreen}>
          <View style={[styles.detailTopBar, { paddingTop: insets.top + 6 }]}>
            <View style={styles.detailHeaderRow}>
              <Text style={styles.detailTitle}>Artist Details</Text>
              <Pressable
                onPress={() => setIsDetailVisible(false)}
                style={({ pressed }) => [
                  styles.detailClose,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={palette.onSurface}
                />
              </Pressable>
            </View>
          </View>

          {detailProfile ? (
            <ScrollView
              style={styles.detailScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.detailScrollContent,
                { paddingBottom: insets.bottom + 110 },
              ]}
            >
              <View style={styles.detailHeroCard}>
                <View style={styles.detailHeroImageWrap}>
                  <Image
                    source={{ uri: withDefaultAvatar(detailProfile.imageUrl) }}
                    style={styles.detailHeroImage}
                  />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]}
                    style={styles.detailHeroShade}
                  />
                  <View style={styles.detailHeroRoleBadge}>
                    <Text style={styles.detailHeroRoleText}>
                      {detailProfile.role}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailHeroBody}>
                  <View style={styles.detailNameRow}>
                    <Text style={styles.detailName}>{detailProfile.name}</Text>
                    {detailProfile.verified ? (
                      <MaterialIcons
                        name="verified"
                        size={18}
                        color={palette.primary}
                      />
                    ) : null}
                  </View>
                  <Text style={styles.detailRoleCity}>
                    {detailProfile.role} · {detailProfile.city}
                  </Text>
                  <Text style={styles.detailBio}>
                    {detailProfile.bio?.trim() || "No bio added yet."}
                  </Text>

                  <View style={styles.detailSignatureCard}>
                    <Text style={styles.detailSectionLabel}>
                      Signature Track
                    </Text>
                    <Text style={styles.detailSignatureTitle} numberOfLines={2}>
                      {detailProfile.signatureTrack?.title ??
                        "No signature track yet"}
                    </Text>
                    {detailProfile.signatureTrack ? (
                      <Text style={styles.detailSignatureMeta}>
                        {detailProfile.signatureTrack.genre} ·{" "}
                        {formatDuration(
                          detailProfile.signatureTrack.durationSec,
                        )}
                      </Text>
                    ) : (
                      <Text style={styles.detailMutedText}>
                        This user has not selected a signature track yet.
                      </Text>
                    )}
                  </View>

                  {!!detailProfile.genres?.length ? (
                    <View style={styles.detailGenresRow}>
                      {detailProfile.genres.map((genre) => (
                        <View
                          key={`${detailProfile.id}-detail-${genre}`}
                          style={styles.detailGenreChip}
                        >
                          <Text style={styles.detailGenreChipText}>
                            {genre}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.detailTracksCard}>
                <Text style={styles.detailSectionLabel}>Tracks</Text>
                {detailOrderedTracks.length === 0 ? (
                  <Text style={styles.detailMutedText}>
                    No tracks shared yet.
                  </Text>
                ) : (
                  detailOrderedTracks.map((track, index) => {
                    const isCurrentTrack =
                      currentTrackKey ===
                      buildTrackKey(detailProfile.id, track.id);
                    const progressPercent = Math.max(
                      0,
                      Math.min(
                        100,
                        isCurrentTrack
                          ? (positionMillis /
                              (durationMillis ||
                                (track.durationSec ?? 0) * 1000 ||
                                1)) *
                              100
                          : 0,
                      ),
                    );
                    const progressRatio = progressPercent / 100;

                    return (
                      <View key={track.id} style={styles.detailTrackItem}>
                        <View style={styles.detailTrackRow}>
                          <View style={styles.detailTrackTextWrap}>
                            <View style={styles.detailTrackLeft}>
                              <MaterialIcons
                                name="audiotrack"
                                size={16}
                                color={palette.primary}
                              />
                              <Text
                                numberOfLines={1}
                                style={styles.detailTrackTitle}
                              >
                                {index === 0
                                  ? `Signature: ${track.title}`
                                  : track.title}
                              </Text>
                            </View>
                            <Text style={styles.detailTrackMeta}>
                              {track.genre} ·{" "}
                              {formatDuration(track.durationSec)}
                            </Text>
                          </View>
                        </View>

                        <AudioWaveform
                          amplitudes={track.waveformAmplitudes}
                          seedKey={`discover-${track.id}`}
                          progressRatio={progressRatio}
                          onSeekRatio={
                            track.previewUrl
                              ? (ratio) => {
                                  void seekTrack(
                                    detailProfile.id,
                                    track,
                                    ratio,
                                  );
                                }
                              : undefined
                          }
                          height={32}
                          playedColor="rgba(139,92,246,0.9)"
                          unplayedColor="rgba(255,255,255,0.2)"
                        />

                        <View style={styles.detailScrubberTimeRow}>
                          <Text style={styles.detailScrubberTimeText}>
                            {isCurrentTrack
                              ? formatDuration(
                                  Math.floor(positionMillis / 1000),
                                )
                              : "00:00"}
                          </Text>
                          <Text style={styles.detailScrubberTimeText}>
                            {formatDuration(track.durationSec)}
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            void playTrack(detailProfile.id, track)
                          }
                          disabled={!track.previewUrl || isTrackLoading}
                          style={({ pressed }) => [
                            styles.detailListenButton,
                            (!track.previewUrl || isTrackLoading) &&
                              styles.detailTrackPlayDisabled,
                            pressed && styles.pressed,
                          ]}
                        >
                          <MaterialIcons
                            name={
                              isCurrentTrack && isTrackPlaying
                                ? "pause"
                                : "play-arrow"
                            }
                            size={18}
                            color={palette.primary}
                          />
                          <Text style={styles.detailListenButtonText}>
                            {isCurrentTrack && isTrackPlaying
                              ? "Pause"
                              : "Listen"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          ) : null}

          <View
            pointerEvents="box-none"
            style={[
              styles.detailSwipePanelWrap,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            <View style={styles.swipePanel}>
              <Pressable
                onPress={() => {
                  setIsDetailVisible(false);
                  swipeOut("left");
                }}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  styles.passChoiceBtn,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="close" size={18} color={palette.error} />
                <Text style={styles.passChoiceText}>PASS</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setIsDetailVisible(false);
                  swipeOut("right");
                }}
                style={({ pressed }) => [
                  styles.choiceBtn,
                  styles.likeChoiceBtn,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons name="bolt" size={16} color={palette.primary} />
                <Text style={styles.likeChoiceText}>LIKE</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    color: palette.onSurfaceVariant,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loaderWrap: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    minHeight: 92,
    paddingHorizontal: 24,
    paddingBottom: 12,
    backgroundColor: "rgba(8,8,8,0.72)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: palette.onSurface,
    fontSize: 44,
    letterSpacing: -1.3,
    fontFamily: "Inter_800ExtraBold",
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  main: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 96,
    paddingBottom: 90,
    justifyContent: "center",
  },
  bgGlowLeft: {
    position: "absolute",
    top: "28%",
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.07)",
  },
  bgGlowRight: {
    position: "absolute",
    bottom: "15%",
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(192,140,247,0.07)",
  },
  stackWrap: {
    width: "100%",
    maxWidth: 420,
    height: "100%",
    maxHeight: 620,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  stackBack: {
    position: "absolute",
    width: "90%",
    height: "95%",
    borderRadius: 30,
    transform: [{ translateY: 12 }, { scale: 0.95 }],
    backgroundColor: palette.surfaceContainerLow,
    opacity: 0.4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  stackMid: {
    position: "absolute",
    width: "95%",
    height: "98%",
    borderRadius: 30,
    transform: [{ translateY: 6 }, { scale: 0.98 }],
    backgroundColor: palette.surfaceContainerHigh,
    opacity: 0.7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  swipeFeedbackTag: {
    position: "absolute",
    top: 18,
    zIndex: 30,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  swipeFeedbackLike: {
    borderColor: palette.primary,
  },
  swipeFeedbackPass: {
    borderColor: palette.error,
  },
  swipeFeedbackText: {
    fontSize: 14,
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  swipeFeedbackTextLike: {
    color: palette.primary,
  },
  swipeFeedbackTextPass: {
    color: palette.error,
  },
  card: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: palette.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  imageArea: {
    position: "relative",
    width: "100%",
    height: "74%",
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  imageTopShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  roleBadge: {
    position: "absolute",
    top: 18,
    left: 18,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(139,92,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
  },
  roleBadgeText: {
    color: palette.primary,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  audioBars: {
    position: "absolute",
    left: 18,
    bottom: 16,
    height: 32,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
  },
  audioBar: {
    width: 4,
    borderRadius: 99,
    backgroundColor: palette.primary,
  },
  likeTag: {
    position: "absolute",
    top: 16,
    right: 16,
    borderWidth: 2,
    borderColor: palette.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  likeTagText: {
    color: palette.primary,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  passTag: {
    position: "absolute",
    top: 16,
    left: 16,
    borderWidth: 2,
    borderColor: palette.error,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  passTagText: {
    color: palette.error,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  cardBody: {
    flex: 1,
    padding: 18,
    justifyContent: "space-between",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  name: {
    fontSize: 30,
    color: palette.onSurface,
    letterSpacing: -0.8,
    fontFamily: "Inter_700Bold",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  locationText: {
    color: palette.onSurfaceVariant,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  signatureWrap: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.24)",
    backgroundColor: "rgba(139,92,246,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  signatureLabel: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  signatureTitle: {
    marginTop: 3,
    color: palette.onSurface,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  signatureMeta: {
    marginTop: 2,
    color: palette.onSurfaceVariant,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  genreChipsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  genreChip: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  genreChipText: {
    color: palette.onSurfaceVariant,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  swipePanelWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  detailSwipePanelWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  swipePanel: {
    width: "100%",
    maxWidth: 440,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(18,18,18,0.88)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  passChoiceBtn: {
    backgroundColor: "rgba(255,110,132,0.12)",
    borderColor: "rgba(255,110,132,0.35)",
  },
  likeChoiceBtn: {
    backgroundColor: "rgba(139,92,246,0.14)",
    borderColor: "rgba(139,92,246,0.4)",
  },
  passChoiceText: {
    color: palette.error,
    letterSpacing: 1,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  likeChoiceText: {
    color: palette.primary,
    letterSpacing: 1,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  listenBtn: {
    borderRadius: 999,
    overflow: "hidden",
  },
  listenBtnDisabled: {
    opacity: 0.5,
  },
  listenGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 999,
  },
  listenText: {
    color: palette.onPrimary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
  filterOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  filterSheet: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    backgroundColor: palette.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 10,
  },
  filterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterTitle: {
    color: palette.onSurface,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  filterCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  filterLabel: {
    marginTop: 4,
    color: palette.onSurfaceVariant,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: "Inter_600SemiBold",
  },
  filterChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  filterChipActive: {
    borderColor: "rgba(139,92,246,0.45)",
    backgroundColor: "rgba(139,92,246,0.14)",
  },
  filterChipText: {
    color: palette.onSurfaceVariant,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  filterChipTextActive: {
    color: palette.primary,
    fontFamily: "Inter_600SemiBold",
  },
  verifiedToggle: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifiedToggleActive: {
    borderColor: "rgba(139,92,246,0.45)",
    backgroundColor: "rgba(139,92,246,0.14)",
  },
  verifiedToggleText: {
    color: palette.onSurfaceVariant,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  verifiedToggleTextActive: {
    color: palette.onSurface,
    fontFamily: "Inter_600SemiBold",
  },
  filterActionsRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  filterResetButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  filterResetText: {
    color: palette.onSurfaceVariant,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  filterApplyButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: palette.primary,
  },
  filterApplyText: {
    color: palette.onPrimary,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  detailFullScreen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  detailTopBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(8,8,8,0.72)",
  },
  detailScroll: {
    flex: 1,
  },
  detailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailTitle: {
    color: palette.onSurface,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  detailClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  detailScrollContent: {
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  detailHeroCard: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: palette.surfaceContainerHigh,
  },
  detailHeroImageWrap: {
    width: "100%",
    height: 220,
  },
  detailHeroImage: {
    width: "100%",
    height: "100%",
  },
  detailHeroShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  detailHeroRoleBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(139,92,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
  },
  detailHeroRoleText: {
    color: palette.primary,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  detailHeroBody: {
    padding: 12,
  },
  detailNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailSignatureCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    backgroundColor: "rgba(139,92,246,0.12)",
    padding: 12,
  },
  detailSectionLabel: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  detailSignatureTitle: {
    marginTop: 4,
    color: palette.onSurface,
    fontSize: 17,
    letterSpacing: -0.3,
    fontFamily: "Inter_700Bold",
  },
  detailSignatureMeta: {
    marginTop: 3,
    color: palette.onSurfaceVariant,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  detailMutedText: {
    marginTop: 6,
    color: palette.onSurfaceVariant,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  detailName: {
    color: palette.onSurface,
    fontSize: 22,
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  detailRoleCity: {
    marginTop: 2,
    color: palette.onSurfaceVariant,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  detailBio: {
    marginTop: 8,
    color: palette.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  detailGenresRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  detailGenreChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  detailGenreChipText: {
    color: palette.onSurfaceVariant,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  detailTracksCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: palette.surfaceContainerHigh,
    padding: 12,
    gap: 8,
  },
  detailTrackRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  detailTrackLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailTrackTextWrap: {
    flex: 1,
  },
  detailTrackTitle: {
    color: palette.onSurface,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  detailTrackMeta: {
    marginTop: 1,
    color: palette.onSurfaceVariant,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  detailTrackPlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    backgroundColor: "rgba(139,92,246,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTrackPlayDisabled: {
    opacity: 0.5,
  },
  detailTrackItem: {
    gap: 8,
  },
  detailScrubberTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  detailScrubberTimeText: {
    color: "rgba(173,170,170,0.78)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  detailListenButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.35)",
    backgroundColor: "rgba(139,92,246,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-end",
  },
  detailListenButtonText: {
    color: palette.primary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
});
