import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    PanResponder,
    StyleSheet,
    View,
    type LayoutChangeEvent,
    type ViewStyle,
} from "react-native";

type AudioWaveformProps = {
  amplitudes?: number[]; // normalized values between 0 and 1
  seedKey?: string;
  progressRatio: number;
  onSeekRatio?: (ratio: number) => void;
  height?: number;
  barWidth?: number;
  barGap?: number;
  minBars?: number;
  maxBars?: number;
  barMinHeight?: number;
  barMaxHeight?: number;
  interactionPaddingVertical?: number;
  playedColor?: string;
  unplayedColor?: string;
  scrubberColor?: string;
  style?: ViewStyle;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const SEEK_UPDATE_INTERVAL_MS = 16; // ~60fps for smooth sync
const DRAG_ACTIVATION_PX = 4;
const SCRUBBER_WIDTH = 2;
const SCRUBBER_HEIGHT = 34;

function resampleAmplitudes(values: number[], targetCount: number): number[] {
  if (!values.length || targetCount <= 0) return [];
  if (values.length === targetCount) return values.map((v) => clamp(v, 0, 1));
  if (targetCount === 1) {
    return [clamp(values[Math.floor(values.length / 2)] ?? 0, 0, 1)];
  }

  const result: number[] = [];

  for (let i = 0; i < targetCount; i += 1) {
    const start = Math.floor((i / targetCount) * values.length);
    const end = Math.floor(((i + 1) / targetCount) * values.length);
    const sliceStart = Math.max(0, start);
    const sliceEnd = Math.max(sliceStart + 1, end);

    let peak = 0;
    for (let j = sliceStart; j < Math.min(sliceEnd, values.length); j += 1) {
      peak = Math.max(peak, Math.abs(values[j] ?? 0));
    }

    result.push(clamp(peak, 0, 1));
  }

  return result;
}

function buildSeedAmplitudes(seedKey: string, count: number): number[] {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i += 1) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) % 9973;
  }

  return Array.from({ length: count }, (_, index) => {
    const normalized = index / Math.max(1, count - 1);
    const phase = normalized * Math.PI * 6 + seed * 0.0031;
    const smoothEnvelope = 0.5 + 0.5 * Math.sin(phase);
    const slowCurve =
      0.55 + 0.45 * Math.sin(normalized * Math.PI * 2.2 + seed * 0.0017);
    return clamp(smoothEnvelope * 0.62 + slowCurve * 0.38, 0, 1);
  });
}

export function AudioWaveform({
  amplitudes,
  seedKey,
  progressRatio,
  onSeekRatio,
  height = 46,
  barWidth = 3,
  barGap = 2,
  minBars = 32,
  maxBars = 72,
  barMinHeight = 6,
  barMaxHeight = 24,
  interactionPaddingVertical = 16,
  playedColor = "rgba(255,255,255,0.96)",
  unplayedColor = "rgba(255,255,255,0.24)",
  scrubberColor = "rgba(255,255,255,0.98)",
  style,
}: AudioWaveformProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPreviewRatio, setDragPreviewRatio] = useState<number | null>(null);

  const hasActivatedDragRef = useRef(false);
  const pendingSeekRatioRef = useRef<number | null>(null);
  const lastSeekSentAtRef = useRef(0);
  const seekTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedProgress = clamp(progressRatio, 0, 1);

  const viewportBarCount = useMemo(() => {
    if (!containerWidth) return minBars;

    return clamp(
      Math.floor(containerWidth / Math.max(1, barWidth + barGap)),
      minBars,
      maxBars,
    );
  }, [containerWidth, barWidth, barGap, minBars, maxBars]);

  const displayAmplitudes = useMemo(() => {
    const safeAmplitudes = amplitudes ?? [];
    if (safeAmplitudes.length) {
      return resampleAmplitudes(safeAmplitudes, viewportBarCount);
    }

    if (seedKey) {
      return buildSeedAmplitudes(seedKey, viewportBarCount);
    }

    return Array.from({ length: viewportBarCount }, () => 0.08);
  }, [amplitudes, seedKey, viewportBarCount]);

  const barHeights = useMemo(() => {
    return displayAmplitudes.map((value) => {
      const normalized = clamp(value, 0, 1);
      return Math.round(
        barMinHeight + normalized * (barMaxHeight - barMinHeight),
      );
    });
  }, [displayAmplitudes, barMinHeight, barMaxHeight]);

  const flushSeek = useCallback(
    (force: boolean) => {
      if (!onSeekRatio) {
        pendingSeekRatioRef.current = null;
        return;
      }

      const nextRatio = pendingSeekRatioRef.current;
      if (nextRatio == null) return;

      const now = Date.now();
      const elapsed = now - lastSeekSentAtRef.current;

      if (!force && elapsed < SEEK_UPDATE_INTERVAL_MS) {
        if (!seekTimerRef.current) {
          const wait = SEEK_UPDATE_INTERVAL_MS - elapsed;
          seekTimerRef.current = setTimeout(() => {
            seekTimerRef.current = null;
            flushSeek(true);
          }, wait);
        }
        return;
      }

      pendingSeekRatioRef.current = null;
      lastSeekSentAtRef.current = now;
      onSeekRatio(nextRatio);
    },
    [onSeekRatio],
  );

  const queueSeek = useCallback(
    (ratio: number) => {
      pendingSeekRatioRef.current = ratio;
      flushSeek(false);
    },
    [flushSeek],
  );

  const seekFromLocationX = useCallback(
    (locationX: number) => {
      if (!onSeekRatio || containerWidth <= 0) {
        return;
      }

      const nextRatio = clamp(locationX / containerWidth, 0, 1);
      setDragPreviewRatio(nextRatio);
      queueSeek(nextRatio);
    },
    [containerWidth, onSeekRatio, queueSeek],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: () => Boolean(onSeekRatio),
        onMoveShouldSetPanResponderCapture: () => Boolean(onSeekRatio),
        onStartShouldSetPanResponder: () => Boolean(onSeekRatio),
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Boolean(onSeekRatio) && Math.abs(gestureState.dx) > 2,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          setIsDragging(true);
          hasActivatedDragRef.current = false;
          const nextRatio =
            containerWidth > 0
              ? clamp(event.nativeEvent.locationX / containerWidth, 0, 1)
              : normalizedProgress;
          setDragPreviewRatio(nextRatio);
          queueSeek(nextRatio);
        },

        onPanResponderMove: (event, gestureState) => {
          const absDx = Math.abs(gestureState.dx);

          if (!hasActivatedDragRef.current) {
            if (absDx < DRAG_ACTIVATION_PX) return;
            hasActivatedDragRef.current = true;
          }

          seekFromLocationX(event.nativeEvent.locationX);
        },

        onPanResponderEnd: (event) => {
          seekFromLocationX(event.nativeEvent.locationX);
        },

        onPanResponderRelease: () => {
          flushSeek(true);
          setIsDragging(false);
          setDragPreviewRatio(null);
          hasActivatedDragRef.current = false;
        },

        onPanResponderTerminate: () => {
          flushSeek(true);
          setIsDragging(false);
          setDragPreviewRatio(null);
          hasActivatedDragRef.current = false;
        },
      }),
    [
      containerWidth,
      flushSeek,
      normalizedProgress,
      onSeekRatio,
      queueSeek,
      seekFromLocationX,
    ],
  );

  useEffect(() => {
    return () => {
      if (seekTimerRef.current) {
        clearTimeout(seekTimerRef.current);
      }
    };
  }, []);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = Math.floor(event.nativeEvent.layout.width);
      if (width > 0 && width !== containerWidth) {
        setContainerWidth(width);
      }
    },
    [containerWidth],
  );

  const effectiveProgress = dragPreviewRatio ?? normalizedProgress;
  const playedBarIndex = Math.floor(
    effectiveProgress * Math.max(0, barHeights.length - 1),
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          minHeight: height,
          paddingVertical: interactionPaddingVertical,
          marginVertical: -Math.floor(interactionPaddingVertical * 0.35),
        },
        style,
      ]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      <View style={[styles.viewport, { height }]}>
        <View
          style={[
            styles.barsRow,
            {
              height,
            },
          ]}
        >
          {barHeights.map((heightValue, index) => {
            const isPlayed = index <= playedBarIndex;

            return (
              <View
                key={`bar-${index}`}
                style={[
                  styles.bar,
                  {
                    height: heightValue,
                    width: barWidth,
                    marginHorizontal: barGap / 2,
                    backgroundColor: isPlayed ? playedColor : unplayedColor,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.scrubber,
          {
            left: `${effectiveProgress * 100}%`,
            marginLeft: -SCRUBBER_WIDTH / 2,
            height: SCRUBBER_HEIGHT,
            marginTop: -SCRUBBER_HEIGHT / 2,
            backgroundColor: scrubberColor,
            opacity: isDragging || onSeekRatio ? 0.98 : 0.9,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
    width: "100%",
    justifyContent: "center",
  },
  viewport: {
    width: "100%",
    justifyContent: "center",
  },
  barsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bar: {
    borderRadius: 999,
    alignSelf: "center",
  },
  scrubber: {
    position: "absolute",
    top: "50%",
    width: SCRUBBER_WIDTH,
    borderRadius: 999,
  },
});
