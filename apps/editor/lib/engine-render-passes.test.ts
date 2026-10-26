import { describe, expect, it } from "vitest";
import { GRADIENT_TYPE_IDS, GradientEngine, bakePalette, createLayer, effectiveBlend, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import { createFakeGL, type FakeGLOptions } from "./test-utils/fake-webgl";

function stateWith(overrides: Partial<EngineState>, layerCount = 1): EngineState {
  const base = resolveConfig({ layers: [{ type: "lightWall", colors: [[1, 0, 0], [0, 0, 1]] }] });
  const layers = Array.from({ length: layerCount }, (_, i) =>
    createLayer({ gradientType: "lightWall", blendMode: i === 0 ? "normal" : "screen" }),
  );
  return { ...base, layers, ...overrides };
}

function setup(options: FakeGLOptions = {}) {
  const fake = createFakeGL(options);
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

describe("GradientEngine render passes", () => {
  it("draws even a plain single layer as a layer pass plus a post pass", () => {
    const { engine, draws, programOf } = setup();
    engine.render(stateWith({ vignette: 0.4 }));

    expect(draws).toHaveLength(2);
    const [layerPass, postPass] = draws;

    // Layer pass: the gradient into a composite FBO, no global effects.
    expect(layerPass.target).not.toBeNull();
    expect(programOf(layerPass)?.gradientId).toBe(GRADIENT_TYPE_IDS.lightWall);
    expect(layerPass.uniforms.u_vignette).toBeUndefined();

    // Post pass: global effects on the composited scene, straight to the canvas.
    expect(postPass.target).toBeNull();
    expect(programOf(postPass)?.gradientId).toBeNull();
    expect(postPass.uniforms.u_vignette).toBe(0.4);
  });

  it("post pass reads the composited scene from unit 6 and applies effects", () => {
    const { engine, draws, feedbackLoops } = setup();
    engine.render(stateWith({ bloomEnabled: true, toneMapMode: 2, brightness: 1.3 }));

    expect(draws).toHaveLength(2);
    const [layerPass, postPass] = draws;

    expect(layerPass.uniforms.u_bloomEnabled).toBeUndefined();
    expect(layerPass.uniforms.u_toneMapMode).toBeUndefined();
    expect(layerPass.uniforms.u_layerOpacity).toBe(1);

    expect(postPass.uniforms.u_bloomEnabled).toBe(1);
    expect(postPass.uniforms.u_toneMapMode).toBe(2);
    expect(postPass.uniforms.u_brightness).toBe(1.3);
    expect(postPass.uniforms.u_sceneTexture).toBe(6);
    expect(postPass.boundTextures.get(6)).toBeTruthy();
    // Per-layer inputs belong to the layer pass only.
    expect(postPass.uniforms.u_maskEnabled).toBeUndefined();
    expect(postPass.uniforms.u_layerOpacity).toBeUndefined();
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
      expect(pass.uniforms.u_vignette).toBeUndefined();
      expect(pass.uniforms.u_grain).toBeUndefined();
    }
    expect(layerPasses[0].uniforms.u_compositeEnabled).toBe(0);
    expect(layerPasses[1].uniforms.u_compositeEnabled).toBe(1);
    expect(layerPasses[2].uniforms.u_compositeEnabled).toBe(1);

    expect(post.target).toBeNull();
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

  it("each layer composites over the texture the previous one wrote", () => {
    const { engine, draws, attachments } = setup();
    engine.render(stateWith({}, 3));
    expect(draws[0].boundTextures.get(5)).toBeNull();
    expect(draws[1].boundTextures.get(5)).toBe(attachments.get(draws[0].target!));
    expect(draws[2].boundTextures.get(5)).toBe(attachments.get(draws[1].target!));
  });

  it("post pass takes its palette and clock from the last visible layer", () => {
    const { engine, draws, uploads } = setup();
    const first = createLayer({ gradientType: "lightWall", speed: 0.3, colors: [[1, 0, 0], [0, 1, 0]] });
    const last = createLayer({
      gradientType: "plasmaOrb",
      blendMode: "screen",
      speed: 0.9,
      softness: 0.4,
      colors: [[0, 0, 1], [1, 1, 0], [0, 1, 1]],
    });
    const hidden = createLayer({ gradientType: "image", visible: false, colors: [[1, 1, 1], [0, 0, 0]] });
    engine.render(stateWith({ reactionDiffEnabled: true, layers: [first, last, hidden] }));

    const post = draws[draws.length - 1];
    expect(post.uniforms.u_speed).toBe(0.9);

    // The palette texture is the one baked from the last visible layer's colours...
    const palette = post.boundTextures.get(7);
    const baked = uploads.find((u) => u.texture === palette);
    const blend = effectiveBlend(0, last.softness);
    expect(baked?.data).toEqual(Array.from(bakePalette(last.colors, true, blend)));
    // ...which is the texture the last layer's own draw used, with the same domain.
    expect(draws[1].boundTextures.get(7)).toBe(palette);
    expect(post.uniforms.u_paletteDomain).toEqual(draws[1].uniforms.u_paletteDomain);
    expect(draws[0].boundTextures.get(7)).not.toBe(palette);
  });

  it("never samples a texture it is rendering into, across frames", () => {
    for (const layerCount of [1, 2, 3, 4]) {
      const { engine, feedbackLoops } = setup();
      const state = stateWith(
        { bloomEnabled: true, feedbackEnabled: true, trailEnabled: true, realBloomEnabled: true },
        layerCount,
      );
      engine.render(state);
      engine.render(state);
      engine.render(stateWith({}, layerCount));
      engine.render(state);
      expect(feedbackLoops).toEqual([]);
    }
  });

  it("feeds the previous frame to the post pass under feedback, alternating targets", () => {
    const { engine, draws, attachments } = setup();
    const state = stateWith({ feedbackEnabled: true });
    engine.render(state);
    engine.render(state);

    const [, post1, , post2] = draws;
    expect(post1.target).not.toBeNull();
    expect(post2.target).not.toBeNull();
    expect(post2.target).not.toBe(post1.target);
    // Each frame reads what the other one wrote.
    expect(post1.boundTextures.get(0)).toBe(attachments.get(post2.target!));
    expect(post2.boundTextures.get(0)).toBe(attachments.get(post1.target!));
  });

  it("binds the trail texture for the post pass", () => {
    const { engine, draws } = setup();
    engine.render(stateWith({ trailEnabled: true }));
    const post = draws[draws.length - 1];
    expect(post.uniforms.u_trailEnabled).toBe(1);
    expect(post.boundTextures.get(4)).toBeTruthy();
  });

  it("builds the cinematic bloom pyramid between the layer passes and the post pass, which adds it", () => {
    const { engine, draws, attachments, feedbackLoops } = setup();
    engine.render(stateWith({ feedbackEnabled: true, realBloomEnabled: true }));
    // Layer pass, the pyramid (a 16x8 canvas has levels of 8x4 and 4x2: two passes down, one up), post pass.
    expect(draws.map((d) => d.viewport.slice(2))).toEqual([[16, 8], [8, 4], [4, 2], [8, 4], [16, 8]]);
    const [layer, down0, down1, up, post] = draws;
    // The first pass down reads the composited scene and keeps only its light; the next passes it all on.
    expect(down0.boundTextures.get(0)).toBe(attachments.get(layer.target!));
    expect(down0.uniforms.u_threshold).toBeGreaterThan(0);
    expect(down1.boundTextures.get(0)).toBe(attachments.get(down0.target!));
    expect(down1.uniforms.u_threshold).toBe(0);
    // Back up: the narrower level, blurred into the wider one.
    expect(up.target).toBe(down0.target);
    expect(up.boundTextures.get(0)).toBe(attachments.get(down1.target!));
    // The post pass (into the feedback target) adds the top level, from unit 8.
    expect(post.target).not.toBeNull();
    expect(post.uniforms.u_realBloomEnabled).toBe(1);
    expect(post.uniforms.u_realBloomGain).toBeGreaterThan(0);
    expect(post.uniforms.u_bloomTexture).toBe(8);
    expect(post.boundTextures.get(8)).toBe(attachments.get(down0.target!));
    expect(feedbackLoops).toEqual([]);
  });

  it("leaves cinematic bloom out when it is off, and frees the pyramid", () => {
    const { engine, draws, deletedTextures, attachments } = setup();
    engine.render(stateWith({ realBloomEnabled: true }));
    const top = attachments.get(draws[1].target!);
    const start = draws.length;
    engine.render(stateWith({ realBloomEnabled: false }));
    expect(draws.length - start).toBe(2);
    expect(draws[draws.length - 1].uniforms.u_realBloomEnabled).toBe(0);
    expect(deletedTextures).toContain(top);
  });

  it("clears the target when no layer is visible, without compiling anything", () => {
    const { engine, draws, programs } = setup();
    const programsAtStart = programs.length;
    const hidden = createLayer({ gradientType: "horizonGlow", visible: false });
    expect(engine.render(stateWith({ layers: [hidden] }))).toBe(true);
    expect(draws).toHaveLength(0);
    expect(programs.length).toBe(programsAtStart);
  });

  // The canvas of the fake GL is 16×8; the palette tables are half-float whatever the targets are.
  // Skips targets that were created and deleted (the half-float attempt that fell back).
  const compositeFormats = (fake: ReturnType<typeof setup>) =>
    [...fake.textureFormats]
      .filter(([texture]) => fake.textureSizes.get(texture)?.width === 16 && !fake.deletedTextures.includes(texture))
      .map(([, format]) => format);

  it("renders the composite targets as half-float when the GPU can", () => {
    const fake = setup({ floatTargets: true });
    fake.engine.render(stateWith({}));
    expect(compositeFormats(fake)).toEqual(["RGBA16F", "RGBA16F"]);
    expect(fake.engine.getMetrics().estimatedBytes).toBe(16 * 8 * 8 * 2);
  });

  it("falls back to 8-bit composite targets if half-float framebuffers are incomplete", () => {
    const fake = setup({ floatTargets: true });
    fake.controls.rejectFloatTargets = true;
    expect(fake.engine.render(stateWith({}))).toBe(true);
    expect(fake.draws).toHaveLength(2);
    expect(compositeFormats(fake)).toEqual(["RGBA", "RGBA"]);
    expect(fake.engine.getMetrics().estimatedBytes).toBe(16 * 8 * 4 * 2);
  });

  it("uses 8-bit composite targets without float render support", () => {
    const fake = setup();
    fake.engine.render(stateWith({}));
    expect(compositeFormats(fake)).toEqual(["RGBA", "RGBA"]);
  });
});
