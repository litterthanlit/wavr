import type { GradientConfig } from "./types";

export type EasingFunction = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "spring";

export interface AnimateOptions {
  duration: number;
  easing: EasingFunction;
  onComplete?: () => void;
}

// --- Easing functions (input/output 0-1) ---

function easeLinear(t: number): number {
  return t;
}

function easeIn(t: number): number {
  return t * t * t;
}

function easeOut(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function easeInOut(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// CSS "ease" curve approximation (cubic-bezier 0.25, 0.1, 0.25, 1.0)
function easeDefault(t: number): number {
  // Fast start, gentle deceleration
  return t < 0.5
    ? 2 * t * t * (3 - 2 * t)
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

const EASING_MAP: Record<EasingFunction, (t: number) => number> = {
  "linear": easeLinear,
  "ease": easeDefault,
  "ease-in": easeIn,
  "ease-out": easeOut,
  "ease-in-out": easeInOut,
  "spring": easeLinear, // spring uses its own solver
};

export function getEasing(name: EasingFunction): (t: number) => number {
  return EASING_MAP[name] ?? easeLinear;
}

// --- Spring solver ---

export interface SpringState {
  value: number;
  velocity: number;
}

export function springStep(
  current: SpringState,
  target: number,
  dt: number,
  stiffness: number = 180,
  damping: number = 12,
): SpringState {
  const displacement = current.value - target;
  const springForce = -stiffness * displacement;
  const dampingForce = -damping * current.velocity;
  const acceleration = springForce + dampingForce;
  const velocity = current.velocity + acceleration * dt;
  const value = current.value + velocity * dt;
  return { value, velocity };
}

export function springIsSettled(state: SpringState, target: number, threshold: number = 0.001): boolean {
  return Math.abs(state.value - target) < threshold && Math.abs(state.velocity) < threshold;
}

// --- Tween engine ---

type NumericKeys<T> = { [K in keyof T]: T[K] extends number | undefined ? K : never }[keyof T];

interface ActiveTween {
  startConfig: Partial<GradientConfig>;
  endConfig: Partial<GradientConfig>;
  startTime: number;
  duration: number;
  easing: (t: number) => number;
  useSpring: boolean;
  springs: Map<string, SpringState>;
  onComplete?: () => void;
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColors(
  a: [number, number, number][],
  b: [number, number, number][],
  t: number,
): [number, number, number][] {
  const len = Math.max(a.length, b.length);
  const result: [number, number, number][] = [];
  for (let i = 0; i < len; i++) {
    const ac = a[Math.min(i, a.length - 1)];
    const bc = b[Math.min(i, b.length - 1)];
    result.push([
      lerpNumber(ac[0], bc[0], t),
      lerpNumber(ac[1], bc[1], t),
      lerpNumber(ac[2], bc[2], t),
    ]);
  }
  return result;
}

export class TweenManager {
  private activeTween: ActiveTween | null = null;
  private baseConfig: Partial<GradientConfig> = {};

  animateTo(
    currentConfig: GradientConfig,
    targetConfig: Partial<GradientConfig>,
    options: AnimateOptions,
  ): void {
    // Snapshot current values for properties being animated
    const startConfig: Partial<GradientConfig> = {};
    for (const key of Object.keys(targetConfig) as (keyof GradientConfig)[]) {
      (startConfig as Record<string, unknown>)[key] = currentConfig[key];
    }

    const useSpring = options.easing === "spring";
    const springs = new Map<string, SpringState>();

    if (useSpring) {
      // Initialize spring states for numeric top-level properties
      for (const key of Object.keys(targetConfig) as (keyof GradientConfig)[]) {
        const sv = startConfig[key];
        if (typeof sv === "number") {
          springs.set(key, { value: sv, velocity: 0 });
        }
      }
    }

    this.activeTween = {
      startConfig,
      endConfig: targetConfig,
      startTime: performance.now(),
      duration: options.duration,
      easing: getEasing(options.easing),
      useSpring,
      springs,
      onComplete: options.onComplete,
    };
  }

  tick(currentConfig: GradientConfig): Partial<GradientConfig> | null {
    const tween = this.activeTween;
    if (!tween) return null;

    const now = performance.now();
    const elapsed = now - tween.startTime;

    if (tween.useSpring) {
      return this.tickSpring(currentConfig, tween);
    }

    const rawT = Math.min(elapsed / tween.duration, 1);
    const t = tween.easing(rawT);

    const result = this.interpolateConfig(tween.startConfig, tween.endConfig, t);

    if (rawT >= 1) {
      this.activeTween = null;
      tween.onComplete?.();
    }

    return result;
  }

  private tickSpring(currentConfig: GradientConfig, tween: ActiveTween): Partial<GradientConfig> {
    const dt = 1 / 60; // fixed step
    const result: Partial<GradientConfig> = {};
    let allSettled = true;

    for (const [key, spring] of tween.springs) {
      const target = (tween.endConfig as Record<string, unknown>)[key] as number;
      const newState = springStep(spring, target, dt);
      tween.springs.set(key, newState);

      if (!springIsSettled(newState, target)) {
        allSettled = false;
      }

      (result as Record<string, unknown>)[key] = newState.value;
    }

    // Interpolate non-numeric properties using time-based fallback
    const elapsed = performance.now() - tween.startTime;
    const fallbackT = Math.min(elapsed / (tween.duration || 500), 1);
    for (const key of Object.keys(tween.endConfig) as (keyof GradientConfig)[]) {
      if (!tween.springs.has(key)) {
        const start = tween.startConfig[key];
        const end = tween.endConfig[key];
        if (start !== undefined && end !== undefined) {
          (result as Record<string, unknown>)[key] = this.lerpValue(start, end, fallbackT);
        }
      }
    }

    if (allSettled) {
      // Snap to target
      for (const [key, _] of tween.springs) {
        (result as Record<string, unknown>)[key] = (tween.endConfig as Record<string, unknown>)[key];
      }
      this.activeTween = null;
      tween.onComplete?.();
    }

    return result;
  }

  private interpolateConfig(
    start: Partial<GradientConfig>,
    end: Partial<GradientConfig>,
    t: number,
  ): Partial<GradientConfig> {
    const result: Partial<GradientConfig> = {};

    for (const key of Object.keys(end) as (keyof GradientConfig)[]) {
      const sv = start[key];
      const ev = end[key];
      if (sv === undefined || ev === undefined) continue;
      (result as Record<string, unknown>)[key] = this.lerpValue(sv, ev, t);
    }

    return result;
  }

  private lerpValue(start: unknown, end: unknown, t: number): unknown {
    if (typeof start === "number" && typeof end === "number") {
      return lerpNumber(start, end, t);
    }

    if (typeof start === "boolean") {
      return t >= 0.5 ? end : start;
    }

    // Layer arrays: interpolate colors within matching layers
    if (Array.isArray(start) && Array.isArray(end)) {
      // Check if this is a layers array
      if (start.length > 0 && typeof start[0] === "object" && "type" in (start[0] as object)) {
        return this.lerpLayers(start, end, t);
      }
    }

    // Nested objects (bloom, noise, etc.)
    if (typeof start === "object" && typeof end === "object" && start !== null && end !== null && !Array.isArray(start)) {
      const obj: Record<string, unknown> = {};
      const s = start as Record<string, unknown>;
      const e = end as Record<string, unknown>;
      for (const k of Object.keys(e)) {
        if (k in s) {
          obj[k] = this.lerpValue(s[k], e[k], t);
        } else {
          obj[k] = e[k];
        }
      }
      // Keep keys from start that aren't in end
      for (const k of Object.keys(s)) {
        if (!(k in e)) obj[k] = s[k];
      }
      return obj;
    }

    // Non-interpolable: snap at halfway
    return t >= 0.5 ? end : start;
  }

  private lerpLayers(start: unknown[], end: unknown[], t: number): unknown[] {
    const len = Math.max(start.length, end.length);
    const result: unknown[] = [];
    for (let i = 0; i < len; i++) {
      const sl = start[Math.min(i, start.length - 1)] as Record<string, unknown>;
      const el = end[Math.min(i, end.length - 1)] as Record<string, unknown>;
      const layer: Record<string, unknown> = {};
      for (const k of Object.keys(el)) {
        if (k === "colors" && Array.isArray(sl.colors) && Array.isArray(el.colors)) {
          layer.colors = lerpColors(
            sl.colors as [number, number, number][],
            el.colors as [number, number, number][],
            t,
          );
        } else if (k in sl) {
          layer[k] = this.lerpValue(sl[k], el[k], t);
        } else {
          layer[k] = el[k];
        }
      }
      for (const k of Object.keys(sl)) {
        if (!(k in layer)) layer[k] = sl[k];
      }
      result.push(layer);
    }
    return result;
  }

  isAnimating(): boolean {
    return this.activeTween !== null;
  }

  cancel(): void {
    this.activeTween = null;
  }
}
