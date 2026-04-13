// Declares match repository operations.
import type { Match } from "@/src/models";

export interface IMatchRepository {
  getByUserId(userId: string): Promise<Match[]>;
  upsertFromUsers(userAId: string, userBId: string): Promise<Match>;
}
