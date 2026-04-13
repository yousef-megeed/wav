// Centralizes environment variables used by infrastructure code.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const EAS_PROJECT_ID = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? "";
export const IS_SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
