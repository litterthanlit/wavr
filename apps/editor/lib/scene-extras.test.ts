import { describe, expect, it } from "vitest";
import { createLayer } from "@wavr/core";
import { PRESET_CATALOG } from "@wavr/core/presets";
import { presetToStorePatch } from "./preset-patch";
import { useGradientStore } from "./store";
import { LAYER_EXTRAS, SCENE_EXTRAS, layerExtrasOn, sceneExtrasOn } from "./scene-extras";

const initial = () => useGradientStore.getState();
const labels = (state: ReturnType<typeof initial>) => sceneExtrasOn(state).map((extra) => extra.label);

describe("scene extras", () => {
  it("lists nothing for the scene the editor opens on", () => {
    expect(labels(initial())).toEqual([]);
  });

  it("lists an effect the editor no longer offers while a scene has it on", () => {
    expect(labels({ ...initial(), asciiEnabled: true })).toEqual(["ASCII"]);
    expect(labels({ ...initial(), radialBlurAmount: 0.3, threeDEnabled: true })).toEqual([
      "Radial Blur",
      "Shader Shape Projection",
    ]);
  });

  it("lists the colour, lens and pointer effects in table order", () => {
    expect(labels({ ...initial(), trailEnabled: true, brightness: 1.3 })).toEqual(["Brightness", "Mouse Trail"]);
  });

  it("lists nothing after loading any preset", () => {
    for (const entry of PRESET_CATALOG) {
      useGradientStore.getState().loadPreset(presetToStorePatch(entry.config));
      expect(labels(initial()), entry.id).toEqual([]);
    }
  });

  it("turns each one off with its patch", () => {
    const everything = SCENE_EXTRAS.reduce((state, extra) => ({ ...state, ...invert(extra.off) }), initial());
    expect(labels(everything)).toEqual(SCENE_EXTRAS.map((extra) => extra.label));
    for (const extra of SCENE_EXTRAS) {
      expect(extra.isOn({ ...everything, ...extra.off }), extra.label).toBe(false);
    }
  });
});

describe("layer extras", () => {
  const layer = createLayer({ gradientType: "halo" });
  const star = { ...layer.mask1, shape: "star" as const };
  const labels = (l: typeof layer) => layerExtrasOn(l).map((extra) => extra.label);

  it("lists nothing for a fresh layer, or for an image layer's own picture", () => {
    expect(labels(layer)).toEqual([]);
    expect(labels({ ...layer, gradientType: "image", imageData: "data:image/png;base64,AA" })).toEqual([]);
  });

  it("lists a texture overlay, a distortion map and a second mask the shader applies", () => {
    const everything = {
      ...layer,
      imageData: "data:image/png;base64,AA",
      distortionMapEnabled: true,
      maskEnabled: true,
      mask1: star,
      mask2: { ...layer.mask2, shape: "circle" as const },
    };
    expect(labels(everything)).toEqual(LAYER_EXTRAS.map((extra) => extra.label));
    expect(labels({ ...everything, mask1: layer.mask1 })).not.toContain("Mask 2");
    expect(labels({ ...everything, textMaskEnabled: true })).not.toContain("Mask 2");

    for (const extra of LAYER_EXTRAS) {
      expect(extra.isOn({ ...everything, ...extra.clear(everything) }), extra.label).toBe(false);
    }
  });
});

function invert(off: object) {
  return Object.fromEntries(Object.entries(off).map(([key, value]) => [key, value === false ? true : 0.5]));
}
