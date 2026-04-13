// Declares profile repository operations.
import type { Profile, ProfileSummary, ProfileUpsertInput } from "@/src/models";

export interface IProfileRepository {
  getByUserId(userId: string): Promise<Profile | null>;
  upsert(input: ProfileUpsertInput): Promise<Profile>;
  getSummariesByUserIds(userIds: string[]): Promise<ProfileSummary[]>;
  uploadAvatar(
    userId: string,
    fileUri: string,
    mimeType?: string,
  ): Promise<string>;
  uploadTrackPreview(
    userId: string,
    fileUri: string,
    fileName?: string,
    mimeType?: string,
  ): Promise<string>;
}
