import { describe, expect, it } from "vitest";
import { GradientEngine, PALETTE_SIZE, bakePalette, createLayer, effectiveBlend, paletteDomain, resolveConfig } from "@wavr/core";
import type { EngineState, LayerParams } from "@wavr/core";
import { createFakeGL, type FakeGLOptions, type Handle } from "./test-utils/fake-webgl";

const UNIT_PALETTE = 7;

function stateWith(layers: LayerParams[], overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers, ...overrides };
}

function setup(options: FakeGLOptions = {}) {
  const fake = createFakeGL(options);
  const engine = new GradientEngine(fake.canvas, {});
  /** Palette tables are the only PALETTE_SIZE x 1 textures. */
  const paletteUploads = () => fake.uploads.filter((u) => u.width === PALETTE_SIZE && u.height === 1);
  const paletteTextures = () => new Set(paletteUploads().map((u) => u.texture as Handle));
  return { engine, paletteUploads, paletteTextures, ...fake };
}

const warm = createLayer({ gradientType: "mesh", colors: [[1, 0.3, 0], [0.9, 0.9, 0.1], [0.2, 0.1, 0.4]] });
const cool = createLayer({
  gradientType: "plasma",
  blendMode: "screen",
  softness: 0.6,
  colors: [[0, 0.2, 1], [0, 0.8, 0.8]],
});
const mist = createLayer({
  gradientType: "silk",
  blendMode: "overlay",
  colors: [[0.9, 0.9, 1], [0.3, 0.3, 0.6], [0.1, 0.1, 0.2], [1, 1, 1]],
});

const bakedFor = (layer: LayerParams, state: EngineState) =>
  Array.from(bakePalette(layer.colors, state.oklabEnabled, effectiveBlend(state.colorBlend, layer.softness)));

describe("palette textures", () => {
  it("uploads each layer's table once, however many frames follow", () => {
    const { engine, paletteUploads } = setup();
    const state = stateWith([warm, cool, mist], { vignette: 0.2 });

    engine.render(state);
    const first = paletteUploads();
    expect(first).toHaveLength(3);
    expect(first.every((u) => u.call === "texImage2D" && u.format === "RGBA16F")).toBe(true);
    expect(new Set(first.map((u) => u.texture)).size).toBe(3);

    for (let frame = 0; frame < 5; frame++) {
      engine.setElapsedTime(frame * 0.1);
      engine.render({ ...state, vignette: 0.2 + frame * 0.01, grain: frame * 0.1 });
    }
    expect(paletteUploads()).toHaveLength(3);
  });

  it("bakes what the old shader computed: the stops, Oklab switch and blend of each layer", () => {
    const { engine, paletteUploads } = setup();
    const state = stateWith([warm, cool, mist], { colorBlend: 0.25, oklabEnabled: false });
    engine.render(state);

    const uploads = paletteUploads();
    expect(uploads.map((u) => u.data)).toEqual(state.layers.map((layer) => bakedFor(layer, state)));
    // warm: the colour blend (0.25); cool: its softness (0.6 * 0.85 = 0.51) wins.
    expect(effectiveBlend(0.25, warm.softness)).toBe(0.25);
    expect(effectiveBlend(0.25, cool.softness)).toBeCloseTo(0.51);
  });

  it("binds each layer's table to the palette unit for its own draw, and the last one for post", () => {
    const { engine, draws, paletteUploads } = setup();
    const state = stateWith([warm, cool, mist]);
    engine.render(state);

    const textures = paletteUploads().map((u) => u.texture);
    const [l0, l1, l2, post] = draws;
    expect(l0.boundTextures.get(UNIT_PALETTE)).toBe(textures[0]);
    expect(l1.boundTextures.get(UNIT_PALETTE)).toBe(textures[1]);
    expect(l2.boundTextures.get(UNIT_PALETTE)).toBe(textures[2]);
    expect(post.boundTextures.get(UNIT_PALETTE)).toBe(textures[2]);

    for (const [i, layer] of state.layers.entries()) {
      const domain = paletteDomain(effectiveBlend(0, layer.softness));
      expect(draws[i].uniforms.u_paletteTexture).toBe(UNIT_PALETTE);
      expect(draws[i].uniforms.u_paletteDomain).toEqual([domain.scale, domain.bias]);
    }
    expect(post.uniforms.u_paletteTexture).toBe(UNIT_PALETTE);
    expect(post.uniforms.u_paletteDomain).toEqual(l2.uniforms.u_paletteDomain);
  });

  it("keeps the palette out of every render target, so it can stay bound while drawing", () => {
    const { engine, feedbackLoops, attachments, paletteTextures } = setup({ floatTargets: true });
    const layers = [warm, cool, mist];
    const everything = { bloomEnabled: true, feedbackEnabled: true, trailEnabled: true, realBloomEnabled: true };
    engine.render(stateWith(layers, everything));
    engine.render(stateWith(layers, everything));
    engine.capturePixels(stateWith(layers, everything));

    expect(feedbackLoops).toEqual([]);
    const attached = new Set(attachments.values());
    for (const texture of paletteTextures()) expect(attached.has(texture)).toBe(false);
  });

  it("bakes again, into the same texture, only for a layer whose palette changed", () => {
    const { engine, paletteUploads } = setup();
    const state = stateWith([warm, cool]);
    engine.render(state);
    const textures = paletteUploads().map((u) => u.texture);
    expect(paletteUploads()).toHaveLength(2);

    const recoloured = { ...cool, colors: [[1, 0, 1], [0.5, 0.5, 0], [0, 0, 0]] as LayerParams["colors"] };
    const next = stateWith([warm, recoloured]);
    engine.render(next);

    const uploads = paletteUploads();
    expect(uploads).toHaveLength(3);
    expect(uploads[2].call).toBe("texSubImage2D");
    expect(uploads[2].texture).toBe(textures[1]);
    expect(uploads[2].data).toEqual(bakedFor(recoloured, next));
  });

  it("bakes again when softness, the colour blend or Oklab change the table, and not otherwise", () => {
    const { engine, paletteUploads } = setup();
    const layer = { ...warm, softness: 0.2 }; // 0.17 effective
    engine.render(stateWith([layer]));
    expect(paletteUploads()).toHaveLength(1);

    // Opacity, speed, and a colour blend under the softness: the table is the same.
    engine.render(stateWith([{ ...layer, opacity: 0.5, speed: 2 }], { colorBlend: 0.1 }));
    expect(paletteUploads()).toHaveLength(1);

    engine.render(stateWith([{ ...layer, softness: 0.5 }]));
    expect(paletteUploads()).toHaveLength(2);

    engine.render(stateWith([{ ...layer, softness: 0.5 }], { colorBlend: 0.7 }));
    expect(paletteUploads()).toHaveLength(3);

    engine.render(stateWith([{ ...layer, softness: 0.5 }], { colorBlend: 0.7, oklabEnabled: false }));
    expect(paletteUploads()).toHaveLength(4);
    expect(paletteUploads()[3].data).toEqual(
      Array.from(bakePalette(layer.colors, false, effectiveBlend(0.7, 0.5))),
    );
  });

  it("follows layers that swap places by re-baking their slots, without new textures", () => {
    const { engine, paletteUploads, paletteTextures } = setup();
    engine.render(stateWith([warm, cool]));
    expect(paletteTextures().size).toBe(2);

    engine.render(stateWith([cool, warm]));
    expect(paletteTextures().size).toBe(2);
    const reuploads = paletteUploads().slice(2);
    expect(reuploads.map((u) => u.call)).toEqual(["texSubImage2D", "texSubImage2D"]);
    expect(reuploads.map((u) => u.data)).toEqual([bakedFor(cool, stateWith([])), bakedFor(warm, stateWith([]))]);
  });

  it("frees the tables of layers that were removed or hidden", () => {
    const { engine, deletedTextures, paletteUploads } = setup();
    engine.render(stateWith([warm, cool, mist]));
    const textures = paletteUploads().map((u) => u.texture);
    expect(deletedTextures.filter((t) => textures.includes(t))).toEqual([]);

    engine.render(stateWith([warm, cool]));
    expect(deletedTextures.filter((t) => textures.includes(t))).toEqual([textures[2]]);

    engine.render(stateWith([warm, { ...cool, visible: false }]));
    expect(deletedTextures.filter((t) => textures.includes(t))).toEqual([textures[2], textures[1]]);

    // Nothing visible: nothing is kept.
    engine.render(stateWith([{ ...warm, visible: false }]));
    expect(deletedTextures.filter((t) => textures.includes(t))).toEqual([textures[2], textures[1], textures[0]]);
  });

  it("allocates a table for a layer that is shown again", () => {
    const { engine, paletteUploads } = setup();
    engine.render(stateWith([warm, cool]));
    engine.render(stateWith([warm, { ...cool, visible: false }]));
    engine.render(stateWith([warm, cool]));
    const uploads = paletteUploads();
    expect(uploads.map((u) => u.call)).toEqual(["texImage2D", "texImage2D", "texImage2D"]);
    expect(uploads[2].texture).not.toBe(uploads[1].texture);
  });

  it("frees every table on destroy and when the context is rebuilt, and bakes again after a rebuild", () => {
    const { engine, deletedTextures, paletteUploads } = setup();
    const state = stateWith([warm, cool]);
    engine.render(state);
    const first = paletteUploads().map((u) => u.texture as Handle);

    engine.initProgram();
    expect(first.every((t) => deletedTextures.includes(t))).toBe(true);
    engine.render(state);
    const rebuilt = paletteUploads().slice(2);
    expect(rebuilt.map((u) => u.call)).toEqual(["texImage2D", "texImage2D"]);
    expect(rebuilt.every((u) => !first.includes(u.texture as Handle))).toBe(true);

    engine.destroy();
    expect(rebuilt.every((u) => deletedTextures.includes(u.texture as Handle))).toBe(true);
  });

  it("gives hidden-layer-only scenes no table", () => {
    const { engine, paletteUploads } = setup();
    engine.render(stateWith([{ ...warm, visible: false }]));
    expect(paletteUploads()).toEqual([]);
  });

  it("uploads nothing for the palette on frames that only move the clock", () => {
    const { engine, uniformCalls, paletteUploads } = setup();
    const state = stateWith([warm, cool]);
    engine.render(state);
    const before = paletteUploads().length;
    uniformCalls.length = 0;

    engine.setElapsedTime(3);
    engine.render(state);
    expect(paletteUploads()).toHaveLength(before);
    // The clock only: three programs' u_time, no palette uniforms.
    expect(uniformCalls.filter((name) => name.startsWith("u_palette"))).toEqual([]);
  });
});
