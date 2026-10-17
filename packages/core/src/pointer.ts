// Pointer model behind the mouse-reactive warp, ripple and trail: a critically
// damped smoother for the position, an eased presence value and the velocity
// derived from them. Pure maths, no GL, so it is unit-testable and shared by
// the engine and its tests. All times are real seconds.

/**
 * Position smoothing rate (rad/s). Critically damped, so the smoothed pointer
 * never overshoots the real one: it is within 2% of a jump after 5.83 / ω =
 * 146 ms, and trails a pointer moving at V canvas heights per second by 2V / ω
 * (0.05 V), close enough to stay glued to the cursor.
 */
export const POINTER_OMEGA = 40;
/** Presence easing rates (rad/s): 2% settle in about 290 ms on enter, 390 ms on leave. */
export const PRESENCE_OMEGA_IN = 20;
export const PRESENCE_OMEGA_OUT = 15;
/** Longest step integrated at once. A stalled frame (a background tab) advances this far and the rest follows over the next frames. */
export const MAX_POINTER_STEP = 0.25;
/** Cap on the velocity handed to shaders, canvas heights per second. */
export const MAX_POINTER_SPEED = 6;
/** Pointer speed (canvas heights per second) at which motion-driven effects reach full strength. Keep in step with MOUSE_SPEED_REF in mouse.glsl. */
export const POINTER_SPEED_REF = 1.5;
/** Seconds a click ripple lives. Keep in step with RIPPLE_LIFE in post.glsl. */
export const RIPPLE_DURATION = 1.6;
/** Trail energy removed per 60 Hz frame on top of the multiplicative decay, so 8-bit energy reaches zero instead of stalling. */
export const TRAIL_FLOOR_PER_FRAME = 0.0025;
/** Entering with less than this much presence jumps the smoothed pointer to the real one instead of sweeping across the canvas. */
const SNAP_PRESENCE = 0.15;

const EPS_POSITION = 2e-4;
const EPS_VELOCITY = 2e-3;
const EPS_PRESENCE = 2e-3;
const EPS_PRESENCE_VELOCITY = 1e-2;

/** A scalar and its rate of change, advanced by springStep. */
export interface Spring {
  value: number;
  velocity: number;
}

/**
 * Advances `spring` towards `target` by `dt` seconds with the exact solution
 * of a critically damped spring of natural frequency `omega`. Exact means the
 * result doesn't depend on how the time is split into steps (for a fixed
 * target), and it is stable at any `dt`.
 */
export function springStep(spring: Spring, target: number, omega: number, dt: number): void {
  const decay = Math.exp(-omega * dt);
  const offset = spring.value - target;
  const carry = (spring.velocity + omega * offset) * dt;
  spring.value = target + (offset + carry) * decay;
  spring.velocity = (spring.velocity - omega * carry) * decay;
}

export interface PointerState {
  /** Latest pointer position, uv (0..1, y up). */
  targetX: number;
  targetY: number;
  x: Spring;
  y: Spring;
  /** Whether the pointer is over the canvas. */
  active: boolean;
  /** 0 while absent, 1 while present, eased between. */
  presence: Spring;
}

/** A pointer that hasn't been seen yet: absent, at the centre. */
export function createPointerState(): PointerState {
  return {
    targetX: 0.5,
    targetY: 0.5,
    x: { value: 0.5, velocity: 0 },
    y: { value: 0.5, velocity: 0 },
    active: false,
    presence: { value: 0, velocity: 0 },
  };
}

/** The pointer is at (x, y) and present. */
export function setPointerTarget(state: PointerState, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  state.targetX = x;
  state.targetY = y;
  if (!state.active) {
    state.active = true;
    if (state.presence.value < SNAP_PRESENCE) {
      state.x.value = x;
      state.y.value = y;
      state.x.velocity = 0;
      state.y.velocity = 0;
    }
  }
}

/** The pointer entered or left. Leaving keeps the position so the effect fades out where the pointer was. */
export function setPointerPresent(state: PointerState, present: boolean): void {
  state.active = present;
}

/** Advances the smoothers by `dt` real seconds. Returns whether anything is still changing. */
export function stepPointer(state: PointerState, dt: number): boolean {
  const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), MAX_POINTER_STEP) : 0;
  if (step > 0) {
    springStep(state.x, state.targetX, POINTER_OMEGA, step);
    springStep(state.y, state.targetY, POINTER_OMEGA, step);
    const presenceTarget = state.active ? 1 : 0;
    springStep(state.presence, presenceTarget, state.active ? PRESENCE_OMEGA_IN : PRESENCE_OMEGA_OUT, step);
    // A critically damped spring can carry a little past its target after a reversal.
    state.presence.value = Math.min(1, Math.max(0, state.presence.value));
  }
  if (isPointerSettled(state)) {
    settlePointer(state);
    return false;
  }
  return true;
}

/** Whether position, velocity and presence have all come to rest at their targets. */
export function isPointerSettled(state: PointerState): boolean {
  const presenceTarget = state.active ? 1 : 0;
  return (
    Math.abs(state.x.value - state.targetX) < EPS_POSITION &&
    Math.abs(state.y.value - state.targetY) < EPS_POSITION &&
    Math.abs(state.x.velocity) < EPS_VELOCITY &&
    Math.abs(state.y.velocity) < EPS_VELOCITY &&
    Math.abs(state.presence.value - presenceTarget) < EPS_PRESENCE &&
    Math.abs(state.presence.velocity) < EPS_PRESENCE_VELOCITY
  );
}

/** Jumps the smoothed pointer and presence to their targets, at rest. */
export function settlePointer(state: PointerState): void {
  state.x.value = state.targetX;
  state.y.value = state.targetY;
  state.x.velocity = 0;
  state.y.velocity = 0;
  state.presence.value = state.active ? 1 : 0;
  state.presence.velocity = 0;
}

/**
 * Velocity of the smoothed pointer in aspect-correct units: canvas heights per
 * second (x is scaled by width / height, so a circle on screen is a circle in
 * these units). Its length is capped at MAX_POINTER_SPEED.
 */
export function pointerVelocity(state: PointerState, aspect: number): [number, number] {
  const vx = state.x.velocity * aspect;
  const vy = state.y.velocity;
  const speed = Math.hypot(vx, vy);
  if (speed <= MAX_POINTER_SPEED) return [vx, vy];
  const scale = MAX_POINTER_SPEED / speed;
  return [vx * scale, vy * scale];
}
