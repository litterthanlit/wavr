/**
 * Canonical value lists shared by every package (schema, engine, React
 * component, preview, editor). Plain arrays with no zod import, so the
 * engine can depend on them without pulling in the schema runtime.
 * Add a value here and the types follow everywhere.
 */

export const GRADIENT_TYPES = [
  "image",
  "liquidChrome", "iridescentFoil", "horizonGlow", "lightLeak", "inkSmoke", "plasmaOrb",
  "aperture", "halo", "lightWall",
] as const;
export type GradientType = (typeof GRADIENT_TYPES)[number];

/**
 * Gradient types that have been removed, and the type a scene naming one opens
 * as. Light wall shows any palette's colours as they are; the other light modes
 * read the palette as a ramp from dark to light. Applied wherever a config
 * enters: migrate(), parseSceneDocument(), core's resolveConfig() and the
 * editor's project load.
 */
export const RETIRED_GRADIENT_TYPES: ReadonlyMap<string, GradientType> = new Map(
  [
    "mesh", "radial", "linear", "conic", "plasma",
    "dither", "scanline", "glitch", "voronoi",
    "silk", "aurora", "liquid", "softCells", "grainflow", "prismGlass", "neonTunnel",
  ].map((type): [string, GradientType] => [type, "lightWall"]),
);

/** The type a layer naming `type` opens as: its replacement if it was retired, else `type`. */
export function currentGradientType<T extends string>(type: T): T | GradientType {
  return RETIRED_GRADIENT_TYPES.get(type) ?? type;
}

/** Global config fields only retired gradient types read. Old configs still carry them; they are dropped. */
export const RETIRED_GLOBALS: readonly string[] = ["domainWarp"];

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

// The RGB space a scene's colour values are read in and its canvas presents
// in. Named as the browser names them (PredefinedColorSpace).
export const COLOR_PROFILES = ["srgb", "display-p3"] as const;
export type ColorProfile = (typeof COLOR_PROFILES)[number];
