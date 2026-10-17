import { beforeAll, describe, expect, it } from "vitest";
import { GRADIENT_TYPES, GRADIENT_TYPE_IDS, GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState, LayerParams } from "@wavr/core";
import { createFakeGL, type FakeGLOptions } from "./test-utils/fake-webgl";

beforeAll(() => {
  // Node has no ImageData; the engine only needs the constructor.
  if (typeof ImageData === "undefined") {
    (globalThis as Record<string, unknown>).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  }
});

function stateWith(layers: LayerParams[], overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers, ...overrides };
}

const layerOf = (gradientType: LayerParams["gradientType"], extra: Partial<LayerParams> = {}) =>
  createLayer({ gradientType, ...extra });

function setup(options: FakeGLOptions = {}) {
  const fake = createFakeGL(options);
  const engine = new GradientEngine(fake.canvas, {});
  const layerPrograms = () => fake.programs.filter((p) => p.gradientId !== null);
  return { engine, layerPrograms, ...fake };
}

describe("layer programs", () => {
  it("compiles one program per gradient type, with its shader id defined first", () => {
    const { engine, layerPrograms } = setup();
    for (const type of GRADIENT_TYPES) engine.render(stateWith([layerOf(type)]));

    const programs = layerPrograms();
    expect(programs).toHaveLength(GRADIENT_TYPES.length);
    for (const type of GRADIENT_TYPES) {
      const id = GRADIENT_TYPE_IDS[type];
      const program = programs.find((p) => p.gradientId === id);
      expect(program, `no program for ${type}`).toBeDefined();
      expect(program!.fragmentSource.startsWith(`#version 300 es\n#define WAVR_GRADIENT ${id}\n`)).toBe(true);
      expect(program!.custom).toBe(false);
    }
  });

  it("reuses a type's program across frames and layers", () => {
    const { engine, layerPrograms, draws, programOf } = setup();
    const state = stateWith([layerOf("mesh"), layerOf("plasma"), layerOf("mesh", { blendMode: "screen" })]);

    for (let frame = 0; frame < 3; frame++) engine.render(state);

    const programs = layerPrograms();
    expect(programs.map((p) => p.gradientId).sort()).toEqual([GRADIENT_TYPE_IDS.mesh, GRADIENT_TYPE_IDS.plasma].sort());
    for (const program of programs) expect(program.linkCalls).toBe(1);

    // Frame draws are layer, layer, layer, post. Layers 0 and 2 share a program.
    const frame = draws.slice(0, 4);
    expect(programOf(frame[0])).toBe(programOf(frame[2]));
    expect(programOf(frame[0])).not.toBe(programOf(frame[1]));
    expect(programOf(frame[3])?.gradientId).toBeNull();
    // The same program draws the same layers on later frames.
    expect(programOf(draws[4])).toBe(programOf(frame[0]));
  });

  it("links the post program once for the engine's lifetime", () => {
    const { engine, programs, draws, programOf } = setup();
    for (const type of ["mesh", "radial", "voronoi"] as const) {
      engine.render(stateWith([layerOf(type)]));
    }
    const posts = new Set(draws.filter((d) => programOf(d)?.gradientId === null).map((d) => programOf(d)));
    expect(posts.size).toBe(1);
    expect([...posts][0]!.linkCalls).toBe(1);
    expect(programs.filter((p) => p.gradientId === null)).toHaveLength(1);
  });

  it("does not compile types that only hidden layers use", () => {
    const { engine, layerPrograms } = setup();
    engine.render(stateWith([layerOf("mesh"), layerOf("glitch", { visible: false })]));
    expect(layerPrograms().map((p) => p.gradientId)).toEqual([GRADIENT_TYPE_IDS.mesh]);
  });
});

describe("custom GLSL program", () => {
  const body = "return vec3(uv, 0.5);";

  it("replaces the gradient of every layer until reverted", () => {
    const { engine, layerPrograms, draws, programOf } = setup();
    const state = stateWith([layerOf("mesh"), layerOf("plasma", { blendMode: "screen" })]);
    engine.render(state);
    const builtIn = layerPrograms().length;
    expect(builtIn).toBe(2);

    expect(engine.setCustomShader(body)).toEqual({ success: true });
    const custom = layerPrograms().find((p) => p.custom)!;
    expect(custom.fragmentSource).toContain(`vec3 customGradient(vec2 uv, float time) {\n${body}\n}`);
    expect(custom.fragmentSource.startsWith("#version 300 es\n#define WAVR_GRADIENT -1\n#define WAVR_CUSTOM\n")).toBe(true);

    const before = draws.length;
    engine.render(state);
    const frame = draws.slice(before);
    expect(programOf(frame[0])).toBe(custom);
    expect(programOf(frame[1])).toBe(custom);

    // Back to the per-type programs, which are still cached.
    expect(engine.setCustomShader(null)).toEqual({ success: true });
    expect(custom.deleted).toBe(true);
    const afterRevert = draws.length;
    engine.render(state);
    expect(layerPrograms().filter((p) => !p.custom)).toHaveLength(2);
    expect(programOf(draws[afterRevert])?.gradientId).toBe(GRADIENT_TYPE_IDS.mesh);
    expect(programOf(draws[afterRevert + 1])?.gradientId).toBe(GRADIENT_TYPE_IDS.plasma);
  });

  it("replaces the previous custom program and frees it", () => {
    const { engine, layerPrograms } = setup();
    engine.render(stateWith([layerOf("mesh")]));
    engine.setCustomShader("return vec3(1.0);");
    const first = layerPrograms().find((p) => p.custom)!;
    engine.setCustomShader("return vec3(0.0);");
    expect(first.deleted).toBe(true);
    const live = layerPrograms().filter((p) => p.custom && !p.deleted);
    expect(live).toHaveLength(1);
    expect(live[0].fragmentSource).toContain("return vec3(0.0);");
  });

  it("reports compile errors without the shader-stage prefix and keeps the old shader", () => {
    const { engine, layerPrograms, controls, draws, programOf } = setup();
    expect(engine.setCustomShader("return vec3(1.0);")).toEqual({ success: true });

    controls.failCompile = true;
    controls.infoLog = "ERROR: 0:812: 'nope' : undeclared identifier";
    const result = engine.setCustomShader("return nope;");
    expect(result).toEqual({ success: false, error: "ERROR: 0:812: 'nope' : undeclared identifier" });
    controls.failCompile = false;

    // The failed attempt is freed, and the previous custom shader still draws.
    const failed = layerPrograms().filter((p) => p.custom).at(-1)!;
    expect(failed.deleted).toBe(true);
    const before = draws.length;
    engine.render(stateWith([layerOf("mesh")]));
    expect(programOf(draws[before])?.fragmentSource).toContain("return vec3(1.0);");
  });

  it("reports link errors the same way", () => {
    const { engine, controls } = setup();
    controls.failLink = true;
    controls.infoLog = "unresolved symbol";
    expect(engine.setCustomShader("return vec3(1.0);")).toEqual({ success: false, error: "unresolved symbol" });
  });

  it("compiles synchronously even when the driver can compile in parallel", () => {
    const { engine, controls, blockingQueries } = setup({ parallelCompile: true });
    expect(controls.compileComplete).toBe(false);
    expect(engine.setCustomShader("return vec3(1.0);")).toEqual({ success: true });
    expect(blockingQueries.length).toBeGreaterThan(0);
  });
});

describe("parallel shader compilation", () => {
  it("draws nothing while programs compile, never blocking on them", () => {
    const { engine, draws, controls, blockingQueries } = setup({ parallelCompile: true });
    const state = stateWith([layerOf("mesh")]);

    for (let frame = 0; frame < 3; frame++) expect(engine.render(state)).toBe(false);
    expect(draws).toHaveLength(0);
    expect(engine.isReady(state)).toBe(false);
    expect(engine.getMetrics().pendingPrograms).toBe(2); // mesh layer + post
    // Link/compile status queries would stall the thread until the compile finishes.
    expect(blockingQueries).toEqual([]);

    controls.compileComplete = true;
    expect(engine.isReady(state)).toBe(true);
    expect(engine.render(state)).toBe(true);
    expect(draws).toHaveLength(2);
    expect(engine.getMetrics().pendingPrograms).toBe(0);
    expect(engine.getMetrics().programCount).toBe(2);
  });

  it("keeps drawing the old type's frames only once the new type has compiled", () => {
    const { engine, draws, controls, layerPrograms } = setup({ parallelCompile: true });
    controls.compileComplete = true;
    const mesh = stateWith([layerOf("mesh")]);
    expect(engine.render(mesh)).toBe(true);
    const drawn = draws.length;

    // Switching to a type that has not been compiled yet: skip frames until it is.
    controls.compileComplete = false;
    const plasma = stateWith([layerOf("plasma")]);
    expect(engine.render(plasma)).toBe(false);
    expect(draws).toHaveLength(drawn);
    expect(layerPrograms()).toHaveLength(2);
    // The finished mesh program is still fine to draw with meanwhile.
    expect(engine.render(mesh)).toBe(true);

    controls.compileComplete = true;
    expect(engine.render(plasma)).toBe(true);
    expect(draws.length).toBeGreaterThan(drawn + 2);
  });

  it("a skipped frame touches no render targets or frame state", () => {
    const { engine, controls, attachments, textureFormats, draws } = setup({ parallelCompile: true });
    const state = stateWith([layerOf("mesh")], { feedbackEnabled: true, trailEnabled: true, realBloomEnabled: true });
    expect(engine.render(state)).toBe(false);
    // No composite, feedback, trail or bloom targets were allocated or advanced.
    expect(attachments.size).toBe(0);
    expect(textureFormats.size).toBe(0);

    controls.compileComplete = true;
    expect(engine.render(state)).toBe(true);
    expect(attachments.size).toBeGreaterThan(0);
    expect(draws.length).toBeGreaterThan(0);
  });

  it("surfaces a compile failure with the info log once the compile completes", () => {
    const { engine, controls } = setup({ parallelCompile: true });
    const state = stateWith([layerOf("mesh")]);
    controls.failCompile = true;
    controls.infoLog = "ERROR: 0:7: syntax error";

    expect(engine.render(state)).toBe(false);
    controls.compileComplete = true;
    expect(() => engine.render(state)).toThrow(/ERROR: 0:7: syntax error/);
    // And keeps reporting it, rather than retrying the same source.
    expect(() => engine.render(state)).toThrow(/ERROR: 0:7: syntax error/);
    expect(() => engine.isReady(state)).toThrow(/syntax error/);
  });

  it("capturing waits for programs to finish compiling instead of skipping the frame", () => {
    const { engine, draws, blockingQueries, controls } = setup({ parallelCompile: true });
    const state = stateWith([layerOf("mesh")]);
    expect(engine.render(state)).toBe(false);
    expect(controls.compileComplete).toBe(false);

    const frame = engine.captureImageData({ state });
    expect(frame?.width).toBe(16);
    // The capture drew into its FBO even though the driver reported nothing complete.
    expect(draws).toHaveLength(2);
    expect(draws[0].target).not.toBeNull();
    expect(blockingQueries.length).toBeGreaterThan(0);
    expect(engine.isReady(state)).toBe(true);
  });

  it("capturePixels also blocks on programs a different state needs", () => {
    const { engine, draws } = setup({ parallelCompile: true });
    const pixels = engine.capturePixels(stateWith([layerOf("silk")]));
    expect(pixels).toHaveLength(16 * 8 * 4);
    expect(draws.length).toBeGreaterThan(0);
  });
});

describe("synchronous compilation without the extension", () => {
  it("compiles on first use and reports failures with the info log", () => {
    const { engine, controls, draws } = setup();
    expect(engine.isReady(stateWith([layerOf("radial")]))).toBe(true);
    expect(engine.render(stateWith([layerOf("radial")]))).toBe(true);
    expect(draws).toHaveLength(2);

    controls.failLink = true;
    controls.infoLog = "ERROR: link";
    expect(() => engine.render(stateWith([layerOf("conic")]))).toThrow(/Program link failed.*ERROR: link/);
  });

  it("throws from the constructor when the post shader does not compile", () => {
    const fake = createFakeGL();
    fake.controls.failCompile = true;
    fake.controls.infoLog = "ERROR: bad post shader";
    expect(() => new GradientEngine(fake.canvas, {})).toThrow(/bad post shader/);
  });
});

describe("context restore", () => {
  it("initProgram drops every program and rebuilds them on demand", () => {
    const { engine, programs, draws, programOf } = setup();
    const state = stateWith([layerOf("mesh"), layerOf("plasma", { blendMode: "screen" })], {
      realBloomEnabled: true,
      trailEnabled: true,
    });
    engine.render(state);
    const old = [...programs];
    expect(old.length).toBeGreaterThanOrEqual(6); // 2 layers, post, bloom x2, trail

    engine.initProgram();
    for (const program of old) expect(program.deleted).toBe(true);

    const before = draws.length;
    expect(engine.render(state)).toBe(true);
    expect(draws.length).toBeGreaterThan(before);
    for (const draw of draws.slice(before)) {
      expect(old).not.toContain(programOf(draw));
    }
  });

  it("keeps the custom shader across initProgram", () => {
    const { engine, layerPrograms, draws, programOf } = setup();
    engine.setCustomShader("return vec3(0.25);");
    engine.initProgram();
    engine.render(stateWith([layerOf("mesh")]));
    const live = layerPrograms().filter((p) => !p.deleted);
    expect(live).toHaveLength(1);
    expect(live[0].custom).toBe(true);
    expect(programOf(draws[0])).toBe(live[0]);
  });
});
