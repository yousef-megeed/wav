// Handles chat use cases and delegates persistence/realtime to repositories.
import { ServiceError } from "@/src/errors";
import type { AudioUploadInput, Message, TypingEvent } from "@/src/models";
import type { IMessageRepository } from "@/src/repositories/IMessageRepository";

export class ChatService {
  public constructor(private readonly messageRepository: IMessageRepository) {}

  public async getMessages(matchId: string): Promise<Message[]> {
    try {
      return await this.messageRepository.getByMatchId(matchId);
    } catch (error: unknown) {
      throw new ServiceError("Failed to load messages", { matchId }, error);
    }
  }

  public async sendMessage(
    matchId: string,
    senderId: string,
    content: string,
    fileUrl?: string,
  ): Promise<Message | null> {
    try {
      if (!content.trim() && !fileUrl) {
        throw new ServiceError("Message content or file is required", {
          matchId,
          senderId,
        });
      }

      return await this.messageRepository.create({
        match_id: matchId,
        sender_id: senderId,
        message_kind: "text",
        content: content.trim() ? content : null,
        file_url: fileUrl ?? null,
        file_name: null,
        audio_duration_ms: null,
        waveform_amplitudes: null,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "Failed to send message",
        { matchId, senderId },
        error,
      );
    }
  }

  public async sendAudioMessage(
    matchId: string,
    senderId: string,
    input: AudioUploadInput,
  ): Promise<Message | null> {
    try {
      const mime = input.mimeType?.toLowerCase() ?? "";
      const fileName = input.name?.toLowerCase() ?? "";
      const looksAudio =
        mime.startsWith("audio/") ||
        /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(fileName);

      if (!looksAudio) {
        throw new ServiceError("Only audio files can be sent", {
          matchId,
          senderId,
          mimeType: input.mimeType,
        });
      }

      const uploadedUrl = await this.messageRepository.uploadAudioFile(
        matchId,
        senderId,
        input,
      );

      return await this.messageRepository.create({
        match_id: matchId,
        sender_id: senderId,
        message_kind: input.kind,
        content: null,
        file_url: uploadedUrl,
        file_name: input.kind === "audio-file" ? (input.name ?? null) : null,
        audio_duration_ms: input.durationMs ?? null,
        waveform_amplitudes: input.waveformAmplitudes ?? null,
        waveform_coverage_ms: input.waveformCoverageMs ?? null,
        waveform_source: input.waveformSource ?? null,
      });
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      const message =
        error instanceof Error
          ? `Failed to send audio message: ${error.message}`
          : "Failed to send audio message";
      throw new ServiceError(message, { matchId, senderId }, error);
    }
  }

  public subscribeToMessages(
    matchId: string,
    onMessage: (message: Message) => void,
  ): () => void {
    try {
      return this.messageRepository.subscribeToMatch(matchId, onMessage);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to subscribe to messages",
        { matchId },
        error,
      );
    }
  }

  public subscribeToMessageUpdates(
    matchId: string,
    onMessageUpdated: (message: Message) => void,
  ): () => void {
    try {
      return this.messageRepository.subscribeToMatchUpdates(
        matchId,
        onMessageUpdated,
      );
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to subscribe to message updates",
        { matchId },
        error,
      );
    }
  }

  public async markMessagesAsRead(
    matchId: string,
    readerId: string,
  ): Promise<void> {
    try {
      await this.messageRepository.markAsRead(matchId, readerId);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to mark messages as read",
        { matchId, readerId },
        error,
      );
    }
  }

  public async sendTypingStatus(
    matchId: string,
    senderId: string,
    isTyping: boolean,
  ): Promise<void> {
    try {
      await this.messageRepository.sendTyping(matchId, senderId, isTyping);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to send typing status",
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
      return this.messageRepository.subscribeToTyping(matchId, onTyping);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to subscribe to typing status",
        { matchId },
        error,
      );
    }
  }
}
