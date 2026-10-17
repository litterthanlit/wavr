import { describe, expect, it } from "vitest";
import { getPortableExportWarnings } from "./export";

describe("export fidelity reporting", () => {
  it("warns when portable code export omits full scene features", () => {
    const warnings = getPortableExportWarnings({
      scene3DEnabled: true,
      timelineEnabled: true,
      keyframeCount: 2,
      audioEnabled: true,
      customGLSL: "return vec3(1.0);",
      layers: [
        { visible: true, imageData: "data:image/png;base64,abc", maskEnabled: true },
        { visible: true, textMaskEnabled: true },
      ],
    });

    expect(warnings).toEqual([
      "Portable code exports include one simplified gradient layer, not the full layer stack.",
      "Image and distortion-map textures are not included in portable code exports.",
      "Masks and text masks are not included in portable code exports.",
      "3D scene overlays are included in image/video exports only.",
      "Timeline keyframes are not included in portable code exports.",
      "Audio reactivity is not included in portable code exports.",
      "Custom GLSL is not included in portable code exports.",
    ]);
  });

  it("warns that mouse interaction is not part of portable code exports", () => {
    const mouse = "Mouse interaction is not included in portable code exports";
    const warn = (input: Parameters<typeof getPortableExportWarnings>[0]) =>
      getPortableExportWarnings({ layers: [{ visible: true }], ...input });

    expect(warn({ mouseReact: 0.5 }).join("\n")).toContain(mouse);
    expect(warn({ mouseReact: 1 })).toHaveLength(1);
    // The other pointer-driven features go with it.
    expect(warn({ mouseReact: 0, rippleEnabled: true }).join("\n")).toContain(mouse);
    expect(warn({ trailEnabled: true }).join("\n")).toContain(mouse);
    expect(warn({ parallaxEnabled: true }).join("\n")).toContain(mouse);
    // Nothing to warn about when the pointer does nothing.
    expect(warn({ mouseReact: 0 })).toEqual([]);
    expect(warn({})).toEqual([]);
  });

  it("returns no warnings for a single plain gradient layer", () => {
    expect(getPortableExportWarnings({
      layers: [{ visible: true }],
    })).toEqual([]);
  });
});
