// Declares swipe repository operations.
import type { Profile, SwipeDirection } from "@/src/models";

export interface ISwipeRepository {
  getCandidatesForUser(userId: string): Promise<Profile[]>;
  createSwipe(
    swiperId: string,
    swipedId: string,
    direction: SwipeDirection,
  ): Promise<void>;
  hasReciprocalRightSwipe(swiperId: string, swipedId: string): Promise<boolean>;
}
