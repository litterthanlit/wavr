import { getEditorPerformanceSettings, type GradientState } from "./store";
import { interpolateKeyframes, type Keyframe, type PlaybackMode } from "./timeline";

/** Drops effects the current performance mode turns off. */
export function withPerformanceMode(state: GradientState): GradientState {
  const settings = getEditorPerformanceSettings(state.performanceMode);
  if (settings.realBloom === "off" && state.realBloomEnabled) {
    return { ...state, realBloomEnabled: false };
  }
  return state;
}

/**
 * `state` with its timeline keyframes applied at `timelineTime` seconds.
 * Unchanged when the timeline is off or has no keyframes.
 */
export function applyTimeline(state: GradientState, timelineTime: number): GradientState {
  if (!state.timelineEnabled || state.keyframes.length === 0) return state;
  const interpolated = interpolateKeyframes(
    state.keyframes as Keyframe[],
    timelineTime,
    state.timelineDuration,
    state.timelinePlaybackMode as PlaybackMode,
  );
  return interpolated ? { ...state, ...interpolated } : state;
}
