import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FFMPEG_PATH = process.env.FFMPEG_PATH || "ffmpeg";
const POLL_INTERVAL_MS = Number.parseInt(
  process.env.WAVEFORM_POLL_MS || "2000",
  10,
);
const TARGET_BARS = Number.parseInt(
  process.env.WAVEFORM_TARGET_BARS || "96",
  10,
);
const WORKER_ID =
  process.env.WAVEFORM_WORKER_ID || `waveform-worker-${randomUUID()}`;
const PCM_SAMPLE_RATE = 16000;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for waveform worker.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const compressPeaks = (samples, targetBars) => {
  if (!samples.length || targetBars <= 0) return [];

  if (samples.length <= targetBars) {
    return samples.map((value) => clamp(value, 0, 1));
  }

  const bars = [];
  for (let i = 0; i < targetBars; i += 1) {
    const start = Math.floor((i / targetBars) * samples.length);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) / targetBars) * samples.length),
    );
    let peak = 0;

    for (let j = start; j < Math.min(end, samples.length); j += 1) {
      peak = Math.max(peak, samples[j] || 0);
    }

    bars.push(clamp(peak, 0, 1));
  }

  return bars;
};

const extractWaveformWithFfmpeg = async (audioUrl, targetBars) => {
  return await new Promise((resolve, reject) => {
    const peaks = [];
    let stderrOutput = "";

    const ffmpeg = spawn(FFMPEG_PATH, [
      "-v",
      "error",
      "-i",
      audioUrl,
      "-ac",
      "1",
      "-ar",
      "16000",
      "-f",
      "f32le",
      "pipe:1",
    ]);

    ffmpeg.stdout.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const floatCount = Math.floor(buffer.length / 4);

      for (let i = 0; i < floatCount; i += 1) {
        const sample = buffer.readFloatLE(i * 4);
        peaks.push(Math.abs(sample));
      }
    });

    ffmpeg.stderr.on("data", (chunk) => {
      stderrOutput += chunk.toString();
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg exited with code ${code}${stderrOutput ? `: ${stderrOutput.trim()}` : ""}`,
          ),
        );
        return;
      }

      if (!peaks.length) {
        reject(
          new Error("No PCM samples were extracted from the audio input."),
        );
        return;
      }

      const amplitudes = compressPeaks(peaks, targetBars);
      const coverageMs = Math.round((peaks.length / PCM_SAMPLE_RATE) * 1000);
      resolve({ amplitudes, coverageMs });
    });
  });
};

const markJobFailed = async (jobId, errorMessage) => {
  const { error } = await supabase
    .from("audio_waveform_jobs")
    .update({
      status: "failed",
      error_message: String(errorMessage).slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("Failed to mark job as failed", jobId, error.message);
  }
};

const persistWaveform = async (job, amplitudes, coverageMs) => {
  if (job.target_type === "message") {
    if (!job.message_id) {
      throw new Error("Job target_type=message is missing message_id.");
    }

    const { error } = await supabase
      .from("messages")
      .update({
        waveform_amplitudes: amplitudes,
        waveform_coverage_ms: coverageMs,
        waveform_source: "canonical",
      })
      .eq("id", job.message_id);

    if (error) {
      throw new Error(`Failed to update message waveform: ${error.message}`);
    }
  } else if (job.target_type === "profile_track") {
    if (!job.profile_user_id || !job.profile_track_id) {
      throw new Error(
        "Job target_type=profile_track is missing profile_user_id or profile_track_id.",
      );
    }

    const { error } = await supabase.rpc("set_profile_track_waveform", {
      p_user_id: job.profile_user_id,
      p_track_id: job.profile_track_id,
      p_waveform: amplitudes,
      p_waveform_coverage_ms: coverageMs,
      p_waveform_source: "canonical",
    });

    if (error) {
      throw new Error(
        `Failed to update profile track waveform: ${error.message}`,
      );
    }
  } else {
    throw new Error(`Unsupported target_type '${job.target_type}'.`);
  }
};

const markJobSucceeded = async (jobId, amplitudes) => {
  const { error } = await supabase
    .from("audio_waveform_jobs")
    .update({
      status: "succeeded",
      waveform_amplitudes: amplitudes,
      completed_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Failed to mark job as succeeded: ${error.message}`);
  }
};

const claimNextJob = async () => {
  const { data, error } = await supabase.rpc("claim_audio_waveform_job", {
    p_worker_id: WORKER_ID,
  });

  if (error) {
    throw new Error(`Failed to claim waveform job: ${error.message}`);
  }

  return data;
};

const processJob = async (job) => {
  const started = Date.now();
  console.log(
    `[waveform-worker] Processing job ${job.id} (${job.target_type})`,
  );

  try {
    const { amplitudes, coverageMs } = await extractWaveformWithFfmpeg(
      job.audio_url,
      TARGET_BARS,
    );
    await persistWaveform(job, amplitudes, coverageMs);
    await markJobSucceeded(job.id, amplitudes);
    console.log(
      `[waveform-worker] Job ${job.id} succeeded (${amplitudes.length} bars, coverage ${coverageMs}ms, ${Date.now() - started} ms)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markJobFailed(job.id, message);
    console.error(`[waveform-worker] Job ${job.id} failed: ${message}`);
  }
};

const runLoop = async () => {
  console.log(
    `[waveform-worker] Started as ${WORKER_ID}. Polling every ${POLL_INTERVAL_MS}ms.`,
  );
  while (true) {
    try {
      const job = await claimNextJob();
      if (!job) {
        await wait(POLL_INTERVAL_MS);
        continue;
      }

      await processJob(job);
    } catch (error) {
      console.error(
        `[waveform-worker] Loop error: ${error instanceof Error ? error.message : String(error)}`,
      );
      await wait(POLL_INTERVAL_MS);
    }
  }
};

await runLoop();
