// Implements IMessageRepository using Supabase and mock message fallback.
import { IS_SUPABASE_ENABLED } from "@/src/config/env";
import { RepositoryError } from "@/src/errors";
import {
    mockFetchMessages,
    mockMarkMessagesAsRead,
    mockSendMessage,
    mockSendTypingEvent,
    mockSubscribeMessages,
    mockSubscribeTyping,
} from "@/src/lib/mock-data";
import { removeRealtimeChannel } from "@/src/lib/realtime";
import { supabase } from "@/src/lib/supabase";
import type {
    AudioUploadInput,
    CreateMessageInput,
    Message,
    TypingEvent,
} from "@/src/models";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { IMessageRepository } from "../IMessageRepository";

const CHAT_AUDIO_BUCKET = "chat-audio";

export class SupabaseMessageRepository implements IMessageRepository {
  private readonly typingChannels = new Map<string, RealtimeChannel>();

  private getAudioExtension(input: AudioUploadInput): string {
    const byName = input.name?.split(".").pop()?.toLowerCase();
    if (byName) return byName;

    const mime = input.mimeType?.toLowerCase() ?? "";
    if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
    if (mime.includes("wav")) return "wav";
    if (mime.includes("ogg")) return "ogg";
    if (mime.includes("aac")) return "aac";
    if (mime.includes("m4a") || mime.includes("mp4")) return "m4a";
    return "mp3";
  }

  public async getByMatchId(matchId: string): Promise<Message[]> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return (await mockFetchMessages(matchId)) as Message[];
      }

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Message[];
    } catch (error: unknown) {
      throw new RepositoryError("Failed to load messages", { matchId }, error);
    }
  }

  public async create(input: CreateMessageInput): Promise<Message | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const created = await mockSendMessage(
          input.match_id,
          input.sender_id,
          input.content ?? "",
          input.file_url ?? undefined,
          {
            messageKind: input.message_kind,
            fileName: input.file_name ?? null,
            audioDurationMs: input.audio_duration_ms ?? null,
            waveformAmplitudes: input.waveform_amplitudes ?? null,
            waveformCoverageMs: input.waveform_coverage_ms ?? null,
            waveformSource: input.waveform_source ?? null,
          },
        );
        return created as Message;
      }

      const { data, error } = await supabase
        .from("messages")
        .insert(input)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as Message | null) ?? null;
    } catch (error: unknown) {
      throw new RepositoryError("Failed to create message", { input }, error);
    }
  }

  public async uploadAudioFile(
    matchId: string,
    senderId: string,
    input: AudioUploadInput,
  ): Promise<string> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return input.uri;
      }

      const extension = this.getAudioExtension(input);
      const path = `${matchId}/${senderId}-${Date.now()}.${extension}`;
      const response = await fetch(input.uri);
      if (!response.ok) {
        throw new Error("Could not read selected audio file");
      }
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(CHAT_AUDIO_BUCKET)
        .upload(path, arrayBuffer, {
          contentType: input.mimeType ?? "audio/mpeg",
          upsert: false,
        });

      if (uploadError) {
        if (/bucket.*not.*found|not found/i.test(uploadError.message)) {
          throw new Error(
            `Storage bucket '${CHAT_AUDIO_BUCKET}' not found. Create it in Supabase Storage.`,
          );
        }
        if (/permission denied|row level security/i.test(uploadError.message)) {
          throw new Error(
            `Storage policy denied upload to '${CHAT_AUDIO_BUCKET}'. Update bucket policies for authenticated users.`,
          );
        }
        throw uploadError;
      }

      const { data: publicData } = supabase.storage
        .from(CHAT_AUDIO_BUCKET)
        .getPublicUrl(path);

      if (publicData.publicUrl) {
        return publicData.publicUrl;
      }

      const { data: signedData, error: signedError } = await supabase.storage
        .from(CHAT_AUDIO_BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signedError) {
        if (/permission denied|row level security/i.test(signedError.message)) {
          throw new Error(
            `Upload succeeded but read access is blocked on '${CHAT_AUDIO_BUCKET}'. Update bucket read policies.`,
          );
        }
        throw signedError;
      }

      return signedData.signedUrl;
    } catch (error: unknown) {
      const detail = error instanceof Error ? `: ${error.message}` : "";
      throw new RepositoryError(
        `Failed to upload chat audio${detail}`,
        { matchId, senderId },
        error,
      );
    }
  }

  public async markAsRead(matchId: string, readerId: string): Promise<void> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        await mockMarkMessagesAsRead(matchId, readerId);
        return;
      }

      const readAt = new Date().toISOString();
      const { error } = await supabase
        .from("messages")
        .update({ read_at: readAt })
        .eq("match_id", matchId)
        .neq("sender_id", readerId)
        .is("read_at", null);

      if (error) {
        if (
          /column .*read_at/i.test(error.message) ||
          /permission denied/i.test(error.message)
        ) {
          return;
        }
        throw error;
      }
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to mark messages as read",
        { matchId, readerId },
        error,
      );
    }
  }

  public subscribeToMatch(
    matchId: string,
    onMessage: (message: Message) => void,
  ): () => void {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return mockSubscribeMessages(matchId, (message) =>
          onMessage(message as Message),
        );
      }

      const channel = supabase
        .channel(`chat-${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            onMessage(payload.new as Message);
          },
        )
        .subscribe();

      return () => {
        removeRealtimeChannel(channel);
      };
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to subscribe to messages",
        { matchId },
        error,
      );
    }
  }

  public subscribeToMatchUpdates(
    matchId: string,
    onMessageUpdated: (message: Message) => void,
  ): () => void {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return () => {
          // Mock mode emits read updates through message listeners.
        };
      }

      const channel = supabase
        .channel(`chat-updates-${matchId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `match_id=eq.${matchId}`,
          },
          (payload) => {
            onMessageUpdated(payload.new as Message);
          },
        )
        .subscribe();

      return () => {
        removeRealtimeChannel(channel);
      };
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to subscribe to message updates",
        { matchId },
        error,
      );
    }
  }

  public async sendTyping(
    matchId: string,
    senderId: string,
    isTyping: boolean,
  ): Promise<void> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        await mockSendTypingEvent(matchId, senderId, isTyping);
        return;
      }

      const channel = this.getOrCreateTypingChannel(matchId);
      const status = await channel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          match_id: matchId,
          sender_id: senderId,
          is_typing: isTyping,
          sent_at: new Date().toISOString(),
        } satisfies TypingEvent,
      });

      if (status !== "ok") {
        throw new Error(`Typing broadcast failed with status: ${status}`);
      }
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to send typing event",
        { matchId, senderId, isTyping },
        error,
      );
    }
  }

  public subscribeToTyping(
    matchId: string,
    onTyping: (event: TypingEvent) => void,
  ): () => void {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return mockSubscribeTyping(matchId, onTyping);
      }

      const channel = this.getOrCreateTypingChannel(matchId)
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          onTyping(payload as TypingEvent);
        })
        .subscribe();

      return () => {
        removeRealtimeChannel(channel);
        this.typingChannels.delete(matchId);
      };
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to subscribe to typing events",
        { matchId },
        error,
      );
    }
  }

  private getOrCreateTypingChannel(matchId: string): RealtimeChannel {
    const existing = this.typingChannels.get(matchId);
    if (existing) return existing;

    const channel = supabase.channel(`typing-${matchId}`);
    this.typingChannels.set(matchId, channel);
    return channel;
  }
}
