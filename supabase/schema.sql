-- WAV schema aligned with app requirements.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  bio TEXT,
  role TEXT NOT NULL CHECK (role IN ('producer', 'vocalist', 'rapper', 'songwriter')),
  daw TEXT,
  genres TEXT[] NOT NULL DEFAULT '{}',
  location TEXT,
  avatar_url TEXT,
  expo_push_token TEXT,
  audio_clip_url TEXT,
  audio_clip_duration INTEGER CHECK (audio_clip_duration <= 60),
  track_previews JSONB,
  linked_accounts JSONB,
  bpm INTEGER,
  key TEXT,
  style_tags TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  swiper_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  swiped_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT swipes_unique_pair UNIQUE (swiper_id, swiped_id)
);

CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT matches_sorted_pair CHECK (user1_id < user2_id),
  CONSTRAINT matches_unique_pair UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_kind TEXT NOT NULL DEFAULT 'text' CHECK (message_kind IN ('text', 'voice-note', 'audio-file')),
  content TEXT,
  file_url TEXT,
  file_name TEXT,
  audio_duration_ms INTEGER,
  waveform_amplitudes REAL[],
  waveform_coverage_ms INTEGER,
  waveform_source TEXT CHECK (waveform_source IN ('preview', 'canonical', 'metering')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS message_kind TEXT NOT NULL DEFAULT 'text';

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS file_name TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS audio_duration_ms INTEGER;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS waveform_amplitudes REAL[];

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS waveform_coverage_ms INTEGER;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS waveform_source TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_message_kind_check'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_message_kind_check
    CHECK (message_kind IN ('text', 'voice-note', 'audio-file'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_waveform_source_check'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_waveform_source_check
    CHECK (waveform_source IN ('preview', 'canonical', 'metering'));
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS track_previews JSONB;

ALTER TABLE IF EXISTS public.profiles
ADD COLUMN IF NOT EXISTS linked_accounts JSONB;

CREATE INDEX IF NOT EXISTS swipes_swiper_idx ON public.swipes (swiper_id);
CREATE INDEX IF NOT EXISTS swipes_swiped_idx ON public.swipes (swiped_id);
CREATE INDEX IF NOT EXISTS matches_user1_idx ON public.matches (user1_id);
CREATE INDEX IF NOT EXISTS matches_user2_idx ON public.matches (user2_id);
CREATE INDEX IF NOT EXISTS messages_match_idx ON public.messages (match_id, created_at);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_read_self ON public.users;
CREATE POLICY users_read_self ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
CREATE POLICY profiles_public_read ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS swipes_insert_self ON public.swipes;
CREATE POLICY swipes_insert_self ON public.swipes
  FOR INSERT WITH CHECK (auth.uid() = swiper_id);

DROP POLICY IF EXISTS swipes_read_self ON public.swipes;
CREATE POLICY swipes_read_self ON public.swipes
  FOR SELECT USING (auth.uid() = swiper_id);

DROP POLICY IF EXISTS matches_read_participant ON public.matches;
CREATE POLICY matches_read_participant ON public.matches
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

DROP POLICY IF EXISTS messages_read_participant ON public.messages;
CREATE POLICY messages_read_participant ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS messages_insert_sender_participant ON public.messages;
CREATE POLICY messages_insert_sender_participant ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS messages_update_read_participant ON public.messages;
CREATE POLICY messages_update_read_participant ON public.messages
  FOR UPDATE USING (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() <> sender_id
    AND EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_id
        AND (m.user1_id = auth.uid() OR m.user2_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.ensure_user_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_user_row();

CREATE OR REPLACE FUNCTION public.handle_new_swipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.direction = 'right' AND EXISTS (
    SELECT 1
    FROM public.swipes s
    WHERE s.swiper_id = NEW.swiped_id
      AND s.swiped_id = NEW.swiper_id
      AND s.direction = 'right'
  ) THEN
    INSERT INTO public.matches (user1_id, user2_id)
    VALUES (LEAST(NEW.swiper_id, NEW.swiped_id), GREATEST(NEW.swiper_id, NEW.swiped_id))
    ON CONFLICT (user1_id, user2_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_swipe_insert ON public.swipes;
CREATE TRIGGER on_swipe_insert
AFTER INSERT ON public.swipes
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_swipe();

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS chat_audio_read ON storage.objects;
CREATE POLICY chat_audio_read ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-audio');

DROP POLICY IF EXISTS chat_audio_upload_authenticated ON storage.objects;
CREATE POLICY chat_audio_upload_authenticated ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-audio'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS chat_audio_update_owner ON storage.objects;
CREATE POLICY chat_audio_update_owner ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-audio'
    AND auth.uid() = owner
  )
  WITH CHECK (
    bucket_id = 'chat-audio'
    AND auth.uid() = owner
  );

DROP POLICY IF EXISTS chat_audio_delete_owner ON storage.objects;
CREATE POLICY chat_audio_delete_owner ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-audio'
    AND auth.uid() = owner
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS profile_pictures_read ON storage.objects;
CREATE POLICY profile_pictures_read ON storage.objects
  FOR SELECT USING (bucket_id IN ('profile-pictures', 'profile pictures', 'profile_pictures'));

DROP POLICY IF EXISTS profile_pictures_upload_authenticated ON storage.objects;
CREATE POLICY profile_pictures_upload_authenticated ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id IN ('profile-pictures', 'profile pictures', 'profile_pictures')
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS profile_pictures_update_owner ON storage.objects;
CREATE POLICY profile_pictures_update_owner ON storage.objects
  FOR UPDATE USING (
    bucket_id IN ('profile-pictures', 'profile pictures', 'profile_pictures')
    AND auth.uid() = owner
  )
  WITH CHECK (
    bucket_id IN ('profile-pictures', 'profile pictures', 'profile_pictures')
    AND auth.uid() = owner
  );

DROP POLICY IF EXISTS profile_pictures_delete_owner ON storage.objects;
CREATE POLICY profile_pictures_delete_owner ON storage.objects
  FOR DELETE USING (
    bucket_id IN ('profile-pictures', 'profile pictures', 'profile_pictures')
    AND auth.uid() = owner
  );

CREATE TABLE IF NOT EXISTS public.audio_waveform_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('message', 'profile_track')),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  profile_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_track_id TEXT,
  audio_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  worker_id TEXT,
  error_message TEXT,
  waveform_amplitudes REAL[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS requester_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS target_type TEXT;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS profile_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS profile_track_id TEXT;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS audio_url TEXT;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'queued';

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS worker_id TEXT;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS waveform_amplitudes REAL[];

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.audio_waveform_jobs
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audio_waveform_jobs_target_type_check'
      AND conrelid = 'public.audio_waveform_jobs'::regclass
  ) THEN
    ALTER TABLE public.audio_waveform_jobs
    ADD CONSTRAINT audio_waveform_jobs_target_type_check
    CHECK (target_type IN ('message', 'profile_track'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audio_waveform_jobs_status_check'
      AND conrelid = 'public.audio_waveform_jobs'::regclass
  ) THEN
    ALTER TABLE public.audio_waveform_jobs
    ADD CONSTRAINT audio_waveform_jobs_status_check
    CHECK (status IN ('queued', 'processing', 'succeeded', 'failed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS waveform_jobs_status_created_idx
  ON public.audio_waveform_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS waveform_jobs_requester_idx
  ON public.audio_waveform_jobs (requester_user_id, created_at DESC);

ALTER TABLE public.audio_waveform_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS waveform_jobs_insert_self ON public.audio_waveform_jobs;
CREATE POLICY waveform_jobs_insert_self ON public.audio_waveform_jobs
  FOR INSERT WITH CHECK (auth.uid() = requester_user_id);

DROP POLICY IF EXISTS waveform_jobs_read_self ON public.audio_waveform_jobs;
CREATE POLICY waveform_jobs_read_self ON public.audio_waveform_jobs
  FOR SELECT USING (auth.uid() = requester_user_id);

CREATE OR REPLACE FUNCTION public.claim_audio_waveform_job(p_worker_id TEXT)
RETURNS public.audio_waveform_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claimed_job public.audio_waveform_jobs;
BEGIN
  WITH next_job AS (
    SELECT id
    FROM public.audio_waveform_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.audio_waveform_jobs j
  SET
    status = 'processing',
    attempts = j.attempts + 1,
    worker_id = p_worker_id,
    started_at = now(),
    error_message = NULL
  FROM next_job
  WHERE j.id = next_job.id
  RETURNING j.* INTO claimed_job;

  RETURN claimed_job;
END;
$$;

DROP FUNCTION IF EXISTS public.set_profile_track_waveform(UUID, TEXT, REAL[]);

CREATE OR REPLACE FUNCTION public.set_profile_track_waveform(
  p_user_id UUID,
  p_track_id TEXT,
  p_waveform REAL[],
  p_waveform_coverage_ms INTEGER DEFAULT NULL,
  p_waveform_source TEXT DEFAULT 'canonical'
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
UPDATE public.profiles
SET track_previews = (
  SELECT jsonb_agg(
    CASE
      WHEN track->>'id' = p_track_id
        THEN jsonb_set(
          jsonb_set(
            jsonb_set(track, '{waveform_amplitudes}', to_jsonb(p_waveform), true),
            '{waveform_coverage_ms}',
            to_jsonb(p_waveform_coverage_ms),
            true
          ),
          '{waveform_source}',
          to_jsonb(p_waveform_source),
          true
        )
      ELSE track
    END
  )
  FROM jsonb_array_elements(COALESCE(track_previews, '[]'::jsonb)) AS track
)
WHERE user_id = p_user_id;
$$;