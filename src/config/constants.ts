// Stores application-wide constants to avoid hardcoded values.
export const THEME_MODE_STORAGE_KEY = "wav.theme-mode";
export const SWIPE_CANDIDATE_LIMIT = 25;
export const DEFAULT_AUDIO_CLIP_DURATION_SECONDS = 60;
export const AUTH_CALLBACK_REDIRECT_URL = "wav://login-callback/";
export const DEFAULT_PROFILE_AVATAR_URL =
  "https://static.xx.fbcdn.net/rsrc.php/y4/r/-PAXP-deijE.gif";

export const withDefaultAvatar = (avatarUrl?: string | null): string =>
  avatarUrl?.trim() ? avatarUrl : DEFAULT_PROFILE_AVATAR_URL;
