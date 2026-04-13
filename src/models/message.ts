export type MessageKind = "text" | "voice-note" | "audio-file";

// Defines message model shapes.
export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  message_kind: MessageKind;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  audio_duration_ms: number | null;
  waveform_amplitudes: number[] | null;
  waveform_coverage_ms?: number | null;
  waveform_source?: "preview" | "canonical" | "metering" | null;
  read_at: string | null;
  created_at: string;
}

export interface CreateMessageInput {
  match_id: string;
  sender_id: string;
  message_kind: MessageKind;
  content: string | null;
  file_url: string | null;
  file_name?: string | null;
  audio_duration_ms?: number | null;
  waveform_amplitudes?: number[] | null;
  waveform_coverage_ms?: number | null;
  waveform_source?: "preview" | "canonical" | "metering" | null;
}

export interface AudioUploadInput {
  uri: string;
  kind: Extract<MessageKind, "voice-note" | "audio-file">;
  name?: string;
  mimeType?: string;
  durationMs?: number | null;
  waveformAmplitudes?: number[] | null;
  waveformCoverageMs?: number | null;
  waveformSource?: "preview" | "canonical" | "metering" | null;
}

export interface TypingEvent {
  match_id: string;
  sender_id: string;
  is_typing: boolean;
  sent_at: string;
}
