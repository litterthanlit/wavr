import { describe, expect, it } from "vitest";
import {
  DEFAULT_MIN_RENDER_SCALE,
  RenderScaleController,
  createRenderScaleConfig,
  initialRenderScaleState,
  percentile,
  renderScaleLevels,
  stepRenderScale,
} from "@wavr/core";

const FRAME = 1000 / 60; // a display refresh

describe("renderScaleLevels", () => {
  it("steps down from 1 to the floor, about 0.85x each time", () => {
    expect(renderScaleLevels()).toEqual([1, 0.85, 0.72, 0.6]);
    expect(renderScaleLevels(0.5)).toEqual([1, 0.85, 0.72, 0.61, 0.5]);
    expect(renderScaleLevels(0.75)).toEqual([1, 0.85, 0.75]);
    expect(renderScaleLevels(1)).toEqual([1]);
    expect(DEFAULT_MIN_RENDER_SCALE).toBe(0.6);
  });

  it("always ends on the floor and never goes up", () => {
    for (const floor of [0.3, 0.45, 0.6, 0.66, 0.8, 0.9, 0.97]) {
      const levels = renderScaleLevels(floor);
      expect(levels[0]).toBe(1);
      expect(levels[levels.length - 1]).toBe(floor);
      for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThan(levels[i - 1]);
    }
  });
});

describe("percentile", () => {
  it("is the nearest rank of the sorted values", () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80];
    expect(percentile(sorted, 8, 0.75)).toBe(60);
    expect(percentile(sorted, 8, 0.5)).toBe(40);
    expect(percentile(sorted, 8, 1)).toBe(80);
    expect(percentile(sorted, 8, 0)).toBe(10);
    expect(percentile(sorted, 5, 0.75)).toBe(40); // only the first `count` values
    expect(percentile([], 0, 0.75)).toBe(0);
  });
});

describe("stepRenderScale", () => {
  const config = createRenderScaleConfig({ targetFps: 45 }); // drop above 25.5 ms, raise below 20 ms
  const at = (level: number, over: Partial<ReturnType<typeof initialRenderScaleState>> = {}) => ({
    ...initialRenderScaleState(0, config),
    level,
    ...over,
  });

  it("derives its thresholds from the target frame rate", () => {
    expect(config.dropAboveMs).toBeCloseTo(25.56, 1);
    expect(config.raiseBelowMs).toBeCloseTo(20, 1);
    // A display refresh (16.7 ms) is inside the band that raises; two refreshes are over the line.
    expect(FRAME).toBeLessThan(config.raiseBelowMs);
    expect(FRAME * 2).toBeGreaterThan(config.dropAboveMs);
  });

  it("drops one level when the p75 is over the budget", () => {
    const next = stepRenderScale(at(0), 40, 5000, config);
    expect(next.level).toBe(1);
    expect(next.changedAtMs).toBe(5000);
  });

  it("moves one level at a time however slow the frames are", () => {
    expect(stepRenderScale(at(0), 5000, 5000, config).level).toBe(1);
    expect(stepRenderScale(at(1), 5000, 5000, config).level).toBe(2);
  });

  it("waits out the cooldown between drops", () => {
    const dropped = stepRenderScale(at(0), 40, 5000, config);
    expect(stepRenderScale(dropped, 40, 5000 + config.cooldownMs - 1, config).level).toBe(1);
    expect(stepRenderScale(dropped, 40, 5000 + config.cooldownMs, config).level).toBe(2);
  });

  it("stops at the last level", () => {
    const last = config.levels.length - 1;
    expect(stepRenderScale(at(last), 500, 60_000, config).level).toBe(last);
  });

  it("does nothing between the thresholds, and that does not count as calm", () => {
    const calm = stepRenderScale(at(2), 15, 10_000, config);
    expect(calm.calmSinceMs).toBe(10_000);
    const middling = stepRenderScale(calm, 23, 11_000, config);
    expect(middling.level).toBe(2);
    expect(middling.calmSinceMs).toBeNull();
  });

  it("raises one level after the p75 has stayed under the line for raiseAfterMs", () => {
    let state = at(2);
    state = stepRenderScale(state, 15, 10_000, config);
    state = stepRenderScale(state, 15, 10_000 + config.raiseAfterMs - 1, config);
    expect(state.level).toBe(2);
    state = stepRenderScale(state, 15, 10_000 + config.raiseAfterMs, config);
    expect(state.level).toBe(1);
    expect(state.raisedAtMs).toBe(10_000 + config.raiseAfterMs);
    // The next rise has to earn its own calm period.
    expect(state.calmSinceMs).toBeNull();
  });

  it("restarts the calm period when a slower stretch interrupts it", () => {
    let state = at(2);
    state = stepRenderScale(state, 15, 10_000, config);
    state = stepRenderScale(state, 22, 11_500, config); // between the thresholds
    state = stepRenderScale(state, 15, 12_000, config);
    expect(state.calmSinceMs).toBe(12_000);
    state = stepRenderScale(state, 15, 13_999, config);
    expect(state.level).toBe(2);
    state = stepRenderScale(state, 15, 14_000, config);
    expect(state.level).toBe(1);
  });

  it("never raises past full resolution", () => {
    let state = at(0);
    for (let t = 0; t < 30_000; t += 100) state = stepRenderScale(state, 10, t, config);
    expect(state.level).toBe(0);
  });

  it("doubles the wait after a rise that did not hold, up to a cap, and forgives a rise that held", () => {
    let state = at(1, { raisedAtMs: 20_000 }); // rose to level 1 at 20 s...
    state = stepRenderScale(state, 40, 21_000, config); // ...and was over budget a second later
    expect(state.level).toBe(2);
    expect(state.raiseAfterMs).toBe(config.raiseAfterMs * 2);
    expect(state.raisedAtMs).toBeNull();

    // Again and again: 4 s, 8 s, ... never past the cap.
    let wait = state.raiseAfterMs;
    for (let i = 0; i < 12; i++) {
      state = { ...state, level: 1, raisedAtMs: 100_000 + i * 1000, changedAtMs: 100_000 + i * 1000 };
      state = stepRenderScale(state, 40, 100_000 + i * 1000 + 1000, config);
      wait = Math.min(wait * 2, config.maxRaiseAfterMs);
      expect(state.raiseAfterMs).toBe(wait);
    }
    expect(wait).toBe(config.maxRaiseAfterMs);

    // A rise that stays for stableMs restores the short wait.
    state = { ...state, level: 1, raisedAtMs: 500_000, changedAtMs: 500_000 };
    state = stepRenderScale(state, 15, 500_000 + config.stableMs, config);
    expect(state.raiseAfterMs).toBe(config.raiseAfterMs);
    expect(state.raisedAtMs).toBeNull();
  });

  it("a drop that follows another drop does not count as a failed rise", () => {
    const first = stepRenderScale(at(0), 40, 5000, config);
    const second = stepRenderScale(first, 40, 6000, config);
    expect(second.level).toBe(2);
    expect(second.raiseAfterMs).toBe(config.raiseAfterMs);
  });

  it("does not change a state it is handed", () => {
    const state = at(1);
    const copy = { ...state };
    stepRenderScale(state, 40, 9999, config);
    expect(state).toEqual(copy);
  });
});

// ---------------------------------------------------------------------------
// The controller, driven by made-up frame times at 60 callbacks a second.
// ---------------------------------------------------------------------------

/** Feeds frames of `frameMs(scale)` back to back for `seconds`, returning the scale after each. */
function simulate(
  controller: RenderScaleController,
  startMs: number,
  seconds: number,
  frameMs: (scale: number, nowMs: number) => number,
): { endMs: number; scales: number[]; changes: { atMs: number; scale: number }[] } {
  let now = startMs;
  const scales: number[] = [];
  const changes: { atMs: number; scale: number }[] = [];
  let last = controller.scale;
  while (now < startMs + seconds * 1000) {
    const ms = frameMs(controller.scale, now);
    now += ms;
    const scale = controller.sample(now, ms);
    scales.push(scale);
    if (scale !== last) {
      changes.push({ atMs: now, scale });
      last = scale;
    }
  }
  return { endMs: now, scales, changes };
}

describe("RenderScaleController", () => {
  it("stays at full resolution when frames keep up, for as long as they do", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    const { changes } = simulate(controller, 0, 120, () => FRAME);
    expect(changes).toEqual([]);
    expect(controller.scale).toBe(1);
  });

  it("starts at full resolution", () => {
    expect(new RenderScaleController().scale).toBe(1);
  });

  it("steps down to the floor under sustained load, a step a second or so, and no further", () => {
    const controller = new RenderScaleController({ minScale: 0.6, targetFps: 45 });
    const { changes, scales } = simulate(controller, 0, 20, () => 45);
    expect(changes.map((c) => c.scale)).toEqual([0.85, 0.72, 0.6]);
    // It takes a window of evidence first, then a cooldown per step: reached the floor within 5 s.
    expect(changes[2].atMs).toBeLessThan(5000);
    for (let i = 1; i < changes.length; i++) {
      expect(changes[i].atMs - changes[i - 1].atMs).toBeGreaterThanOrEqual(1000);
    }
    expect(Math.min(...scales)).toBe(0.6);
  });

  it("holds a lower floor when asked, and a higher one", () => {
    const low = new RenderScaleController({ minScale: 0.5 });
    simulate(low, 0, 30, () => 60);
    expect(low.scale).toBe(0.5);
    const high = new RenderScaleController({ minScale: 0.85 });
    simulate(high, 0, 30, () => 60);
    expect(high.scale).toBe(0.85);
  });

  it("ignores an occasional slow frame", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    let n = 0;
    const { changes } = simulate(controller, 0, 60, () => (++n % 60 === 0 ? 300 : FRAME));
    expect(changes).toEqual([]);
  });

  it("tolerates up to a quarter of the frames being late, and drops past that", () => {
    const slowShare = (share: number) => {
      const controller = new RenderScaleController({ targetFps: 45 });
      let n = 0;
      // Every `period`th frame is late: a repeating pattern of share ≈ 1/period.
      const period = Math.round(1 / share);
      simulate(controller, 0, 30, () => (++n % period === 0 ? 50 : FRAME));
      return controller.scale;
    };
    expect(slowShare(1 / 6)).toBe(1); // ~17 % late
    expect(slowShare(1 / 3)).toBeLessThan(1); // ~33 % late
  });

  it("raises again, a step at a time, once the load is gone", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    const down = simulate(controller, 0, 10, () => 45);
    expect(controller.scale).toBe(0.6);

    const up = simulate(controller, down.endMs, 30, () => FRAME);
    expect(up.changes.map((c) => c.scale)).toEqual([0.72, 0.85, 1]);
    // Each rise waits for raiseAfterMs of calm, so the first is 2+ s after the load ended.
    expect(up.changes[0].atMs - down.endMs).toBeGreaterThanOrEqual(2000);
    for (let i = 1; i < up.changes.length; i++) {
      expect(up.changes[i].atMs - up.changes[i - 1].atMs).toBeGreaterThanOrEqual(2000);
    }
  });

  it("does not flip between two scales when only the lower one is affordable", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    // Full resolution takes 30 ms a frame; anything lower, 15.
    const frameMs = (scale: number) => (scale >= 1 ? 30 : 15);
    const tenMinutes = simulate(controller, 0, 600, frameMs);

    const drops = tenMinutes.changes.filter((c) => c.scale < 1).length;
    const rises = tenMinutes.changes.filter((c) => c.scale === 1).length;
    // A rise is tried every so often (2, 4, 8, 16, 32 s, then once a minute), each failed try waiting longer.
    expect(rises).toBeGreaterThanOrEqual(5);
    expect(rises).toBeLessThanOrEqual(15);
    expect(drops).toBeLessThanOrEqual(rises + 1);

    const risesAt = tenMinutes.changes.filter((c) => c.scale === 1).map((c) => c.atMs);
    const gaps = risesAt.slice(1).map((t, i) => t - risesAt[i]);
    // The gaps never shrink and grow quickly at first, until they reach the cap (about a minute).
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1] * 0.95);
    expect(gaps[3]).toBeGreaterThan(gaps[0] * 4);
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(controller.config.maxRaiseAfterMs);

    // Time spent over budget at full resolution stays a small share of the run.
    const framesAtFull = tenMinutes.scales.filter((s) => s === 1).length;
    expect(framesAtFull / tenMinutes.scales.length).toBeLessThan(0.1);
  });

  it("sits at a middle scale when that is the one that fits", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    // Cost grows with the pixels drawn: 36 ms at 1, 26 at 0.85, 19 at 0.72, 14 at 0.6.
    const frameMs = (scale: number) => 36 * scale * scale;
    const { changes } = simulate(controller, 0, 300, frameMs);
    expect(controller.scale).toBe(0.72);
    // It may probe upward a few times but never more than once per backoff.
    expect(changes.filter((c) => c.scale === 0.85).length).toBeLessThanOrEqual(10);
  });

  it("ignores the frames after a reset, and forgets the ones before it", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    // Four slow frames: not enough to judge.
    let now = 0;
    for (let i = 0; i < 4; i++) controller.sample((now += 50), 50);
    controller.reset(now);
    // The settle period: slow frames here count for nothing...
    for (let i = 0; i < 8; i++) controller.sample((now += 50), 50);
    expect(controller.scale).toBe(1);
    // ...and the earlier ones are gone: after it, five slow frames are needed again.
    const settled = now;
    expect(settled - 0).toBeGreaterThan(controller.config.settleMs);
    for (let i = 0; i < 4; i++) controller.sample((now += 50), 50);
    expect(controller.scale).toBe(1);
    for (let i = 0; i < 40; i++) controller.sample((now += 50), 50);
    expect(controller.scale).toBeLessThan(1);
  });

  it("counts a very long frame as one slow frame, not as the end of the world", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    let now = 0;
    // A hidden tab: a 30 s gap then ordinary frames.
    for (let i = 0; i < 20; i++) controller.sample((now += FRAME), FRAME);
    controller.sample((now += 30_000), 30_000);
    for (let i = 0; i < 100; i++) controller.sample((now += FRAME), FRAME);
    expect(controller.scale).toBe(1);

    // But frames that are all that slow are heard: 600 ms frames count as 500.
    for (let i = 0; i < 40; i++) controller.sample((now += 600), 600);
    expect(controller.scale).toBeLessThan(1);
  });

  it("judges nothing until it has enough frames", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    let now = 0;
    for (let i = 0; i < controller.config.minSamples - 1; i++) controller.sample((now += 400), 400);
    expect(controller.scale).toBe(1);
  });

  it("judges very slow frames on the newest few, though fewer than that fit in a second", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    let now = 0;
    // 400 ms frames: two fit in the window, but five of them (2 s) are still recent enough.
    for (let i = 0; i < controller.config.minSamples; i++) controller.sample((now += 400), 400);
    expect(controller.scale).toBe(0.85);
  });

  it("forgets frames older than its window, and never judges on stale ones", () => {
    const controller = new RenderScaleController({ targetFps: 45 });
    let now = 0;
    // A slow stretch just short of a verdict (4 frames), then a long pause, then one good frame:
    // five samples, but the slow four are 10 s old.
    for (let i = 0; i < 4; i++) controller.sample((now += 100), 80);
    now += 10_000;
    controller.sample((now += FRAME), FRAME);
    expect(controller.scale).toBe(1);
    for (let i = 0; i < 100; i++) controller.sample((now += FRAME), FRAME);
    expect(controller.scale).toBe(1);
  });

  it("is deterministic: the same frames give the same scales", () => {
    const run = () => {
      const controller = new RenderScaleController({ targetFps: 45 });
      let n = 0;
      return simulate(controller, 0, 120, (scale) => (Math.floor(n++ / 600) % 2 === 0 ? 36 * scale * scale : FRAME)).scales;
    };
    expect(run()).toEqual(run());
  });
});
