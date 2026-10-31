import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_LAYER,
  GRADIENT_TYPES,
  GRADIENT_TYPE_IDS,
  LIGHT_FIELD_PALETTES,
  LIGHT_FIELD_PALETTE_ROLES,
  LIGHT_GRADIENT_PALETTES,
  defaultSoftnessForGradientType,
  isLightFieldType,
  isLightGradientType,
  isLightRampPalette,
} from "@wavr/core";
import { PRESET_CATALOG } from "@wavr/core/presets";
import { GradientType as SchemaGradientType } from "@wavr/schema";
import {
  COMMAND_GRADIENT_TYPES,
  GRADIENT_OPTIONS,
  gradientTypeLabel,
  lookPatch,
  lookThumbnail,
} from "./gradient-types";
import { INITIAL_LAYER_PARAMS } from "./initial-scene";
import { useGradientStore } from "./store";

// Guards the places a new gradient type must be wired up that the type
// system can't check (see "Adding a Gradient Mode" in CLAUDE.md).

const GRADIENTS_SHADER = fs.readFileSync(
  path.resolve(__dirname, "../../../packages/core/src/shaders/gradients.glsl"),
  "utf8",
);

function computeGradientBody(): string {
  const start = GRADIENTS_SHADER.indexOf("vec3 computeGradient(");
  const end = GRADIENTS_SHADER.indexOf("\n}", start);
  return GRADIENTS_SHADER.slice(start, end);
}

describe("gradient types", () => {
  it("schema accepts exactly the canonical list", () => {
    expect(SchemaGradientType.options).toEqual([...GRADIENT_TYPES]);
  });

  it("every type has exactly one editor option", () => {
    const optionValues = GRADIENT_OPTIONS.map((option) => option.value);
    expect([...optionValues].sort()).toEqual([...GRADIENT_TYPES].sort());
  });

  it("types are shown by their picker name", () => {
    expect(gradientTypeLabel("liquidChrome")).toBe("Liquid Chrome");
    expect(gradientTypeLabel("lightWall")).toBe("Light Wall");
  });

  it("the Look grid shows the light fields, then the light modes, then the uploaded picture", () => {
    expect(GRADIENT_OPTIONS.map((option) => option.value)).toEqual([
      "aperture", "halo", "corona", "lightWall",
      "horizonGlow", "lightLeak", "liquidChrome", "iridescentFoil", "inkSmoke", "plasmaOrb",
      "image",
    ]);
    for (const option of GRADIENT_OPTIONS.slice(4, 10)) expect(isLightGradientType(option.value), option.value).toBe(true);
  });

  it("each look says what it is, and the light fields how they read their stops", () => {
    for (const option of GRADIENT_OPTIONS) expect(option.description, option.value).toMatch(/^[A-Z].*\.$/);
    const description = (type: string) => GRADIENT_OPTIONS.find((option) => option.value === type)?.description;
    expect(description("aperture")).toContain(LIGHT_FIELD_PALETTE_ROLES.aperture);
    expect(description("lightWall")).toContain(LIGHT_FIELD_PALETTE_ROLES.lightWall);
  });

  it("each look but image shows its flagship preset's thumbnail", () => {
    for (const { value } of GRADIENT_OPTIONS) {
      if (value === "image") {
        expect(lookThumbnail(value)).toBeNull();
        continue;
      }
      expect(lookThumbnail(value)).toMatch(new RegExp(`^/presets/${value}\\.webp\\?v=[0-9a-f]{10}$`));
      expect(fs.existsSync(path.resolve(__dirname, `../public/presets/${value}.webp`)), value).toBe(true);
    }
  });

  it("each light mode has a curated palette that runs from shadow to light, as its presets do", () => {
    for (const [type, palette] of Object.entries(LIGHT_GRADIENT_PALETTES)) {
      expect(GRADIENT_TYPES).toContain(type);
      expect(isLightRampPalette(palette), `${type}'s palette`).toBe(true);
    }
    const lightPresets = PRESET_CATALOG.filter((entry) => entry.category === "light");
    expect(lightPresets.length).toBeGreaterThan(0);
    for (const entry of lightPresets) {
      for (const layer of entry.config.layers) {
        expect(isLightGradientType(layer.type), `${entry.id} uses ${layer.type}`).toBe(true);
        expect(isLightRampPalette(layer.colors), `${entry.id}'s palette`).toBe(true);
      }
    }
  });

  it("the opening scene is a light field on its own palette", () => {
    const type = INITIAL_LAYER_PARAMS.gradientType ?? "lightWall";
    expect(isLightFieldType(type)).toBe(true);
    expect(isLightGradientType(type)).toBe(false);
    if (isLightFieldType(type)) expect(INITIAL_LAYER_PARAMS.colors).toEqual(LIGHT_FIELD_PALETTES[type]);
  });

  it("a light ramp starts dark and ends clearly lighter", () => {
    expect(isLightRampPalette(LIGHT_GRADIENT_PALETTES.horizonGlow)).toBe(true);
    expect(isLightRampPalette(DEFAULT_LAYER.colors)).toBe(false);
    expect(isLightRampPalette([[0, 0, 0]])).toBe(false);
  });

  it("a look brings its own palette and softness; image keeps the colours it doesn't read", () => {
    const halo = lookPatch("halo");
    expect(halo).toEqual({ gradientType: "halo", softness: defaultSoftnessForGradientType("halo"), colors: LIGHT_GRADIENT_PALETTES.halo });
    expect(lookPatch("lightWall").colors).toEqual(LIGHT_FIELD_PALETTES.lightWall);
    expect(lookPatch("image")).toEqual({ gradientType: "image", softness: defaultSoftnessForGradientType("image") });
    expect(halo.colors?.[0]).not.toBe(LIGHT_GRADIENT_PALETTES.halo[0]);
  });

  it("the command palette offers every type but image", () => {
    expect([...COMMAND_GRADIENT_TYPES].sort()).toEqual(GRADIENT_TYPES.filter((t) => t !== "image").sort());
  });

  it("no gradient function reads the mouse (mouseWarp in layer.glsl does that once)", () => {
    expect(GRADIENTS_SHADER).not.toMatch(/u_mouse\w*|\w+Displace\b|rippleEffect/);
  });

  it("keeps each type's shader id, which code exports and embeds compile in", () => {
    expect(GRADIENT_TYPE_IDS).toEqual({
      image: 8,
      liquidChrome: 17,
      iridescentFoil: 18,
      horizonGlow: 19,
      lightLeak: 20,
      inkSmoke: 21,
      plasmaOrb: 22,
      aperture: 23,
      halo: 24,
      lightWall: 25,
      corona: 26,
    });
  });

  it("every type has a unique shader id", () => {
    expect(Object.keys(GRADIENT_TYPE_IDS).sort()).toEqual([...GRADIENT_TYPES].sort());
    const ids = Object.values(GRADIENT_TYPE_IDS);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the shader dispatches every shader id", () => {
    const body = computeGradientBody();
    for (const [type, id] of Object.entries(GRADIENT_TYPE_IDS)) {
      expect(
        body,
        `${type} (id ${id}) has no branch in computeGradient()`,
      ).toMatch(new RegExp(`#elif WAVR_GRADIENT == ${id}\\s+return ${type}Gradient\\(uv, time\\);`));
    }
  });

  it("the shader guards every gradient function with its shader id", () => {
    for (const [type, id] of Object.entries(GRADIENT_TYPE_IDS)) {
      expect(
        GRADIENTS_SHADER,
        `${type}Gradient is not guarded by #if WAVR_GRADIENT == ${id}`,
      ).toMatch(new RegExp(`#if WAVR_GRADIENT == ${id}\\nvec3 ${type}Gradient\\(vec2 uv, float time\\) \\{`));
    }
  });
});

describe("picking a look", () => {
  it("sets the type, softness and palette in one undo step", () => {
    const store = useGradientStore.getState;
    const before = { gradientType: store().gradientType, colors: store().colors, softness: store().softness };
    expect(before.gradientType).not.toBe("lightLeak");

    store().setLook("lightLeak");
    expect(store().layers[store().activeLayerIndex]).toMatchObject(lookPatch("lightLeak"));

    store().undo();
    expect({ gradientType: store().gradientType, colors: store().colors, softness: store().softness }).toEqual(before);
  });

  it("does nothing for the look the layer already has", () => {
    const store = useGradientStore.getState;
    store().setDiscrete({ colors: [[0.1, 0.1, 0.1], [0.9, 0.8, 0.7]] });
    const colors = store().colors;
    store().setLook(store().gradientType);
    expect(store().colors).toBe(colors);
  });
});
