// Creates service instances composed from repository instances.
import {
    createRepositories,
    type RepositoryContainer,
} from "@/src/repositories";
import { AudioService } from "./AudioService";
import { AuthService } from "./AuthService";
import { ChatService } from "./ChatService";
import { MatchService } from "./MatchService";
import { NotificationService } from "./NotificationService";
import { ProfileService } from "./ProfileService";
import { SwipeService } from "./SwipeService";

export interface ServiceContainer {
  authService: AuthService;
  profileService: ProfileService;
  swipeService: SwipeService;
  matchService: MatchService;
  chatService: ChatService;
  audioService: AudioService;
  notificationService: NotificationService;
}

export const createServices = (
  repositories: RepositoryContainer = createRepositories(),
): ServiceContainer => ({
  authService: new AuthService(repositories.userRepository),
  profileService: new ProfileService(repositories.profileRepository),
  swipeService: new SwipeService(
    repositories.swipeRepository,
    repositories.matchRepository,
  ),
  matchService: new MatchService(repositories.matchRepository),
  chatService: new ChatService(repositories.messageRepository),
  audioService: new AudioService(),
  notificationService: new NotificationService(),
});
