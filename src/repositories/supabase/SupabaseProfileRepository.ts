// Implements IProfileRepository using Supabase and mock profile fallback.
import { SWIPE_CANDIDATE_LIMIT } from "@/src/config/constants";
import { IS_SUPABASE_ENABLED } from "@/src/config/env";
import { RepositoryError } from "@/src/errors";
import {
  mockFetchProfilesByUserIds,
  mockGetProfile,
  mockUpsertProfile,
} from "@/src/lib/mock-data";
import { getFileExtension } from "@/src/lib/storage";
import { supabase } from "@/src/lib/supabase";
import type { Profile, ProfileSummary, ProfileUpsertInput } from "@/src/models";
import type { IProfileRepository } from "../IProfileRepository";

const PROFILE_PICTURE_BUCKET_CANDIDATES = [
  "profile pictures",
  "profile-pictures",
  "profile_pictures",
] as const;

const PROFILE_TRACK_BUCKET_CANDIDATES = [
  "chat-audio",
  "profile-tracks",
] as const;

const appendCacheBust = (url: string): string => {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const isRetryableUploadError = (message?: string): boolean => {
  if (!message) return false;
  return /(invalid jwt|jwt|token|session|network|fetch|timed out|timeout|503|429)/i.test(
    message,
  );
};

const uploadWithSessionRetry = async (
  bucketId: string,
  storagePath: string,
  body: ArrayBuffer,
  options: {
    contentType: string;
    upsert: boolean;
  },
) => {
  let lastError: { message: string } | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { error } = await supabase.storage
      .from(bucketId)
      .upload(storagePath, body, options);

    if (!error) {
      return { error: null };
    }

    lastError = error;
    const shouldRetry = attempt === 0 && isRetryableUploadError(error.message);
    if (!shouldRetry) {
      return { error };
    }

    try {
      await supabase.auth.refreshSession();
    } catch {
      // Continue with one retry even if refresh fails.
    }
    await wait(250);
  }

  return {
    error: lastError
      ? { message: lastError.message }
      : { message: "Upload failed" },
  };
};

export class SupabaseProfileRepository implements IProfileRepository {
  public async uploadAvatar(
    userId: string,
    fileUri: string,
    mimeType?: string,
  ): Promise<string> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return fileUri;
      }

      const extension = getFileExtension(fileUri) || "jpg";
      const normalizedExtension = extension === "jpeg" ? "jpg" : extension;
      const contentType =
        mimeType ??
        {
          png: "image/png",
          jpg: "image/jpeg",
          webp: "image/webp",
          heic: "image/heic",
        }[normalizedExtension] ??
        "image/jpeg";

      const storagePath = `${userId}/avatar.${normalizedExtension}`;
      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error("Could not read selected image file");
      }
      const arrayBuffer = await response.arrayBuffer();

      let lastError: Error | null = null;

      for (const bucketId of PROFILE_PICTURE_BUCKET_CANDIDATES) {
        const { error: uploadError } = await uploadWithSessionRetry(
          bucketId,
          storagePath,
          arrayBuffer,
          {
            contentType,
            upsert: true,
          },
        );

        if (uploadError) {
          if (/bucket.*not.*found|not found/i.test(uploadError.message)) {
            lastError = new Error(`Bucket '${bucketId}' was not found.`);
            continue;
          }

          if (
            /permission denied|row level security/i.test(uploadError.message)
          ) {
            throw new Error(
              `Upload blocked by storage policy on '${bucketId}'.`,
            );
          }

          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from(bucketId)
          .getPublicUrl(storagePath);

        if (publicData.publicUrl) {
          return appendCacheBust(publicData.publicUrl);
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucketId)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);
        if (signedError) {
          throw signedError;
        }

        return appendCacheBust(signedData.signedUrl);
      }

      throw new Error(
        lastError?.message ??
          "Could not find a valid profile picture storage bucket.",
      );
    } catch (error: unknown) {
      throw new RepositoryError(
        error instanceof Error
          ? `Failed to upload profile avatar: ${error.message}`
          : "Failed to upload profile avatar",
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
      if (!IS_SUPABASE_ENABLED) {
        return fileUri;
      }

      const extension = getFileExtension(fileName || fileUri) || "mp3";
      const normalizedExtension = extension.toLowerCase();
      const contentType =
        mimeType ??
        {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          m4a: "audio/m4a",
          aac: "audio/aac",
          ogg: "audio/ogg",
          flac: "audio/flac",
        }[normalizedExtension] ??
        "audio/mpeg";

      const safeFileName = (fileName ?? `track-${Date.now()}`)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.[^.]+$/, "");
      const uniqueSuffix = Math.random().toString(36).slice(2, 10);
      const storagePath = `${userId}/tracks/${Date.now()}-${uniqueSuffix}-${safeFileName}.${normalizedExtension}`;

      const response = await fetch(fileUri);
      if (!response.ok) {
        throw new Error("Could not read selected audio file");
      }
      const arrayBuffer = await response.arrayBuffer();

      let lastError: Error | null = null;

      for (const bucketId of PROFILE_TRACK_BUCKET_CANDIDATES) {
        const { error: uploadError } = await uploadWithSessionRetry(
          bucketId,
          storagePath,
          arrayBuffer,
          {
            contentType,
            upsert: false,
          },
        );

        if (uploadError) {
          if (/bucket.*not.*found|not found/i.test(uploadError.message)) {
            lastError = new Error(`Bucket '${bucketId}' was not found.`);
            continue;
          }

          if (
            /permission denied|row level security/i.test(uploadError.message)
          ) {
            throw new Error(
              `Upload blocked by storage policy on '${bucketId}'.`,
            );
          }

          throw uploadError;
        }

        const { data: publicData } = supabase.storage
          .from(bucketId)
          .getPublicUrl(storagePath);

        if (publicData.publicUrl) {
          return publicData.publicUrl;
        }

        const { data: signedData, error: signedError } = await supabase.storage
          .from(bucketId)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 30);
        if (signedError) {
          throw signedError;
        }

        return signedData.signedUrl;
      }

      throw new Error(
        lastError?.message ??
          "Could not find a valid profile track storage bucket.",
      );
    } catch (error: unknown) {
      throw new RepositoryError(
        error instanceof Error
          ? `Failed to upload profile track preview: ${error.message}`
          : "Failed to upload profile track preview",
        { userId },
        error,
      );
    }
  }

  public async getByUserId(userId: string): Promise<Profile | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const profile = await mockGetProfile(userId);
        return profile as Profile | null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to fetch profile by user id",
        { userId },
        error,
      );
    }
  }

  public async upsert(input: ProfileUpsertInput): Promise<Profile> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return (await mockUpsertProfile(input.user_id, input)) as Profile;
      }

      const { data, error } = await supabase
        .from("profiles")
        .upsert(input, { onConflict: "user_id" })
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to upsert profile",
        { userId: input.user_id },
        error,
      );
    }
  }

  public async getSummariesByUserIds(
    userIds: string[],
  ): Promise<ProfileSummary[]> {
    try {
      if (userIds.length === 0) return [];

      if (!IS_SUPABASE_ENABLED) {
        return (await mockFetchProfilesByUserIds(userIds)) as ProfileSummary[];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, role, avatar_url")
        .in("user_id", userIds)
        .limit(Math.max(userIds.length, SWIPE_CANDIDATE_LIMIT));

      if (error) throw error;
      return (data ?? []) as ProfileSummary[];
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to fetch profile summaries",
        { userIds },
        error,
      );
    }
  }
}
