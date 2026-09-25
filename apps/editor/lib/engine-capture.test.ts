import { beforeAll, describe, expect, it } from "vitest";
import { GradientEngine, createLayer, fitSize, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import { pngExportSize } from "./export";
import { applyTimeline } from "./frame-state";
import { createFakeGL } from "./test-utils/fake-webgl";
import { useGradientStore } from "./store";

beforeAll(() => {
  // Node has no ImageData; the engine only needs the constructor.
  if (typeof ImageData === "undefined") {
    (globalThis as Record<string, unknown>).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  }
});

function state(overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers: [createLayer({ gradientType: "mesh" })], ...overrides };
}

function setup() {
  const fake = createFakeGL(); // canvas is 16×8
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

describe("GradientEngine.captureImageData", () => {
  it("returns null before anything has rendered", () => {
    const { engine } = setup();
    expect(engine.captureImageData()).toBeNull();
  });

  it("renders at the requested time and restores the live clock", () => {
    const { engine, draws } = setup();
    engine.setElapsedTime(5);
    engine.render(state());

    const frame = engine.captureImageData({ time: 12.5 });
    expect(frame?.width).toBe(16);
    expect(frame?.height).toBe(8);
    expect(draws[draws.length - 1].uniforms.u_time).toBe(12.5);
    expect(engine.getElapsedTime()).toBe(5);
  });

  it("renders an explicit state without replacing the live one", () => {
    const { engine, draws } = setup();
    const live = state({ vignette: 0.1 });
    engine.render(live);

    engine.captureImageData({ state: state({ vignette: 0.9 }) });
    expect(draws[draws.length - 1].uniforms.u_vignette).toBe(0.9);

    // A default capture afterwards still uses the live state.
    engine.captureImageData();
    expect(draws[draws.length - 1].uniforms.u_vignette).toBe(0.1);
  });

  it("captures at a larger size, then restores the canvas and redraws it", () => {
    const { engine, canvas, draws } = setup();
    engine.render(state());
    const before = draws.length;

    const frame = engine.captureImageData({ width: 64, height: 32 });
    expect(frame?.width).toBe(64);
    expect(frame?.height).toBe(32);
    expect(frame?.data.length).toBe(64 * 32 * 4);
    expect(draws[before].uniforms.u_resolution).toEqual([64, 32]);

    expect(canvas.width).toBe(16);
    expect(canvas.height).toBe(8);
    // Resizing cleared the visible canvas, so it is drawn again at live size.
    const redraw = draws[draws.length - 1];
    expect(redraw.target).toBeNull();
    expect(redraw.uniforms.u_resolution).toEqual([16, 8]);
  });

  it("scales oversized captures down to the GPU limit, keeping aspect", () => {
    const { engine } = setup(); // fake GPU limit: 4096
    engine.render(state());
    const frame = engine.captureImageData({ width: 16 * 1000, height: 8 * 1000 });
    expect(frame?.width).toBe(4096);
    expect(frame?.height).toBe(2048);
  });
});

describe("export sizing", () => {
  it("fitSize keeps aspect and never goes below 1px", () => {
    expect(fitSize(1920, 1080, 4096)).toEqual({ width: 1920, height: 1080 });
    expect(fitSize(7680, 4320, 4096)).toEqual({ width: 4096, height: 2304 });
    expect(fitSize(10000, 1, 4096)).toEqual({ width: 4096, height: 1 });
  });

  it("pngExportSize multiplies the canvas size by the scale", () => {
    expect(pngExportSize({ width: 1200, height: 800 }, 2, 16384)).toEqual({ width: 2400, height: 1600 });
    expect(pngExportSize({ width: 1200, height: 800 }, 4, 4096)).toEqual({ width: 4096, height: 2730 });
  });
});

describe("applyTimeline", () => {
  it("interpolates keyframes at the given time and is a no-op without a timeline", () => {
    const base = useGradientStore.getState();
    expect(applyTimeline(base, 1)).toBe(base);

    const withTimeline = {
      ...base,
      timelineEnabled: true,
      timelineDuration: 10,
      timelinePlaybackMode: "once" as const,
      keyframes: [
        { time: 0, params: { speed: 0 } },
        { time: 10, params: { speed: 1 } },
      ],
    };
    expect(applyTimeline(withTimeline, 5).speed).toBeCloseTo(0.5);
  });
});
