import { describe, expect, it } from "vitest";
import { migrate, detectShape, detectVersion, GradientConfig, DEFAULT_CONFIG, SCHEMA_VERSION } from "../src";

// ---------- fixtures -------------------------------------------------------

// Realistic `project-state-v1` — modeled on apps/editor/lib/projects.ts::ProjectState
// at the moment this spec was written. Flat shape, LayerParams-rich layers,
// editor-only fields present, no Phase 11 effects.
const V1_PROJECT_STATE = {
  layers: [
    {
      gradientType: "mesh",
      colors: [[0.388, 0.357, 1.0], [1.0, 0.42, 0.42], [0.251, 0.878, 0.816]],
      speed: 0.5,
      complexity: 3,
      scale: 1.2,
      distortion: 0.4,
      opacity: 1,
      blendMode: "normal",
      depth: 0,
      // Layer-extension fields (must be dropped into droppedKeys):
      visible: true,
      imageData: null,
      imageScale: 1,
      imageOffset: [0, 0],
      distortionMapData: null,
      distortionMapEnabled: false,
      distortionMapIntensity: 0.3,
      imageBlendMode: "replace",
      imageBlendOpacity: 1,
      maskEnabled: false,
      mask1: { shape: "none" },
      mask2: { shape: "none" },
      maskBlendMode: "union",
      maskSmoothness: 0.1,
      textMaskEnabled: false,
      textMaskContent: "",
      textMaskFontSize: 80,
      textMaskFontWeight: 700,
      textMaskLetterSpacing: 0,
      textMaskAlign: "center",
    },
  ],
  activeLayerIndex: 0, // editor-only → dropped
  brightness: 1.1,
  saturation: 1.2,
  noiseEnabled: true,
  noiseIntensity: 0.4,
  noiseScale: 1.5,
  grain: 0.1,
  mouseReact: 0.6,
  bloomEnabled: true,
  bloomIntensity: 0.5,
  vignette: 0.3,
  blurEnabled: false,
  blurAmount: 0,
  radialBlurAmount: 0.2, // renamed → radialBlur
  colorBlend: 0, // editor-only → dropped
  chromaticAberration: 0.05,
  hueShift: 10,
  asciiEnabled: false,
  asciiSize: 8,
  ditherEnabled: true,
  ditherSize: 4,
  timelineEnabled: false, // editor-only → dropped
  timelineDuration: 10,
  timelinePlaybackMode: "loop",
  keyframes: [],
};

// Realistic `types-v1` — modeled on a preset from packages/core/src/presets/*.
// Nested effect groups, no `version`, no `colorSpace`, optional realBloomEnabled.
const V1_TYPES = {
  layers: [
    {
      type: "mesh",
      colors: [[0.0, 0.9, 0.8], [0.2, 0.8, 0.3], [0.3, 0.2, 0.7]],
      complexity: 4,
      scale: 1.2,
      distortion: 0.35,
    },
  ],
  saturation: 1.2,
  vignette: 0.2,
  realBloomEnabled: true, // renamed → realBloom.enabled
};

// ---------- detectVersion / detectShape ------------------------------------

describe("detectVersion", () => {
  it("identifies V2", () => {
    expect(detectVersion({ version: "2.0.0" })).toBe("2.0.0");
  });
  it("defaults to 1.0.0 for anything else", () => {
    expect(detectVersion({})).toBe("1.0.0");
    expect(detectVersion(null)).toBe("1.0.0");
    expect(detectVersion("garbage")).toBe("1.0.0");
    expect(detectVersion({ version: "1.2.3" })).toBe("1.0.0");
  });
});

describe("detectShape", () => {
  it("identifies v2", () => {
    expect(detectShape({ version: "2.0.0", layers: [] })).toBe("v2");
  });
  it("identifies project-state-v1 via flat flags", () => {
    expect(detectShape(V1_PROJECT_STATE)).toBe("project-state-v1");
    expect(detectShape({ noiseEnabled: true })).toBe("project-state-v1");
    expect(detectShape({ activeLayerIndex: 0 })).toBe("project-state-v1");
  });
  it("identifies types-v1 via nested groups or plain layers array", () => {
    expect(detectShape(V1_TYPES)).toBe("types-v1");
    expect(detectShape({ layers: [], noise: { enabled: true, intensity: 0.3, scale: 1 } })).toBe("types-v1");
  });
  it("falls back to project-state-v1 for non-objects", () => {
    expect(detectShape(null)).toBe("project-state-v1");
    expect(detectShape("x")).toBe("project-state-v1");
  });
});

// ---------- project-state-v1 → V2 ------------------------------------------

describe("migrate(project-state-v1)", () => {
  const result = migrate(V1_PROJECT_STATE);

  it("produces a valid V2 config", () => {
    expect(result.detectedShape).toBe("project-state-v1");
    expect(result.config.version).toBe(SCHEMA_VERSION);
    expect(() => GradientConfig.parse(result.config)).not.toThrow();
  });

  it("unflattens flag triples into nested groups", () => {
    expect(result.config.noise).toEqual({ enabled: true, intensity: 0.4, scale: 1.5 });
    expect(result.config.bloom).toEqual({ enabled: true, intensity: 0.5 });
    expect(result.config.dither).toEqual({ enabled: true, size: 4 });
  });

  it("renames radialBlurAmount → radialBlur", () => {
    expect(result.config.radialBlur).toBe(0.2);
  });

  it("sets colorSpace to 'linear' on migration", () => {
    expect(result.config.colorSpace).toBe("linear");
  });

  it("carries passthrough globals (brightness, saturation, vignette, chromaticAberration, hueShift)", () => {
    expect(result.config.brightness).toBe(1.1);
    expect(result.config.saturation).toBe(1.2);
    expect(result.config.vignette).toBe(0.3);
    expect(result.config.chromaticAberration).toBe(0.05);
    expect(result.config.hueShift).toBe(10);
  });

  it("maps layers: gradientType → type, colors preserved", () => {
    expect(result.config.layers).toHaveLength(1);
    expect(result.config.layers[0]!.type).toBe("mesh");
    expect(result.config.layers[0]!.colors).toEqual(V1_PROJECT_STATE.layers[0]!.colors);
    expect(result.config.layers[0]!.speed).toBe(0.5);
  });

  it("drops editor-only globals into droppedKeys", () => {
    expect(result.droppedKeys).toContain("activeLayerIndex");
    expect(result.droppedKeys).toContain("colorBlend");
    expect(result.droppedKeys).toContain("timelineEnabled");
    expect(result.droppedKeys).toContain("timelineDuration");
    expect(result.droppedKeys).toContain("keyframes");
  });

  it("drops layer extensions into droppedKeys with indexed paths", () => {
    expect(result.droppedKeys).toContain("layers[0].visible");
    expect(result.droppedKeys).toContain("layers[0].imageData");
    expect(result.droppedKeys).toContain("layers[0].mask1");
    expect(result.droppedKeys).toContain("layers[0].textMaskContent");
  });

  it("omits effect groups not present in ProjectState", () => {
    expect(result.config.curl).toBeUndefined();
    expect(result.config.shape3d).toBeUndefined();
    expect(result.config.realBloom).toBeUndefined();
  });

  it("is idempotent (migrate(migrate(x)).config ≡ migrate(x).config)", () => {
    const first = migrate(V1_PROJECT_STATE).config;
    const second = migrate(first).config;
    expect(second).toEqual(first);
  });
});

// ---------- types-v1 → V2 ---------------------------------------------------

describe("migrate(types-v1)", () => {
  const result = migrate(V1_TYPES);

  it("produces a valid V2 config", () => {
    expect(result.detectedShape).toBe("types-v1");
    expect(() => GradientConfig.parse(result.config)).not.toThrow();
  });

  it("renames realBloomEnabled → realBloom.enabled", () => {
    expect(result.config.realBloom).toEqual({ enabled: true });
  });

  it("preserves nested groups as-is (keys already match V2)", () => {
    const withNoise = migrate({
      ...V1_TYPES,
      noise: { enabled: true, intensity: 0.5, scale: 2 },
    });
    expect(withNoise.config.noise).toEqual({ enabled: true, intensity: 0.5, scale: 2 });
  });

  it("fills version and colorSpace", () => {
    expect(result.config.version).toBe(SCHEMA_VERSION);
    expect(result.config.colorSpace).toBe("linear");
  });

  it("maps layers with `type` field (not `gradientType`) unchanged", () => {
    expect(result.config.layers[0]!.type).toBe("mesh");
  });

  it("is idempotent", () => {
    const first = migrate(V1_TYPES).config;
    const second = migrate(first).config;
    expect(second).toEqual(first);
  });
});

// ---------- V2 pass-through ------------------------------------------------

describe("migrate(v2)", () => {
  it("passes DEFAULT_CONFIG through unchanged", () => {
    const result = migrate(DEFAULT_CONFIG);
    expect(result.detectedShape).toBe("v2");
    expect(result.config).toEqual(DEFAULT_CONFIG);
    expect(result.droppedKeys).toEqual([]);
  });

  it("throws via parse on a V2-tagged payload with invalid fields", () => {
    const bad = { ...DEFAULT_CONFIG, brightness: 999 };
    expect(() => migrate(bad)).toThrow();
  });

  it("throws via parse on extra unknown keys under V2 tag", () => {
    const bad = { ...DEFAULT_CONFIG, mystery: 1 };
    expect(() => migrate(bad)).toThrow();
  });
});

// ---------- invalid inputs --------------------------------------------------

describe("migrate(invalid)", () => {
  it("throws on a non-object", () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate("x")).toThrow();
  });
  it("throws on an empty object (layers required)", () => {
    expect(() => migrate({})).toThrow();
  });
});
