// Implements IUserRepository using Supabase auth and local mock auth fallback.
import { IS_SUPABASE_ENABLED } from "@/src/config/env";
import { RepositoryError } from "@/src/errors";
import {
    getMockSession,
    mockExchangeCodeForSession,
    mockSetSessionFromTokens,
    mockSignIn,
    mockSignOut,
    mockSignUp,
    mockStartGoogleSignIn,
    subscribeMockAuth,
} from "@/src/lib/mock-auth";
import { supabase } from "@/src/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { EmailSignUpResult, IUserRepository } from "../IUserRepository";

export class SupabaseUserRepository implements IUserRepository {
  public async getSession(): Promise<Session | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return getMockSession();
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session ?? null;
    } catch (error: unknown) {
      throw new RepositoryError("Failed to get auth session", undefined, error);
    }
  }

  public onAuthStateChange(
    callback: (session: Session | null) => void,
  ): () => void {
    try {
      if (!IS_SUPABASE_ENABLED) {
        return subscribeMockAuth((nextSession) => callback(nextSession));
      }

      const { data: listener } = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          callback(nextSession ?? null);
        },
      );

      return () => listener.subscription.unsubscribe();
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to subscribe auth state",
        undefined,
        error,
      );
    }
  }

  public async signInWithEmail(
    email: string,
    password: string,
  ): Promise<Session | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const result = await mockSignIn(email, password);
        return result.data.session;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data.session ?? null;
    } catch (error: unknown) {
      throw new RepositoryError("Failed to sign in", { email }, error);
    }
  }

  public async signUpWithEmail(
    email: string,
    password: string,
    emailRedirectTo: string,
  ): Promise<EmailSignUpResult> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const result = await mockSignUp(email, password);
        return result.data;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo,
        },
      });
      if (error) throw error;

      let session = data.session ?? null;

      // Force instant sign-up UX by trying password sign-in when signUp returns no session.
      if (!session) {
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });
        if (signInError) {
          throw signInError;
        }
        session = signInData.session ?? null;
      }

      return {
        session,
        requiresEmailVerification: false,
      };
    } catch (error: unknown) {
      throw new RepositoryError("Failed to sign up", { email }, error);
    }
  }

  public async startGoogleSignIn(redirectTo: string): Promise<string | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const result = await mockStartGoogleSignIn();
        return result.data.url;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      return data.url ?? null;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to start Google sign-in",
        undefined,
        error,
      );
    }
  }

  public async exchangeCodeForSession(
    authCode: string,
  ): Promise<Session | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const result = await mockExchangeCodeForSession();
        return result.data.session ?? null;
      }

      const { data, error } =
        await supabase.auth.exchangeCodeForSession(authCode);
      if (error) throw error;
      return data.session ?? null;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to exchange auth code for session",
        undefined,
        error,
      );
    }
  }

  public async setSessionFromTokens(
    accessToken: string,
    refreshToken: string,
  ): Promise<Session | null> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        const result = await mockSetSessionFromTokens();
        return result.data.session ?? null;
      }

      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
      return data.session ?? null;
    } catch (error: unknown) {
      throw new RepositoryError(
        "Failed to set session from tokens",
        undefined,
        error,
      );
    }
  }

  public async signOut(): Promise<void> {
    try {
      if (!IS_SUPABASE_ENABLED) {
        await mockSignOut();
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error: unknown) {
      throw new RepositoryError("Failed to sign out", undefined, error);
    }
  }
}
