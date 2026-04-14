export interface Keyframe {
  time: number; // seconds
  params: KeyframeParams;
}

export interface KeyframeParams {
  speed?: number;
  complexity?: number;
  scale?: number;
  distortion?: number;
  brightness?: number;
  saturation?: number;
  hueShift?: number;
  colorBlend?: number;
  noiseIntensity?: number;
  vignette?: number;
}

export type PlaybackMode = "loop" | "bounce" | "once";

export const KEYFRAMEABLE_PARAMS: (keyof KeyframeParams)[] = [
  "speed", "complexity", "scale", "distortion",
  "brightness", "saturation", "hueShift", "colorBlend",
  "noiseIntensity", "vignette",
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function interpolateKeyframes(
  keyframes: Keyframe[],
  time: number,
  duration: number,
  mode: PlaybackMode
): KeyframeParams | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return { ...keyframes[0].params };

  // Apply playback mode
  let t = time;
  if (mode === "loop") {
    t = t % duration;
  } else if (mode === "bounce") {
    const cycle = t % (duration * 2);
    t = cycle > duration ? duration * 2 - cycle : cycle;
  } else {
    t = Math.min(t, duration);
  }

  // Find surrounding keyframes
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);

  // Before first keyframe
  if (t <= sorted[0].time) return { ...sorted[0].params };
  // After last keyframe
  if (t >= sorted[sorted.length - 1].time) return { ...sorted[sorted.length - 1].params };

  // Find the two surrounding keyframes
  let prev = sorted[0];
  let next = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i].time && t < sorted[i + 1].time) {
      prev = sorted[i];
      next = sorted[i + 1];
      break;
    }
  }

  // Interpolate
  const segmentDuration = next.time - prev.time;
  const progress = segmentDuration > 0 ? (t - prev.time) / segmentDuration : 0;
  // Smooth easing
  const eased = progress * progress * (3 - 2 * progress);

  const result: KeyframeParams = {};
  for (const key of KEYFRAMEABLE_PARAMS) {
    const a = prev.params[key];
    const b = next.params[key];
    if (a !== undefined && b !== undefined) {
      result[key] = lerp(a, b, eased);
    } else if (a !== undefined) {
      result[key] = a;
    } else if (b !== undefined) {
      result[key] = b;
    }
  }

  return result;
}
