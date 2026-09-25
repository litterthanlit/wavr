import { describe, expect, it } from "vitest";
import { GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState, LayerParams } from "@wavr/core";
import { createFakeGL } from "./test-utils/fake-webgl";

function stateWith(layers: LayerParams[], overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers, ...overrides };
}

function setup() {
  const fake = createFakeGL();
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

const red = createLayer({ gradientType: "mesh", speed: 0.2, scale: 1, colors: [[1, 0, 0], [0.5, 0, 0]] });
const blue = createLayer({
  gradientType: "plasma",
  speed: 0.7,
  scale: 2,
  blendMode: "screen",
  colors: [[0, 0, 1], [0, 0, 0.5], [0.2, 0.2, 1]],
});

describe("GradientEngine uniform uploads", () => {
  it("skips uniforms that did not change since the last frame", () => {
    const { engine, uniformCalls } = setup();
    const state = stateWith([red]);

    engine.render(state);
    const firstFrame = uniformCalls.length;
    uniformCalls.length = 0;

    engine.render(state);
    // Same state, same elapsed time: nothing needs re-uploading.
    expect(uniformCalls).toEqual([]);
    expect(firstFrame).toBeGreaterThan(80);
  });

  it("uploads only what changed", () => {
    const { engine, uniformCalls } = setup();
    engine.render(stateWith([red], { vignette: 0 }));
    uniformCalls.length = 0;

    engine.render(stateWith([red], { vignette: 0.6 }));
    expect(uniformCalls).toEqual(["u_vignette"]);
  });

  it("keeps per-layer values correct at every draw in multi-layer scenes", () => {
    const { engine, draws } = setup();
    const scenes = [
      stateWith([red, blue]),
      stateWith([red, blue]),
      stateWith([blue, red]),
      stateWith([red]),
      stateWith([red, blue], { bloomEnabled: true }),
    ];

    for (const state of scenes) {
      const start = draws.length;
      engine.render(state);
      const layerDraws = draws.slice(start, start + state.layers.length);
      layerDraws.forEach((draw, i) => {
        const layer = state.layers[i];
        expect(draw.uniforms.u_speed).toBeCloseTo(layer.speed);
        expect(draw.uniforms.u_scale).toBe(layer.scale);
        expect(draw.uniforms.u_colorCount).toBe(layer.colors.length);
        layer.colors.forEach((color, c) => {
          expect(draw.uniforms[`u_colors[${c}]`]).toEqual(color);
        });
      });
    }
  });

  it("re-uploads everything after the program is replaced", () => {
    const { engine, draws, uniformCalls } = setup();
    const state = stateWith([red], { vignette: 0.3 });
    engine.render(state);

    const result = engine.setCustomShader("vec3 customGradient(vec2 uv, float time) { return vec3(uv, 0.0); }");
    expect(result.success).toBe(true);
    uniformCalls.length = 0;

    engine.render(state);
    // A fresh program starts with default uniform values, so the cache must
    // not skip anything that was uploaded to the old program.
    expect(uniformCalls).toContain("u_vignette");
    expect(uniformCalls).toContain("u_colors[0]");
    const last = draws[draws.length - 1];
    expect(last.uniforms.u_vignette).toBe(0.3);
    expect(last.uniforms["u_colors[1]"]).toEqual(red.colors[1]);
  });
});
