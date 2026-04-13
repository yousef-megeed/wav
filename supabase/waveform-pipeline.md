# Waveform Extraction Pipeline (Supabase Function + ffmpeg Worker)

This repository now includes a queue-based contract for server-side waveform extraction.

## Components

1. Edge Function enqueue endpoint:

- Path: supabase/functions/enqueue-waveform-job/index.ts
- Purpose: validate caller + enqueue extraction job in public.audio_waveform_jobs

2. Queue + SQL helpers:

- Path: supabase/schema.sql
- Table: public.audio_waveform_jobs
- RPC claim function: public.claim_audio_waveform_job(p_worker_id text)
- RPC profile update function: public.set_profile_track_waveform(p_user_id uuid, p_track_id text, p_waveform real[])

3. Worker process (external infrastructure):

- Path: scripts/waveform-worker.mjs
- Purpose: poll queue, run ffmpeg, compute amplitudes, persist waveform

## Deployment steps

1. Apply schema changes

- Run the updated SQL in supabase/schema.sql against your project.

2. Configure function secrets

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

3. Deploy edge function

```bash
supabase functions deploy enqueue-waveform-job
```

4. Run worker in infrastructure where ffmpeg is installed

```bash
npm run waveform:worker
```

Required environment variables for worker:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY

Optional worker variables:

- FFMPEG_PATH (default: ffmpeg)
- WAVEFORM_TARGET_BARS (default: 96)
- WAVEFORM_POLL_MS (default: 2000)
- WAVEFORM_WORKER_ID (default: generated UUID)

## How jobs are enqueued in app

1. Chat audio messages:

- App.tsx enqueues a message-target extraction job after audio message is created.

2. Profile tracks:

- App.tsx enqueues profile_track extraction jobs after profile save with uploaded previews.

## Notes

- This pipeline uses real audio sample extraction via ffmpeg on the worker.
- The client can still provide immediate local waveform data; the server pipeline can overwrite with canonical extracted amplitudes.
- Worker requires external runtime outside Expo app (VM/container/serverless job runner).
