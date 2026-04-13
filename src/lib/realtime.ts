// Wraps Supabase Realtime channel setup and cleanup helpers.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export const removeRealtimeChannel = (channel: RealtimeChannel): void => {
  supabase.removeChannel(channel);
};
