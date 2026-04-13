import type { MusicPreview, Profile, Role } from "@/src/models";
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
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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

type ProfileScreenProps = {
  profile?: Profile | null;
  onOpenDiscover?: () => void;
  onOpenMatches?: () => void;
  onOpenSettings?: () => void;
};

type Tag = {
  id: string;
  label: string;
};

const palette = {
  background: APP_COLORS.backgroundStrong,
  surfaceContainerLow: APP_COLORS.surfaceLow,
  surfaceContainerHigh: APP_COLORS.surfaceMid,
  textPrimary: APP_COLORS.textPrimary,
  textSecondary: APP_COLORS.textSecondary,
  primary: APP_COLORS.primaryStrong,
  primaryDim: APP_COLORS.primaryDim,
};

const profileTags: Tag[] = [
  { id: "audio-producer", label: "Audio Producer" },
  { id: "sound-design", label: "Sound Design" },
  { id: "mixing", label: "Mixing" },
];

const ROLE_STYLE_TAG_PREFIX = "role:";

const ROLE_LABELS: Record<Role, string> = {
  producer: "Producer",
  vocalist: "Vocalist",
  rapper: "Rapper",
  songwriter: "Songwriter",
};

const parseRolesFromStyleTags = (
  styleTags: string[] | undefined,
  fallbackRole?: Role,
): Role[] => {
  const extracted = (styleTags ?? [])
    .map((tag) => {
      if (!tag.startsWith(ROLE_STYLE_TAG_PREFIX)) return null;
      const value = tag.slice(ROLE_STYLE_TAG_PREFIX.length);
      if (
        value === "producer" ||
        value === "vocalist" ||
        value === "rapper" ||
        value === "songwriter"
      ) {
        return value as Role;
      }
      return null;
    })
    .filter((value): value is Role => Boolean(value));

  if (extracted.length) {
    return Array.from(new Set(extracted));
  }

  return fallbackRole ? [fallbackRole] : [];
};

export function ProfileScreen({
  profile,
  onOpenDiscover,
  onOpenMatches,
  onOpenSettings,
}: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackRequestIdRef = useRef(0);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [isDiscoverPreviewVisible, setIsDiscoverPreviewVisible] =
    useState(false);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const displayName = profile?.display_name ?? "Your Profile";
  const selectedRoles = parseRolesFromStyleTags(
    profile?.style_tags,
    profile?.role,
  );
  const rolePills = selectedRoles.length
    ? selectedRoles.map((role) => ROLE_LABELS[role])
    : ["Artist"];
  const discoverRoleLabel = rolePills[0] ?? "Artist";
  const discoverLocation = profile?.location?.trim() || "Remote";
  const bioText =
    profile?.bio?.trim() ||
    "Tell collaborators what you make and what you're looking for.";
  const avatarUri = withDefaultAvatar(profile?.avatar_url);
  const visibleStyleTags = (profile?.style_tags ?? []).filter(
    (tag) => !tag.startsWith(ROLE_STYLE_TAG_PREFIX),
  );
  const tagsToRender: Tag[] =
    profile?.genres?.length || visibleStyleTags.length
      ? [...(profile?.genres ?? []), ...visibleStyleTags].map((tag, index) => ({
          id: `genre-${index}`,
          label: tag,
        }))
      : profileTags;
  const portfolioTracks = profile?.track_previews ?? [];
  const signatureTrackId = portfolioTracks[0]?.id ?? null;
  const orderedPortfolioTracks = useMemo(() => {
    if (!signatureTrackId) {
      return portfolioTracks;
    }
    const signatureTrack = portfolioTracks.find(
      (track) => track.id === signatureTrackId,
    );
    if (!signatureTrack) {
      return portfolioTracks;
    }
    const otherTracks = portfolioTracks.filter(
      (track) => track.id !== signatureTrackId,
    );
    return [signatureTrack, ...otherTracks];
  }, [portfolioTracks, signatureTrackId]);
  const discoverSignatureTrack = orderedPortfolioTracks[0] ?? null;
  const discoverExtraTracks = orderedPortfolioTracks.slice(1);
  const formatDuration = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return "00:00";
    return `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  };

  const releaseSound = async () => {
    if (!soundRef.current) return;
    soundRef.current.setOnPlaybackStatusUpdate(null);
    await soundRef.current.unloadAsync();
    soundRef.current = null;
  };

  const onPlaybackUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        setIsBuffering(false);
        setIsPlaying(false);
      }
      return;
    }

    setIsBuffering(status.isBuffering);
    setIsPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis);
    if (status.durationMillis) {
      setDurationMillis(status.durationMillis);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
    }
  };

  const startTrack = async (track: MusicPreview) => {
    if (!track.preview_url) return;
    const requestId = ++playbackRequestIdRef.current;

    if (currentTrackId === track.id && soundRef.current) {
      if (isPlaying) {
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
        { uri: track.preview_url },
        { shouldPlay: true, progressUpdateIntervalMillis: 50 },
      );

      if (playbackRequestIdRef.current !== requestId) {
        await sound.unloadAsync();
        return;
      }

      sound.setOnPlaybackStatusUpdate(onPlaybackUpdate);
      soundRef.current = sound;
      setCurrentTrackId(track.id);
      setPositionMillis(0);
      setDurationMillis((track.duration_sec ?? 0) * 1000);
    } finally {
      if (playbackRequestIdRef.current === requestId) {
        setIsTrackLoading(false);
      }
    }
  };

  const seekTrack = async (track: MusicPreview, ratio: number) => {
    if (!track.preview_url) return;
    const clampedRatio = Math.max(0, Math.min(1, ratio));

    if (!soundRef.current || currentTrackId !== track.id) {
      await startTrack(track);
    }

    if (!soundRef.current) return;
    const fallbackDuration = Math.max(0, (track.duration_sec ?? 0) * 1000);
    const totalDuration =
      currentTrackId === track.id && durationMillis > 0
        ? durationMillis
        : fallbackDuration;
    if (!totalDuration) return;

    const nextPosition = Math.floor(totalDuration * clampedRatio);
    void soundRef.current.setPositionAsync(nextPosition);
  };

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
    if (!portfolioTracks.length) {
      setCurrentTrackId(null);
      setIsPlaying(false);
      setPositionMillis(0);
      setDurationMillis(0);
      void releaseSound();
      return;
    }

    if (
      currentTrackId &&
      !portfolioTracks.some((track) => track.id === currentTrackId)
    ) {
      setCurrentTrackId(null);
      setIsPlaying(false);
      setPositionMillis(0);
      setDurationMillis(0);
      void releaseSound();
    }
  }, [currentTrackId, portfolioTracks]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 156 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.profilePhotoGlow} />
          <LinearGradient
            colors={[palette.primary, palette.primaryDim]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profilePhotoBorder}
          >
            <View style={styles.profilePhotoInner}>
              <ExpoImage
                source={{ uri: avatarUri }}
                style={styles.profilePhoto}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={160}
              />
            </View>
          </LinearGradient>

          <View style={styles.nameRow}>
            <Text style={styles.name}>{displayName}</Text>
            {profile?.is_verified ? (
              <MaterialIcons
                name="verified"
                size={20}
                color={palette.primary}
              />
            ) : null}
          </View>

          <View style={styles.rolePillsWrap}>
            {rolePills.map((pill) => (
              <View key={pill} style={styles.rolePill}>
                <Text style={styles.rolePillText}>{pill}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.bio}>{bioText}</Text>

          <Pressable
            onPress={() => setIsDiscoverPreviewVisible(true)}
            style={({ pressed }) => [
              styles.previewDiscoverButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons
              name="visibility"
              size={16}
              color={palette.primary}
            />
            <Text style={styles.previewDiscoverButtonText}>
              Preview Discover Card
            </Text>
          </Pressable>

          <View style={styles.tagsWrap}>
            {tagsToRender.map((tag) => (
              <View key={tag.id} style={styles.tagChip}>
                <Text style={styles.tagChipText}>{tag.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.portfolioSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.portfolioTitle}>Portfolio</Text>
            <Text style={styles.sectionAccent}>
              {portfolioTracks.length} Tracks
            </Text>
          </View>

          <View style={styles.portfolioList}>
            {portfolioTracks.length === 0 ? (
              <Text style={styles.emptyStateText}>
                Add tracks from Settings to build your public portfolio.
              </Text>
            ) : null}

            {orderedPortfolioTracks.map((track, index) => {
              const isSignatureTrack = track.id === signatureTrackId;
              const isActiveTrack = currentTrackId === track.id;
              const totalTrackDurationMs =
                isActiveTrack && durationMillis > 0
                  ? durationMillis
                  : (track.duration_sec ?? 0) * 1000;
              const progressRatio = Math.max(
                0,
                Math.min(
                  1,
                  isActiveTrack
                    ? positionMillis / Math.max(1, totalTrackDurationMs)
                    : 0,
                ),
              );

              return (
                <View
                  key={track.id}
                  style={[
                    styles.portfolioListItem,
                    isSignatureTrack && styles.portfolioListItemSignature,
                  ]}
                >
                  <View style={styles.portfolioTrackBody}>
                    <View style={styles.portfolioMetaWrap}>
                      <View style={styles.portfolioNameRow}>
                        <Text style={styles.portfolioName}>{track.title}</Text>
                        {isSignatureTrack ? (
                          <View style={styles.signatureTrackBadge}>
                            <Text style={styles.signatureTrackBadgeText}>
                              Signature
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.portfolioMetaText}>
                        {track.genre} · {formatDuration(track.duration_sec)}
                      </Text>
                      {isSignatureTrack ? (
                        <Text style={styles.signatureTrackHint}>
                          Featured in My Sound above
                        </Text>
                      ) : null}
                    </View>

                    <AudioWaveform
                      amplitudes={track.waveform_amplitudes ?? undefined}
                      seedKey={`${track.id}:${track.title}:${track.genre}`}
                      progressRatio={progressRatio}
                      onSeekRatio={
                        track.preview_url
                          ? (ratio) => {
                              void seekTrack(track, ratio);
                            }
                          : undefined
                      }
                      height={44}
                    />

                    <View style={styles.scrubberTimeRow}>
                      <Text style={styles.scrubberTimeText}>
                        {isActiveTrack
                          ? formatDuration(Math.floor(positionMillis / 1000))
                          : "00:00"}
                      </Text>
                      <Text style={styles.scrubberTimeText}>
                        {formatDuration(
                          Math.floor(totalTrackDurationMs / 1000),
                        )}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => {
                      void startTrack(track);
                    }}
                    disabled={isTrackLoading}
                    style={({ pressed }) => [
                      styles.listenButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons
                      name={isActiveTrack && isPlaying ? "pause" : "play-arrow"}
                      size={18}
                      color={palette.primary}
                    />
                    <Text style={styles.listenButtonText}>
                      {isSignatureTrack ? "Play Signature" : "Listen"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <MainBottomNav
        activeTab="profile"
        bottomInset={insets.bottom}
        onOpenDiscover={onOpenDiscover}
        onOpenMatches={onOpenMatches}
        onOpenSettings={onOpenSettings}
      />

      <Modal
        visible={isDiscoverPreviewVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsDiscoverPreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <Pressable
            style={styles.previewBackdrop}
            onPress={() => setIsDiscoverPreviewVisible(false)}
          />
          <View style={styles.previewSheet}>
            <View style={styles.previewHeaderRow}>
              <Text style={styles.previewTitle}>Discover Preview</Text>
              <Pressable
                onPress={() => setIsDiscoverPreviewVisible(false)}
                style={({ pressed }) => [
                  styles.previewCloseButton,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="close"
                  size={20}
                  color={palette.textPrimary}
                />
              </Pressable>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewImageArea}>
                <ExpoImage
                  source={{ uri: avatarUri }}
                  style={styles.previewImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={140}
                />
                <LinearGradient
                  colors={["rgba(0,0,0,0.62)", "rgba(0,0,0,0)"]}
                  style={styles.previewImageShade}
                />
                <View style={styles.previewRoleBadge}>
                  <Text style={styles.previewRoleBadgeText}>
                    {discoverRoleLabel}
                  </Text>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.previewScrollContent}
              >
                <View style={styles.previewCardBody}>
                  <View style={styles.previewNameRow}>
                    <Text style={styles.previewName}>{displayName}</Text>
                    {profile?.is_verified ? (
                      <MaterialIcons
                        name="verified"
                        size={18}
                        color={palette.primary}
                      />
                    ) : null}
                  </View>
                  <View style={styles.previewLocationRow}>
                    <MaterialIcons
                      name="location-on"
                      size={15}
                      color={palette.textSecondary}
                    />
                    <Text style={styles.previewLocationText}>
                      {discoverLocation}
                    </Text>
                  </View>
                  <Text numberOfLines={4} style={styles.previewBioText}>
                    {bioText}
                  </Text>

                  <View style={styles.previewSignatureCard}>
                    <Text style={styles.previewSectionLabel}>
                      Signature Track
                    </Text>
                    <Text
                      style={styles.previewSignatureTitle}
                      numberOfLines={2}
                    >
                      {discoverSignatureTrack?.title ??
                        "No signature track yet"}
                    </Text>
                    {discoverSignatureTrack ? (
                      <Text style={styles.previewSignatureMeta}>
                        {discoverSignatureTrack.genre} ·{" "}
                        {formatDuration(discoverSignatureTrack.duration_sec)}
                      </Text>
                    ) : (
                      <Text style={styles.previewMutedText}>
                        Add your signature track in Settings so collaborators
                        can hear your strongest work first.
                      </Text>
                    )}
                  </View>

                  {!!tagsToRender.length ? (
                    <View style={styles.previewGenresRow}>
                      {tagsToRender.slice(0, 8).map((tag) => (
                        <View
                          key={`preview-tag-${tag.id}`}
                          style={styles.previewGenreChip}
                        >
                          <Text style={styles.previewGenreChipText}>
                            {tag.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.previewTracksCard}>
                    <Text style={styles.previewSectionLabel}>More Tracks</Text>
                    {discoverExtraTracks.length === 0 ? (
                      <Text style={styles.previewMutedText}>
                        No additional tracks yet.
                      </Text>
                    ) : (
                      discoverExtraTracks.map((track) => (
                        <View
                          key={`preview-track-${track.id}`}
                          style={styles.previewTrackRow}
                        >
                          <MaterialIcons
                            name="audiotrack"
                            size={15}
                            color={palette.primary}
                          />
                          <View style={styles.previewTrackTextWrap}>
                            <Text
                              style={styles.previewTrackTitle}
                              numberOfLines={1}
                            >
                              {track.title}
                            </Text>
                            <Text style={styles.previewTrackMeta}>
                              {track.genre} ·{" "}
                              {formatDuration(track.duration_sec)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    gap: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: palette.textPrimary,
    fontSize: 44,
    letterSpacing: -1.3,
    fontFamily: "Inter_800ExtraBold",
  },
  headerAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  headerAvatar: {
    width: "100%",
    height: "100%",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 94,
    paddingHorizontal: 24,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  profilePhotoGlow: {
    position: "absolute",
    top: -8,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(139,92,246,0.2)",
  },
  profilePhotoBorder: {
    width: 132,
    height: 132,
    borderRadius: 66,
    padding: 4,
    marginBottom: 18,
  },
  profilePhotoInner: {
    flex: 1,
    borderRadius: 62,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: palette.background,
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  name: {
    color: palette.textPrimary,
    fontSize: 34,
    letterSpacing: -0.8,
    fontFamily: "Inter_700Bold",
  },
  rolePillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  rolePill: {
    borderRadius: 999,
    backgroundColor: "rgba(139,92,246,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rolePillText: {
    color: palette.primary,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  bio: {
    maxWidth: 340,
    textAlign: "center",
    color: palette.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  previewDiscoverButton: {
    marginTop: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.36)",
    backgroundColor: "rgba(139,92,246,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewDiscoverButtonText: {
    color: palette.primary,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  tagsWrap: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(73,72,71,0.3)",
    backgroundColor: palette.surfaceContainerHigh,
  },
  tagChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  sectionHeaderRow: {
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionAccent: {
    color: palette.primary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  portfolioSection: {
    marginBottom: 8,
  },
  portfolioTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  portfolioList: {
    gap: 10,
  },
  portfolioListItem: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: palette.surfaceContainerLow,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 10,
  },
  portfolioListItemSignature: {
    borderColor: "rgba(186,158,255,0.34)",
    backgroundColor: "rgba(32,25,45,0.42)",
  },
  portfolioTrackBody: {
    flex: 1,
    gap: 8,
  },
  portfolioMetaWrap: {
    flex: 1,
  },
  portfolioNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  portfolioName: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  signatureTrackBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.56)",
    backgroundColor: "rgba(186,158,255,0.16)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  signatureTrackBadgeText: {
    color: palette.primary,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_700Bold",
  },
  signatureTrackHint: {
    marginTop: 4,
    color: "rgba(186,158,255,0.85)",
    fontSize: 10,
    letterSpacing: 0.4,
    fontFamily: "Inter_500Medium",
  },
  portfolioMetaText: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontFamily: "Inter_500Medium",
  },
  scrubberTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scrubberTimeText: {
    color: "rgba(173,170,170,0.78)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  listenButton: {
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
    marginTop: 0,
  },
  listenButtonText: {
    color: palette.primary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
  emptyStateText: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  previewOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  previewSheet: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    backgroundColor: palette.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 12,
  },
  previewHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  previewCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  previewCard: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: palette.surfaceContainerHigh,
  },
  previewImageArea: {
    width: "100%",
    height: 250,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewImageShade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  previewRoleBadge: {
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
  previewRoleBadgeText: {
    color: palette.primary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  previewCardBody: {
    padding: 14,
    gap: 6,
  },
  previewScrollContent: {
    paddingBottom: 12,
  },
  previewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewName: {
    color: palette.textPrimary,
    fontSize: 24,
    letterSpacing: -0.6,
    fontFamily: "Inter_700Bold",
  },
  previewLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  previewLocationText: {
    color: palette.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  previewBioText: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  previewSignatureCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.3)",
    backgroundColor: "rgba(139,92,246,0.12)",
    padding: 10,
  },
  previewSectionLabel: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  previewSignatureTitle: {
    marginTop: 3,
    color: palette.textPrimary,
    fontSize: 15,
    letterSpacing: -0.2,
    fontFamily: "Inter_700Bold",
  },
  previewSignatureMeta: {
    marginTop: 2,
    color: palette.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  previewMutedText: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  previewGenresRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  previewGenreChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  previewGenreChipText: {
    color: palette.textSecondary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontFamily: "Inter_600SemiBold",
  },
  previewTracksCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 10,
    gap: 8,
  },
  previewTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  previewTrackTextWrap: {
    flex: 1,
  },
  previewTrackTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  previewTrackMeta: {
    marginTop: 1,
    color: palette.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
