import { describe, expect, it } from "vitest";
import { createLayer, type LayerParams } from "@wavr/core";
import { DEFAULT_MASK_TEXT, maskMode, maskModePatch, type MaskMode } from "./layer-mask";

const layer = createLayer();
const switched = (from: LayerParams, mode: MaskMode) => ({ ...from, ...maskModePatch(from, mode) });

describe("layer mask mode", () => {
  it("reads a fresh layer as unmasked", () => {
    expect(maskMode(layer)).toBe("none");
  });

  it("reads the mask the shader applies: text over shape, and no shape as none", () => {
    expect(maskMode({ ...layer, maskEnabled: true, mask1: { ...layer.mask1, shape: "star" } })).toBe("shape");
    expect(maskMode({ ...layer, maskEnabled: true })).toBe("none");
    expect(maskMode({ ...layer, maskEnabled: true, textMaskEnabled: true, mask1: { ...layer.mask1, shape: "star" } })).toBe("text");
  });

  it("switches to each mode, and only that one is on", () => {
    for (const mode of ["shape", "text", "none", "text", "shape"] as const) {
      const next = switched(switched(layer, "shape"), mode);
      expect(maskMode(next)).toBe(mode);
      expect(next.maskEnabled && next.textMaskEnabled).toBe(false);
    }
  });

  it("starts a shape mask as a circle and a text mask with text, keeping what the layer had", () => {
    expect(switched(layer, "shape").mask1.shape).toBe("circle");
    expect(switched(layer, "text").textMaskContent).toBe(DEFAULT_MASK_TEXT);

    const star = { ...layer, mask1: { ...layer.mask1, shape: "star" as const }, textMaskContent: "Hello" };
    expect(switched(star, "shape").mask1.shape).toBe("star");
    expect(switched(star, "text").textMaskContent).toBe("Hello");
    expect(maskModePatch(star, "none")).toEqual({ maskEnabled: false, textMaskEnabled: false });
  });
});
