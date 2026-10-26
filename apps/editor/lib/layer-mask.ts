import type { LayerParams } from "@wavr/core";

/** What masks a layer: nothing, its shape mask or its text mask. */
export type MaskMode = "none" | "shape" | "text";

type MaskFields = Pick<LayerParams, "maskEnabled" | "mask1" | "textMaskEnabled" | "textMaskContent">;

/** The text a text mask starts with: an empty one would mask the whole layer away. */
export const DEFAULT_MASK_TEXT = "Wavr";

/**
 * The layer's mask as the shader applies it: the text mask wins over the
 * shape mask, and a shape mask without a shape masks nothing.
 */
export function maskMode(layer: MaskFields): MaskMode {
  if (layer.textMaskEnabled) return "text";
  if (layer.maskEnabled && layer.mask1.shape !== "none") return "shape";
  return "none";
}

/**
 * The layer patch that switches its mask to `mode`, the other one off. A shape
 * mask without a shape starts as a circle, a text mask without text as
 * DEFAULT_MASK_TEXT, so the choice shows at once.
 */
export function maskModePatch(layer: MaskFields, mode: MaskMode): Partial<LayerParams> {
  switch (mode) {
    case "none":
      return { maskEnabled: false, textMaskEnabled: false };
    case "shape":
      return {
        maskEnabled: true,
        textMaskEnabled: false,
        ...(layer.mask1.shape === "none" && { mask1: { ...layer.mask1, shape: "circle" } }),
      };
    case "text":
      return {
        maskEnabled: false,
        textMaskEnabled: true,
        ...(layer.textMaskContent === "" && { textMaskContent: DEFAULT_MASK_TEXT }),
      };
  }
}
