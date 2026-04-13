import { Audio, type AVPlaybackStatus } from "expo-av";

const DEFAULT_TARGET_BARS = 96;
const MIN_AMPLITUDE = 0;
const MAX_AMPLITUDE = 1;
const STANDARD_EXTRACT_TIMEOUT_MS = 20_000;
const MAX_EXTRACT_TIMEOUT_MS = 45_000;
const MAX_PROGRESS_STALL_MS = 3_500;
const DEFAULT_METERING_FLOOR_DB = -85;

type AudioSampleChannel = {
  frames?: number[];
};

type AudioSamplePayload = {
  channels?: AudioSampleChannel[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const normalizePeak = (value: number) => {
  const absValue = Math.abs(value);
  return clamp(absValue, MIN_AMPLITUDE, MAX_AMPLITUDE);
};

const compressPeaks = (samples: number[], targetBars: number): number[] => {
  if (!samples.length || targetBars <= 0) {
    return [];
  }

  if (samples.length <= targetBars) {
    return samples.map((sample) => clamp(sample, MIN_AMPLITUDE, MAX_AMPLITUDE));
  }

  const bars: number[] = [];
  for (let i = 0; i < targetBars; i += 1) {
    const start = Math.floor((i / targetBars) * samples.length);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) / targetBars) * samples.length),
    );
    let peak = 0;

    for (let j = start; j < Math.min(end, samples.length); j += 1) {
      peak = Math.max(peak, samples[j] ?? 0);
    }

    bars.push(clamp(peak, MIN_AMPLITUDE, MAX_AMPLITUDE));
  }

  return bars;
};

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const getDurationMillis = (status: AVPlaybackStatus): number => {
  if (!status.isLoaded || typeof status.durationMillis !== "number") {
    return 0;
  }
  return Math.max(0, status.durationMillis);
};

const computeExtractTimeoutMs = (durationMillis: number): number => {
  if (durationMillis <= 0) {
    return STANDARD_EXTRACT_TIMEOUT_MS;
  }

  return Math.max(
    STANDARD_EXTRACT_TIMEOUT_MS,
    Math.min(MAX_EXTRACT_TIMEOUT_MS, Math.floor(durationMillis * 1.5)),
  );
};

const shouldStopSampling = (
  status: AVPlaybackStatus,
  startedAtMs: number,
  timeoutMs: number,
  lastProgressAtMs: number,
): boolean => {
  if (!status.isLoaded) {
    return true;
  }

  if (
    status.didJustFinish ||
    (typeof status.positionMillis === "number" &&
      typeof status.durationMillis === "number" &&
      status.durationMillis > 0 &&
      status.positionMillis >= status.durationMillis - 24)
  ) {
    return true;
  }

  const now = Date.now();
  if (now - startedAtMs >= timeoutMs) {
    return true;
  }

  // Bail out early when playback position is no longer moving.
  if (now - lastProgressAtMs >= MAX_PROGRESS_STALL_MS) {
    return true;
  }

  return false;
};

const normalizeMeteringSample = (
  dbValue: number,
  floorDb = DEFAULT_METERING_FLOOR_DB,
): number => {
  if (!Number.isFinite(dbValue)) {
    return 0;
  }

  const clampedDb = Math.max(floorDb, Math.min(0, dbValue));
  const normalized = (clampedDb - floorDb) / Math.abs(floorDb);
  return Math.min(1, Math.pow(2, normalized * 3.5) - 1);
};

export function buildWaveformFromMeteringSamples(
  samples: number[],
  targetBars = DEFAULT_TARGET_BARS,
  floorDb = DEFAULT_METERING_FLOOR_DB,
): number[] | undefined {
  if (!samples.length || targetBars <= 0) {
    return undefined;
  }

  const barCount = Math.min(targetBars, samples.length);
  const amplitudes: number[] = [];

  for (let i = 0; i < barCount; i += 1) {
    const start = Math.floor((i / barCount) * samples.length);
    const end = Math.max(
      start + 1,
      Math.floor(((i + 1) / barCount) * samples.length),
    );
    let peak = 0;

    for (let cursor = start; cursor < Math.min(end, samples.length); cursor += 1) {
      peak = Math.max(
        peak,
        normalizeMeteringSample(samples[cursor] ?? floorDb, floorDb),
      );
    }

    amplitudes.push(peak);
  }

  return amplitudes;
}

export function buildPreviewWaveformMeta(durationMs?: number | null): {
  waveformCoverageMs: number | null;
  waveformSource: "preview";
} {
  return {
    waveformCoverageMs: durationMs ?? null,
    waveformSource: "preview",
  };
}

/**
 * Extract full-track waveform for accurate time-to-waveform mapping.
 */
export async function extractWaveformAmplitudesFromAudioFile(
  uri: string,
  targetBars = DEFAULT_TARGET_BARS,
): Promise<number[] | undefined> {
  const peakSamples: number[] = [];
  let sound: Audio.Sound | null = null;

  try {
    const created = await Audio.Sound.createAsync(
      { uri },
      {
        shouldPlay: false,
        isMuted: false,
        volume: 0,
        progressUpdateIntervalMillis: 120,
      },
    );

    sound = created.sound;
    const soundWithSamples = sound as Audio.Sound & {
      setOnAudioSampleReceived?: (
        callback: (sample: AudioSamplePayload) => void,
      ) => void;
    };

    if (typeof soundWithSamples.setOnAudioSampleReceived !== "function") {
      return undefined;
    }

    soundWithSamples.setOnAudioSampleReceived((sample) => {
      const channels = sample.channels ?? [];
      if (!channels.length) {
        return;
      }

      let framePeak = 0;
      let processedFrames = 0;
      for (const channel of channels) {
        const frames = channel.frames ?? [];
        for (let i = 0; i < frames.length; i += 1) {
          const frame = frames[i];
          if (!Number.isFinite(frame)) {
            continue;
          }

          framePeak = Math.max(framePeak, normalizePeak(frame));
          processedFrames += 1;
        }
      }

      // Ignore callback ticks that contain no decoded PCM frames.
      if (processedFrames > 0) {
        peakSamples.push(framePeak);
      }
    });

    await sound.playAsync();

    const initialStatus = await sound.getStatusAsync();
    const durationMillis = getDurationMillis(initialStatus);
    const timeoutMs = computeExtractTimeoutMs(durationMillis);
    const startedAt = Date.now();
    let lastPositionMillis =
      initialStatus.isLoaded && typeof initialStatus.positionMillis === "number"
        ? initialStatus.positionMillis
        : 0;
    let lastProgressAt = startedAt;

    while (true) {
      await wait(80);
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        break;
      }

      if (typeof status.positionMillis === "number") {
        if (status.positionMillis > lastPositionMillis) {
          lastPositionMillis = status.positionMillis;
          lastProgressAt = Date.now();
        }
      }

      if (shouldStopSampling(status, startedAt, timeoutMs, lastProgressAt)) {
        break;
      }
    }

    if (!peakSamples.length) {
      return undefined;
    }

    const result = compressPeaks(peakSamples, targetBars);
    const nonZeroBars = result.filter((value) => value > 0.0005).length;
    const nonZeroRatio = result.length > 0 ? nonZeroBars / result.length : 0;

    // If the sampled waveform is mostly zeros for a non-trivial track,
    // prefer fallback rendering over a misleading partial waveform.
    if (durationMillis >= 10_000 && nonZeroRatio < 0.1) {
      console.log("[WaveformService] Fast extraction looked incomplete", {
        uri,
        durationMillis,
        nonZeroBars,
        totalBars: result.length,
      });
      return undefined;
    }

    console.log("[WaveformService] Fast extraction complete:", {
      uri,
      barCount: result.length,
      amplitudes: result,
      min: Math.min(...result),
      max: Math.max(...result),
      avg: result.reduce((a, b) => a + b, 0) / result.length,
    });
    return result;
  } catch {
    return undefined;
  } finally {
    if (sound) {
      try {
        (sound as any).setOnAudioSampleReceived?.(null);
      } catch {
        // Ignore cleanup callback errors.
      }

      try {
        await sound.unloadAsync();
      } catch {
        // Ignore unload errors on cleanup.
      }
    }
  }
}

/**
 * Complete extraction (processes entire file)
 * Used for server-side canonical storage
 */
export async function extractFullWaveformAmplitudes(
  uri: string,
  targetBars = DEFAULT_TARGET_BARS,
): Promise<number[] | undefined> {
  const peakSamples: number[] = [];
  let sound: Audio.Sound | null = null;

  try {
    const created = await Audio.Sound.createAsync(
      { uri },
      {
        shouldPlay: false,
        isMuted: false,
        volume: 0,
        progressUpdateIntervalMillis: 120,
      },
    );

    sound = created.sound;
    const soundWithSamples = sound as Audio.Sound & {
      setOnAudioSampleReceived?: (
        callback: (sample: AudioSamplePayload) => void,
      ) => void;
    };

    if (typeof soundWithSamples.setOnAudioSampleReceived !== "function") {
      return undefined;
    }

    soundWithSamples.setOnAudioSampleReceived((sample) => {
      const channels = sample.channels ?? [];
      if (!channels.length) {
        return;
      }

      let framePeak = 0;
      let processedFrames = 0;
      for (const channel of channels) {
        const frames = channel.frames ?? [];
        for (let i = 0; i < frames.length; i += 1) {
          const frame = frames[i];
          if (!Number.isFinite(frame)) {
            continue;
          }

          framePeak = Math.max(framePeak, normalizePeak(frame));
          processedFrames += 1;
        }
      }

      if (processedFrames > 0) {
        peakSamples.push(framePeak);
      }
    });

    await sound.playAsync();

    const initialStatus = await sound.getStatusAsync();
    const durationMillis = getDurationMillis(initialStatus);
    const timeoutMs = computeExtractTimeoutMs(durationMillis);
    const startedAt = Date.now();
    let lastPositionMillis =
      initialStatus.isLoaded && typeof initialStatus.positionMillis === "number"
        ? initialStatus.positionMillis
        : 0;
    let lastProgressAt = startedAt;

    while (true) {
      await wait(80);
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) {
        break;
      }

      if (typeof status.positionMillis === "number") {
        if (status.positionMillis > lastPositionMillis) {
          lastPositionMillis = status.positionMillis;
          lastProgressAt = Date.now();
        }
      }

      if (shouldStopSampling(status, startedAt, timeoutMs, lastProgressAt)) {
        break;
      }
    }

    if (!peakSamples.length) {
      return undefined;
    }

    const result = compressPeaks(peakSamples, targetBars);
    const nonZeroBars = result.filter((value) => value > 0.0005).length;
    const nonZeroRatio = result.length > 0 ? nonZeroBars / result.length : 0;

    if (durationMillis >= 10_000 && nonZeroRatio < 0.1) {
      console.log("[WaveformService] Full extraction looked incomplete", {
        uri,
        durationMillis,
        nonZeroBars,
        totalBars: result.length,
      });
      return undefined;
    }

    console.log("[WaveformService] Full extraction complete:", {
      uri,
      barCount: result.length,
      amplitudes: result,
      min: Math.min(...result),
      max: Math.max(...result),
      avg: result.reduce((a, b) => a + b, 0) / result.length,
    });
    return result;
  } catch {
    return undefined;
  } finally {
    if (sound) {
      try {
        (sound as any).setOnAudioSampleReceived?.(null);
      } catch {
        // Ignore cleanup callback errors.
      }

      try {
        await sound.unloadAsync();
      } catch {
        // Ignore unload errors on cleanup.
      }
    }
  }
}
