// Handles match-related retrieval logic.
import { ServiceError } from "@/src/errors";
import type { Match } from "@/src/models";
import type { IMatchRepository } from "@/src/repositories/IMatchRepository";

export class MatchService {
  public constructor(private readonly matchRepository: IMatchRepository) {}

  public async getMatches(userId: string): Promise<Match[]> {
    try {
      return await this.matchRepository.getByUserId(userId);
    } catch (error: unknown) {
      throw new ServiceError("Failed to get matches", { userId }, error);
    }
  }
}
