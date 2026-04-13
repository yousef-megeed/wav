// Implements ISwipeRepository using Supabase and mock swipe fallback.
import { SWIPE_CANDIDATE_LIMIT } from "@/src/config/constants";
import { IS_SUPABASE_ENABLED } from "@/src/config/env";
import { RepositoryError } from "@/src/errors";
import {
    mockCreateSwipeAndCheckMatch,
    mockFetchSwipeCandidates,
} from "@/src/lib/mock-data";
import { supabase } from "@/src/lib/supabase";
import type { Profile, SwipeDirection } from "@/src/models";
import type { ISwipeRepository } from "../ISwipeRepository";

export class SupabaseSwipeRepository implements ISwipeRepository {
  public async getCandidatesForUser(userId: string): Promise<Profile[]> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return (await mockFetchSwipeCandidates(userId)) as Profile[];
      }

      const { data: swiped, error: swipedError } = await supabase
        .from("swipes")
        .select("swiped_id")
        .eq("swiper_id", userId);
      if (swipedError) throw swipedError;

      const excluded = [
        userId,
        ...(swiped ?? []).map((item) => item.swiped_id),
      ];
      const exclusion = `(${excluded.map((id) => `\"${id}\"`).join(",")})`;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .not("user_id", "in", exclusion)
        .limit(SWIPE_CANDIDATE_LIMIT);
      if (error) throw error;

      return (data ?? []) as Profile[];
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to fetch swipe candidates",
        { userId },
        error,
      );
    }
  }

  public async createSwipe(
    swiperId: string,
    swipedId: string,
    direction: SwipeDirection,
  ): Promise<void> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        await mockCreateSwipeAndCheckMatch(swiperId, swipedId, direction);
        return;
      }

      const { error } = await supabase.from("swipes").insert({
        swiper_id: swiperId,
        swiped_id: swipedId,
        direction,
      });
      if (error) throw error;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to create swipe",
        { swiperId, swipedId, direction },
        error,
      );
    }
  }

  public async hasReciprocalRightSwipe(
    swiperId: string,
    swipedId: string,
  ): Promise<boolean> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const match = await mockCreateSwipeAndCheckMatch(
          swiperId,
          swipedId,
          "right",
        );
        return Boolean(match);
      }

      const { data, error } = await supabase
        .from("swipes")
        .select("id")
        .eq("swiper_id", swipedId)
        .eq("swiped_id", swiperId)
        .eq("direction", "right")
        .maybeSingle();

      if (error) throw error;
      return Boolean(data);
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to check reciprocal swipe",
        { swiperId, swipedId },
        error,
      );
    }
  }
}
