import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import { createFakeGL } from "./test-utils/fake-webgl";

function state(overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "lightWall", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers: [createLayer({ gradientType: "lightWall" })], ...overrides };
}

function setup() {
  const fake = createFakeGL(); // canvas is 16×8
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

describe("GradientEngine.resize", () => {
  beforeEach(() => {
    // resize() reads the device pixel ratio from window, which Node lacks.
    vi.stubGlobal("window", { devicePixelRatio: 1 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the last state again at once when the canvas changes size", () => {
    const { engine, canvas, draws } = setup();
    engine.setElapsedTime(5);
    engine.render(state());
    const before = draws.length;

    engine.resize(32, 20);
    expect([canvas.width, canvas.height]).toEqual([32, 20]);
    // Setting the size cleared the canvas, so it is drawn again, at the new size and the same time.
    expect(draws.length).toBeGreaterThan(before);
    const redraw = draws[draws.length - 1];
    expect(redraw.target).toBeNull();
    expect(redraw.uniforms.u_resolution).toEqual([32, 20]);
    expect(redraw.uniforms.u_time).toBe(5);
    expect(engine.getElapsedTime()).toBe(5);
  });

  it("draws nothing when the size is unchanged", () => {
    const { engine, draws } = setup();
    engine.render(state());
    const before = draws.length;
    engine.resize(16, 8);
    expect(draws.length).toBe(before);
  });

  it("only sizes the canvas before the first frame", () => {
    const { engine, canvas, draws } = setup();
    engine.resize(32, 20);
    expect([canvas.width, canvas.height]).toEqual([32, 20]);
    expect(draws).toHaveLength(0);
  });
});
