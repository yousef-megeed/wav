// Builds repository instances used by the service layer.
import type { IMatchRepository } from "./IMatchRepository";
import type { IMessageRepository } from "./IMessageRepository";
import type { IProfileRepository } from "./IProfileRepository";
import type { ISwipeRepository } from "./ISwipeRepository";
import type { IUserRepository } from "./IUserRepository";
import { SupabaseMatchRepository } from "./supabase/SupabaseMatchRepository";
import { SupabaseMessageRepository } from "./supabase/SupabaseMessageRepository";
import { SupabaseProfileRepository } from "./supabase/SupabaseProfileRepository";
import { SupabaseSwipeRepository } from "./supabase/SupabaseSwipeRepository";
import { SupabaseUserRepository } from "./supabase/SupabaseUserRepository";

export interface RepositoryContainer {
  userRepository: IUserRepository;
  profileRepository: IProfileRepository;
  swipeRepository: ISwipeRepository;
  matchRepository: IMatchRepository;
  messageRepository: IMessageRepository;
}

export const createRepositories = (): RepositoryContainer => ({
  userRepository: new SupabaseUserRepository(),
  profileRepository: new SupabaseProfileRepository(),
  swipeRepository: new SupabaseSwipeRepository(),
  matchRepository: new SupabaseMatchRepository(),
  messageRepository: new SupabaseMessageRepository(),
});
