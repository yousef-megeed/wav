// Provides in-memory mock auth providers used by repository fallback mode.
import type { Session } from "@supabase/supabase-js";
import type { EmailSignUpResult } from "@/src/repositories/IUserRepository";

type AuthListener = (session: Session | null) => void;

const listeners = new Set<AuthListener>();

let mockSession: Session | null = {
  access_token: "",
  refresh_token: "",
  expires_in: 0,
  token_type: "bearer",
  user: {
    id: "",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: new Date().toISOString(),
  },
} as Session | null;

// Start logged out in local mode so Splash -> Onboarding -> Auth is visible.
mockSession = null;

const emit = () => {
  listeners.forEach((listener) => listener(mockSession));
};

export const getMockSession = () => mockSession;

export const subscribeMockAuth = (listener: AuthListener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const mockSignIn = async (_email: string, _password: string) => {
  mockSession = {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    expires_in: 60 * 60 * 24,
    token_type: "bearer",
    user: {
      id: "test-user-1",
      app_metadata: {},
      user_metadata: { display_name: "Test User" },
      aud: "authenticated",
      created_at: new Date().toISOString(),
      email: _email,
    },
  } as Session;
  emit();
  return { data: { session: mockSession }, error: null };
};

export const mockSignUp = async (email: string, password: string) => {
  const result = await mockSignIn(email, password);
  const signUpResult: EmailSignUpResult = {
    session: result.data.session,
    requiresEmailVerification: false,
  };
  return { data: signUpResult, error: null };
};

export const mockStartGoogleSignIn = async () => {
  await mockSignIn("google.mock@wav.local", "mock-password");
  return { data: { url: null }, error: null };
};

export const mockExchangeCodeForSession = async () => {
  return { data: { session: mockSession }, error: null };
};

export const mockSetSessionFromTokens = async () => {
  return { data: { session: mockSession }, error: null };
};

export const mockSignOut = async () => {
  mockSession = null;
  emit();
  return { error: null };
};
