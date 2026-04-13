// Implements IMatchRepository using Supabase and mock match fallback.
import { IS_SUPABASE_ENABLED } from "@/src/config/env";
import { RepositoryError } from "@/src/errors";
import {
    mockCreateSwipeAndCheckMatch,
    mockFetchMatches,
} from "@/src/lib/mock-data";
import { supabase } from "@/src/lib/supabase";
import type { Match } from "@/src/models";
import { toSortedPair } from "@/src/utils/helpers";
import type { IMatchRepository } from "../IMatchRepository";

export class SupabaseMatchRepository implements IMatchRepository {
  public async getByUserId(userId: string): Promise<Match[]> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return (await mockFetchMatches(userId)) as Match[];
      }

      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as Match[];
    } catch (error: unknown) {
      throw new RepositoryError("Failed to fetch matches", { userId }, error);
    }
  }

  public async upsertFromUsers(
    userAId: string,
    userBId: string,
  ): Promise<Match> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const match = await mockCreateSwipeAndCheckMatch(
          userAId,
          userBId,
          "right",
        );
        if (!match) {
          throw new Error("Mock match was not created");
        }
        return match as Match;
      }

      const [user1, user2] = toSortedPair(userAId, userBId);
      const { data, error } = await supabase
        .from("matches")
        .upsert(
          { user1_id: user1, user2_id: user2 },
          { onConflict: "user1_id,user2_id" },
        )
        .select()
        .single();

      if (error) throw error;
      return data as Match;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to upsert match",
        { userAId, userBId },
        error,
      );
    }
  }
}
