import type { GradientEngine } from "@wavr/core";
import { getEditorPerformanceSettings, type EditorPerformanceSettings, type GradientState } from "./store";
import { interpolateKeyframes, type Keyframe, type PlaybackMode } from "./timeline";

/**
 * Applies a performance mode's engine settings: pixel ratio, frame cap and how
 * sharp the layers are drawn (a fixed render scale, or one the engine adapts to
 * the frame rate). Only the live view uses them: captures and exports render at
 * full resolution whatever these are.
 */
export function applyEnginePerformanceSettings(
  engine: Pick<GradientEngine, "setMaxPixelRatio" | "setMaxFrameRate" | "setRenderScale" | "setAdaptiveRenderScale">,
  settings: EditorPerformanceSettings,
) {
  engine.setMaxPixelRatio(settings.maxPixelRatio);
  engine.setMaxFrameRate(settings.maxFrameRate);
  const { renderScale } = settings;
  if (renderScale.mode === "adaptive") {
    engine.setAdaptiveRenderScale({ minScale: renderScale.minScale, targetFps: renderScale.targetFps });
  } else {
    engine.setRenderScale(renderScale.scale);
  }
}

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
