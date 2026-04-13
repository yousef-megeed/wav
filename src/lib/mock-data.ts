// Provides in-memory mock data providers used by repository fallback mode.
import type { Match, Message, Profile, TypingEvent } from "@/src/models";

type MessageListener = (message: Message) => void;
type TypingListener = (event: TypingEvent) => void;

const listenersByMatch = new Map<string, Set<MessageListener>>();
const typingListenersByMatch = new Map<string, Set<TypingListener>>();

const profiles: Profile[] = [
  {
    id: "profile-test-user-1",
    user_id: "test-user-1",
    display_name: "You",
    bio: "Creator testing WAV locally.",
    role: "producer",
    daw: "Ableton",
    genres: ["Hip Hop", "R&B"],
    location: "New York",
    avatar_url: null,
    audio_clip_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    audio_clip_duration: 60,
    bpm: 140,
    key: "A minor",
    linked_accounts: null,
    track_previews: [
      {
        id: "track-you-1",
        title: "Midnight Bounce",
        genre: "Hip Hop",
        bpm: 140,
        key: "A minor",
        duration_sec: 30,
        preview_url:
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      },
    ],
    style_tags: ["dark", "bounce"],
    is_verified: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "profile-2",
    user_id: "test-user-2",
    display_name: "Luna Vox",
    bio: "Hooks and harmonies.",
    role: "vocalist",
    daw: "Logic",
    genres: ["Pop", "R&B"],
    location: "Los Angeles",
    avatar_url: null,
    audio_clip_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    audio_clip_duration: 60,
    bpm: 122,
    key: "C major",
    linked_accounts: null,
    track_previews: [
      {
        id: "track-luna-1",
        title: "Neon Hooks",
        genre: "Pop",
        bpm: 122,
        key: "C major",
        duration_sec: 25,
        preview_url:
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      },
      {
        id: "track-luna-2",
        title: "Velvet Chorus",
        genre: "R&B",
        bpm: 118,
        key: "D minor",
        duration_sec: 30,
        preview_url:
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      },
    ],
    style_tags: ["melodic"],
    is_verified: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "profile-3",
    user_id: "test-user-3",
    display_name: "Kilo Bars",
    bio: "Punchlines and cadence.",
    role: "rapper",
    daw: "FL Studio",
    genres: ["Trap", "Drill"],
    location: "Atlanta",
    avatar_url: null,
    audio_clip_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    audio_clip_duration: 60,
    bpm: 150,
    key: "F# minor",
    linked_accounts: null,
    track_previews: [
      {
        id: "track-kilo-1",
        title: "Drill Cipher",
        genre: "Drill",
        bpm: 150,
        key: "F# minor",
        duration_sec: 20,
        preview_url:
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      },
      {
        id: "track-kilo-2",
        title: "Trap Season",
        genre: "Trap",
        bpm: 148,
        key: "G minor",
        duration_sec: 30,
        preview_url:
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      },
    ],
    style_tags: ["aggressive"],
    is_verified: false,
    created_at: new Date().toISOString(),
  },
  {
    id: "profile-4",
    user_id: "test-user-4",
    display_name: "Nia Notes",
    bio: "Topline songwriter.",
    role: "songwriter",
    daw: "GarageBand",
    genres: ["Afrobeats", "Pop"],
    location: "London",
    avatar_url: null,
    audio_clip_url:
      "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
    audio_clip_duration: 60,
    bpm: 108,
    key: "D major",
    linked_accounts: null,
    track_previews: [
      {
        id: "track-nia-1",
        title: "Sunset Topline",
        genre: "Afrobeats",
        bpm: 108,
        key: "D major",
        duration_sec: 35,
        preview_url:
          "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      },
    ],
    style_tags: ["warm"],
    is_verified: false,
    created_at: new Date().toISOString(),
  },
];

const swipes = new Map<string, Map<string, "left" | "right">>();
const matches: Match[] = [];
const messagesByMatch = new Map<string, Message[]>();

const getSwipeMap = (userId: string) => {
  const existing = swipes.get(userId);
  if (existing) return existing;
  const next = new Map<string, "left" | "right">();
  swipes.set(userId, next);
  return next;
};

export const mockGetProfile = async (userId: string) => {
  return profiles.find((item) => item.user_id === userId) ?? null;
};

export const mockUpsertProfile = async (
  userId: string,
  updates: Partial<Profile> & { user_id: string },
) => {
  const idx = profiles.findIndex((item) => item.user_id === userId);
  const current = idx >= 0 ? profiles[idx] : null;

  const merged: Profile = {
    id: current?.id ?? `profile-${userId}`,
    user_id: userId,
    display_name: updates.display_name ?? current?.display_name ?? "",
    bio: updates.bio ?? current?.bio ?? null,
    role: (updates.role as Profile["role"]) ?? current?.role ?? "producer",
    daw: updates.daw ?? current?.daw ?? null,
    genres: updates.genres ?? current?.genres ?? [],
    location: updates.location ?? current?.location ?? null,
    avatar_url: updates.avatar_url ?? current?.avatar_url ?? null,
    audio_clip_url: updates.audio_clip_url ?? current?.audio_clip_url ?? null,
    audio_clip_duration:
      updates.audio_clip_duration ?? current?.audio_clip_duration ?? null,
    bpm: updates.bpm ?? current?.bpm ?? null,
    key: updates.key ?? current?.key ?? null,
    linked_accounts:
      updates.linked_accounts ?? current?.linked_accounts ?? null,
    track_previews: updates.track_previews ?? current?.track_previews ?? [],
    style_tags: updates.style_tags ?? current?.style_tags ?? [],
    is_verified: updates.is_verified ?? current?.is_verified ?? false,
    created_at: current?.created_at ?? new Date().toISOString(),
  };

  if (idx >= 0) {
    profiles[idx] = merged;
  } else {
    profiles.push(merged);
  }

  return merged;
};

export const mockFetchSwipeCandidates = async (me: string) => {
  const meSwipes = getSwipeMap(me);
  return profiles.filter(
    (profile) => profile.user_id !== me && !meSwipes.has(profile.user_id),
  );
};

export const mockCreateSwipeAndCheckMatch = async (
  swiperId: string,
  swipedId: string,
  direction: "left" | "right",
) => {
  getSwipeMap(swiperId).set(swipedId, direction);

  if (direction !== "right") return null;

  const reciprocal = getSwipeMap(swipedId).get(swiperId) === "right";
  if (!reciprocal) {
    // Seed one instant match in local mode for testing chat quickly.
    if (swipedId === "test-user-2") {
      getSwipeMap(swipedId).set(swiperId, "right");
    } else {
      return null;
    }
  }

  const user1 = [swiperId, swipedId].sort()[0];
  const user2 = [swiperId, swipedId].sort()[1];
  const existing = matches.find(
    (m) => m.user1_id === user1 && m.user2_id === user2,
  );
  if (existing) return existing;

  const match: Match = {
    id: `match-${user1}-${user2}`,
    user1_id: user1,
    user2_id: user2,
    created_at: new Date().toISOString(),
  };

  matches.unshift(match);
  if (!messagesByMatch.has(match.id)) messagesByMatch.set(match.id, []);
  return match;
};

export const mockFetchMatches = async (me: string) => {
  return matches.filter((m) => m.user1_id === me || m.user2_id === me);
};

export const mockFetchProfilesByUserIds = async (userIds: string[]) => {
  return profiles
    .filter((p) => userIds.includes(p.user_id))
    .map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      role: p.role,
      avatar_url: p.avatar_url,
    }));
};

export const mockFetchMessages = async (matchId: string) => {
  return [...(messagesByMatch.get(matchId) ?? [])];
};

export const mockCreateLocalTestChat = async (
  me: string,
  otherId = "test-user-2",
) => {
  const match = await mockCreateSwipeAndCheckMatch(me, otherId, "right");
  if (!match) {
    throw new Error("Could not create local test match");
  }

  const seeded = messagesByMatch.get(match.id) ?? [];
  if (seeded.length === 0) {
    const starter: Message[] = [
      {
        id: `msg-${Date.now()}-seed-1`,
        match_id: match.id,
        sender_id: otherId,
        message_kind: "text",
        content: "Yo! I like your sound. Want to collab on a hook?",
        file_url: null,
        file_name: null,
        audio_duration_ms: null,
        waveform_amplitudes: null,
        read_at: null,
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: `msg-${Date.now()}-seed-2`,
        match_id: match.id,
        sender_id: me,
        message_kind: "text",
        content: "Absolutely. Send me the BPM and key.",
        file_url: null,
        file_name: null,
        audio_duration_ms: null,
        waveform_amplitudes: null,
        read_at: null,
        created_at: new Date(Date.now() - 30_000).toISOString(),
      },
    ];
    messagesByMatch.set(match.id, starter);
  }

  return match;
};

export const mockSendMessage = async (
  matchId: string,
  senderId: string,
  content: string,
  fileUrl?: string,
  meta?: {
    messageKind?: "text" | "voice-note" | "audio-file";
    fileName?: string | null;
    audioDurationMs?: number | null;
    waveformAmplitudes?: number[] | null;
    waveformCoverageMs?: number | null;
    waveformSource?: "preview" | "canonical" | "metering" | null;
  },
) => {
  const message: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    match_id: matchId,
    sender_id: senderId,
    message_kind: meta?.messageKind ?? (fileUrl ? "audio-file" : "text"),
    content: content || null,
    file_url: fileUrl ?? null,
    file_name: meta?.fileName ?? null,
    audio_duration_ms: meta?.audioDurationMs ?? null,
    waveform_amplitudes: meta?.waveformAmplitudes ?? null,
    waveform_coverage_ms: meta?.waveformCoverageMs ?? null,
    waveform_source: meta?.waveformSource ?? null,
    read_at: null,
    created_at: new Date().toISOString(),
  };

  const current = messagesByMatch.get(matchId) ?? [];
  const next = [...current, message];
  messagesByMatch.set(matchId, next);

  const listeners = listenersByMatch.get(matchId);
  listeners?.forEach((listener) => listener(message));

  return message;
};

export const mockMarkMessagesAsRead = async (
  matchId: string,
  readerId: string,
) => {
  const current = messagesByMatch.get(matchId) ?? [];
  const readAt = new Date().toISOString();
  const updated = current.map((message) => {
    if (message.sender_id === readerId || message.read_at) {
      return message;
    }
    return {
      ...message,
      read_at: readAt,
    };
  });
  messagesByMatch.set(matchId, updated);

  const listeners = listenersByMatch.get(matchId);
  if (!listeners) return;

  updated.forEach((message) => {
    if (message.sender_id !== readerId && message.read_at === readAt) {
      listeners.forEach((listener) => listener(message));
    }
  });
};

export const mockSubscribeMessages = (
  matchId: string,
  listener: MessageListener,
) => {
  const current = listenersByMatch.get(matchId) ?? new Set<MessageListener>();
  current.add(listener);
  listenersByMatch.set(matchId, current);

  return () => {
    const next = listenersByMatch.get(matchId);
    next?.delete(listener);
  };
};

export const mockSendTypingEvent = async (
  matchId: string,
  senderId: string,
  isTyping: boolean,
) => {
  const event: TypingEvent = {
    match_id: matchId,
    sender_id: senderId,
    is_typing: isTyping,
    sent_at: new Date().toISOString(),
  };

  const listeners = typingListenersByMatch.get(matchId);
  listeners?.forEach((listener) => listener(event));
};

export const mockSubscribeTyping = (
  matchId: string,
  listener: TypingListener,
) => {
  const current =
    typingListenersByMatch.get(matchId) ?? new Set<TypingListener>();
  current.add(listener);
  typingListenersByMatch.set(matchId, current);

  return () => {
    const next = typingListenersByMatch.get(matchId);
    next?.delete(listener);
    if (next && next.size === 0) {
      typingListenersByMatch.delete(matchId);
    }
  };
};
