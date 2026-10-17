import { describe, expect, it, vi } from "vitest";
import { attachPointer, type PointerTarget } from "@wavr/core";
import {
  MAX_POINTER_SPEED,
  POINTER_OMEGA,
  createPointerState,
  isPointerSettled,
  pointerVelocity,
  setPointerPresent,
  setPointerTarget,
  settlePointer,
  springStep,
  stepPointer,
  type PointerState,
} from "../../../packages/core/src/pointer";

/** Steps `state` for `seconds` in `dt` slices and returns the smoothed x after each. */
function run(state: PointerState, seconds: number, dt: number): number[] {
  const xs: number[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) {
    stepPointer(state, dt);
    xs.push(state.x.value);
  }
  return xs;
}

/** A pointer that is present and settled at (x, y). */
function pointerAt(x: number, y: number): PointerState {
  const state = createPointerState();
  setPointerTarget(state, x, y);
  settlePointer(state);
  return state;
}

describe("pointer smoother", () => {
  it("reaches a new target without ever overshooting it", () => {
    for (const dt of [1 / 240, 1 / 120, 1 / 60, 1 / 30]) {
      const state = pointerAt(0.2, 0.5);
      setPointerTarget(state, 0.8, 0.5);
      const xs = run(state, 1, dt);
      for (let i = 0; i < xs.length; i++) {
        expect(xs[i]).toBeLessThanOrEqual(0.8 + 1e-12);
        if (i > 0) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-12);
      }
      expect(xs[xs.length - 1]).toBe(0.8);
    }
  });

  it("settles in about 120-200 ms", () => {
    const state = pointerAt(0, 0.5);
    setPointerTarget(state, 1, 0.5);
    let settledAt = -1;
    for (let i = 1; i <= 600 && settledAt < 0; i++) {
      stepPointer(state, 0.001);
      if (Math.abs(1 - state.x.value) < 0.02) settledAt = i * 0.001;
    }
    // 2% of the jump, with ω = 40 rad/s: 5.83 / 40 = 146 ms
    expect(settledAt).toBeGreaterThan(0.12);
    expect(settledAt).toBeLessThan(0.2);
    expect(POINTER_OMEGA).toBeGreaterThan(30);
  });

  it("does not overshoot when a moving pointer stops either", () => {
    const state = pointerAt(0.1, 0.5);
    let target = 0.1;
    for (let i = 0; i < 90; i++) {
      target += 0.01; // 0.6 per second
      setPointerTarget(state, target, 0.5);
      stepPointer(state, 1 / 60);
    }
    // The smoothed pointer trails by about 2V / ω ...
    expect(target - state.x.value).toBeGreaterThan(0.02);
    expect(target - state.x.value).toBeLessThan(0.04);
    // ... and closes the gap from behind once the real one stops.
    const xs = run(state, 1, 1 / 60);
    for (const x of xs) expect(x).toBeLessThanOrEqual(target + 1e-9);
  });

  it("gives the same position whatever the frame rate", () => {
    const at = (steps: number, dt: number) => {
      const state = pointerAt(0.3, 0.7);
      setPointerTarget(state, 0.9, 0.2);
      for (let i = 0; i < steps; i++) stepPointer(state, dt);
      return state;
    };
    const coarse = at(1, 0.033);
    for (const [steps, dt] of [[4, 0.00825], [2, 0.0165], [33, 0.001]] as const) {
      const fine = at(steps, dt);
      expect(fine.x.value).toBeCloseTo(coarse.x.value, 9);
      expect(fine.y.value).toBeCloseTo(coarse.y.value, 9);
      expect(fine.x.velocity).toBeCloseTo(coarse.x.velocity, 8);
    }
  });

  it("is stable for any step, and a stalled frame only advances so far", () => {
    const state = pointerAt(0.1, 0.1);
    setPointerTarget(state, 0.9, 0.9);
    stepPointer(state, 30); // a background tab coming back: clamped to MAX_POINTER_STEP
    expect(state.x.value).toBeGreaterThan(0.85);
    expect(state.x.value).toBeLessThan(0.9);
    expect(Number.isFinite(state.x.velocity)).toBe(true);
    stepPointer(state, 1 / 60);
    stepPointer(state, 1 / 60);
    stepPointer(state, 1 / 60);
    expect(state.x.value).toBeCloseTo(0.9, 2);
    // The exact step itself is stable at any size.
    const spring = { value: 0, velocity: 0 };
    springStep(spring, 1, 40, 1e6);
    expect(spring.value).toBeCloseTo(1, 12);
  });

  it("ignores NaN positions and steps", () => {
    const state = pointerAt(0.4, 0.4);
    setPointerTarget(state, Number.NaN, 0.1);
    stepPointer(state, Number.NaN);
    expect(state.targetX).toBe(0.4);
    expect(state.x.value).toBe(0.4);
  });
});

describe("pointer presence", () => {
  it("starts absent and stays at rest until the first pointer event", () => {
    const state = createPointerState();
    expect(state.active).toBe(false);
    expect(state.presence.value).toBe(0);
    expect(stepPointer(state, 1 / 60)).toBe(false);
    expect(isPointerSettled(state)).toBe(true);
    expect(state.presence.value).toBe(0);
  });

  it("eases in over a few hundred ms instead of switching on", () => {
    const state = createPointerState();
    setPointerTarget(state, 0.6, 0.4);
    expect(state.presence.value).toBe(0);

    const seen: number[] = [];
    for (let i = 0; i < 60; i++) {
      stepPointer(state, 1 / 60);
      seen.push(state.presence.value);
    }
    expect(seen[0]).toBeGreaterThan(0);
    expect(seen[0]).toBeLessThan(0.1);
    // 100 ms in: under way but not there; 300 ms in: nearly there; 1 s in: done.
    expect(seen[5]).toBeGreaterThan(0.2);
    expect(seen[5]).toBeLessThan(0.7);
    expect(seen[17]).toBeGreaterThan(0.9);
    expect(seen[59]).toBe(1);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
  });

  it("eases out on leave and keeps the position where the pointer left", () => {
    const state = pointerAt(0.25, 0.75);
    expect(state.presence.value).toBe(1);
    setPointerPresent(state, false);
    const seen: number[] = [];
    for (let i = 0; i < 90; i++) {
      stepPointer(state, 1 / 60);
      seen.push(state.presence.value);
    }
    expect(seen[0]).toBeLessThan(1);
    expect(seen[0]).toBeGreaterThan(0.9);
    expect(seen[29]).toBeGreaterThan(0); // not gone after 500 ms of ... still easing
    expect(seen[89]).toBe(0);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1]);
    expect(state.x.value).toBe(0.25);
    expect(state.y.value).toBe(0.75);
    expect(isPointerSettled(state)).toBe(true);
  });

  it("jumps to where the pointer enters rather than sweeping across from the old spot", () => {
    const state = pointerAt(0.1, 0.1);
    setPointerPresent(state, false);
    run(state, 1, 1 / 60); // fully gone
    setPointerTarget(state, 0.9, 0.8);
    expect(state.x.value).toBe(0.9);
    expect(state.y.value).toBe(0.8);
    expect(pointerVelocity(state, 1)).toEqual([0, 0]);
  });

  it("glides, not jumps, when it comes back while the effect is still visible", () => {
    const state = pointerAt(0.1, 0.5);
    setPointerPresent(state, false);
    for (let i = 0; i < 6; i++) stepPointer(state, 1 / 60); // 100 ms: mostly still there
    setPointerTarget(state, 0.9, 0.5);
    expect(state.x.value).toBeLessThan(0.2);
  });
});

describe("pointer velocity", () => {
  it("is in canvas heights per second, so x counts for the aspect ratio", () => {
    // 0.5 uv/s to the right on a 2:1 canvas is 1 height/s.
    const state = pointerAt(0.1, 0.5);
    let x = 0.1;
    let sum = 0;
    let last: [number, number] = [0, 0];
    for (let i = 0; i < 120; i++) {
      x += 0.5 / 60;
      setPointerTarget(state, x, 0.5);
      stepPointer(state, 1 / 60);
      last = pointerVelocity(state, 2);
      if (i >= 90) sum += last[0];
    }
    // The target here moves in 60 Hz steps, which the end-of-frame velocity
    // reads about 4% low; real pointer events arrive between frames.
    expect(sum / 30).toBeGreaterThan(0.95);
    expect(sum / 30).toBeLessThan(1.05);
    expect(last[1]).toBe(0);
    // And the same motion on a square canvas is half that.
    expect(pointerVelocity(state, 1)[0]).toBeCloseTo(last[0] / 2, 9);
  });

  it("is zero for a still pointer and caps its length", () => {
    const still = pointerAt(0.5, 0.5);
    expect(pointerVelocity(still, 16 / 9)).toEqual([0, 0]);

    const state = pointerAt(0, 0);
    setPointerTarget(state, 1, 1);
    stepPointer(state, 1 / 240);
    const [vx, vy] = pointerVelocity(state, 16 / 9);
    expect(Math.hypot(vx, vy)).toBeCloseTo(MAX_POINTER_SPEED, 9);
    // Direction is kept.
    expect(vx / vy).toBeCloseTo(16 / 9, 6);
  });
});

/** A DOM-ish element: an EventTarget with a rect. */
function fakeElement(rect = { left: 10, top: 20, width: 200, height: 100 }) {
  const element = new EventTarget() as EventTarget & {
    getBoundingClientRect(): typeof rect;
    ownerDocument?: { defaultView: EventTarget };
  };
  element.getBoundingClientRect = () => rect;
  return element as unknown as HTMLElement & EventTarget & { ownerDocument?: { defaultView: EventTarget } };
}

const fire = (target: EventTarget, type: string, props: Record<string, unknown> = {}) =>
  target.dispatchEvent(Object.assign(new Event(type), props));

function spyTarget(): PointerTarget & { setMouse: ReturnType<typeof vi.fn>; setPointerActive: ReturnType<typeof vi.fn>; triggerRipple: ReturnType<typeof vi.fn> } {
  return { setMouse: vi.fn(), setPointerActive: vi.fn(), triggerRipple: vi.fn() };
}

describe("attachPointer", () => {
  it("maps the pointer to the element, 0..1 with y up", () => {
    const element = fakeElement();
    const target = spyTarget();
    attachPointer(element, target);

    fire(element, "pointermove", { clientX: 110, clientY: 45 });
    expect(target.setMouse).toHaveBeenLastCalledWith(0.5, 0.75);
    fire(element, "pointermove", { clientX: 10, clientY: 120 }); // bottom-left corner
    expect(target.setMouse).toHaveBeenLastCalledWith(0, 0);
    fire(element, "pointermove", { clientX: 210, clientY: 20 }); // top-right corner
    expect(target.setMouse).toHaveBeenLastCalledWith(1, 1);
  });

  it("follows the element's rect as it moves", () => {
    const rect = { left: 0, top: 0, width: 100, height: 100 };
    const element = fakeElement(rect);
    const target = spyTarget();
    attachPointer(element, target);
    fire(element, "pointermove", { clientX: 50, clientY: 50 });
    expect(target.setMouse).toHaveBeenLastCalledWith(0.5, 0.5);
    Object.assign(rect, { left: 50, width: 200 });
    fire(element, "pointermove", { clientX: 50, clientY: 50 });
    expect(target.setMouse).toHaveBeenLastCalledWith(0, 0.5);
  });

  it("treats enter and press as position too, so touch and pen start where they land", () => {
    const element = fakeElement();
    const target = spyTarget();
    attachPointer(element, target);
    fire(element, "pointerenter", { clientX: 60, clientY: 70 });
    expect(target.setMouse).toHaveBeenLastCalledWith(0.25, 0.5);
    fire(element, "pointerdown", { clientX: 110, clientY: 70 });
    expect(target.setMouse).toHaveBeenLastCalledWith(0.5, 0.5);
    expect(target.setMouse).toHaveBeenCalledTimes(2);
  });

  it("marks the pointer inactive on leave and cancel", () => {
    const element = fakeElement();
    const target = spyTarget();
    attachPointer(element, target);
    fire(element, "pointerleave");
    expect(target.setPointerActive).toHaveBeenLastCalledWith(false);
    fire(element, "pointercancel");
    expect(target.setPointerActive).toHaveBeenCalledTimes(2);
    expect(target.setPointerActive).not.toHaveBeenCalledWith(true);
  });

  it("marks the pointer inactive when the window loses focus", () => {
    const element = fakeElement();
    const view = new EventTarget();
    (element as { ownerDocument: unknown }).ownerDocument = { defaultView: view };
    const target = spyTarget();
    const detach = attachPointer(element, target);
    fire(view, "blur");
    expect(target.setPointerActive).toHaveBeenCalledWith(false);
    detach();
    fire(view, "blur");
    expect(target.setPointerActive).toHaveBeenCalledTimes(1);
  });

  it("starts a ripple on click only when asked to", () => {
    const element = fakeElement();
    const without = spyTarget();
    attachPointer(element, without);
    fire(element, "click", { clientX: 110, clientY: 45 });
    expect(without.triggerRipple).not.toHaveBeenCalled();

    const target = spyTarget();
    attachPointer(element, target, { ripple: true });
    fire(element, "click", { clientX: 110, clientY: 45 });
    expect(target.triggerRipple).toHaveBeenCalledWith(0.5, 0.75);
  });

  it("listens passively and removes everything when disposed", () => {
    const element = fakeElement();
    const add = vi.spyOn(element, "addEventListener");
    const target = spyTarget();
    const detach = attachPointer(element, target, { ripple: true });

    expect(add.mock.calls.map(([type]) => type).sort()).toEqual(
      ["click", "pointercancel", "pointerdown", "pointerenter", "pointerleave", "pointermove"],
    );
    for (const [, , options] of add.mock.calls) expect(options).toMatchObject({ passive: true });

    detach();
    for (const type of ["pointermove", "pointerenter", "pointerdown", "pointerleave", "pointercancel", "click"]) {
      fire(element, type, { clientX: 50, clientY: 50 });
    }
    expect(target.setMouse).not.toHaveBeenCalled();
    expect(target.setPointerActive).not.toHaveBeenCalled();
    expect(target.triggerRipple).not.toHaveBeenCalled();
  });

  it("ignores an element with no size", () => {
    const element = fakeElement({ left: 0, top: 0, width: 0, height: 0 });
    const target = spyTarget();
    attachPointer(element, target, { ripple: true });
    fire(element, "pointermove", { clientX: 5, clientY: 5 });
    fire(element, "click", { clientX: 5, clientY: 5 });
    expect(target.setMouse).not.toHaveBeenCalled();
    expect(target.triggerRipple).not.toHaveBeenCalled();
  });
});
