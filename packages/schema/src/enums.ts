/**
 * Canonical value lists shared by every package (schema, engine, React
 * component, preview, editor). Plain arrays with no zod import, so the
 * engine can depend on them without pulling in the schema runtime.
 * Add a value here and the types follow everywhere.
 */

export const GRADIENT_TYPES = [
  "mesh", "radial", "linear", "conic", "plasma",
  "dither", "scanline", "glitch", "voronoi", "image",
  "silk", "aurora", "liquid", "softCells", "grainflow", "prismGlass", "neonTunnel",
] as const;
export type GradientType = (typeof GRADIENT_TYPES)[number];

// 26-value Photoshop set.
export const BLEND_MODES = [
  "normal",
  "darken", "multiply", "colorBurn", "linearBurn", "darkerColor",
  "lighten", "screen", "colorDodge", "add", "lighterColor",
  "overlay", "softLight", "hardLight", "vividLight", "linearLight", "pinLight", "hardMix",
  "difference", "exclusion", "subtract", "divide",
  "hue", "saturation", "color", "luminosity",
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

export const IMAGE_BLEND_MODES = ["replace", "normal", "multiply", "screen", "overlay"] as const;
export type ImageBlendMode = (typeof IMAGE_BLEND_MODES)[number];

export const MASK_SHAPES = ["none", "circle", "roundedRect", "ellipse", "polygon", "star", "blob"] as const;
export type MaskShape = (typeof MASK_SHAPES)[number];

export const MASK_BLEND_MODES = ["union", "subtract", "intersect", "smoothUnion"] as const;
export type MaskBlendMode = (typeof MASK_BLEND_MODES)[number];

export const TEXT_MASK_ALIGNS = ["left", "center", "right"] as const;
export type TextMaskAlign = (typeof TEXT_MASK_ALIGNS)[number];
