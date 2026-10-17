import { afterEach, describe, expect, it, vi } from "vitest";
import { GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import {
  RIPPLE_DURATION,
  createPointerState,
  pointerVelocity,
  setPointerTarget,
  settlePointer,
  stepPointer,
} from "../../../packages/core/src/pointer";
import { createFakeGL, type DrawRecord } from "./test-utils/fake-webgl";

// The fake canvas is 16 x 8: aspect 2, trail field 4 x 2.
const ASPECT = 2;

function stateWith(overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [] });
  return { ...base, layers: [createLayer({ gradientType: "mesh" })], ...overrides };
}

function setup() {
  const fake = createFakeGL();
  const engine = new GradientEngine(fake.canvas, {});
  /** Renders and returns the layer pass and the post pass of that frame. */
  const frame = (state: EngineState) => {
    const from = fake.draws.length;
    engine.render(state);
    const drawn = fake.draws.slice(from);
    return { layer: drawn.find((d) => fake.programOf(d)?.gradientId === 0)!, post: drawn[drawn.length - 1], drawn };
  };
  const trailDraws = (from = 0): DrawRecord[] => fake.draws.slice(from).filter((d) => d.uniforms.u_trailDecay !== undefined);
  return { engine, ...fake, frame, trailDraws };
}

describe("engine pointer uniforms", () => {
  it("has no mouse effect before the first pointer event", () => {
    const { frame } = setup();
    const { layer } = frame(stateWith());
    expect(layer.uniforms.u_mousePresence).toBe(0);
    expect(layer.uniforms.u_mouseSmooth).toEqual([0.5, 0.5]);
    expect(layer.uniforms.u_mouseVelocity).toEqual([0, 0]);
  });

  it("stays absent however long the loop runs without a pointer", () => {
    const { engine, frame } = setup();
    for (let i = 0; i < 120; i++) engine.advancePointer(1 / 60);
    expect(frame(stateWith()).layer.uniforms.u_mousePresence).toBe(0);
  });

  it("setMouse implies presence, eases it in, and jumps to the first position", () => {
    const { engine, frame } = setup();
    engine.setMouse(0.3, 0.7);
    // Before any time has passed it is not visible yet, but it is already where it entered.
    let { layer } = frame(stateWith());
    expect(layer.uniforms.u_mousePresence).toBe(0);
    expect(layer.uniforms.u_mouseSmooth).toEqual([0.3, 0.7]);

    engine.advancePointer(1 / 60);
    layer = frame(stateWith()).layer;
    expect(layer.uniforms.u_mousePresence).toBeGreaterThan(0);
    expect(layer.uniforms.u_mousePresence).toBeLessThan(0.2);

    for (let i = 0; i < 60; i++) engine.advancePointer(1 / 60);
    layer = frame(stateWith()).layer;
    expect(layer.uniforms.u_mousePresence).toBe(1);
    expect(layer.uniforms.u_mouseVelocity).toEqual([0, 0]);
  });

  it("setPointerActive(false) fades the effect out where the pointer was", () => {
    const { engine, frame } = setup();
    engine.setMouse(0.8, 0.2);
    engine.settlePointer();
    expect(frame(stateWith()).layer.uniforms.u_mousePresence).toBe(1);

    engine.setPointerActive(false);
    engine.advancePointer(0.1);
    let { layer } = frame(stateWith());
    expect(layer.uniforms.u_mousePresence).toBeGreaterThan(0);
    expect(layer.uniforms.u_mousePresence).toBeLessThan(1);

    for (let i = 0; i < 90; i++) engine.advancePointer(1 / 60);
    layer = frame(stateWith()).layer;
    expect(layer.uniforms.u_mousePresence).toBe(0);
    expect(layer.uniforms.u_mouseSmooth).toEqual([0.8, 0.2]);
  });

  it("hands the shaders velocity in canvas heights per second, not uv", () => {
    const { engine, frame } = setup();
    engine.setMouse(0.2, 0.5);
    engine.settlePointer();
    engine.setMouse(0.6, 0.5);
    engine.advancePointer(1 / 60);

    const expected = createPointerState();
    setPointerTarget(expected, 0.2, 0.5);
    settlePointer(expected);
    setPointerTarget(expected, 0.6, 0.5);
    stepPointer(expected, 1 / 60);
    const [vx] = pointerVelocity(expected, ASPECT);

    const { layer } = frame(stateWith());
    const velocity = layer.uniforms.u_mouseVelocity as number[];
    expect(velocity[0]).toBeCloseTo(vx, 9);
    expect(velocity[0]).toBeGreaterThan(0);
    expect(velocity[1]).toBe(0);
    // The smoothed position is between the old and the new target: no overshoot.
    const smooth = layer.uniforms.u_mouseSmooth as number[];
    expect(smooth[0]).toBeGreaterThan(0.2);
    expect(smooth[0]).toBeLessThan(0.6);
  });

  it("settlePointer puts the smoothed pointer on its target at rest", () => {
    const { engine, frame } = setup();
    engine.setMouse(0.1, 0.9);
    engine.settlePointer();
    engine.setMouse(0.9, 0.1);
    engine.advancePointer(1 / 60);
    engine.settlePointer();
    const { layer } = frame(stateWith());
    expect(layer.uniforms.u_mouseSmooth).toEqual([0.9, 0.1]);
    expect(layer.uniforms.u_mouseVelocity).toEqual([0, 0]);
    expect(layer.uniforms.u_mousePresence).toBe(1);
  });
});

describe("click ripple", () => {
  it("runs on real seconds, not the speed-scaled animation clock", () => {
    const { engine, frame } = setup();
    engine.setSpeedMultiplier(0.1);
    engine.setElapsedTime(5);
    const state = stateWith({ rippleEnabled: true });
    engine.triggerRipple(0.3, 0.6);

    let { post } = frame(state);
    expect(post.uniforms.u_rippleEnabled).toBe(1);
    expect(post.uniforms.u_rippleOrigin).toEqual([0.3, 0.6]);
    expect(post.uniforms.u_rippleTime).toBe(0);

    engine.advancePointer(0.1);
    engine.advancePointer(0.1);
    engine.advancePointer(0.1);
    post = frame(state).post;
    expect(post.uniforms.u_rippleTime).toBeCloseTo(0.3, 9);
    expect(engine.getElapsedTime()).toBe(5); // untouched

    engine.advancePointer(RIPPLE_DURATION);
    post = frame(state).post;
    expect(post.uniforms.u_rippleEnabled).toBe(0);
  });

  it("only draws when the ripple effect is on", () => {
    const { engine, frame } = setup();
    engine.triggerRipple(0.5, 0.5);
    expect(frame(stateWith({ rippleEnabled: false })).post.uniforms.u_rippleEnabled).toBe(0);
  });

  it("a second click restarts it from the new place", () => {
    const { engine, frame } = setup();
    const state = stateWith({ rippleEnabled: true });
    engine.triggerRipple(0.2, 0.2);
    engine.advancePointer(0.5);
    engine.triggerRipple(0.7, 0.4);
    const { post } = frame(state);
    expect(post.uniforms.u_rippleOrigin).toEqual([0.7, 0.4]);
    expect(post.uniforms.u_rippleTime).toBe(0);
  });
});

describe("pointer trail", () => {
  const trailOn = () => stateWith({ trailEnabled: true, trailLength: 0.96, trailWidth: 0.05 });

  it("allocates the field but draws nothing until pointer time has passed", () => {
    const { engine, frame, trailDraws } = setup();
    const { post } = frame(trailOn());
    expect(post.uniforms.u_trailEnabled).toBe(1);
    expect(post.uniforms.u_trailWidth).toBe(0.05);
    expect(post.boundTextures.get(4)).toBeTruthy();
    expect(trailDraws()).toHaveLength(0);

    engine.setMouse(0.5, 0.5);
    engine.advancePointer(1 / 60);
    frame(trailOn());
    expect(trailDraws()).toHaveLength(1);
  });

  it("does not age the trail when the same moment is drawn again (captures, repaints)", () => {
    const { engine, frame, trailDraws } = setup();
    engine.setMouse(0.5, 0.5);
    engine.advancePointer(1 / 60);
    frame(trailOn());
    frame(trailOn());
    engine.capturePixels(trailOn());
    expect(trailDraws()).toHaveLength(1);
  });

  it("decays per real time, whatever the frame rate", () => {
    const { engine, trailDraws } = setup();
    const state = trailOn();
    engine.setMouse(0.5, 0.5);
    engine.advancePointer(1 / 30);
    engine.updateTrail(state);
    const slow = trailDraws()[0].uniforms.u_trailDecay as number;

    engine.advancePointer(1 / 60);
    engine.updateTrail(state);
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);
    const [, a, b] = trailDraws();
    const fast = (a.uniforms.u_trailDecay as number) * (b.uniforms.u_trailDecay as number);

    expect(slow).toBeCloseTo(Math.pow(0.96, 2), 12);
    expect(fast).toBeCloseTo(slow, 12);
  });

  it("applies the time of several advances in one pass, capped at 0.1 s", () => {
    const { engine, trailDraws } = setup();
    const state = trailOn();
    engine.setMouse(0.5, 0.5);
    engine.advancePointer(1 / 60);
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);
    expect(trailDraws()[0].uniforms.u_trailDecay).toBeCloseTo(Math.pow(0.96, 2), 12);

    engine.advancePointer(5);
    engine.updateTrail(state);
    expect(trailDraws()[1].uniforms.u_trailDecay).toBeCloseTo(Math.pow(0.96, 6), 12);
  });

  it("stamps a segment from the last position to the current one, aspect-correct", () => {
    const { engine, trailDraws } = setup();
    const state = trailOn();
    engine.setMouse(0.2, 0.5);
    engine.settlePointer();
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);

    engine.setMouse(0.8, 0.5);
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);

    const [first, second] = trailDraws();
    // A pointer standing still stamps a dot ...
    expect(first.uniforms.u_trailFrom).toEqual(first.uniforms.u_trailTo);
    // ... a moving one a line from where the last stamp was.
    expect(second.uniforms.u_trailFrom).toEqual(first.uniforms.u_trailTo);
    const to = second.uniforms.u_trailTo as number[];
    expect(to[0]).toBeGreaterThan(0.2);
    expect(to[0]).toBeLessThan(0.8);
    expect(second.uniforms.u_trailAspect).toBe(ASPECT);
    expect(second.uniforms.u_trailWidth).toBe(0.05);
    // Stronger while moving than at rest.
    expect(second.uniforms.u_trailStamp as number).toBeGreaterThan(first.uniforms.u_trailStamp as number);
  });

  it("stamps nothing while the pointer is absent", () => {
    const { engine, trailDraws } = setup();
    const state = trailOn();
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);
    expect(trailDraws()[0].uniforms.u_trailStamp).toBe(0);
  });

  it("a pointer that comes in elsewhere stamps a dot there, not a line from where it left", () => {
    const { engine, trailDraws } = setup();
    const state = trailOn();
    engine.setMouse(0.1, 0.1);
    engine.settlePointer();
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);

    engine.setPointerActive(false);
    for (let i = 0; i < 90; i++) {
      engine.advancePointer(1 / 60);
      engine.updateTrail(state);
    }
    engine.setMouse(0.9, 0.9);
    engine.advancePointer(1 / 60);
    engine.updateTrail(state);

    const last = trailDraws().at(-1)!;
    expect(last.uniforms.u_trailFrom).toEqual([0.9, 0.9]);
    expect(last.uniforms.u_trailTo).toEqual([0.9, 0.9]);
  });

  it("drops the field when the trail is switched off", () => {
    const { frame } = setup();
    frame(trailOn());
    const { post } = frame(stateWith({ trailEnabled: false }));
    expect(post.uniforms.u_trailEnabled).toBe(0);
    expect(post.boundTextures.get(4) ?? null).toBeNull();
  });

  it("never samples the field it is writing", () => {
    const { engine, frame, feedbackLoops } = setup();
    engine.setMouse(0.4, 0.4);
    for (let i = 0; i < 6; i++) {
      engine.setMouse(0.4 + i * 0.05, 0.4);
      engine.advancePointer(1 / 60);
      frame(trailOn());
    }
    expect(feedbackLoops).toEqual([]);
  });
});

describe("render loop and the pointer", () => {
  let nowMs = 1000;
  let queue: Array<() => void> = [];

  function loopSetup(state: EngineState) {
    nowMs = 1000;
    queue = [];
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
      queue.push(callback);
      return queue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      queue = [];
    });
    const setupResult = setup();
    let current = state;
    setupResult.engine.startLoop(() => current);
    /** Runs `count` animation frames `ms` apart and returns how many of them drew. */
    const run = (count: number, ms = 1000 / 60 + 0.5) => {
      let drew = 0;
      for (let i = 0; i < count; i++) {
        nowMs += ms;
        const before = setupResult.draws.length;
        queue.shift()?.();
        if (setupResult.draws.length > before) drew++;
      }
      return drew;
    };
    return { ...setupResult, run, setState: (next: EngineState) => { current = next; } };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("paused: draws the first frame (startLoop draws it at once), then idles", () => {
    const { run, engine, draws } = loopSetup(stateWith({ playing: false }));
    expect(draws.length).toBeGreaterThan(0);
    expect(run(30)).toBe(0);
    expect(engine.getElapsedTime()).toBe(0);
  });

  it("paused: the pointer still answers, then the loop goes idle again", () => {
    const { run, engine, draws, frame } = loopSetup(stateWith({ playing: false }));
    expect(run(10)).toBe(0);

    engine.setMouse(0.4, 0.6);
    // Draws every frame while the presence settles (about 0.45 s) ...
    expect(run(20)).toBe(20);
    // ... and stops once it has.
    run(120);
    const settled = draws.length;
    expect(run(60)).toBe(0);
    expect(draws.length).toBe(settled);

    // The animation clock never moved, and the last frame had the effect fully on.
    expect(engine.getElapsedTime()).toBe(0);
    expect(frame(stateWith({ playing: false })).layer.uniforms.u_mousePresence).toBe(1);

    // Leaving fades it out the same way.
    engine.setPointerActive(false);
    expect(run(20)).toBe(20);
    run(120);
    expect(run(30)).toBe(0);
    expect(frame(stateWith({ playing: false })).layer.uniforms.u_mousePresence).toBe(0);
  });

  it("paused: a click ripple plays out in real time and then stops drawing", () => {
    const state = stateWith({ playing: false, rippleEnabled: true });
    const { run, engine, draws, programOf } = loopSetup(state);
    expect(run(5)).toBe(0);

    engine.triggerRipple(0.5, 0.5);
    const drew = run(60); // about a second
    expect(drew).toBe(60);
    const post = [...draws].reverse().find((d) => programOf(d)?.gradientId === null)!;
    expect(post.uniforms.u_rippleEnabled).toBe(1);
    expect(post.uniforms.u_rippleTime as number).toBeGreaterThan(0.9);
    expect(post.uniforms.u_rippleTime as number).toBeLessThan(1.1);

    run(60); // past the end
    expect(run(30)).toBe(0);
    expect(engine.getElapsedTime()).toBe(0);
  });

  it("paused: draws while a trail is fading, then goes idle", () => {
    const state = stateWith({ playing: false, trailEnabled: true, trailLength: 0.9 });
    const { run, engine } = loopSetup(state);
    engine.setMouse(0.3, 0.5);
    run(20);
    engine.setMouse(0.7, 0.5);
    run(30);
    // The pointer is at rest by now (about 0.25 s), but the stroke it left is still fading (0.9 per frame: under a second).
    expect(run(20)).toBe(20);
    run(400);
    expect(run(30)).toBe(0);
  });

  it("paused: leaves ripples and trails alone when those effects are off", () => {
    const { run, engine } = loopSetup(stateWith({ playing: false }));
    engine.triggerRipple(0.5, 0.5);
    expect(run(30)).toBe(0);
  });

  it("playing: the ripple counts real seconds while the animation clock is slowed", () => {
    const { run, engine, draws, programOf } = loopSetup(stateWith({ playing: true, rippleEnabled: true }));
    engine.setSpeedMultiplier(0.1);
    engine.triggerRipple(0.5, 0.5);
    run(30); // half a second at 60 fps
    const post = [...draws].reverse().find((d) => programOf(d)?.gradientId === null)!;
    expect(post.uniforms.u_rippleTime as number).toBeGreaterThan(0.45);
    expect(post.uniforms.u_rippleTime as number).toBeLessThan(0.55);
    expect(engine.getElapsedTime()).toBeLessThan(0.07);
  });
});
