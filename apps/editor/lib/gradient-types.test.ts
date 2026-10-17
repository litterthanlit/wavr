import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GRADIENT_TYPES, GRADIENT_TYPE_IDS } from "@wavr/core";
import { GradientType as SchemaGradientType } from "@wavr/schema";
import {
  COMMAND_GRADIENT_TYPES,
  GRADIENT_OPTIONS,
  PREMIUM_GRADIENT_TYPES,
  RANDOM_GRADIENT_TYPES,
} from "./gradient-types";

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
