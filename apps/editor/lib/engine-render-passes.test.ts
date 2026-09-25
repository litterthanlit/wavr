import { describe, expect, it } from "vitest";
import { GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";

// Records the GL calls GradientEngine.render() makes, so the pass structure
// (which framebuffer each draw targets, which uniforms it sees, which
// textures are bound) can be checked without a real WebGL context.

type Handle = { id: number; kind: string };

interface DrawRecord {
  program: Handle | null;
  target: Handle | null;
  uniforms: Record<string, number>;
  boundTextures: Map<number, Handle | null>;
}

function createFakeGL() {
  let nextId = 1;
  const make = (kind: string): Handle => ({ id: nextId++, kind });

  let activeUnit = 0;
  const units = new Map<number, Handle | null>();
  let drawFramebuffer: Handle | null = null;
  let program: Handle | null = null;
  const attachments = new Map<Handle, Handle>(); // fbo → colour texture
  const uniformsByProgram = new Map<Handle | null, Record<string, number>>();
  const draws: DrawRecord[] = [];
  const feedbackLoops: string[] = [];

  const uniformsFor = () => {
    let u = uniformsByProgram.get(program);
    if (!u) {
      u = {};
      uniformsByProgram.set(program, u);
    }
    return u;
  };

  const recordDraw = () => {
    const target = drawFramebuffer;
    const attached = target ? attachments.get(target) : undefined;
    for (const [unit, tex] of units) {
      if (attached && tex === attached) {
        feedbackLoops.push(`draw ${draws.length}: texture ${tex.id} bound to unit ${unit} while rendering into it`);
      }
    }
    draws.push({ program, target, uniforms: { ...uniformsFor() }, boundTextures: new Map(units) });
  };

  const setUniform = (loc: unknown, value: number) => {
    if (typeof loc === "string") uniformsFor()[loc] = value;
  };

  const methods: Record<string, (...args: never[]) => unknown> = {
    createTexture: () => make("texture"),
    createFramebuffer: () => make("framebuffer"),
    createProgram: () => make("program"),
    createShader: () => make("shader"),
    createBuffer: () => make("buffer"),
    createVertexArray: () => make("vao"),
    getUniformLocation: (_p: never, name: string) => name,
    getAttribLocation: () => 0,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    checkFramebufferStatus: () => "FRAMEBUFFER_COMPLETE",
    isContextLost: () => false,
    getExtension: () => null,
    getParameter: () => 4096,
    useProgram: (p: Handle) => { program = p; },
    activeTexture: (unit: string) => { activeUnit = Number(unit.replace("TEXTURE", "")); },
    bindTexture: (_t: never, tex: Handle | null) => { units.set(activeUnit, tex); },
    bindFramebuffer: (target: string, fbo: Handle | null) => {
      if (target === "FRAMEBUFFER" || target === "DRAW_FRAMEBUFFER") drawFramebuffer = fbo;
    },
    framebufferTexture2D: (_t: never, _a: never, _tt: never, tex: Handle) => {
      if (drawFramebuffer) attachments.set(drawFramebuffer, tex);
    },
    uniform1i: (loc: never, v: number) => setUniform(loc, v),
    uniform1f: (loc: never, v: number) => setUniform(loc, v),
    drawArrays: () => recordDraw(),
    drawElements: () => recordDraw(),
  };

  const canvas = { width: 16, height: 8 } as unknown as HTMLCanvasElement;
  const gl = new Proxy({ canvas } as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop in methods) return methods[prop];
      if (/^[A-Z0-9_]+$/.test(prop)) return prop; // GL enum → its own name
      return () => undefined; // every other GL call is a no-op
    },
  });
  (canvas as unknown as { getContext: () => unknown }).getContext = () => gl;

  return { canvas, draws, feedbackLoops, attachments };
}

function stateWith(overrides: Partial<EngineState>, layerCount = 1): EngineState {
  const base = resolveConfig({ layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] });
  const layers = Array.from({ length: layerCount }, (_, i) =>
    createLayer({ gradientType: "mesh", blendMode: i === 0 ? "normal" : "screen" }),
  );
  return { ...base, layers, ...overrides };
}

function setup() {
  const fake = createFakeGL();
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

describe("GradientEngine render passes", () => {
  it("draws a plain single layer in one pass with global effects", () => {
    const { engine, draws } = setup();
    engine.render(stateWith({ vignette: 0.4 }));

    expect(draws).toHaveLength(1);
    expect(draws[0].target).toBeNull();
    expect(draws[0].uniforms.u_postPass).toBe(0);
    expect(draws[0].uniforms.u_vignette).toBe(0.4);
  });

  it("composites then post-processes when a single layer uses bloom", () => {
    const { engine, draws, feedbackLoops } = setup();
    engine.render(stateWith({ bloomEnabled: true, toneMapMode: 2 }));

    expect(draws).toHaveLength(2);
    const [layerPass, postPass] = draws;

    // Layer pass: raw gradient into a composite FBO, no global effects.
    expect(layerPass.target).not.toBeNull();
    expect(layerPass.uniforms.u_postPass).toBe(0);
    expect(layerPass.uniforms.u_bloomEnabled).toBe(0);
    expect(layerPass.uniforms.u_toneMapMode).toBe(0);

    // Post pass: effects on, reading the composited scene from unit 6.
    expect(postPass.target).toBeNull();
    expect(postPass.uniforms.u_postPass).toBe(1);
    expect(postPass.uniforms.u_bloomEnabled).toBe(1);
    expect(postPass.uniforms.u_toneMapMode).toBe(2);
    expect(postPass.uniforms.u_sceneTexture).toBe(6);
    expect(postPass.uniforms.u_maskEnabled).toBe(0);
    expect(postPass.uniforms.u_layerOpacity).toBe(1);
    expect(postPass.boundTextures.get(6)).toBeTruthy();
    expect(feedbackLoops).toEqual([]);
  });

  it("applies global effects once, after compositing every layer", () => {
    const { engine, draws, feedbackLoops } = setup();
    const state = stateWith({ vignette: 0.5, grain: 0.3 }, 3);
    engine.render(state);

    expect(draws).toHaveLength(4);
    const layerPasses = draws.slice(0, 3);
    const post = draws[3];

    for (const pass of layerPasses) {
      expect(pass.target).not.toBeNull();
      expect(pass.uniforms.u_postPass).toBe(0);
      expect(pass.uniforms.u_vignette).toBe(0);
      expect(pass.uniforms.u_grain).toBe(0);
    }
    expect(layerPasses[0].uniforms.u_compositeEnabled).toBe(0);
    expect(layerPasses[1].uniforms.u_compositeEnabled).toBe(1);
    expect(layerPasses[2].uniforms.u_compositeEnabled).toBe(1);

    expect(post.target).toBeNull();
    expect(post.uniforms.u_postPass).toBe(1);
    expect(post.uniforms.u_vignette).toBe(0.5);
    expect(post.uniforms.u_grain).toBe(0.3);
    expect(feedbackLoops).toEqual([]);
  });

  it("post pass reads the texture the last layer wrote", () => {
    for (const layerCount of [1, 2, 3]) {
      const { engine, draws, attachments } = setup();
      engine.render(stateWith({ glowEnabled: true }, layerCount));
      const lastLayer = draws[layerCount - 1];
      const post = draws[layerCount];
      expect(lastLayer.target).not.toBeNull();
      expect(post.boundTextures.get(6)).toBe(attachments.get(lastLayer.target!));
    }
  });

  it("never samples a texture it is rendering into, across frames", () => {
    for (const layerCount of [2, 3, 4]) {
      const { engine, feedbackLoops } = setup();
      const state = stateWith({ bloomEnabled: true }, layerCount);
      engine.render(state);
      engine.render(state);
      engine.render(stateWith({}, layerCount));
      expect(feedbackLoops).toEqual([]);
    }
  });

  it("runs cinematic bloom even when feedback is enabled", () => {
    const { engine, draws } = setup();
    engine.render(stateWith({ feedbackEnabled: true, realBloomEnabled: true }));
    // 1 gradient draw + extract, horizontal blur, vertical blur, composite.
    expect(draws).toHaveLength(5);
  });
});
