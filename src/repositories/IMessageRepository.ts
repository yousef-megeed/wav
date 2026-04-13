// Declares message repository operations.
import type {
  AudioUploadInput,
  CreateMessageInput,
  Message,
  TypingEvent,
} from "@/src/models";

export interface IMessageRepository {
  getByMatchId(matchId: string): Promise<Message[]>;
  create(input: CreateMessageInput): Promise<Message | null>;
  uploadAudioFile(
    matchId: string,
    senderId: string,
    input: AudioUploadInput,
  ): Promise<string>;
  markAsRead(matchId: string, readerId: string): Promise<void>;
  subscribeToMatch(
    matchId: string,
    onMessage: (message: Message) => void,
  ): () => void;
  subscribeToMatchUpdates(
    matchId: string,
    onMessageUpdated: (message: Message) => void,
  ): () => void;
  sendTyping(
    matchId: string,
    senderId: string,
    isTyping: boolean,
  ): Promise<void>;
  subscribeToTyping(
    matchId: string,
    onTyping: (event: TypingEvent) => void,
  ): () => void;
}
