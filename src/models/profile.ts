// Defines profile-related model shapes with no business logic.
export type Role = "producer" | "vocalist" | "rapper" | "songwriter";

export type LinkedAccountProvider = "spotify" | "apple_music" | "soundcloud";

export interface LinkedAccounts {
  spotify_url?: string | null;
  apple_music_url?: string | null;
  soundcloud_url?: string | null;
}

export interface MusicPreview {
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
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  bio: string | null;
  role: Role;
  daw: string | null;
  genres: string[];
  location: string | null;
  avatar_url: string | null;
  expo_push_token?: string | null;
  audio_clip_url: string | null;
  audio_clip_duration: number | null;
  bpm: number | null;
  key: string | null;
  track_previews?: MusicPreview[];
  linked_accounts?: LinkedAccounts | null;
  style_tags: string[];
  is_verified: boolean;
  created_at: string;
}

export interface ProfileSummary {
  user_id: string;
  display_name: string;
  role: Role;
  avatar_url: string | null;
}

export interface ProfileUpsertInput {
  user_id: string;
  display_name?: string;
  bio?: string | null;
  role?: Role;
  daw?: string | null;
  genres?: string[];
  location?: string | null;
  avatar_url?: string | null;
  audio_clip_url?: string | null;
  audio_clip_duration?: number | null;
  bpm?: number | null;
  key?: string | null;
  track_previews?: MusicPreview[];
  linked_accounts?: LinkedAccounts | null;
  style_tags?: string[];
  is_verified?: boolean;
}
