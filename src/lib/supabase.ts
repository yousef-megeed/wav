// Creates the single Supabase client instance used only by repository implementations.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import {
    IS_SUPABASE_ENABLED,
    SUPABASE_ANON_KEY,
    SUPABASE_URL,
} from "../config/env";

if (!IS_SUPABASE_ENABLED) {
  console.warn("Supabase env missing; running in local mock mode.");
}

export const supabase = createClient(
  IS_SUPABASE_ENABLED ? SUPABASE_URL : "https://local-test.supabase.co",
  IS_SUPABASE_ENABLED ? SUPABASE_ANON_KEY : "local-test-anon-key",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
