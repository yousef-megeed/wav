import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { withDefaultAvatar } from "./src/config/constants";
import { supabase } from "./src/lib/supabase";
import type { Match, Message, Profile, Role } from "./src/models";
import { AuthScreen } from "./src/screens/auth/AuthScreen";
import {
  ChatScreen,
  type ChatCollaboratorDetails,
  type ChatMessage,
} from "./src/screens/main/ChatScreen";
import { DiscoverScreen } from "./src/screens/main/DiscoverScreen";
import { MatchesScreen } from "./src/screens/main/MatchesScreen";
import { MatchesSplashScreen } from "./src/screens/main/MatchesSplashScreen";
import { ProfileScreen } from "./src/screens/main/ProfileScreen";
import { SettingsScreen } from "./src/screens/main/SettingsScreen";
import { createServices } from "./src/services";

type OnboardingStep =
  | "profile"
  | "discover"
  | "matches"
  | "chat"
  | "profile-main"
  | "settings-main"
  | "match-celebration";

type MatchCard = {
  id: string;
  name: string;
  imageUrl: string;
  isNew?: boolean;
};

type ConversationItem = {
  id: string;
  name: string;
  message: string;
  time: string;
  imageUrl: string;
  isOnline?: boolean;
  statusText?: string;
  unread?: boolean;
};

type CelebrationMatch = {
  matchId: string;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorAvatarUrl: string | null;
  collaboratorRole: Role | null;
  collaboratorLocation: string | null;
};

const MAIN_STEPS: OnboardingStep[] = [
  "discover",
  "matches",
  "chat",
  "profile-main",
  "settings-main",
  "match-celebration",
];

const EXPO_PUSH_TOKEN_REGEX = /^ExponentPushToken\[[^\]]+\]$/;

export default function App() {
  const services = useMemo(() => createServices(), []);
  const refreshActiveChatRef = useRef<(() => Promise<void>) | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isHydratingProfile, setIsHydratingProfile] = useState(false);
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);
  const [onboardingStep, setOnboardingStep] =
    useState<OnboardingStep>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [discoverCandidates, setDiscoverCandidates] = useState<Profile[]>([]);
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(false);

  const [matchCards, setMatchCards] = useState<MatchCard[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [conversationToMatch, setConversationToMatch] = useState<
    Record<string, Match>
  >({});
  const [conversationToCollaboratorId, setConversationToCollaboratorId] =
    useState<Record<string, string>>({});

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeCollaboratorId, setActiveCollaboratorId] = useState<
    string | null
  >(null);
  const [activeCollaboratorName, setActiveCollaboratorName] =
    useState("Collaborator");
  const [activeCollaboratorAvatarUrl, setActiveCollaboratorAvatarUrl] =
    useState(withDefaultAvatar(null));
  const [activeCollaboratorDetails, setActiveCollaboratorDetails] =
    useState<ChatCollaboratorDetails | null>(null);
  const [celebrationMatch, setCelebrationMatch] =
    useState<CelebrationMatch | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSeenByUserId, setLastSeenByUserId] = useState<
    Record<string, string>
  >({});

  const mapProfileToCollaboratorDetails = useCallback(
    (source: Profile | null | undefined): ChatCollaboratorDetails | null => {
      if (!source) {
        return null;
      }

      return {
        role: source.role,
        location: source.location,
        bio: source.bio,
        genres: source.genres,
        isVerified: source.is_verified,
        trackPreviews: (source.track_previews ?? []).map((track) => ({
          id: track.id,
          title: track.title,
          genre: track.genre,
          durationSec: track.duration_sec,
          previewUrl: track.preview_url,
          waveformAmplitudes: track.waveform_amplitudes ?? undefined,
        })),
      };
    },
    [],
  );

  const resolveDisplayName = useCallback((activeSession: Session) => {
    const metadataName =
      (activeSession.user.user_metadata?.full_name as string | undefined) ??
      (activeSession.user.user_metadata?.name as string | undefined);
    if (metadataName?.trim()) {
      return metadataName.trim();
    }

    const emailPrefix = activeSession.user.email?.split("@")[0];
    if (emailPrefix?.trim()) {
      return emailPrefix.trim();
    }

    return "WAV Artist";
  }, []);

  const formatLastSeenLabel = useCallback((isoTimestamp?: string | null) => {
    if (!isoTimestamp) {
      return "Offline";
    }

    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
      return "Offline";
    }

    const diffMs = Date.now() - parsed.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
    if (diffMinutes < 1) return "Last seen just now";
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Last seen ${diffDays}d ago`;

    return `Last seen ${parsed.toLocaleDateString()}`;
  }, []);

  const loadProfile = useCallback(
    async (activeSession: Session) => {
      setIsHydratingProfile(true);
      try {
        const existing = await services.profileService.getProfile(
          activeSession.user.id,
        );
        setProfile(existing);

        if (existing) {
          setOnboardingStep((previous) =>
            MAIN_STEPS.includes(previous) ? previous : "discover",
          );
          return;
        }

        setOnboardingStep("profile");
      } finally {
        setIsHydratingProfile(false);
      }
    },
    [services.profileService],
  );

  const loadDiscoverCandidates = useCallback(async () => {
    if (!session) return;

    setIsLoadingDiscover(true);
    try {
      const candidates = await services.swipeService.getCandidates(
        session.user.id,
      );
      setDiscoverCandidates(candidates);
    } finally {
      setIsLoadingDiscover(false);
    }
  }, [services.swipeService, session]);

  const loadMatches = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!session) return;

      if (!options?.silent) {
        setIsLoadingMatches(true);
      }
      try {
        const matches = await services.matchService.getMatches(session.user.id);
        const otherUserIds = matches.map((match) =>
          match.user1_id === session.user.id ? match.user2_id : match.user1_id,
        );

        const summaries =
          await services.profileService.getProfileSummaries(otherUserIds);
        const summaryByUserId = new Map(
          summaries.map((item) => [item.user_id, item]),
        );

        const cards: MatchCard[] = matches.map((match, index) => {
          const collaboratorId =
            match.user1_id === session.user.id
              ? match.user2_id
              : match.user1_id;
          const summary = summaryByUserId.get(collaboratorId);

          return {
            id: match.id,
            name: summary?.display_name ?? "Collaborator",
            imageUrl: withDefaultAvatar(summary?.avatar_url),
            isNew: index < 3,
          };
        });

        const items: ConversationItem[] = matches.map((match) => {
          const collaboratorId =
            match.user1_id === session.user.id
              ? match.user2_id
              : match.user1_id;
          const summary = summaryByUserId.get(collaboratorId);
          const isOnline = onlineUserIds.has(collaboratorId);
          return {
            id: match.id,
            name: summary?.display_name ?? "Collaborator",
            message: "Start your conversation",
            time: new Date(match.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            imageUrl: withDefaultAvatar(summary?.avatar_url),
            isOnline,
            statusText: isOnline
              ? "Active now"
              : formatLastSeenLabel(lastSeenByUserId[collaboratorId]),
            unread: false,
          };
        });

        const latestMessages = await Promise.all(
          matches.map(async (match) => {
            try {
              const messages = await services.chatService.getMessages(match.id);
              const latest = [...messages].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              )[messages.length - 1];
              return [match.id, latest ?? null] as const;
            } catch {
              return [match.id, null] as const;
            }
          }),
        );

        const latestMessageByMatchId = new Map(latestMessages);
        const itemsWithPreview = items.map((item) => {
          const latest = latestMessageByMatchId.get(item.id);
          if (!latest) {
            return item;
          }

          const prefix = latest.sender_id === session.user.id ? "You: " : "";
          const body =
            latest.message_kind === "text"
              ? latest.content?.trim() || "Sent a message"
              : latest.message_kind === "voice-note"
                ? "Sent a voice note"
                : latest.file_name
                  ? `Sent ${latest.file_name}`
                  : "Sent an audio file";

          return {
            ...item,
            message: `${prefix}${body}`,
            time: new Date(latest.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          };
        });

        const mapping = matches.reduce<Record<string, Match>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {});

        const collaboratorMapping = matches.reduce<Record<string, string>>(
          (acc, item) => {
            const collaboratorId =
              item.user1_id === session.user.id ? item.user2_id : item.user1_id;
            acc[item.id] = collaboratorId;
            return acc;
          },
          {},
        );

        setConversationToMatch(mapping);
        setConversationToCollaboratorId(collaboratorMapping);
        setMatchCards(cards);
        setConversations(itemsWithPreview);
      } finally {
        if (!options?.silent) {
          setIsLoadingMatches(false);
        }
      }
    },
    [
      formatLastSeenLabel,
      lastSeenByUserId,
      onlineUserIds,
      services.chatService,
      services.matchService,
      services.profileService,
      session,
    ],
  );

  const mergeMessageLists = useCallback(
    (current: Message[], incoming: Message[]): Message[] => {
      const getSourceRank = (source?: string | null): number => {
        if (source === "canonical") return 3;
        if (source === "metering") return 2;
        if (source === "preview") return 1;
        return 0;
      };

      const map = new Map(current.map((item) => [item.id, item]));
      for (const message of incoming) {
        const existing = map.get(message.id);
        if (!existing) {
          map.set(message.id, message);
          continue;
        }

        const existingSourceRank = getSourceRank(existing.waveform_source);
        const incomingSourceRank = getSourceRank(message.waveform_source);

        if (existingSourceRank > incomingSourceRank) {
          map.set(message.id, {
            ...existing,
            ...message,
            waveform_amplitudes: existing.waveform_amplitudes,
            waveform_coverage_ms: existing.waveform_coverage_ms,
            waveform_source: existing.waveform_source,
          });
          continue;
        }

        map.set(message.id, {
          ...existing,
          ...message,
        });
      }

      return Array.from(map.values()).sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    },
    [],
  );

  const mergeChatMessage = useCallback(
    (next: Message) => {
      setChatMessages((current) => mergeMessageLists(current, [next]));
    },
    [mergeMessageLists],
  );

  useEffect(() => {
    let active = true;

    const init = async () => {
      const activeSession = await services.authService.getCurrentSession();
      if (!active) return;
      setSession(activeSession);
      setIsCheckingSession(false);
    };

    void init();

    const unsubscribe = services.authService.onAuthStateChange((next) => {
      if (!active) return;
      setSession(next ?? null);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [services.authService]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setDiscoverCandidates([]);
      setMatchCards([]);
      setConversations([]);
      setConversationToMatch({});
      setConversationToCollaboratorId({});
      setActiveMatchId(null);
      setActiveCollaboratorId(null);
      setActiveCollaboratorDetails(null);
      setCelebrationMatch(null);
      setChatMessages([]);
      setOnlineUserIds(new Set());
      setLastSeenByUserId({});
      setOnboardingStep("profile");
      return;
    }

    void loadProfile(session);
  }, [loadProfile, session]);

  useEffect(() => {
    if (onboardingStep === "discover") {
      void loadDiscoverCandidates();
    }
  }, [loadDiscoverCandidates, onboardingStep]);

  useEffect(() => {
    if (onboardingStep === "matches") {
      void loadMatches();
    }
  }, [loadMatches, onboardingStep]);

  useEffect(() => {
    if (onboardingStep !== "matches") {
      return;
    }

    const pollingTimer = setInterval(() => {
      void loadMatches({ silent: true });
    }, 4000);

    return () => {
      clearInterval(pollingTimer);
    };
  }, [loadMatches, onboardingStep]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const channel = supabase.channel("app-presence", {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    const trackPresence = async (isOnline: boolean) => {
      if (isOnline) {
        await channel.track({
          user_id: session.user.id,
          online_at: new Date().toISOString(),
        });
        return;
      }

      await channel.untrack();
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUserIds(new Set(Object.keys(state)));

        const updates: Record<string, string> = {};
        for (const [userId, entries] of Object.entries(state)) {
          if (!Array.isArray(entries) || entries.length === 0) {
            continue;
          }

          const latest = entries[entries.length - 1] as
            | { online_at?: string }
            | undefined;
          if (latest?.online_at) {
            updates[userId] = latest.online_at;
          }
        }

        if (Object.keys(updates).length > 0) {
          setLastSeenByUserId((current) => ({
            ...current,
            ...updates,
          }));
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void trackPresence(AppState.currentState === "active");
        }
      });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        void trackPresence(nextState === "active");
      },
    );

    return () => {
      appStateSubscription.remove();
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let cancelled = false;

    const registerPushToken = async () => {
      try {
        const token =
          await services.notificationService.registerForPushNotifications();
        if (!token || cancelled) {
          return;
        }

        await supabase
          .from("profiles")
          .update({ expo_push_token: token })
          .eq("user_id", session.user.id);
      } catch {
        // Push support depends on device/build type; ignore registration failures.
      }
    };

    void registerPushToken();

    return () => {
      cancelled = true;
    };
  }, [services.notificationService, session]);

  const notifyChatRecipient = useCallback(
    async (input: { recipientUserId: string; previewText: string }) => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("expo_push_token")
          .eq("user_id", input.recipientUserId)
          .maybeSingle();

        const token = (data as { expo_push_token?: string | null } | null)
          ?.expo_push_token;

        if (!token || !EXPO_PUSH_TOKEN_REGEX.test(token)) {
          return;
        }

        await services.notificationService.sendPushToToken({
          token,
          title: profile?.display_name ?? "New message",
          body: input.previewText,
          data: {
            type: "chat-message",
            matchId: activeMatchId,
            senderId: session?.user.id,
            recipientId: input.recipientUserId,
          },
        });
      } catch {
        // Do not block chat flow if push fails.
      }
    },
    [
      activeMatchId,
      profile?.display_name,
      services.notificationService,
      session?.user.id,
    ],
  );

  useEffect(() => {
    if (!session || onboardingStep !== "chat" || !activeMatchId) {
      refreshActiveChatRef.current = null;
      return;
    }

    let disposed = false;
    let isSyncing = false;

    setChatMessages([]);

    const syncMessages = async (showLoader: boolean) => {
      if (isSyncing) {
        return;
      }

      isSyncing = true;
      if (showLoader) {
        setIsLoadingChat(true);
      }

      try {
        const latest = await services.chatService.getMessages(activeMatchId);
        if (!disposed) {
          setChatMessages((current) => mergeMessageLists(current, latest));
        }

        if (showLoader) {
          await services.chatService.markMessagesAsRead(
            activeMatchId,
            session.user.id,
          );
        }
      } finally {
        isSyncing = false;
        if (showLoader && !disposed) {
          setIsLoadingChat(false);
        }
      }
    };

    refreshActiveChatRef.current = async () => {
      await syncMessages(false);
    };

    const onRealtimeMessage = (message: Message) => {
      mergeChatMessage(message);
    };

    void syncMessages(true);

    const unsubscribeInserts = services.chatService.subscribeToMessages(
      activeMatchId,
      onRealtimeMessage,
    );
    const unsubscribeUpdates = services.chatService.subscribeToMessageUpdates(
      activeMatchId,
      onRealtimeMessage,
    );
    const pollingTimer = setInterval(() => {
      void syncMessages(false);
    }, 2500);

    return () => {
      disposed = true;
      refreshActiveChatRef.current = null;
      clearInterval(pollingTimer);
      unsubscribeInserts();
      unsubscribeUpdates();
    };
  }, [
    activeMatchId,
    mergeMessageLists,
    mergeChatMessage,
    onboardingStep,
    services.chatService,
    session,
  ]);

  const handleUploadProfileAvatar = useCallback(
    async (fileUri: string, mimeType?: string) => {
      if (!session) return null;

      const avatarUrl = await services.profileService.uploadProfileAvatar(
        session.user.id,
        fileUri,
        mimeType,
      );

      setProfile((current) =>
        current
          ? {
              ...current,
              avatar_url: avatarUrl,
            }
          : current,
      );

      return avatarUrl;
    },
    [services.profileService, session],
  );

  const enqueueWaveformExtraction = useCallback(
    async (payload: {
      targetType: "message" | "profile_track";
      audioUrl: string;
      messageId?: string;
      profileUserId?: string;
      profileTrackId?: string;
    }) => {
      try {
        await supabase.auth.refreshSession();

        const {
          data: { session: activeSession },
        } = await supabase.auth.getSession();

        const accessToken = activeSession?.access_token;
        if (!accessToken) {
          return;
        }

        await supabase.functions.invoke("enqueue-waveform-job", {
          body: payload,
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      } catch {
        // Keep main flows resilient if queue function is unavailable.
      }
    },
    [],
  );

  const handleSaveIdentity = useCallback(
    async (input: {
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
    }) => {
      if (!session) return;

      setIsSavingIdentity(true);
      try {
        const uploadedTrackPreviews: Array<{
          id: string;
          title: string;
          genre: string;
          bpm: number | null;
          key: string | null;
          duration_sec: number;
          preview_url: string;
          waveform_amplitudes?: number[] | null;
          waveform_coverage_ms?: number | null;
          waveform_source?: "preview" | "canonical" | "metering" | null;
        }> = [];

        const totalTracks = input.trackPreviews.length;
        let uploadedCount = 0;
        input.onTrackUploadProgress?.({
          uploaded: 0,
          total: totalTracks,
          phase: totalTracks > 0 ? "uploading" : "saving",
        });

        for (const track of input.trackPreviews) {
          let previewUrl = (track.preview_url ?? "").trim();

          if (track.fileUri) {
            try {
              previewUrl = await services.profileService.uploadTrackPreview(
                session.user.id,
                track.fileUri,
                track.fileName || `${track.title || "track"}-${track.id}`,
                track.mimeType,
              );
            } catch (error: unknown) {
              // Keep other tracks savable even if one upload fails.
              console.warn("Skipping failed track upload", {
                trackId: track.id,
                error,
              });
            }
          }

          uploadedCount += 1;
          input.onTrackUploadProgress?.({
            uploaded: uploadedCount,
            total: totalTracks,
            trackTitle: track.title,
            phase: "uploading",
          });

          if (!previewUrl.trim()) {
            continue;
          }

          uploadedTrackPreviews.push({
            id: track.id,
            title: track.title,
            genre: track.genre,
            bpm: null,
            key: null,
            duration_sec: track.duration_sec,
            preview_url: previewUrl,
            waveform_amplitudes: track.waveform_amplitudes ?? null,
            waveform_coverage_ms:
              track.waveform_coverage_ms ?? track.duration_sec * 1000,
            waveform_source: track.waveform_source ?? "preview",
          });
        }

        const cleanTrackPreviews = uploadedTrackPreviews.filter(
          (track) => track.preview_url.trim().length > 0,
        );

        const enqueueProfileTrackJobs = () => {
          for (const track of cleanTrackPreviews) {
            if (!track.preview_url) {
              continue;
            }

            void enqueueWaveformExtraction({
              targetType: "profile_track",
              profileUserId: session.user.id,
              profileTrackId: track.id,
              audioUrl: track.preview_url,
            });
          }
        };

        input.onTrackUploadProgress?.({
          uploaded: uploadedCount,
          total: totalTracks,
          phase: "saving",
        });

        const signatureTrack = cleanTrackPreviews[0] ?? null;
        const signatureClipDuration = signatureTrack
          ? Math.min(60, Math.max(0, signatureTrack.duration_sec || 0))
          : null;

        try {
          const savedWithPreviews = await services.profileService.saveProfile({
            user_id: session.user.id,
            display_name: input.displayName,
            bio: input.bio || null,
            role: input.role,
            genres: input.genres,
            style_tags: input.styleTags,
            avatar_url: input.avatarUrl,
            audio_clip_url: signatureTrack?.preview_url ?? null,
            audio_clip_duration: signatureClipDuration,
            track_previews: cleanTrackPreviews,
          });

          setProfile(savedWithPreviews);
          enqueueProfileTrackJobs();
          input.onTrackUploadProgress?.({
            uploaded: uploadedCount,
            total: totalTracks,
            phase: "done",
          });
          return;
        } catch {
          const savedWithoutPreviews =
            await services.profileService.saveProfile({
              user_id: session.user.id,
              display_name: input.displayName,
              bio: input.bio || null,
              role: input.role,
              genres: input.genres,
              style_tags: input.styleTags,
              avatar_url: input.avatarUrl,
              audio_clip_url: signatureTrack?.preview_url ?? null,
              audio_clip_duration: signatureClipDuration,
            });

          setProfile({
            ...savedWithoutPreviews,
            track_previews: cleanTrackPreviews,
          });
          enqueueProfileTrackJobs();
          input.onTrackUploadProgress?.({
            uploaded: uploadedCount,
            total: totalTracks,
            phase: "done",
          });
        }
      } finally {
        setIsSavingIdentity(false);
      }
    },
    [enqueueWaveformExtraction, services.profileService, session],
  );

  const handleCompleteOnboardingIdentity = useCallback(
    async (input: {
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
    }) => {
      await handleSaveIdentity(input);
      setOnboardingStep("discover");
    },
    [handleSaveIdentity],
  );

  const handleDiscoverSwipe = async (
    swipedUserId: string,
    direction: "left" | "right",
  ) => {
    if (!session) return;

    const swipedCandidate = discoverCandidates.find(
      (candidate) => candidate.user_id === swipedUserId,
    );

    setDiscoverCandidates((current) =>
      current.filter((candidate) => candidate.user_id !== swipedUserId),
    );

    const match = await services.swipeService.swipe(
      session.user.id,
      swipedUserId,
      direction,
    );

    if (match) {
      await loadMatches();
      const collaboratorId =
        match.user1_id === session.user.id ? match.user2_id : match.user1_id;
      setCelebrationMatch({
        matchId: match.id,
        collaboratorId,
        collaboratorName: swipedCandidate?.display_name ?? "Collaborator",
        collaboratorAvatarUrl: withDefaultAvatar(swipedCandidate?.avatar_url),
        collaboratorRole: swipedCandidate?.role ?? null,
        collaboratorLocation: swipedCandidate?.location ?? null,
      });
      setOnboardingStep("match-celebration");
    }
  };

  const handleOpenChat = (conversationId: string) => {
    const conversation = conversations.find(
      (item) => item.id === conversationId,
    );
    if (!conversation) return;

    setActiveMatchId(conversationToMatch[conversationId]?.id ?? conversationId);
    const collaboratorId = conversationToCollaboratorId[conversationId] ?? null;
    setActiveCollaboratorId(collaboratorId);
    setActiveCollaboratorName(conversation.name);
    setActiveCollaboratorAvatarUrl(withDefaultAvatar(conversation.imageUrl));
    setActiveCollaboratorDetails(null);
    setOnboardingStep("chat");

    if (!collaboratorId) {
      return;
    }

    const discoverSnapshot = discoverCandidates.find(
      (candidate) => candidate.user_id === collaboratorId,
    );
    if (discoverSnapshot) {
      setActiveCollaboratorDetails(
        mapProfileToCollaboratorDetails(discoverSnapshot),
      );
    }

    void (async () => {
      try {
        const collaboratorProfile =
          await services.profileService.getProfile(collaboratorId);
        if (collaboratorProfile) {
          setActiveCollaboratorDetails(
            mapProfileToCollaboratorDetails(collaboratorProfile),
          );
        }
      } catch {
        // Keep snapshot details if loading full profile fails.
      }
    })();
  };

  const handleSendChatMessage = async (content: string) => {
    if (!session || !activeMatchId) return;
    const created = await services.chatService.sendMessage(
      activeMatchId,
      session.user.id,
      content,
    );

    if (created) {
      mergeChatMessage(created);
      await refreshActiveChatRef.current?.();
      if (activeCollaboratorId) {
        await notifyChatRecipient({
          recipientUserId: activeCollaboratorId,
          previewText: content,
        });
      }
    }
  };

  const handleSendChatAudio = async (input: {
    uri: string;
    kind: "voice-note" | "audio-file";
    name?: string;
    mimeType?: string;
    durationMs?: number | null;
    waveformAmplitudes?: number[] | null;
    waveformCoverageMs?: number | null;
    waveformSource?: "preview" | "canonical" | "metering" | null;
  }) => {
    if (!session || !activeMatchId) return;
    const created = await services.chatService.sendAudioMessage(
      activeMatchId,
      session.user.id,
      input,
    );

    if (created) {
      mergeChatMessage(created);
      if (created.file_url) {
        void enqueueWaveformExtraction({
          targetType: "message",
          messageId: created.id,
          audioUrl: created.file_url,
        });
      }
      await refreshActiveChatRef.current?.();
      if (activeCollaboratorId) {
        await notifyChatRecipient({
          recipientUserId: activeCollaboratorId,
          previewText:
            input.kind === "voice-note"
              ? "Sent you a voice message"
              : `Sent you ${input.name ? `"${input.name}"` : "an audio file"}`,
        });
      }
    }
  };

  if (isCheckingSession || isHydratingProfile) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <AuthScreen onAuthenticated={setSession} />
      </SafeAreaProvider>
    );
  }

  const discoverProfiles = discoverCandidates.map((candidate) => ({
    id: candidate.user_id,
    name: candidate.display_name,
    role: candidate.role,
    city: candidate.location ?? "Remote",
    verified: candidate.is_verified,
    imageUrl: withDefaultAvatar(candidate.avatar_url),
    bio: candidate.bio ?? null,
    genres: candidate.genres ?? [],
    tracks: (candidate.track_previews ?? []).map((track) => ({
      id: track.id,
      title: track.title,
      genre: track.genre,
      durationSec: track.duration_sec,
      previewUrl: track.preview_url,
      waveformAmplitudes: track.waveform_amplitudes ?? undefined,
    })),
    signatureTrack: candidate.track_previews?.[0]
      ? {
          id: candidate.track_previews[0].id,
          title: candidate.track_previews[0].title,
          genre: candidate.track_previews[0].genre,
          durationSec: candidate.track_previews[0].duration_sec,
          previewUrl: candidate.track_previews[0].preview_url,
          waveformAmplitudes:
            candidate.track_previews[0].waveform_amplitudes ?? undefined,
        }
      : null,
  }));

  const chatUiMessages: ChatMessage[] = chatMessages.map((message) => ({
    id: message.id,
    kind:
      message.message_kind === "voice-note"
        ? message.sender_id === session.user.id
          ? "outgoing-voice"
          : "incoming-voice"
        : message.message_kind === "audio-file"
          ? message.sender_id === session.user.id
            ? "outgoing-audio-file"
            : "incoming-audio-file"
          : message.sender_id === session.user.id
            ? "outgoing"
            : "incoming",
    text: message.content ?? null,
    audioUrl: message.file_url ?? undefined,
    fileName: message.file_name ?? undefined,
    durationMs:
      message.audio_duration_ms ?? message.waveform_coverage_ms ?? undefined,
    waveformAmplitudes: message.waveform_amplitudes ?? undefined,
    waveformCoverageMs: message.waveform_coverage_ms ?? undefined,
    waveformSource: message.waveform_source ?? undefined,
    time: new Date(message.created_at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }));

  const isCollaboratorActive =
    activeCollaboratorId !== null && onlineUserIds.has(activeCollaboratorId);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      {onboardingStep === "profile" ? (
        <SettingsScreen
          mode="onboarding"
          profile={profile}
          isSavingIdentity={isSavingIdentity}
          onUploadAvatar={handleUploadProfileAvatar}
          onSaveIdentity={handleCompleteOnboardingIdentity}
        />
      ) : onboardingStep === "discover" ? (
        <DiscoverScreen
          profiles={discoverProfiles}
          isLoadingProfiles={isLoadingDiscover}
          onSwipe={handleDiscoverSwipe}
          onOpenMatches={() => setOnboardingStep("matches")}
          onOpenProfile={() => setOnboardingStep("profile-main")}
          onOpenSettings={() => setOnboardingStep("settings-main")}
        />
      ) : onboardingStep === "matches" ? (
        <MatchesScreen
          newMatches={matchCards}
          conversations={conversations}
          isLoading={isLoadingMatches}
          profileAvatarUrl={withDefaultAvatar(profile?.avatar_url)}
          onOpenDiscover={() => setOnboardingStep("discover")}
          onOpenProfile={() => setOnboardingStep("profile-main")}
          onOpenSettings={() => setOnboardingStep("settings-main")}
          onOpenChat={handleOpenChat}
        />
      ) : onboardingStep === "chat" ? (
        <ChatScreen
          collaboratorName={activeCollaboratorName}
          collaboratorAvatarUrl={activeCollaboratorAvatarUrl}
          collaboratorDetails={activeCollaboratorDetails}
          isCollaboratorActive={isCollaboratorActive}
          messages={chatUiMessages}
          isLoading={isLoadingChat}
          onSendMessage={handleSendChatMessage}
          onSendAudioMessage={handleSendChatAudio}
          onBack={() => setOnboardingStep("matches")}
        />
      ) : onboardingStep === "profile-main" ? (
        <ProfileScreen
          profile={profile}
          onOpenDiscover={() => setOnboardingStep("discover")}
          onOpenMatches={() => setOnboardingStep("matches")}
          onOpenSettings={() => setOnboardingStep("settings-main")}
        />
      ) : onboardingStep === "settings-main" ? (
        <SettingsScreen
          onBack={() => setOnboardingStep("profile-main")}
          onOpenDiscover={() => setOnboardingStep("discover")}
          onOpenMatches={() => setOnboardingStep("matches")}
          onOpenProfile={() => setOnboardingStep("profile-main")}
          profile={profile}
          userEmail={session?.user.email ?? null}
          isSavingIdentity={isSavingIdentity}
          onUploadAvatar={handleUploadProfileAvatar}
          onSaveIdentity={handleSaveIdentity}
        />
      ) : (
        <MatchesSplashScreen
          onClose={() => setOnboardingStep("discover")}
          onSendMessage={() => {
            if (!celebrationMatch) {
              setOnboardingStep("matches");
              return;
            }

            setActiveMatchId(celebrationMatch.matchId);
            setActiveCollaboratorId(celebrationMatch.collaboratorId);
            setActiveCollaboratorName(celebrationMatch.collaboratorName);
            setActiveCollaboratorAvatarUrl(
              withDefaultAvatar(celebrationMatch.collaboratorAvatarUrl),
            );
            const discoverSnapshot = discoverCandidates.find(
              (candidate) =>
                candidate.user_id === celebrationMatch.collaboratorId,
            );
            setActiveCollaboratorDetails(
              mapProfileToCollaboratorDetails(discoverSnapshot),
            );
            setOnboardingStep("chat");

            void (async () => {
              try {
                const collaboratorProfile =
                  await services.profileService.getProfile(
                    celebrationMatch.collaboratorId,
                  );
                if (collaboratorProfile) {
                  setActiveCollaboratorDetails(
                    mapProfileToCollaboratorDetails(collaboratorProfile),
                  );
                }
              } catch {
                // Keep snapshot details if loading full profile fails.
              }
            })();
          }}
          onKeepSwiping={() => setOnboardingStep("discover")}
          profileAvatarUrl={withDefaultAvatar(profile?.avatar_url)}
          currentUserName={profile?.display_name ?? "You"}
          currentUserRole={profile?.role ?? null}
          currentUserLocation={profile?.location ?? null}
          matchedName={celebrationMatch?.collaboratorName}
          matchedAvatarUrl={
            celebrationMatch?.collaboratorAvatarUrl ?? withDefaultAvatar(null)
          }
          matchedRole={celebrationMatch?.collaboratorRole ?? null}
          matchedLocation={celebrationMatch?.collaboratorLocation ?? null}
        />
      )}
    </SafeAreaProvider>
  );
}
