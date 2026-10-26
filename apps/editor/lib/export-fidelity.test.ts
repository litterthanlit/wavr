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

  it("does not warn about pointer reactivity, which portable code exports carry", () => {
    const warn = (input: Parameters<typeof getPortableExportWarnings>[0]) =>
      getPortableExportWarnings({ layers: [{ visible: true }], ...input });

    expect(warn({ mouseReact: 0.5 })).toEqual([]);
    expect(warn({ mouseReact: 1 })).toEqual([]);
    expect(warn({ mouseReact: 0 })).toEqual([]);
    expect(warn({})).toEqual([]);
  });

  it("warns that click ripple, trail and parallax are not part of portable code exports", () => {
    const dropped = "Click ripple, pointer trail and parallax are not included in portable code exports";
    const warn = (input: Parameters<typeof getPortableExportWarnings>[0]) =>
      getPortableExportWarnings({ layers: [{ visible: true }], ...input });

    expect(warn({ rippleEnabled: true }).join("\n")).toContain(dropped);
    expect(warn({ trailEnabled: true }).join("\n")).toContain(dropped);
    expect(warn({ parallaxEnabled: true }).join("\n")).toContain(dropped);
    // Pointer reactivity on top of them is not what is being dropped, and one message covers all three.
    expect(warn({ mouseReact: 1, rippleEnabled: true, trailEnabled: true, parallaxEnabled: true })).toHaveLength(1);
    expect(warn({ mouseReact: 1, trailEnabled: true }).join("\n")).toContain("pointer reactivity is");
  });

  it("warns that the image gradient is drawn as a light wall", () => {
    const warnings = getPortableExportWarnings({ layers: [{ visible: true, gradientType: "image" }] });
    expect(warnings).toEqual([
      "The Image gradient needs its picture, so portable code exports draw a Light Wall in its place.",
    ]);
    expect(getPortableExportWarnings({ layers: [{ visible: true, gradientType: "halo" }] })).toEqual([]);
    // A hidden image layer is not drawn at all.
    expect(getPortableExportWarnings({ layers: [{ visible: false, gradientType: "image" }] })).toEqual([]);
  });

  it("returns no warnings for a single plain gradient layer", () => {
    expect(getPortableExportWarnings({
      layers: [{ visible: true }],
    })).toEqual([]);
  });
});
