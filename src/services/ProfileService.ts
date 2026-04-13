// Handles profile use cases and validation rules.
import { ServiceError } from "@/src/errors";
import type { Profile, ProfileSummary, ProfileUpsertInput } from "@/src/models";
import type { IProfileRepository } from "@/src/repositories/IProfileRepository";
import { isNonEmptyText } from "@/src/utils/validators";

export class ProfileService {
  public constructor(private readonly profileRepository: IProfileRepository) {}

  public async uploadProfileAvatar(
    userId: string,
    fileUri: string,
    mimeType?: string,
  ): Promise<string> {
    try {
      if (!isNonEmptyText(userId) || !isNonEmptyText(fileUri)) {
        throw new ServiceError("User and file are required for avatar upload");
      }
      return await this.profileRepository.uploadAvatar(
        userId,
        fileUri,
        mimeType,
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "Failed to upload profile avatar",
        { userId },
        error,
      );
    }
  }

  public async uploadTrackPreview(
    userId: string,
    fileUri: string,
    fileName?: string,
    mimeType?: string,
  ): Promise<string> {
    try {
      if (!isNonEmptyText(userId) || !isNonEmptyText(fileUri)) {
        throw new ServiceError("User and file are required for track upload");
      }
      return await this.profileRepository.uploadTrackPreview(
        userId,
        fileUri,
        fileName,
        mimeType,
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "Failed to upload profile track preview",
        { userId },
        error,
      );
    }
  }

  public async getProfile(userId: string): Promise<Profile | null> {
    try {
      return await this.profileRepository.getByUserId(userId);
    } catch (error: unknown) {
      throw new ServiceError("Failed to load profile", { userId }, error);
    }
  }

  public async saveProfile(input: ProfileUpsertInput): Promise<Profile> {
    try {
      if (
        input.display_name !== undefined &&
        !isNonEmptyText(input.display_name)
      ) {
        throw new ServiceError("Display name is required");
      }
      return await this.profileRepository.upsert(input);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        "Failed to save profile",
        { userId: input.user_id },
        error,
      );
    }
  }

  public async getProfileSummaries(
    userIds: string[],
  ): Promise<ProfileSummary[]> {
    try {
      return await this.profileRepository.getSummariesByUserIds(userIds);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to fetch profile summaries",
        { userIds },
        error,
      );
    }
  }
}
