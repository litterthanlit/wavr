import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GRADIENT_TYPES, GRADIENT_TYPE_IDS } from "@wavr/core";
import { GradientType as SchemaGradientType } from "@wavr/schema";
import { GRADIENT_OPTIONS } from "./gradient-types";

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
