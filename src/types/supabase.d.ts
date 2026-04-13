// Declares a minimal Supabase database contract used for typed query casting.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: { Row: { id: string; email: string | null; created_at: string } };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          display_name: string;
          bio: string | null;
          role: string;
          daw: string | null;
          genres: string[];
          location: string | null;
          avatar_url: string | null;
          expo_push_token: string | null;
          audio_clip_url: string | null;
          audio_clip_duration: number | null;
          track_previews: Json[] | null;
          linked_accounts: Json | null;
          bpm: number | null;
          key: string | null;
          style_tags: string[];
          is_verified: boolean;
          created_at: string;
        };
      };
      swipes: {
        Row: {
          id: string;
          swiper_id: string;
          swiped_id: string;
          direction: "left" | "right";
          created_at: string;
        };
      };
      matches: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          created_at: string;
        };
      };
      messages: {
        Row: {
          id: string;
          match_id: string;
          sender_id: string;
          message_kind: "text" | "voice-note" | "audio-file";
          content: string | null;
          file_url: string | null;
          file_name: string | null;
          audio_duration_ms: number | null;
          waveform_amplitudes: number[] | null;
          waveform_coverage_ms: number | null;
          waveform_source: "preview" | "canonical" | "metering" | null;
          read_at: string | null;
          created_at: string;
        };
      };
    };
  };
}
