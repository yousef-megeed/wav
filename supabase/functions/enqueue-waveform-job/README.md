# enqueue-waveform-job

Creates queued jobs for server-side audio waveform extraction.

## Request Body

```json
{
  "targetType": "message",
  "messageId": "<uuid>",
  "audioUrl": "https://..."
}
```

or

```json
{
  "targetType": "profile_track",
  "profileUserId": "<auth user uuid>",
  "profileTrackId": "track-123",
  "audioUrl": "https://..."
}
```

## Auth

- Requires authenticated caller.
- `message` jobs can only be enqueued by the message sender.
- `profile_track` jobs can only be enqueued for the caller's own user id.

## Required function secrets

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy enqueue-waveform-job
```
