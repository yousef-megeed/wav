// Declares user and authentication repository operations.
import type { Session } from "@supabase/supabase-js";

export interface EmailSignUpResult {
  session: Session | null;
  requiresEmailVerification: boolean;
}

export interface IUserRepository {
  getSession(): Promise<Session | null>;
  onAuthStateChange(callback: (session: Session | null) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<Session | null>;
  signUpWithEmail(
    email: string,
    password: string,
    emailRedirectTo: string,
  ): Promise<EmailSignUpResult>;
  startGoogleSignIn(redirectTo: string): Promise<string | null>;
  exchangeCodeForSession(authCode: string): Promise<Session | null>;
  setSessionFromTokens(
    accessToken: string,
    refreshToken: string,
  ): Promise<Session | null>;
  signOut(): Promise<void>;
}
