import { describe, expect, it } from "vitest";
import { GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import { createFakeGL } from "./test-utils/fake-webgl";

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
