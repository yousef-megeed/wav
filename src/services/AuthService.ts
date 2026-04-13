// Handles authentication business logic and delegates persistence to repositories.
import { AUTH_CALLBACK_REDIRECT_URL } from "@/src/config/constants";
import { ServiceError } from "@/src/errors";
import type {
  EmailSignUpResult,
  IUserRepository,
} from "@/src/repositories/IUserRepository";
import { isValidEmail, isValidPassword } from "@/src/utils/validators";
import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

export class AuthService {
  public constructor(private readonly userRepository: IUserRepository) {}

  public async getCurrentSession(): Promise<Session | null> {
    try {
      return await this.userRepository.getSession();
    } catch (error: unknown) {
      throw new ServiceError(
        "Failed to resolve current session",
        undefined,
        error,
      );
    }
  }

  public async refreshSession(): Promise<Session | null> {
    return this.getCurrentSession();
  }

  public onAuthStateChange(
    callback: (session: Session | null) => void,
  ): () => void {
    try {
      return this.userRepository.onAuthStateChange(callback);
    } catch (error: unknown) {
      throw new ServiceError(
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
      if (!isValidEmail(email)) {
        throw new ServiceError("Invalid email format", { email });
      }
      if (!isValidPassword(password)) {
        throw new ServiceError("Password must be at least 6 characters");
      }
      return await this.userRepository.signInWithEmail(email, password);
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError("Failed to sign in", { email }, error);
    }
  }

  public async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<EmailSignUpResult> {
    try {
      if (!isValidEmail(email)) {
        throw new ServiceError("Invalid email format", { email });
      }
      if (!isValidPassword(password)) {
        throw new ServiceError("Password must be at least 6 characters");
      }
      return await this.userRepository.signUpWithEmail(
        email,
        password,
        AUTH_CALLBACK_REDIRECT_URL,
      );
    } catch (error: unknown) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError("Failed to sign up", { email }, error);
    }
  }

  public async signInWithGoogle(): Promise<Session | null> {
    try {
      const oauthUrl = await this.userRepository.startGoogleSignIn(
        AUTH_CALLBACK_REDIRECT_URL,
      );
      if (!oauthUrl) {
        return this.getCurrentSession();
      }

      const result = await WebBrowser.openAuthSessionAsync(
        oauthUrl,
        AUTH_CALLBACK_REDIRECT_URL,
      );

      if (result.type !== "success" || !result.url) {
        return this.getCurrentSession();
      }

      return await this.handleAuthCallback(result.url);
    } catch (error: unknown) {
      throw new ServiceError("Failed to sign in with Google", undefined, error);
    }
  }

  public async handleAuthCallback(url: string): Promise<Session | null> {
    try {
      const authCode = this.getUrlParam(url, "code");
      if (authCode) {
        return await this.userRepository.exchangeCodeForSession(authCode);
      }

      const accessToken = this.getUrlParam(url, "access_token");
      const refreshToken = this.getUrlParam(url, "refresh_token");
      if (accessToken && refreshToken) {
        return await this.userRepository.setSessionFromTokens(
          accessToken,
          refreshToken,
        );
      }

      return this.getCurrentSession();
    } catch (error: unknown) {
      throw new ServiceError("Failed to handle auth callback", { url }, error);
    }
  }

  private getUrlParam(url: string, paramName: string): string | null {
    const [withoutHash, hashPart] = url.split("#");
    const queryPart = withoutHash.includes("?")
      ? withoutHash.split("?")[1]
      : "";

    const queryParams = new URLSearchParams(queryPart);
    const hashParams = new URLSearchParams(hashPart ?? "");

    return queryParams.get(paramName) ?? hashParams.get(paramName);
  }

  public async signOut(): Promise<void> {
    try {
      await this.userRepository.signOut();
    } catch (error: unknown) {
      throw new ServiceError("Failed to sign out", undefined, error);
    }
  }
}
