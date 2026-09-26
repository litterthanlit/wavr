import { describe, expect, it } from "vitest";
import { CONFIG_FIELD_STATE_KEYS, resolveConfig, type GradientConfig } from "@wavr/core";
import * as corePresets from "@wavr/core/presets";
import { PRESET_CATALOG, PRESET_CATEGORIES } from "@wavr/core/presets";
import { presets as allPresets } from "@wavr/core/presets/all";
import { presetToStorePatch } from "./preset-patch";
import { PRESETS } from "./presets";

const BASE: GradientConfig = { layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] };

// A non-default value for every mappable config field.
const SAMPLES: { [K in keyof typeof CONFIG_FIELD_STATE_KEYS]: GradientConfig[K] } = {
  noise: { enabled: true, intensity: 0.71, scale: 2.3 },
  grain: 0.42,
  mouseReact: 0.91,
  bloom: { enabled: true, intensity: 0.66 },
  vignette: 0.37,
  blur: { enabled: true, amount: 3.5 },
  radialBlur: 0.44,
  chromaticAberration: 0.55,
  hueShift: 33,
  ascii: { enabled: true, size: 13 },
  dither: { enabled: true, size: 7 },
  curl: { enabled: true, intensity: 0.77, scale: 1.9 },
  kaleidoscope: { enabled: true, segments: 9, rotation: 21 },
  reactionDiffusion: { enabled: true, intensity: 0.81, scale: 1.7 },
  pixelSort: { enabled: true, intensity: 0.62, threshold: 0.33 },
  domainWarp: 0.29,
  feedback: { enabled: true, decay: 0.88 },
  parallax: { enabled: true, strength: 0.93 },
  shape3d: { enabled: true, shape: "torus", perspective: 2.2, rotationSpeed: 0.9, zoom: 1.6, lighting: 0.2 },
  meshDistortion: { enabled: true, displacement: 0.77, frequency: 3.3, speed: 0.95 },
  oklabEnabled: false,
  toneMapMode: 2,
  ripple: { enabled: true, intensity: 0.73 },
  glow: { enabled: true, intensity: 0.64, radius: 0.11 },
  caustic: { enabled: true, intensity: 0.58 },
  liquify: { enabled: true, intensity: 0.69, scale: 3.1 },
  trail: { enabled: true, length: 0.5, width: 0.2 },
  realBloomEnabled: true,
  deband: { enabled: false, strength: 2.5 },
};

describe("CONFIG_FIELD_STATE_KEYS", () => {
  it("lists exactly the engine keys each config field changes", () => {
    const base = resolveConfig(BASE) as unknown as Record<string, unknown>;
    for (const [field, keys] of Object.entries(CONFIG_FIELD_STATE_KEYS)) {
      const sample = SAMPLES[field as keyof typeof SAMPLES];
      const changed = resolveConfig({ ...BASE, [field]: sample }) as unknown as Record<string, unknown>;
      const differing = Object.keys(base).filter((k) => JSON.stringify(base[k]) !== JSON.stringify(changed[k]));
      expect([field, differing.sort()]).toEqual([field, [...keys].sort()]);
    }
  });
});

describe("preset catalog", () => {
  it("has unique ids, each exported under that name and included in presets/all", () => {
    const ids = PRESET_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const exported = corePresets as unknown as Record<string, GradientConfig>;
    for (const entry of PRESET_CATALOG) {
      expect(exported[entry.id], entry.id).toBe(entry.config);
      expect(allPresets[entry.id], entry.id).toBe(entry.config);
    }
    expect(Object.keys(allPresets).sort()).toEqual([...ids].sort());
  });

  it("uses only known categories, and every category has presets", () => {
    const categories = PRESET_CATEGORIES.map((category) => category.id);
    for (const entry of PRESET_CATALOG) expect(categories).toContain(entry.category);
    for (const category of categories) {
      expect(PRESET_CATALOG.some((entry) => entry.category === category), category).toBe(true);
    }
  });

  it("gives the editor one preset per catalog entry, in order", () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(PRESET_CATALOG.map((entry) => entry.id));
  });
});

describe("presetToStorePatch", () => {
  it("always sets the layer look, brightness and saturation", () => {
    const patch = presetToStorePatch({ layers: [{ type: "silk", colors: [[0.1, 0.2, 0.3]], speed: 0.7 }] });
    expect(patch).toEqual({
      gradientType: "silk",
      speed: 0.7,
      complexity: 3,
      scale: 1,
      distortion: 0.3,
      colors: [[0.1, 0.2, 0.3]],
      brightness: 1,
      saturation: 1,
    });
  });

  it("adds only the effects a preset states", () => {
    const patch = presetToStorePatch({ ...BASE, grain: 0, bloom: { enabled: false, intensity: 0.3 } });
    expect(patch).toMatchObject({ grain: 0, bloomEnabled: false, bloomIntensity: 0.3 });
    expect(patch).not.toHaveProperty("vignette");
    expect(patch).not.toHaveProperty("noiseEnabled");
  });

  it("includes softness only when the preset sets it", () => {
    expect(presetToStorePatch(BASE)).not.toHaveProperty("softness");
    expect(presetToStorePatch({ layers: [{ type: "silk", colors: [[1, 1, 1]], softness: 0.8 }] }).softness).toBe(0.8);
  });
});
