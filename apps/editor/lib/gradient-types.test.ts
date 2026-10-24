import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_LAYER,
  GRADIENT_TYPES,
  GRADIENT_TYPE_IDS,
  LIGHT_FIELD_PALETTES,
  LIGHT_GRADIENT_PALETTES,
  isLightFieldType,
  isLightGradientType,
  isLightRampPalette,
} from "@wavr/core";
import { PRESET_CATALOG } from "@wavr/core/presets";
import { GradientType as SchemaGradientType } from "@wavr/schema";
import {
  COMMAND_GRADIENT_TYPES,
  GRADIENT_OPTIONS,
  PREMIUM_GRADIENT_TYPES,
  RANDOM_GRADIENT_TYPES,
  gradientTypeLabel,
} from "./gradient-types";
import { INITIAL_LAYER_PARAMS } from "./initial-scene";

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
    expect(gradientTypeLabel("softCells")).toBe("Soft Cells");
  });

  it("the picker leads with the premium modes and keeps the stylized ones apart", () => {
    const groupOrder = [...new Set(GRADIENT_OPTIONS.map((option) => option.group))];
    expect(groupOrder).toEqual(["Premium", "Classic", "Stylized", "Media"]);
    const stylized = GRADIENT_OPTIONS.filter((o) => o.group === "Stylized").map((o) => o.value);
    expect(stylized.sort()).toEqual(["dither", "glitch", "scanline"]);
    const premium = GRADIENT_OPTIONS.filter((o) => o.group === "Premium").map((o) => o.value);
    expect(premium).toEqual(PREMIUM_GRADIENT_TYPES);
  });

  it("Randomize only picks modes that work with any palette", () => {
    const group = (type: string) => GRADIENT_OPTIONS.find((o) => o.value === type)?.group;
    for (const type of RANDOM_GRADIENT_TYPES) {
      expect(["Premium", "Classic"], `${type} is ${group(type)}`).toContain(group(type));
    }
    // These depend on the palette's order or contrast, so a random one can ruin them.
    for (const type of ["aurora", "dither", "scanline", "glitch", "voronoi", "image"] as const) {
      expect(RANDOM_GRADIENT_TYPES).not.toContain(type);
    }
    for (const type of RANDOM_GRADIENT_TYPES) {
      expect(isLightGradientType(type), `${type} reads the palette as light`).toBe(false);
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

  it("the opening scene is a light field on its own palette, so the panel offers no swap", () => {
    const type = INITIAL_LAYER_PARAMS.gradientType ?? "mesh";
    expect(isLightFieldType(type)).toBe(true);
    expect(isLightGradientType(type)).toBe(false);
    if (isLightFieldType(type)) expect(INITIAL_LAYER_PARAMS.colors).toEqual(LIGHT_FIELD_PALETTES[type]);
  });

  it("the light-ramp hint shows on a bright first colour", () => {
    expect(isLightRampPalette(LIGHT_GRADIENT_PALETTES.horizonGlow)).toBe(true);
    expect(isLightRampPalette(DEFAULT_LAYER.colors)).toBe(false);
    expect(isLightRampPalette([[0, 0, 0]])).toBe(false);
  });

  it("the command palette offers every type but image", () => {
    expect([...COMMAND_GRADIENT_TYPES].sort()).toEqual(GRADIENT_TYPES.filter((t) => t !== "image").sort());
  });

  it("no gradient function reads the mouse (mouseWarp in layer.glsl does that once)", () => {
    expect(GRADIENTS_SHADER).not.toMatch(/u_mouse\w*|\w+Displace\b|rippleEffect/);
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
