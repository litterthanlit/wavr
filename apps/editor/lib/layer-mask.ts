import type { LayerParams } from "@wavr/core";

export type MaskMode = "none" | "shape" | "text";

type MaskFields = Pick<LayerParams, "maskEnabled" | "mask1" | "textMaskEnabled" | "textMaskContent">;

export const DEFAULT_MASK_TEXT = "Wavr";

export function maskMode(layer: MaskFields): MaskMode {
  if (layer.textMaskEnabled) return "text";
  if (layer.maskEnabled && layer.mask1.shape !== "none") return "shape";
  return "none";
}

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
