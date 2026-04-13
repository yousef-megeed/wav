// Handles swipe use cases and match detection business logic.
import { ServiceError } from "@/src/errors";
import type { Match, Profile, SwipeDirection } from "@/src/models";
import type { IMatchRepository } from "@/src/repositories/IMatchRepository";
import type { ISwipeRepository } from "@/src/repositories/ISwipeRepository";

export class SwipeService {
  public constructor(
    private readonly swipeRepository: ISwipeRepository,
    private readonly matchRepository: IMatchRepository,
  ) {}

  public async getCandidates(userId: string): Promise<Profile[]> {
    try {
      return await this.swipeRepository.getCandidatesForUser(userId);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to get swipe candidates",
        { userId },
        error,
      );
    }
  }

  public async swipe(
    swiperId: string,
    swipedId: string,
    direction: SwipeDirection,
  ): Promise<Match | null> {
    try {
      await this.swipeRepository.createSwipe(swiperId, swipedId, direction);
      if (direction === "left") {
        return null;
      }

      // In Supabase mode, DB trigger creates the match on swipe insert when reciprocal exists.
      // Read matches first because RLS can block direct reciprocal swipe reads.
      const existingMatches = await this.matchRepository.getByUserId(swiperId);
      const existing = existingMatches.find((match) => {
        const a = match.user1_id;
        const b = match.user2_id;
        return (
          (a === swiperId && b === swipedId) ||
          (a === swipedId && b === swiperId)
        );
      });
      if (existing) {
        return existing;
      }

      const isMatch = await this.swipeRepository.hasReciprocalRightSwipe(
        swiperId,
        swipedId,
      );
      if (!isMatch) {
        return null;
      }

      return await this.matchRepository.upsertFromUsers(swiperId, swipedId);
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to process swipe",
        { swiperId, swipedId, direction },
        error,
      );
    }
  }
}
