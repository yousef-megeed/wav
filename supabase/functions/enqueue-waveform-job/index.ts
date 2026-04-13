// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type EnqueuePayload = {
  targetType: "message" | "profile_track";
  audioUrl: string;
  messageId?: string;
  profileUserId?: string;
  profileTrackId?: string;
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, {
      error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in function secrets.",
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json(401, { error: "Missing Authorization header." });
  }

  let payload: EnqueuePayload;
  try {
    payload = (await req.json()) as EnqueuePayload;
  } catch {
    return json(400, { error: "Body must be valid JSON." });
  }

  if (!payload?.audioUrl || !/^https?:\/\//i.test(payload.audioUrl)) {
    return json(400, {
      error: "audioUrl is required and must be an absolute http(s) URL.",
    });
  }

  if (
    payload.targetType !== "message" &&
    payload.targetType !== "profile_track"
  ) {
    return json(400, {
      error: "targetType must be either 'message' or 'profile_track'.",
    });
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    return json(401, { error: "Missing Bearer token." });
  }

  const {
    data: { user },
    error: userError,
  } = await serviceClient.auth.getUser(jwt);

  if (userError || !user) {
    return json(401, {
      error: "Unauthorized caller.",
      details: userError?.message ?? "Invalid JWT",
    });
  }

  if (payload.targetType === "message") {
    if (!payload.messageId) {
      return json(400, {
        error: "messageId is required for targetType=message.",
      });
    }

    const { data: messageRow, error: messageError } = await serviceClient
      .from("messages")
      .select("id, sender_id")
      .eq("id", payload.messageId)
      .maybeSingle();

    if (messageError || !messageRow) {
      return json(404, { error: "messageId not found." });
    }

    if (messageRow.sender_id !== user.id) {
      return json(403, {
        error: "Only the message sender can enqueue extraction.",
      });
    }
  }

  if (payload.targetType === "profile_track") {
    if (!payload.profileUserId || !payload.profileTrackId) {
      return json(400, {
        error:
          "profileUserId and profileTrackId are required for targetType=profile_track.",
      });
    }

    if (payload.profileUserId !== user.id) {
      return json(403, {
        error: "You can only enqueue extraction for your own profile tracks.",
      });
    }
  }

  const { data, error } = await serviceClient
    .from("audio_waveform_jobs")
    .insert({
      requester_user_id: user.id,
      target_type: payload.targetType,
      message_id:
        payload.targetType === "message" ? (payload.messageId ?? null) : null,
      profile_user_id:
        payload.targetType === "profile_track"
          ? (payload.profileUserId ?? null)
          : null,
      profile_track_id:
        payload.targetType === "profile_track"
          ? (payload.profileTrackId ?? null)
          : null,
      audio_url: payload.audioUrl,
      status: "queued",
    })
    .select("id, status, target_type, created_at")
    .single();

  if (error) {
    return json(500, {
      error: "Failed to enqueue waveform extraction job.",
      details: error.message,
    });
  }

  return json(200, {
    ok: true,
    job: data,
  });
});
