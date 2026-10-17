// Adaptive internal resolution for the layer pass. The engine draws the layers
// (the expensive part: noise, fbm, raymarching) into the composite targets at a
// fraction of the canvas size and the post pass upsamples them, so a slow GPU
// can trade sharpness for frame rate without the user's settings changing.
//
// The controller below decides the fraction. It is deliberately slow and
// sticky: a drop needs more than a quarter of the last second's frames to be
// late, a rise needs a couple of calm seconds, and a rise that did not hold
// makes the next one wait twice as long, so it never flips between two scales.
// It takes frame times in and gives a scale out, with no clock or GL of its
// own, so it can be tested with made-up numbers.

/** Lowest scale the adaptive controller goes to by default. See TEXT_MASK_MIN_SCALE in engine.ts for why not lower. */
export const DEFAULT_MIN_RENDER_SCALE = 0.6;

/** The scales it steps through, from 1 down to `minScale`: each step is about 0.85x the one before. */
export function renderScaleLevels(minScale: number = DEFAULT_MIN_RENDER_SCALE): number[] {
  const floor = Math.min(1, Math.max(0.1, minScale));
  const levels = [1];
  let scale = 1;
  // Stop short of the floor if the next step would land within 0.02 of it, then end on it exactly.
  while (Math.round(scale * 0.85 * 100) / 100 > floor + 0.02) {
    scale = Math.round(scale * 0.85 * 100) / 100;
    levels.push(scale);
  }
  if (floor < 1) levels.push(floor);
  return levels;
}

export interface RenderScaleConfig {
  /** Scales to step through, highest first (renderScaleLevels). */
  levels: readonly number[];
  /** A p75 frame time above this (ms) means the frame rate is being missed: drop a level. */
  dropAboveMs: number;
  /** A p75 below this (ms) means there is room: after raiseAfterMs of that, go up a level. */
  raiseBelowMs: number;
  /** Judge on the frames of the last windowMs... */
  windowMs: number;
  /**
   * ...but never on fewer than this many: when frames are so slow that fewer
   * fit in the window, the newest minSamples are used, as long as none is older
   * than staleMs. Until there are that many, nothing is judged.
   */
  minSamples: number;
  /** Frames older than this are forgotten for good. */
  staleMs: number;
  /** Minimum time between a drop and the next one. */
  cooldownMs: number;
  /** How long the p75 must stay under raiseBelowMs before going up. */
  raiseAfterMs: number;
  /** A failed rise doubles raiseAfterMs, up to this. */
  maxRaiseAfterMs: number;
  /** A rise that has held this long counts as having worked. */
  stableMs: number;
  /** Frames are not judged for this long after a reset (a resize, a shader compile, ...). */
  settleMs: number;
  /** Frame times are clamped to this (a hidden tab or a long stall is one slow frame, not a verdict). */
  maxSampleMs: number;
}

export interface RenderScaleOptions {
  /** Lowest scale to go to. Default DEFAULT_MIN_RENDER_SCALE. */
  minScale?: number;
  /** The frame rate to hold. Drops start when more than a quarter of frames take over 1.15x its frame time. */
  targetFps?: number;
}

export function createRenderScaleConfig(options: RenderScaleOptions = {}): RenderScaleConfig {
  const frameMs = 1000 / Math.min(240, Math.max(10, options.targetFps ?? 45));
  return {
    levels: renderScaleLevels(options.minScale),
    dropAboveMs: frameMs * 1.15,
    raiseBelowMs: frameMs * 0.9,
    windowMs: 1000,
    minSamples: 5,
    staleMs: 3000,
    cooldownMs: 1000,
    raiseAfterMs: 2000,
    maxRaiseAfterMs: 60_000,
    stableMs: 20_000,
    settleMs: 500,
    maxSampleMs: 500,
  };
}

export interface RenderScaleState {
  /** Index into config.levels; 0 is full resolution. */
  level: number;
  /** When the level last changed. */
  changedAtMs: number;
  /** Since when the p75 has been under raiseBelowMs without a break; null if it is not. */
  calmSinceMs: number | null;
  /** How long calm must last before going up. Doubles after a rise that did not hold. */
  raiseAfterMs: number;
  /** When the level was last raised, until that rise has held for stableMs; otherwise null. */
  raisedAtMs: number | null;
}

export function initialRenderScaleState(nowMs: number, config: RenderScaleConfig): RenderScaleState {
  return { level: 0, changedAtMs: nowMs, calmSinceMs: null, raiseAfterMs: config.raiseAfterMs, raisedAtMs: null };
}

/**
 * One judgement: given the p75 of recent frame times at `nowMs`, the state
 * that follows. The level moves at most one step.
 */
export function stepRenderScale(
  state: RenderScaleState,
  p75Ms: number,
  nowMs: number,
  config: RenderScaleConfig,
): RenderScaleState {
  let { level, changedAtMs, calmSinceMs, raiseAfterMs, raisedAtMs } = state;

  // A rise that has held earns back the short wait.
  if (raisedAtMs !== null && nowMs - raisedAtMs >= config.stableMs) {
    raiseAfterMs = config.raiseAfterMs;
    raisedAtMs = null;
  }

  if (p75Ms > config.dropAboveMs) {
    calmSinceMs = null;
    if (level < config.levels.length - 1 && nowMs - changedAtMs >= config.cooldownMs) {
      // Dropping again soon after a rise means the higher scale was too much: wait longer next time.
      if (raisedAtMs !== null) raiseAfterMs = Math.min(raiseAfterMs * 2, config.maxRaiseAfterMs);
      return { level: level + 1, changedAtMs: nowMs, calmSinceMs: null, raiseAfterMs, raisedAtMs: null };
    }
  } else if (p75Ms < config.raiseBelowMs) {
    calmSinceMs ??= nowMs;
    if (level > 0 && nowMs - calmSinceMs >= raiseAfterMs && nowMs - changedAtMs >= raiseAfterMs) {
      return { level: level - 1, changedAtMs: nowMs, calmSinceMs: null, raiseAfterMs, raisedAtMs: nowMs };
    }
  } else {
    // Between the two thresholds: no reason to move either way, and not calm enough to count.
    calmSinceMs = null;
  }
  return { level, changedAtMs, calmSinceMs, raiseAfterMs, raisedAtMs };
}

/** The p-th percentile (0-1) of the first `count` values of `sorted`, nearest-rank. */
export function percentile(sorted: ArrayLike<number>, count: number, p: number): number {
  if (count <= 0) return 0;
  return sorted[Math.min(count - 1, Math.max(0, Math.ceil(p * count) - 1))];
}

const WINDOW_CAPACITY = 512;
const JUDGE_EVERY_MS = 100;

/**
 * Feeds frame times to stepRenderScale. `sample(nowMs, frameMs)` takes one
 * frame (how long it took, ms) and returns the scale to draw the layers at.
 */
export class RenderScaleController {
  readonly config: RenderScaleConfig;
  private state: RenderScaleState;
  private times = new Float64Array(WINDOW_CAPACITY);
  private frames = new Float64Array(WINDOW_CAPACITY);
  private head = 0;
  private count = 0;
  private scratch = new Float64Array(WINDOW_CAPACITY);
  private lastJudgedMs = -Infinity;
  private ignoreUntilMs = -Infinity;

  constructor(options: RenderScaleOptions = {}, nowMs = 0) {
    this.config = createRenderScaleConfig(options);
    this.state = initialRenderScaleState(nowMs, this.config);
  }

  /** The scale to draw the layers at. */
  get scale(): number {
    return this.config.levels[this.state.level];
  }

  /** Forgets the frames seen and ignores the next `settleMs`: what was measured no longer applies (a resize, a compile). */
  reset(nowMs: number) {
    this.count = 0;
    this.head = 0;
    this.ignoreUntilMs = nowMs + this.config.settleMs;
    this.state = { ...this.state, calmSinceMs: null };
  }

  /** Records a frame that took `frameMs` and ended at `nowMs`. Returns the scale in force afterwards. */
  sample(nowMs: number, frameMs: number): number {
    if (nowMs < this.ignoreUntilMs) return this.scale;
    this.push(nowMs, Math.min(frameMs, this.config.maxSampleMs));
    if (nowMs - this.lastJudgedMs >= JUDGE_EVERY_MS) {
      this.lastJudgedMs = nowMs;
      this.judge(nowMs);
    }
    return this.scale;
  }

  private push(nowMs: number, frameMs: number) {
    const slot = (this.head + this.count) % WINDOW_CAPACITY;
    if (this.count === WINDOW_CAPACITY) {
      this.head = (this.head + 1) % WINDOW_CAPACITY;
    } else {
      this.count++;
    }
    this.times[slot] = nowMs;
    this.frames[slot] = frameMs;
  }

  private judge(nowMs: number) {
    // Forget frames that went stale.
    while (this.count > 0 && nowMs - this.times[this.head] > this.config.staleMs) {
      this.head = (this.head + 1) % WINDOW_CAPACITY;
      this.count--;
    }

    // The frames of the last windowMs, or the newest minSamples if that is more.
    let inWindow = 0;
    while (
      inWindow < this.count &&
      nowMs - this.times[(this.head + this.count - 1 - inWindow) % WINDOW_CAPACITY] <= this.config.windowMs
    ) {
      inWindow++;
    }
    const used = Math.max(inWindow, Math.min(this.count, this.config.minSamples));
    if (used < this.config.minSamples) return;

    for (let i = 0; i < used; i++) {
      this.scratch[i] = this.frames[(this.head + this.count - used + i) % WINDOW_CAPACITY];
    }
    const window = this.scratch.subarray(0, used).sort();
    const next = stepRenderScale(this.state, percentile(window, used, 0.75), nowMs, this.config);
    if (next.level !== this.state.level) {
      // A different scale makes the frames seen so far beside the point.
      this.count = 0;
      this.head = 0;
    }
    this.state = next;
  }
}
