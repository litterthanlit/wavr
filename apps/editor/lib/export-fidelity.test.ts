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

  it("returns no warnings for a single plain gradient layer", () => {
    expect(getPortableExportWarnings({
      layers: [{ visible: true }],
    })).toEqual([]);
  });
});
