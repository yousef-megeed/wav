import { AUTH_CALLBACK_REDIRECT_URL } from "@/src/config/constants";
import type { Profile, Role } from "@/src/models";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { MainBottomNav } from "../../components/MainBottomNav";
import { withDefaultAvatar } from "../../config/constants";
import { ALPHA_COLORS, APP_COLORS } from "../../constants/theme";
import { ServiceError } from "../../errors";
import { supabase } from "../../lib/supabase";
import { NotificationService } from "../../services/NotificationService";
import { buildPreviewWaveformMeta } from "../../services/WaveformService";

type SettingsScreenProps = {
  mode?: "settings" | "onboarding";
  onBack?: () => void;
  onOpenDiscover?: () => void;
  onOpenMatches?: () => void;
  onOpenProfile?: () => void;
  profile?: Profile | null;
  userEmail?: string | null;
  isSavingIdentity?: boolean;
  onUploadAvatar?: (
    fileUri: string,
    mimeType?: string,
  ) => Promise<string | null>;
  onSaveIdentity?: (input: {
    displayName: string;
    bio: string;
    role: Role;
    genres: string[];
    styleTags: string[];
    avatarUrl: string | null;
    trackPreviews: Array<{
      id: string;
      title: string;
      genre: string;
      duration_sec: number;
      fileUri: string | null;
      fileName?: string;
      mimeType?: string;
      preview_url?: string | null;
      waveform_amplitudes?: number[] | null;
      waveform_coverage_ms?: number | null;
      waveform_source?: "preview" | "canonical" | "metering" | null;
    }>;
    onTrackUploadProgress?: (progress: {
      uploaded: number;
      total: number;
      trackTitle?: string;
      phase: "uploading" | "saving" | "done";
    }) => void;
  }) => Promise<void>;
};

const palette = {
  background: APP_COLORS.background,
  surfaceContainerLow: APP_COLORS.surface,
  surfaceContainerHigh: APP_COLORS.surfaceHigher,
  surfaceContainerHighest: APP_COLORS.surfaceHighest,
  textPrimary: APP_COLORS.textPrimary,
  textSecondary: APP_COLORS.textSecondary,
  primary: APP_COLORS.primary,
  primaryDim: APP_COLORS.primaryDim,
  navIconMuted: ALPHA_COLORS.navIconMuted,
};

const supportTiles = [
  { id: "help", icon: "help-center", title: "Help Center" },
  { id: "privacy", icon: "verified-user", title: "Privacy Policy" },
  { id: "terms", icon: "article", title: "Terms of Service" },
] as const;

type SelectableRole = Exclude<Role, "songwriter">;

const ROLE_OPTIONS: SelectableRole[] = ["producer", "vocalist", "rapper"];
const ROLE_STYLE_TAG_PREFIX = "role:";
const STYLE_TAG_OPTIONS = [
  "Trap",
  "Boom Bap",
  "Melodic",
  "Dark",
  "Chill",
  "Aggressive",
  "Atmospheric",
  "Experimental",
  "Lo-fi",
  "Club",
  "Afro",
  "Drill",
] as const;

const TRACK_GENRE_OPTIONS = [
  "Hip-Hop",
  "Trap",
  "R&B",
  "Pop",
  "Drill",
  "Afrobeat",
  "Lo-fi",
  "Electronic",
] as const;
const TRACK_GENRE_OTHER = "Other";

const ROLE_LABELS: Record<Role, string> = {
  producer: "Producer",
  vocalist: "Vocalist",
  rapper: "Rapper",
  songwriter: "Songwriter",
};

type EditableTrack = {
  id: string;
  title: string;
  genre: string;
  duration: string;
  fileUri: string | null;
  mimeType?: string;
  preview_url?: string | null;
  fileName?: string;
  waveform_amplitudes?: number[] | null;
  waveform_coverage_ms?: number | null;
  waveform_source?: "preview" | "canonical" | "metering" | null;
  isExtractingWaveform?: boolean;
};

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const isPresetTrackGenre = (genre: string): boolean =>
  TRACK_GENRE_OPTIONS.includes(
    genre.trim() as (typeof TRACK_GENRE_OPTIONS)[number],
  );

const createTrackId = () =>
  `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const resolveAudioDurationSeconds = async (
  fileUri: string,
): Promise<string> => {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: false },
    );
    const status = await sound.getStatusAsync();
    await sound.unloadAsync();
    if (status.isLoaded && status.durationMillis) {
      return String(Math.max(1, Math.round(status.durationMillis / 1000)));
    }
  } catch {
    // Duration detection can fail for unsupported files; keep empty and let save fallback to 0.
  }

  return "";
};

const parseRolesFromStyleTags = (
  styleTags: string[] | undefined,
  fallbackRole?: Role,
): SelectableRole[] => {
  const extracted = (styleTags ?? [])
    .map((tag) => {
      if (!tag.startsWith(ROLE_STYLE_TAG_PREFIX)) return null;
      const value = tag.slice(ROLE_STYLE_TAG_PREFIX.length);
      if (ROLE_OPTIONS.includes(value as SelectableRole)) {
        return value as SelectableRole;
      }
      return null;
    })
    .filter((value): value is SelectableRole => Boolean(value));

  if (extracted.length) {
    return Array.from(new Set(extracted));
  }

  if (fallbackRole && ROLE_OPTIONS.includes(fallbackRole as SelectableRole)) {
    return [fallbackRole as SelectableRole];
  }

  return ["producer"];
};

const stripRoleStyleTags = (styleTags: string[] | undefined) =>
  (styleTags ?? []).filter((tag) => !tag.startsWith(ROLE_STYLE_TAG_PREFIX));

export function SettingsScreen({
  mode = "settings",
  onOpenDiscover,
  onOpenMatches,
  onOpenProfile,
  profile,
  userEmail,
  isSavingIdentity,
  onUploadAvatar,
  onSaveIdentity,
}: SettingsScreenProps) {
  const isOnboardingMode = mode === "onboarding";
  const insets = useSafeAreaInsets();
  const notificationService = useMemo(() => new NotificationService(), []);
  const [isUpdateEmailVisible, setIsUpdateEmailVisible] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState(userEmail ?? "");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [isUpdatingPush, setIsUpdatingPush] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(
    Boolean(profile?.expo_push_token?.trim()),
  );
  const [displayNameInput, setDisplayNameInput] = useState(
    profile?.display_name ?? "",
  );
  const [bioInput, setBioInput] = useState(profile?.bio ?? "");
  const [selectedRole, setSelectedRole] = useState<SelectableRole>(
    parseRolesFromStyleTags(profile?.style_tags, profile?.role)[0] ??
      "producer",
  );
  const [isRoleDropdownVisible, setIsRoleDropdownVisible] = useState(false);
  const [isStyleTagsDropdownVisible, setIsStyleTagsDropdownVisible] =
    useState(false);
  const [activeTrackGenrePickerId, setActiveTrackGenrePickerId] = useState<
    string | null
  >(null);
  const [genresInput, setGenresInput] = useState(
    (profile?.genres ?? []).join(", "),
  );
  const [selectedStyleTags, setSelectedStyleTags] = useState<string[]>(
    stripRoleStyleTags(profile?.style_tags).filter((tag) =>
      STYLE_TAG_OPTIONS.includes(tag as (typeof STYLE_TAG_OPTIONS)[number]),
    ),
  );
  const [avatarUrlInput, setAvatarUrlInput] = useState(
    profile?.avatar_url ?? "",
  );
  const [editableTracks, setEditableTracks] = useState<EditableTrack[]>(
    (profile?.track_previews ?? []).map((track) => ({
      id: track.id,
      title: track.title,
      genre: track.genre,
      duration: String(track.duration_sec),
      fileUri: null,
      preview_url: track.preview_url,
      waveform_amplitudes: track.waveform_amplitudes ?? null,
      waveform_coverage_ms: track.waveform_coverage_ms ?? null,
      waveform_source: track.waveform_source ?? null,
      fileName:
        track.preview_url.split("?")[0]?.split("/").pop() ?? track.title,
    })),
  );
  const [customGenreTrackIds, setCustomGenreTrackIds] = useState<Set<string>>(
    () =>
      new Set(
        (profile?.track_previews ?? [])
          .filter((track) => !isPresetTrackGenre(track.genre))
          .map((track) => track.id),
      ),
  );
  const [signatureTrackId, setSignatureTrackId] = useState<string | null>(
    profile?.track_previews?.[0]?.id ?? null,
  );
  const [uploadProgress, setUploadProgress] = useState<{
    uploaded: number;
    total: number;
    trackTitle?: string;
    phase: "uploading" | "saving" | "done";
  } | null>(null);
  const [avatarUploadProgress, setAvatarUploadProgress] = useState<
    number | null
  >(null);
  const avatarProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  useEffect(() => {
    setPushEnabled(Boolean(profile?.expo_push_token?.trim()));
  }, [profile?.expo_push_token]);

  useEffect(() => {
    setNewEmailInput(userEmail ?? "");
  }, [userEmail]);

  useEffect(
    () => () => {
      if (avatarProgressTimerRef.current) {
        clearInterval(avatarProgressTimerRef.current);
      }
    },
    [],
  );

  const handleUpdateEmail = async () => {
    const normalizedEmail = newEmailInput.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    setIsUpdatingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
      });
      if (error) {
        throw error;
      }

      setIsUpdateEmailVisible(false);
      Alert.alert(
        "Confirm your email",
        "We sent a confirmation link to your new email address.",
      );
    } catch {
      Alert.alert("Could not update email", "Please try again in a moment.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleResetPassword = async () => {
    const email = (userEmail ?? "").trim();
    if (!email) {
      Alert.alert("No email found", "Add an email address first.");
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: AUTH_CALLBACK_REDIRECT_URL,
      });
      if (error) {
        throw error;
      }

      Alert.alert(
        "Password reset sent",
        "Check your email for a reset-password link.",
      );
    } catch {
      Alert.alert(
        "Reset failed",
        "Could not send reset instructions right now.",
      );
    }
  };

  const handleTogglePushNotifications = async () => {
    if (!profile?.user_id || isUpdatingPush) {
      return;
    }

    setIsUpdatingPush(true);
    try {
      if (pushEnabled) {
        const { error } = await supabase
          .from("profiles")
          .update({ expo_push_token: null })
          .eq("user_id", profile.user_id);
        if (error) {
          throw error;
        }
        setPushEnabled(false);
        return;
      }

      const token = await notificationService.registerForPushNotifications();
      if (!token) {
        Alert.alert(
          "Permission required",
          "Allow notifications to enable push alerts.",
        );
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ expo_push_token: token })
        .eq("user_id", profile.user_id);
      if (error) {
        throw error;
      }

      setPushEnabled(true);
    } catch (error: unknown) {
      const message =
        error instanceof ServiceError && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : "Please try changing this setting again.";
      Alert.alert("Notification setting failed", message);
    } finally {
      setIsUpdatingPush(false);
    }
  };

  const handlePickAvatar = async () => {
    let pickedAssetUri: string | null = null;
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Photo access needed",
          "Allow access so you can update your profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      pickedAssetUri = asset.uri;
      if (!onUploadAvatar) {
        setAvatarUrlInput(asset.uri);
        setAvatarUploadProgress(100);
        setTimeout(() => setAvatarUploadProgress(null), 500);
        return;
      }

      setAvatarUploadProgress(8);
      if (avatarProgressTimerRef.current) {
        clearInterval(avatarProgressTimerRef.current);
      }
      avatarProgressTimerRef.current = setInterval(() => {
        setAvatarUploadProgress((current) => {
          if (current === null) return 8;
          if (current >= 90) return current;
          return Math.min(90, current + 6);
        });
      }, 220);

      const uploadedUrl = await onUploadAvatar(asset.uri, asset.mimeType);
      if (!uploadedUrl) {
        throw new Error("Upload completed but no image URL was returned.");
      }

      setAvatarUrlInput(uploadedUrl);
      setAvatarUploadProgress(100);
      setTimeout(() => setAvatarUploadProgress(null), 700);
    } catch (error: unknown) {
      setAvatarUploadProgress(null);
      if (pickedAssetUri) {
        // Fallback so the user still sees the selected image immediately.
        setAvatarUrlInput(pickedAssetUri);
      }

      const message =
        error instanceof ServiceError && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : "Could not update profile picture. Please try again.";

      Alert.alert("Upload failed", message);
    } finally {
      if (avatarProgressTimerRef.current) {
        clearInterval(avatarProgressTimerRef.current);
        avatarProgressTimerRef.current = null;
      }
    }
  };

  const handleAddTrack = () => {
    void (async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const picked = result.assets[0];
      const id = createTrackId();
      const inferredTitle = picked.name.replace(/\.[^.]+$/, "").trim();
      const resolvedDuration = await resolveAudioDurationSeconds(picked.uri);
      const previewWaveformMeta = buildPreviewWaveformMeta(
        (Number.parseInt(resolvedDuration, 10) || 0) * 1000,
      );

      // Add track immediately with placeholder waveform.
      // Canonical waveform is generated asynchronously by the worker pipeline.
      const newTrack = {
        id,
        title: inferredTitle || "Untitled Track",
        genre: "",
        duration: resolvedDuration,
        fileUri: picked.uri,
        mimeType: picked.mimeType ?? undefined,
        preview_url: null,
        fileName: picked.name,
        waveform_amplitudes: null,
        waveform_coverage_ms: previewWaveformMeta.waveformCoverageMs,
        waveform_source: previewWaveformMeta.waveformSource,
        isExtractingWaveform: false,
      };

      setEditableTracks((current) => [...current, newTrack]);

      if (!signatureTrackId) {
        setSignatureTrackId(id);
      }

    })();
  };

  const handleReplaceTrackFile = async (trackId: string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/*"],
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) {
      return;
    }

    const picked = result.assets[0];
    const resolvedDuration = await resolveAudioDurationSeconds(picked.uri);
    const previewWaveformMeta = buildPreviewWaveformMeta(
      (Number.parseInt(resolvedDuration, 10) || 0) * 1000,
    );

    // Update track immediately with new file and placeholder waveform.
    // Canonical waveform will be persisted by worker.
    setEditableTracks((current) =>
      current.map((item) =>
        item.id === trackId
          ? {
              ...item,
              fileUri: picked.uri,
              mimeType: picked.mimeType ?? undefined,
              fileName: picked.name,
              preview_url: null,
              duration: resolvedDuration,
              waveform_amplitudes: null,
              waveform_coverage_ms: previewWaveformMeta.waveformCoverageMs,
              waveform_source: previewWaveformMeta.waveformSource,
              isExtractingWaveform: false,
            }
          : item,
      ),
    );
  };

  const handleSaveIdentityPress = async () => {
    if (!onSaveIdentity) {
      Alert.alert("Nothing to save", "Save action is not available right now.");
      return;
    }

    const normalizedName = displayNameInput.trim();
    if (!normalizedName) {
      Alert.alert(
        "Display name required",
        "Please enter a name for your profile.",
      );
      return;
    }

    const usedIds = new Set<string>();
    const parsedTracks = editableTracks
      .map((track, index) => ({
        id: track.id || `${createTrackId()}-${index}`,
        title: track.title.trim(),
        genre: track.genre.trim() || "Unspecified",
        duration_sec: Number.parseInt(track.duration, 10) || 0,
        fileUri: track.fileUri,
        fileName: track.fileName,
        mimeType: track.mimeType,
        preview_url: track.preview_url,
        waveform_amplitudes: track.waveform_amplitudes ?? null,
        waveform_coverage_ms: track.waveform_coverage_ms ?? null,
        waveform_source: track.waveform_source ?? null,
      }))
      .filter((track) => track.title && (track.fileUri || track.preview_url))
      .map((track) => {
        let resolvedId = track.id;
        while (usedIds.has(resolvedId)) {
          resolvedId = createTrackId();
        }
        usedIds.add(resolvedId);
        return {
          ...track,
          id: resolvedId,
        };
      });

    if (isOnboardingMode) {
      if (!avatarUrlInput.trim()) {
        Alert.alert(
          "Profile photo required",
          "Please add a profile picture to continue.",
        );
        return;
      }

      if (!bioInput.trim()) {
        Alert.alert("Bio required", "Please add a short bio to continue.");
        return;
      }

      if (splitCsv(genresInput).length === 0) {
        Alert.alert("Genres required", "Please add at least one genre.");
        return;
      }

      if (selectedStyleTags.length === 0) {
        Alert.alert(
          "Style tags required",
          "Please select at least one style tag.",
        );
        return;
      }

      if (parsedTracks.length < 3) {
        Alert.alert(
          "More tracks required",
          "Add at least 3 tracks to continue.",
        );
        return;
      }
    }

    const signatureIndex = parsedTracks.findIndex(
      (track) => track.id === signatureTrackId,
    );
    if (signatureIndex > 0) {
      const [signatureTrack] = parsedTracks.splice(signatureIndex, 1);
      parsedTracks.unshift(signatureTrack);
    }

    setUploadProgress({
      uploaded: 0,
      total: parsedTracks.length,
      phase: parsedTracks.length > 0 ? "uploading" : "saving",
    });

    try {
      const primaryRole: Role = selectedRole;
      const persistedRoleTags = [`${ROLE_STYLE_TAG_PREFIX}${selectedRole}`];
      await onSaveIdentity({
        displayName: normalizedName,
        bio: bioInput.trim(),
        role: primaryRole,
        genres: splitCsv(genresInput),
        styleTags: [...selectedStyleTags, ...persistedRoleTags],
        avatarUrl: avatarUrlInput.trim() || null,
        trackPreviews: parsedTracks,
        onTrackUploadProgress: (progress) => {
          setUploadProgress(progress);
        },
      });
      setUploadProgress({
        uploaded: parsedTracks.length,
        total: parsedTracks.length,
        phase: "done",
      });
      Alert.alert("Identity saved", "Your profile updates are now live.");
    } catch {
      Alert.alert(
        "Could not save",
        "Please try saving your identity changes again.",
      );
    } finally {
      setUploadProgress(null);
    }
  };

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

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
        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>
            {isOnboardingMode ? "Profile Setup" : "Settings"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isOnboardingMode ? "Create your identity" : "Profile Management"}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 128 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!isOnboardingMode ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Push Notifications</Text>

            <View style={styles.preferencesCard}>
              <View style={styles.preferenceRow}>
                <View style={styles.preferenceLeft}>
                  <MaterialIcons
                    name="notifications"
                    size={19}
                    color={palette.primary}
                  />
                  <View>
                    <Text style={styles.preferenceTitle}>
                      Push Notifications
                    </Text>
                    <Text style={styles.preferenceSubtitle}>
                      {pushEnabled ? "Enabled" : "Disabled"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    void handleTogglePushNotifications();
                  }}
                  disabled={isUpdatingPush}
                  style={[
                    styles.switchTrack,
                    pushEnabled && styles.switchTrackActive,
                    isUpdatingPush && styles.switchTrackDisabled,
                  ]}
                >
                  <View
                    style={[
                      styles.switchThumb,
                      pushEnabled && styles.switchThumbActive,
                    ]}
                  />
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {isOnboardingMode ? "Create Identity" : "Edit Identity"}
          </Text>

          <View style={styles.inlineEditorCard}>
            <Pressable
              onPress={handlePickAvatar}
              disabled={
                avatarUploadProgress !== null && avatarUploadProgress < 100
              }
              style={styles.editorAvatarButton}
            >
              <ExpoImage
                source={{ uri: withDefaultAvatar(avatarUrlInput) }}
                style={styles.editorAvatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={160}
              />
              <Text style={styles.editorAvatarText}>
                {avatarUploadProgress !== null && avatarUploadProgress < 100
                  ? "Uploading Photo..."
                  : "Change Photo"}
              </Text>
            </Pressable>
            {avatarUploadProgress !== null ? (
              <View style={styles.avatarProgressWrap}>
                <View style={styles.avatarProgressTrack}>
                  <View
                    style={[
                      styles.avatarProgressFill,
                      {
                        width: `${Math.max(0, Math.min(100, avatarUploadProgress))}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.avatarProgressText}>
                  {Math.round(avatarUploadProgress)}%
                </Text>
              </View>
            ) : null}

            <View style={styles.fieldSection}>
              <Text style={styles.fieldSectionTitle}>Display Name</Text>
              <TextInput
                value={displayNameInput}
                onChangeText={setDisplayNameInput}
                placeholder="Display name"
                placeholderTextColor="rgba(173,170,170,0.5)"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldSectionTitle}>Bio</Text>
              <TextInput
                value={bioInput}
                onChangeText={setBioInput}
                placeholder="Bio"
                placeholderTextColor="rgba(173,170,170,0.5)"
                multiline
                style={[styles.input, styles.bioInput]}
              />
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldSectionTitle}>Role</Text>
              <Pressable
                onPress={() => setIsRoleDropdownVisible(true)}
                style={({ pressed }) => [
                  styles.dropdownTrigger,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.dropdownTriggerText}>
                  {ROLE_LABELS[selectedRole]}
                </Text>
                <MaterialIcons
                  name="arrow-drop-down"
                  size={20}
                  color={palette.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldSectionTitle}>Genres</Text>
              <TextInput
                value={genresInput}
                onChangeText={setGenresInput}
                placeholder="Genres (comma separated)"
                placeholderTextColor="rgba(173,170,170,0.5)"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldSection}>
              <Text style={styles.fieldSectionTitle}>Style Tags</Text>
              <Pressable
                onPress={() => setIsStyleTagsDropdownVisible(true)}
                style={({ pressed }) => [
                  styles.dropdownTrigger,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dropdownTriggerText,
                    selectedStyleTags.length === 0 &&
                      styles.dropdownPlaceholder,
                  ]}
                >
                  {selectedStyleTags.length > 0
                    ? `${selectedStyleTags.length} selected`
                    : "Select style tags"}
                </Text>
                <MaterialIcons
                  name="arrow-drop-down"
                  size={20}
                  color={palette.textSecondary}
                />
              </Pressable>
            </View>

            <View style={styles.trackHeaderRow}>
              <Text style={styles.trackTitle}>Portfolio Tracks</Text>
              <Pressable onPress={handleAddTrack}>
                <Text style={styles.trackAddText}>Add Track</Text>
              </Pressable>
            </View>

            {editableTracks.map((track) => (
              <View
                key={track.id}
                style={[
                  styles.trackCard,
                  signatureTrackId === track.id && styles.trackCardSignature,
                ]}
              >
                {signatureTrackId === track.id ? (
                  <View style={styles.signatureBadge}>
                    <MaterialIcons name="stars" size={12} color="#2b006e" />
                    <Text style={styles.signatureBadgeText}>
                      Signature Track
                    </Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={() => void handleReplaceTrackFile(track.id)}
                  style={({ pressed }) => [
                    styles.trackFileButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <MaterialIcons
                    name="audiotrack"
                    size={16}
                    color={palette.primary}
                  />
                  <Text style={styles.trackFileText} numberOfLines={1}>
                    {track.fileName ?? "Select audio file"}
                  </Text>
                  {track.isExtractingWaveform ? (
                    <ActivityIndicator size="small" color={palette.primary} />
                  ) : (
                    <Text style={styles.trackFileAction}>Change</Text>
                  )}
                </Pressable>

                <TextInput
                  value={track.title}
                  onChangeText={(value) =>
                    setEditableTracks((current) =>
                      current.map((item) =>
                        item.id === track.id ? { ...item, title: value } : item,
                      ),
                    )
                  }
                  placeholder="Track title"
                  placeholderTextColor="rgba(173,170,170,0.5)"
                  style={styles.input}
                />
                <View style={styles.fieldSectionCompact}>
                  <Text style={styles.trackFieldLabel}>Track Title</Text>
                </View>

                <View style={styles.fieldSectionCompact}>
                  <Text style={styles.trackFieldLabel}>Genre</Text>
                  <Pressable
                    onPress={() => setActiveTrackGenrePickerId(track.id)}
                    style={({ pressed }) => [
                      styles.dropdownTrigger,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dropdownTriggerText,
                        !track.genre && styles.dropdownPlaceholder,
                      ]}
                    >
                      {track.genre || "Select genre"}
                    </Text>
                    <MaterialIcons
                      name="arrow-drop-down"
                      size={20}
                      color={palette.textSecondary}
                    />
                  </Pressable>
                </View>
                {customGenreTrackIds.has(track.id) ? (
                  <TextInput
                    value={track.genre}
                    onChangeText={(value) =>
                      setEditableTracks((current) =>
                        current.map((item) =>
                          item.id === track.id
                            ? { ...item, genre: value }
                            : item,
                        ),
                      )
                    }
                    placeholder="Type your genre"
                    placeholderTextColor="rgba(173,170,170,0.5)"
                    style={styles.input}
                  />
                ) : null}
                <View style={styles.trackActionRow}>
                  <View style={styles.durationPill}>
                    <MaterialIcons
                      name="schedule"
                      size={14}
                      color={palette.navIconMuted}
                    />
                    <Text style={styles.durationPillText}>
                      Duration:{" "}
                      {track.duration ? `${track.duration}s` : "Unknown"}
                    </Text>
                  </View>
                  <Pressable onPress={() => setSignatureTrackId(track.id)}>
                    <Text style={styles.trackActionText}>
                      {signatureTrackId === track.id
                        ? "Signature Track"
                        : "Set as Signature"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setCustomGenreTrackIds((current) => {
                        const next = new Set(current);
                        next.delete(track.id);
                        return next;
                      });
                      setEditableTracks((current) =>
                        current.filter((item) => item.id !== track.id),
                      );
                    }}
                  >
                    <Text style={styles.trackActionTextDanger}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            {uploadProgress ? (
              <View style={styles.uploadProgressCard}>
                <View style={styles.uploadProgressTopRow}>
                  <Text style={styles.uploadProgressTitle}>
                    {uploadProgress.phase === "saving"
                      ? "Saving identity"
                      : uploadProgress.phase === "done"
                        ? "Upload complete"
                        : "Uploading tracks"}
                  </Text>
                  <Text style={styles.uploadProgressCount}>
                    {uploadProgress.uploaded}/{uploadProgress.total}
                  </Text>
                </View>
                <View style={styles.uploadProgressTrack}>
                  <View
                    style={[
                      styles.uploadProgressFill,
                      {
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            uploadProgress.total > 0
                              ? (uploadProgress.uploaded /
                                  uploadProgress.total) *
                                  100
                              : 100,
                          ),
                        )}%`,
                      },
                    ]}
                  />
                </View>
                {uploadProgress.trackTitle ? (
                  <Text style={styles.uploadProgressMeta} numberOfLines={1}>
                    {uploadProgress.trackTitle}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                void handleSaveIdentityPress();
              }}
              disabled={Boolean(isSavingIdentity)}
              style={({ pressed }) => [
                styles.saveIdentityButton,
                pressed && styles.pressed,
                isSavingIdentity && styles.saveIdentityButtonDisabled,
              ]}
            >
              <Text style={styles.saveIdentityText}>
                {isSavingIdentity
                  ? "Saving..."
                  : isOnboardingMode
                    ? "Continue"
                    : "Save Identity"}
              </Text>
            </Pressable>
          </View>
        </View>

        {!isOnboardingMode ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Account Actions</Text>

            <View style={styles.rowActionsWrap}>
              <Pressable
                onPress={() => setIsUpdateEmailVisible(true)}
                style={({ pressed }) => [
                  styles.rowAction,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="alternate-email"
                  size={18}
                  color={palette.textSecondary}
                />
                <Text style={styles.rowActionText}>Update Email</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void handleResetPassword();
                }}
                style={({ pressed }) => [
                  styles.rowAction,
                  pressed && styles.pressed,
                ]}
              >
                <MaterialIcons
                  name="lock-reset"
                  size={18}
                  color={palette.textSecondary}
                />
                <Text style={styles.rowActionText}>Reset Password</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isOnboardingMode ? (
          <View style={styles.signOutWrap}>
            <Pressable
              onPress={() => {
                void supabase.auth.signOut();
              }}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && styles.pressed,
              ]}
            >
              <MaterialIcons
                name="logout"
                size={20}
                color={palette.textSecondary}
              />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {!isOnboardingMode ? (
        <MainBottomNav
          activeTab="settings"
          bottomInset={insets.bottom}
          onOpenDiscover={onOpenDiscover}
          onOpenMatches={onOpenMatches}
          onOpenProfile={onOpenProfile}
        />
      ) : null}

      <Modal
        visible={isRoleDropdownVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setIsRoleDropdownVisible(false)}
      >
        <View style={styles.emailModalOverlay}>
          <Pressable
            style={styles.emailModalBackdrop}
            onPress={() => setIsRoleDropdownVisible(false)}
          />
          <View style={styles.selectModalCard}>
            <Text style={styles.emailModalTitle}>Select Role</Text>
            {ROLE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setSelectedRole(option);
                  setIsRoleDropdownVisible(false);
                }}
                style={({ pressed }) => [
                  styles.selectOptionRow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.selectOptionText}>
                  {ROLE_LABELS[option]}
                </Text>
                {selectedRole === option ? (
                  <MaterialIcons
                    name="check"
                    size={18}
                    color={palette.primary}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isStyleTagsDropdownVisible}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setIsStyleTagsDropdownVisible(false)}
      >
        <View style={styles.emailModalOverlay}>
          <Pressable
            style={styles.emailModalBackdrop}
            onPress={() => setIsStyleTagsDropdownVisible(false)}
          />
          <View style={styles.selectModalCard}>
            <Text style={styles.emailModalTitle}>Select Style Tags</Text>
            {STYLE_TAG_OPTIONS.map((tag) => {
              const isSelected = selectedStyleTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() =>
                    setSelectedStyleTags((current) =>
                      isSelected
                        ? current.filter((item) => item !== tag)
                        : [...current, tag],
                    )
                  }
                  style={({ pressed }) => [
                    styles.selectOptionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.selectOptionText}>{tag}</Text>
                  {isSelected ? (
                    <MaterialIcons
                      name="check"
                      size={18}
                      color={palette.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => setIsStyleTagsDropdownVisible(false)}
              style={({ pressed }) => [
                styles.emailSaveButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emailSaveText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(activeTrackGenrePickerId)}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => setActiveTrackGenrePickerId(null)}
      >
        <View style={styles.emailModalOverlay}>
          <Pressable
            style={styles.emailModalBackdrop}
            onPress={() => setActiveTrackGenrePickerId(null)}
          />
          <View style={styles.selectModalCard}>
            <Text style={styles.emailModalTitle}>Select Track Genre</Text>
            {[...TRACK_GENRE_OPTIONS, TRACK_GENRE_OTHER].map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  const trackId = activeTrackGenrePickerId;
                  if (!trackId) return;

                  if (option === TRACK_GENRE_OTHER) {
                    setCustomGenreTrackIds((current) => {
                      const next = new Set(current);
                      next.add(trackId);
                      return next;
                    });
                    setEditableTracks((current) =>
                      current.map((item) =>
                        item.id === trackId && isPresetTrackGenre(item.genre)
                          ? { ...item, genre: "" }
                          : item,
                      ),
                    );
                  } else {
                    setCustomGenreTrackIds((current) => {
                      const next = new Set(current);
                      next.delete(trackId);
                      return next;
                    });
                    setEditableTracks((current) =>
                      current.map((item) =>
                        item.id === trackId ? { ...item, genre: option } : item,
                      ),
                    );
                  }

                  setActiveTrackGenrePickerId(null);
                }}
                style={({ pressed }) => [
                  styles.selectOptionRow,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.selectOptionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {!isOnboardingMode ? (
        <Modal
          visible={isUpdateEmailVisible}
          animationType="fade"
          transparent
          statusBarTranslucent
          onRequestClose={() => setIsUpdateEmailVisible(false)}
        >
          <View style={styles.emailModalOverlay}>
            <Pressable
              style={styles.emailModalBackdrop}
              onPress={() => setIsUpdateEmailVisible(false)}
            />
            <View style={styles.emailModalCard}>
              <Text style={styles.emailModalTitle}>Update Email</Text>
              <TextInput
                value={newEmailInput}
                onChangeText={setNewEmailInput}
                placeholder="name@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="rgba(173,170,170,0.5)"
                style={styles.input}
              />
              <View style={styles.emailModalActions}>
                <Pressable
                  onPress={() => setIsUpdateEmailVisible(false)}
                  style={({ pressed }) => [
                    styles.emailCancelButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.emailCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void handleUpdateEmail();
                  }}
                  disabled={isUpdatingEmail}
                  style={({ pressed }) => [
                    styles.emailSaveButton,
                    pressed && styles.pressed,
                    isUpdatingEmail && styles.saveIdentityButtonDisabled,
                  ]}
                >
                  <Text style={styles.emailSaveText}>
                    {isUpdatingEmail ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
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
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.background,
  },
  scroll: {
    flex: 1,
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
    backgroundColor: "rgba(14,14,14,0.72)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  content: {
    paddingTop: 94,
    paddingHorizontal: 24,
    gap: 28,
  },
  heroHeader: {
    marginBottom: -4,
  },
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 44,
    letterSpacing: -1.3,
    fontFamily: "Inter_800ExtraBold",
  },
  heroSubtitle: {
    marginTop: 3,
    color: palette.textSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2.2,
    fontFamily: "Inter_600SemiBold",
  },
  section: {
    gap: 14,
  },
  sectionLabel: {
    marginLeft: 2,
    color: palette.primary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.7,
    fontFamily: "Inter_700Bold",
  },
  profileCard: {
    borderRadius: 14,
    padding: 18,
    backgroundColor: palette.surfaceContainerLow,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(186,158,255,0.4)",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileImageWrap: {
    position: "relative",
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 39,
  },
  profileEditDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: palette.surfaceContainerLow,
  },
  profileMeta: {
    flex: 1,
  },
  profileName: {
    color: palette.textPrimary,
    fontSize: 21,
    fontFamily: "Inter_700Bold",
  },
  profileEmail: {
    marginTop: 2,
    color: palette.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  profileHint: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontFamily: "Inter_500Medium",
  },
  inlineAction: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  inlineActionText: {
    color: palette.primary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontFamily: "Inter_700Bold",
  },
  rowActionsWrap: {
    flexDirection: "row",
    gap: 10,
  },
  rowAction: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: palette.surfaceContainerLow,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  rowActionText: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  preferencesCard: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: palette.surfaceContainerLow,
  },
  preferenceRowWithBorder: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(73,72,71,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  preferenceRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  preferenceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  preferenceTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  preferenceSubtitle: {
    marginTop: 2,
    color: palette.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  qualityToggle: {
    flexDirection: "row",
    borderRadius: 999,
    padding: 3,
    backgroundColor: "#000000",
    gap: 4,
  },
  qualityChipInactive: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qualityChipActive: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.primary,
  },
  qualityTextInactive: {
    color: palette.textSecondary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  qualityTextActive: {
    color: "#39008c",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  switchTrack: {
    width: 48,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(186,158,255,0.2)",
    justifyContent: "center",
    paddingHorizontal: 4,
    alignItems: "flex-start",
  },
  switchTrackActive: {
    alignItems: "flex-end",
    backgroundColor: "rgba(186,158,255,0.45)",
  },
  switchTrackDisabled: {
    opacity: 0.55,
  },
  switchThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.primary,
  },
  switchThumbActive: {
    backgroundColor: "#ffffff",
  },
  inlineEditorCard: {
    borderRadius: 14,
    backgroundColor: palette.surfaceContainerLow,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  proCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  proBubble: {
    position: "absolute",
    top: -16,
    right: -16,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  proRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  proTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  proBadge: {
    borderRadius: 4,
    backgroundColor: palette.textPrimary,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    color: palette.primary,
    fontSize: 9,
    letterSpacing: 1.2,
    fontFamily: "Inter_800ExtraBold",
  },
  proTitle: {
    color: palette.textPrimary,
    fontSize: 26,
    letterSpacing: -0.5,
    fontFamily: "Inter_800ExtraBold",
  },
  proRenewText: {
    color: "rgba(43,0,110,0.95)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  manageButton: {
    borderRadius: 999,
    backgroundColor: palette.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  manageButtonText: {
    color: "#000000",
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    fontFamily: "Inter_700Bold",
  },
  supportGrid: {
    flexDirection: "row",
    gap: 10,
  },
  supportCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: palette.surfaceContainerLow,
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 8,
  },
  supportText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  signOutWrap: {
    marginTop: 2,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(73,72,71,0.2)",
    alignItems: "center",
  },
  signOutButton: {
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signOutText: {
    color: palette.textSecondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1.3,
    fontFamily: "Inter_700Bold",
  },
  editorOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  editorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  editorSheetWrap: {
    width: "100%",
    maxHeight: "78%",
    paddingHorizontal: 10,
  },
  editorHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    alignSelf: "center",
    marginBottom: 8,
  },
  editorSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: palette.surfaceContainerLow,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 32,
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -6 },
    elevation: 20,
  },
  emailModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  emailModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  emailModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: palette.surfaceContainerLow,
    padding: 14,
    gap: 10,
  },
  emailModalTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  emailModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  emailCancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  emailCancelText: {
    color: palette.textSecondary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
  emailSaveButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  emailSaveText: {
    color: "#2b006e",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_800ExtraBold",
  },
  editorHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  editorTitle: {
    color: palette.textPrimary,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  editorContent: {
    gap: 10,
    paddingBottom: 12,
  },
  editorAvatarButton: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  editorAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    marginBottom: 6,
  },
  editorAvatarText: {
    color: palette.primary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  avatarProgressWrap: {
    marginTop: -2,
    marginBottom: 2,
    gap: 5,
  },
  avatarProgressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  avatarProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  avatarProgressText: {
    color: palette.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  fieldSection: {
    gap: 6,
  },
  fieldSectionCompact: {
    gap: 6,
    marginTop: 2,
  },
  fieldSectionTitle: {
    color: palette.textSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  input: {
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerHighest,
    color: palette.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  dropdownTrigger: {
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerHighest,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownTriggerText: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  dropdownPlaceholder: {
    color: "rgba(173,170,170,0.6)",
  },
  bioInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  roleChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "transparent",
  },
  roleChipActive: {
    borderColor: palette.primary,
    backgroundColor: "rgba(186,158,255,0.15)",
  },
  roleChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  roleChipTextActive: {
    color: palette.primary,
  },
  selectModalCard: {
    width: "100%",
    maxWidth: 360,
    maxHeight: "70%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: palette.surfaceContainerLow,
    padding: 14,
    gap: 8,
  },
  selectOptionRow: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectOptionText: {
    color: palette.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  styleTagsLabel: {
    color: palette.textPrimary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  styleTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  styleTagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "transparent",
  },
  styleTagChipActive: {
    borderColor: palette.primary,
    backgroundColor: "rgba(186,158,255,0.15)",
  },
  styleTagChipText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  styleTagChipTextActive: {
    color: palette.primary,
  },
  trackHeaderRow: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trackTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  trackAddText: {
    color: palette.primary,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontFamily: "Inter_700Bold",
  },
  trackCard: {
    borderRadius: 12,
    padding: 10,
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  trackCardSignature: {
    borderColor: "rgba(186,158,255,0.72)",
    backgroundColor: "rgba(186,158,255,0.14)",
  },
  signatureBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  signatureBadgeText: {
    color: "#2b006e",
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: "Inter_800ExtraBold",
  },
  trackFileButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.25)",
    backgroundColor: "rgba(186,158,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  trackFileText: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  trackFileAction: {
    color: palette.primary,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Inter_700Bold",
  },
  trackFieldLabel: {
    marginTop: 1,
    color: palette.textSecondary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Inter_700Bold",
  },
  trackGenreRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trackGenreChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "transparent",
  },
  trackGenreChipActive: {
    borderColor: palette.primary,
    backgroundColor: "rgba(186,158,255,0.15)",
  },
  trackGenreChipText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  trackGenreChipTextActive: {
    color: palette.primary,
  },
  trackActionRow: {
    marginTop: 2,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  durationPill: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.02)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  durationPillText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  trackActionText: {
    color: palette.primary,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  trackActionTextDanger: {
    color: "#ff6b6b",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  saveIdentityButton: {
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
  },
  uploadProgressCard: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.25)",
    backgroundColor: "rgba(186,158,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  uploadProgressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  uploadProgressTitle: {
    color: palette.textPrimary,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  uploadProgressCount: {
    color: palette.primary,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  uploadProgressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  uploadProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.primary,
  },
  uploadProgressMeta: {
    color: palette.textSecondary,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  saveIdentityButtonDisabled: {
    opacity: 0.5,
  },
  saveIdentityText: {
    color: "#2b006e",
    fontSize: 13,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontFamily: "Inter_800ExtraBold",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
});
