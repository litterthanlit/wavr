import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  FULL_RESOLUTION_GRADIENTS,
  GRADIENT_TYPES,
  GradientEngine,
  TEXT_MASK_MIN_SCALE,
  createLayer,
  resolveConfig,
} from "@wavr/core";
import type { EngineState, LayerParams } from "@wavr/core";
import { createFakeGL, type FakeGLOptions } from "./test-utils/fake-webgl";

beforeAll(() => {
  // Node has no ImageData or Image; the engine only needs the constructors.
  if (typeof ImageData === "undefined") {
    (globalThis as Record<string, unknown>).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  }
  if (typeof Image === "undefined") {
    (globalThis as Record<string, unknown>).Image = class {
      onload: (() => void) | null = null;
      set src(_value: string) {}
    };
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stateWith(layers: LayerParams[], overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers, ...overrides };
}

const meshLayer = (extra: Partial<LayerParams> = {}) => createLayer({ gradientType: "mesh", ...extra });
const plasmaLayer = (extra: Partial<LayerParams> = {}) =>
  createLayer({ gradientType: "plasma", blendMode: "screen", ...extra });

function setup(size: [number, number] = [100, 50], options: FakeGLOptions = {}) {
  const fake = createFakeGL(options);
  fake.canvas.width = size[0];
  fake.canvas.height = size[1];
  const engine = new GradientEngine(fake.canvas, {});
  /** Draws of one frame: the layer passes, then the post pass. */
  const frame = (state: EngineState) => {
    const start = fake.draws.length;
    engine.render(state);
    return fake.draws.slice(start);
  };
  /** Live textures of this size (created and not deleted). */
  const texturesOfSize = (width: number, height: number) =>
    [...fake.textureSizes]
      .filter(([texture, s]) => s.width === width && s.height === height && !fake.deletedTextures.includes(texture))
      .map(([texture]) => texture);
  return { engine, frame, texturesOfSize, ...fake };
}

describe("render scale", () => {
  it("draws everything at full size by default", () => {
    const { engine, frame } = setup();
    expect(engine.getRenderScale()).toBe(1);
    const [layer, post] = frame(stateWith([meshLayer()]));
    expect(layer.viewport).toEqual([0, 0, 100, 50]);
    expect(layer.uniforms.u_resolution).toEqual([100, 50]);
    expect(layer.uniforms.u_compositeScale).toEqual([1, 1]);
    expect(post.viewport).toEqual([0, 0, 100, 50]);
    expect(post.uniforms.u_resolution).toEqual([100, 50]);
    expect(post.uniforms.u_compositeScale).toEqual([1, 1]);
    expect(engine.getMetrics().renderScale).toBe(1);
  });

  it("draws the layers into a corner of the composite targets and the post pass at full size", () => {
    const { engine, frame } = setup();
    engine.setRenderScale(0.5);
    const draws = frame(stateWith([meshLayer(), plasmaLayer(), meshLayer({ blendMode: "overlay" })]));
    expect(draws).toHaveLength(4);

    for (const layer of draws.slice(0, 3)) {
      expect(layer.target).not.toBeNull();
      expect(layer.viewport).toEqual([0, 0, 50, 25]);
      // Layer programs see the size they are drawing at, so anything in pixels stays consistent.
      expect(layer.uniforms.u_resolution).toEqual([50, 25]);
      expect(layer.uniforms.u_compositeScale).toEqual([0.5, 0.5]);
    }
    const post = draws[3];
    expect(post.target).toBeNull();
    expect(post.viewport).toEqual([0, 0, 100, 50]);
    // Effects measured in pixels (grain, dither, ASCII, blur, pixel sort, deband) get the canvas.
    expect(post.uniforms.u_resolution).toEqual([100, 50]);
    expect(post.uniforms.u_compositeScale).toEqual([0.5, 0.5]);
    expect(engine.getMetrics().renderScale).toBe(0.5);
  });

  it("keeps the composite targets at canvas size, so a change of scale never reallocates them", () => {
    const { engine, frame, texturesOfSize, deletedTextures } = setup();
    const state = stateWith([meshLayer(), plasmaLayer()]);
    frame(state);
    const targets = texturesOfSize(100, 50);
    expect(targets).toHaveLength(2);
    const deletedBefore = deletedTextures.length;

    for (const scale of [0.5, 0.7, 0.6, 1, 0.85, 0.5, 1]) {
      engine.setRenderScale(scale);
      const [first] = frame(state);
      expect(first.viewport[2]).toBe(Math.round(100 * scale));
    }
    expect(texturesOfSize(100, 50)).toEqual(targets);
    expect(deletedTextures.length).toBe(deletedBefore);
  });

  it("rounds the drawn size to whole pixels, at least 1", () => {
    const { engine, frame } = setup([101, 51]);
    engine.setRenderScale(0.6);
    const [layer] = frame(stateWith([meshLayer()]));
    expect(layer.viewport).toEqual([0, 0, 61, 31]); // round(60.6), round(30.6)
    expect(layer.uniforms.u_compositeScale).toEqual([61 / 101, 31 / 51]);

    const tiny = setup([3, 2]);
    tiny.engine.setRenderScale(0.25);
    const [tinyLayer] = tiny.frame(stateWith([meshLayer()]));
    expect(tinyLayer.viewport).toEqual([0, 0, 1, 1]);
  });

  it("clamps what it is given to 0.25..1", () => {
    const { engine } = setup();
    engine.setRenderScale(0.1);
    expect(engine.getRenderScale()).toBe(0.25);
    engine.setRenderScale(3);
    expect(engine.getRenderScale()).toBe(1);
    engine.setRenderScale(Number.NaN);
    expect(engine.getRenderScale()).toBe(1);
    engine.setRenderScale(0.6);
    expect(engine.getRenderScale()).toBe(0.6);
  });

  it("changes nothing else in the frame: same targets, textures and palette bindings", () => {
    const full = setup();
    const scaled = setup();
    scaled.engine.setRenderScale(0.6);
    const state = stateWith([meshLayer(), plasmaLayer()], { vignette: 0.3 });
    const a = full.frame(state);
    const b = scaled.frame(state);
    expect(b).toHaveLength(a.length);
    expect(scaled.feedbackLoops).toEqual([]);
    a.forEach((draw, i) => {
      expect(b[i].target === null).toBe(draw.target === null);
      expect([...b[i].boundTextures.keys()].sort()).toEqual([...draw.boundTextures.keys()].sort());
    });
  });

  describe("layers that keep full resolution", () => {
    const FULL = [0, 0, 100, 50];

    it.each([...FULL_RESOLUTION_GRADIENTS])("%s, which depends on screen pixels or image detail", (type) => {
      const { engine, frame } = setup();
      engine.setRenderScale(0.5);
      const [layer, post] = frame(stateWith([createLayer({ gradientType: type })]));
      expect(layer.viewport).toEqual(FULL);
      expect(layer.uniforms.u_compositeScale).toEqual([1, 1]);
      expect(post.uniforms.u_compositeScale).toEqual([1, 1]);
      expect(engine.getMetrics().renderScale).toBe(1);
    });

    it("every other gradient type is scaled", () => {
      for (const type of GRADIENT_TYPES) {
        if (FULL_RESOLUTION_GRADIENTS.has(type)) continue;
        const { engine, frame } = setup();
        engine.setRenderScale(0.5);
        const [layer] = frame(stateWith([createLayer({ gradientType: type })]));
        expect(layer.viewport, type).toEqual([0, 0, 50, 25]);
      }
    });

    it("a scene is full resolution as soon as one visible layer needs it", () => {
      const { engine, frame } = setup();
      engine.setRenderScale(0.5);
      const state = stateWith([meshLayer(), createLayer({ gradientType: "dither", blendMode: "screen" }), plasmaLayer()]);
      const draws = frame(state);
      for (const layer of draws.slice(0, 3)) expect(layer.viewport).toEqual(FULL);

      // Hidden, it no longer counts.
      const hidden = frame(stateWith([meshLayer(), createLayer({ gradientType: "dither", visible: false })]));
      expect(hidden[0].viewport).toEqual([0, 0, 50, 25]);
    });

    it("a layer with an uploaded picture, whatever its gradient", () => {
      const { engine, frame } = setup();
      engine.setRenderScale(0.5);
      const [layer] = frame(stateWith([meshLayer({ imageData: "data:image/png;base64,AAAA" })]));
      expect(layer.viewport).toEqual(FULL);
    });

    it("Custom GLSL, whose code may use gl_FragCoord", () => {
      const { engine, frame } = setup();
      engine.setRenderScale(0.5);
      expect(engine.setCustomShader("return vec3(gl_FragCoord.xy / u_resolution, 0.0);").success).toBe(true);
      const [layer] = frame(stateWith([meshLayer()]));
      expect(layer.viewport).toEqual(FULL);

      engine.setCustomShader(null);
      const [back] = frame(stateWith([meshLayer()]));
      expect(back.viewport).toEqual([0, 0, 50, 25]);
    });
  });

  it("keeps the scale at 0.8 or above while a text mask is on, and leaves a higher setting alone", () => {
    expect(TEXT_MASK_MIN_SCALE).toBe(0.8);
    const { engine, frame } = setup();
    const masked = stateWith([meshLayer({ textMaskEnabled: true, textMaskContent: "WAVR" })]);

    engine.setRenderScale(0.5);
    expect(frame(masked)[0].viewport).toEqual([0, 0, 80, 40]);
    engine.setRenderScale(0.6);
    expect(frame(masked)[0].viewport).toEqual([0, 0, 80, 40]);
    engine.setRenderScale(0.9);
    expect(frame(masked)[0].viewport).toEqual([0, 0, 90, 45]);
    // Shape masks are not special-cased.
    engine.setRenderScale(0.5);
    expect(frame(stateWith([meshLayer({ maskEnabled: true })]))[0].viewport).toEqual([0, 0, 50, 25]);
  });

  describe("captures", () => {
    it("always draw at full resolution, whatever the live scale, and the live scale comes back after", () => {
      const { engine, frame, draws } = setup();
      const state = stateWith([meshLayer(), plasmaLayer()]);
      engine.setRenderScale(0.5);
      expect(frame(state)[0].viewport).toEqual([0, 0, 50, 25]);

      const before = draws.length;
      engine.capturePixels(state);
      for (const draw of draws.slice(before)) expect(draw.viewport).toEqual([0, 0, 100, 50]);
      expect(draws.slice(before, before + 2).map((d) => d.uniforms.u_compositeScale)).toEqual([[1, 1], [1, 1]]);
      expect(engine.getRenderScale()).toBe(0.5);

      expect(frame(state)[0].viewport).toEqual([0, 0, 50, 25]);
    });

    it("captureImageData too, at the live size and at another size", () => {
      const { engine, frame, draws } = setup();
      const state = stateWith([meshLayer()]);
      engine.setRenderScale(0.5);
      frame(state);

      let start = draws.length;
      engine.captureImageData({ state });
      expect(draws[start].viewport).toEqual([0, 0, 100, 50]);

      start = draws.length;
      engine.captureImageData({ state, width: 400, height: 200 });
      expect(draws[start].viewport).toEqual([0, 0, 400, 200]);
      expect(draws[start].uniforms.u_resolution).toEqual([400, 200]);
      // Restored: the live canvas is redrawn at its own size and the live scale.
      const redraw = draws.slice(start).filter((d) => d.target === null).pop()!;
      expect(redraw.viewport).toEqual([0, 0, 100, 50]);
      const redrawLayer = draws[draws.indexOf(redraw) - 1];
      expect(redrawLayer.viewport).toEqual([0, 0, 50, 25]);
    });

    it("can be asked for a lower scale, to see the live view at it", () => {
      const { engine, frame, draws } = setup();
      const state = stateWith([meshLayer()]);
      frame(state);

      let start = draws.length;
      engine.captureImageData({ state, renderScale: 0.6 });
      expect(draws[start].viewport).toEqual([0, 0, 60, 30]);
      expect(draws[start].uniforms.u_compositeScale).toEqual([0.6, 0.6]);
      expect(draws[start + 1].viewport).toEqual([0, 0, 100, 50]);
      expect(engine.getRenderScale()).toBe(1);

      // The same rules as live: a layer that needs full resolution gets it.
      start = draws.length;
      engine.captureImageData({ state: stateWith([createLayer({ gradientType: "glitch" })]), renderScale: 0.6 });
      expect(draws[start].viewport).toEqual([0, 0, 100, 50]);

      // And the next default capture is full again.
      start = draws.length;
      engine.captureImageData({ state });
      expect(draws[start].viewport).toEqual([0, 0, 100, 50]);
    });

    it("restore the scale even when the capture fails", () => {
      const { engine, frame, controls, draws } = setup();
      const state = stateWith([meshLayer()]);
      engine.setRenderScale(0.5);
      frame(state);
      controls.contextLost = true;
      expect(() => engine.capturePixels(state)).toThrow();
      controls.contextLost = false;
      const start = draws.length;
      engine.render(state);
      expect(draws[start].viewport).toEqual([0, 0, 50, 25]);
    });
  });

  describe("targets that follow the final output, not the layer pass", () => {
    it("feedback, trail and cinematic bloom are sized from the canvas", () => {
      const { engine, frame, texturesOfSize, draws } = setup([100, 50], { floatTargets: true });
      engine.setRenderScale(0.5);
      const state = stateWith([meshLayer(), plasmaLayer()], {
        feedbackEnabled: true,
        trailEnabled: true,
        realBloomEnabled: true,
      });
      const start = draws.length;
      engine.render(state);

      // Composite 2 + feedback 2 + bloom scene 1 at canvas size; trail 2 + bloom blur 2 at a quarter.
      expect(texturesOfSize(100, 50)).toHaveLength(2 + 2 + 1);
      expect(texturesOfSize(25, 12)).toHaveLength(2 + 2);
      expect(texturesOfSize(50, 25)).toEqual([]);

      const viewports = draws.slice(start).map((d) => d.viewport);
      // trail (2 draws at 1/4), 2 layers at the layer scale, post, then bloom: extract, blur x2 at 1/4, composite.
      expect(viewports).toEqual([
        [0, 0, 25, 12],
        [0, 0, 25, 12],
        [0, 0, 50, 25],
        [0, 0, 50, 25],
        [0, 0, 100, 50],
        [0, 0, 25, 12],
        [0, 0, 25, 12],
        [0, 0, 25, 12],
        [0, 0, 100, 50],
      ]);
      expect(frame(state)).toBeDefined();
    });

    it("the post pass reads the feedback target of the previous frame at full size, under a reduced scale", () => {
      const { engine, frame, feedbackLoops } = setup();
      engine.setRenderScale(0.6);
      const state = stateWith([meshLayer()], { feedbackEnabled: true, bloomEnabled: true });
      frame(state);
      const [, post] = frame(state);
      expect(post.viewport).toEqual([0, 0, 100, 50]);
      expect(feedbackLoops).toEqual([]);
    });
  });

  it("never binds the texture a pass draws into to a sampler, at any scale", () => {
    const { engine, feedbackLoops } = setup();
    const state = stateWith([meshLayer(), plasmaLayer(), meshLayer({ blendMode: "overlay" })], {
      bloomEnabled: true,
      feedbackEnabled: true,
      trailEnabled: true,
    });
    for (const scale of [1, 0.5, 0.8, 1]) {
      engine.setRenderScale(scale);
      engine.render(state);
      engine.render(state);
    }
    expect(feedbackLoops).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The adaptive controller driven by the engine's render loop.
// ---------------------------------------------------------------------------

describe("adaptive render scale in the render loop", () => {
  /** A loop clock: ticks are animation frames `dt` ms apart. */
  function loopHarness(options: { maxFrameRate?: number; playing?: boolean } = {}) {
    let now = 1000;
    let pending: ((timestamp: number) => void) | null = null;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      pending = callback;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      pending = null;
    });

    const h = setup();
    h.engine.setMaxFrameRate(options.maxFrameRate ?? 120);
    const state = stateWith([meshLayer(), plasmaLayer()], { playing: options.playing ?? true });
    h.engine.startLoop(() => state);

    const tick = (dt: number) => {
      now += dt;
      const callback = pending!;
      callback(now);
    };
    /** Time passing with no animation frames (the tab is hidden). */
    const advance = (ms: number) => {
      now += ms;
    };
    /** Runs `seconds` of ticks `dt(scale)` apart. */
    const run = (seconds: number, dt: (scale: number) => number) => {
      const end = now + seconds * 1000;
      while (now < end) tick(dt(h.engine.getRenderScale()));
    };
    const lastLayerViewport = () => h.draws.filter((d) => d.target !== null).pop()!.viewport;
    return { ...h, tick, advance, run, lastLayerViewport, state };
  }

  it("starts at full resolution and stays there while frames keep up", () => {
    const h = loopHarness();
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    h.run(20, () => 1000 / 60);
    expect(h.engine.getRenderScale()).toBe(1);
    expect(h.lastLayerViewport()).toEqual([0, 0, 100, 50]);
    h.engine.stopLoop();
  });

  it("drops the layer pass resolution when frames arrive late, and the draws follow", () => {
    const h = loopHarness();
    h.engine.setAdaptiveRenderScale({ minScale: 0.6, targetFps: 45 });
    h.run(10, () => 40);
    expect(h.engine.getRenderScale()).toBe(0.6);
    h.tick(40);
    expect(h.lastLayerViewport()).toEqual([0, 0, 60, 30]);
    expect(h.engine.getMetrics().renderScale).toBe(0.6);
    h.engine.stopLoop();
  });

  it("comes back to full resolution when the load goes away", () => {
    const h = loopHarness();
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    h.run(10, () => 40);
    expect(h.engine.getRenderScale()).toBe(0.6);
    h.run(30, () => 1000 / 60);
    expect(h.engine.getRenderScale()).toBe(1);
    h.tick(1000 / 60);
    expect(h.lastLayerViewport()).toEqual([0, 0, 100, 50]);
    h.engine.stopLoop();
  });

  it("times only the gap after a frame that drew: a frame cap is not a slow GPU", () => {
    // Capped to 24 fps: the loop draws every third animation frame, 16.7 ms apart.
    const h = loopHarness({ maxFrameRate: 24 });
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    h.run(30, () => 1000 / 60);
    expect(h.engine.getRenderScale()).toBe(1);
    // It did draw only some of the frames.
    const layerDraws = h.draws.filter((d) => d.target !== null).length;
    expect(layerDraws).toBeGreaterThan(0);
    expect(layerDraws).toBeLessThan(30 * 60);
    h.engine.stopLoop();
  });

  it("measures nothing while paused", () => {
    const h = loopHarness({ playing: false });
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    h.run(20, () => 80);
    expect(h.engine.getRenderScale()).toBe(1);
    h.engine.stopLoop();
  });

  it("a fixed scale ends adaptive scaling, and null returns to full", () => {
    const h = loopHarness();
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    h.engine.setRenderScale(0.7);
    h.run(10, () => 40);
    expect(h.engine.getRenderScale()).toBe(0.7);

    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    expect(h.engine.getRenderScale()).toBe(1);
    h.run(10, () => 40);
    expect(h.engine.getRenderScale()).toBe(0.6);
    h.engine.setAdaptiveRenderScale(null);
    expect(h.engine.getRenderScale()).toBe(1);
    h.run(10, () => 40);
    expect(h.engine.getRenderScale()).toBe(1);
    h.engine.stopLoop();
  });

  it("a resize or a capture restarts the measuring, so those frames do not count", () => {
    const h = loopHarness();
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    // Slow frames, but a capture lands every 400 ms: the 500 ms settle after each swallows them.
    for (let i = 0; i < 40; i++) {
      h.run(0.4, () => 40);
      h.engine.capturePixels(stateWith([meshLayer()]));
    }
    expect(h.engine.getRenderScale()).toBe(1);
    h.engine.stopLoop();
  });

  it("restarts the loop's clock when the loop is restarted (a hidden tab comes back)", () => {
    const h = loopHarness();
    h.engine.setAdaptiveRenderScale({ targetFps: 45 });
    h.run(2, () => 1000 / 60);
    h.engine.stopLoop();
    // 20 s away, then the loop starts again: that gap is not a frame.
    h.advance(20_000);
    h.engine.startLoop(() => h.state);
    h.run(10, () => 1000 / 60);
    expect(h.engine.getRenderScale()).toBe(1);
    h.engine.stopLoop();
  });
});
