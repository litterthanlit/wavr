import {
  defaultSoftnessForGradientType,
  type GradientType,
  type LayerParams,
} from "@wavr/core";

export type GradientOption = {
  value: GradientType;
  label: string;
  group: "Premium" | "Classic" | "Stylized" | "Media";
};

/** The strongest, calmest modes: the picker leads with these. */
export const PREMIUM_GRADIENT_TYPES: GradientType[] = [
  "liquidChrome",
  "horizonGlow",
  "inkSmoke",
  "plasmaOrb",
  "iridescentFoil",
  "lightLeak",
  "mesh",
  "silk",
  "aurora",
  "liquid",
  "prismGlass",
  "grainflow",
  "softCells",
  "neonTunnel",
];

/**
 * What Randomize picks from: modes that look good with any palette. Left out:
 * aurora (the palette's first colour is its sky, so it needs a dark one), the
 * light modes (liquidChrome, iridescentFoil, horizonGlow, lightLeak, inkSmoke,
 * plasmaOrb: the palette runs from shadow to the brightest light, so it has to
 * start dark and end light), voronoi
 * and softCells (read as flat tiles in a random palette), dither (needs two
 * contrasting colours) and the rest of the stylized group.
 */
export const RANDOM_GRADIENT_TYPES: LayerParams["gradientType"][] = [
  "mesh",
  "silk",
  "liquid",
  "grainflow",
  "prismGlass",
  "neonTunnel",
  "plasma",
];

export const COMMAND_GRADIENT_TYPES: Exclude<LayerParams["gradientType"], "image">[] = [
  "liquidChrome",
  "horizonGlow",
  "inkSmoke",
  "plasmaOrb",
  "iridescentFoil",
  "lightLeak",
  "mesh",
  "silk",
  "aurora",
  "liquid",
  "prismGlass",
  "grainflow",
  "softCells",
  "neonTunnel",
  "linear",
  "radial",
  "conic",
  "plasma",
  "voronoi",
  "dither",
  "scanline",
  "glitch",
];

export const GRADIENT_OPTIONS: GradientOption[] = [
  { value: "liquidChrome", label: "Liquid Chrome", group: "Premium" },
  { value: "horizonGlow", label: "Horizon Glow", group: "Premium" },
  { value: "inkSmoke", label: "Ink Smoke", group: "Premium" },
  { value: "plasmaOrb", label: "Plasma Orb", group: "Premium" },
  { value: "iridescentFoil", label: "Iridescent Foil", group: "Premium" },
  { value: "lightLeak", label: "Light Leak", group: "Premium" },
  { value: "mesh", label: "Mesh", group: "Premium" },
  { value: "silk", label: "Silk", group: "Premium" },
  { value: "aurora", label: "Aurora", group: "Premium" },
  { value: "liquid", label: "Liquid", group: "Premium" },
  { value: "prismGlass", label: "Prism Glass", group: "Premium" },
  { value: "grainflow", label: "Grainflow", group: "Premium" },
  { value: "softCells", label: "Soft Cells", group: "Premium" },
  { value: "neonTunnel", label: "Neon Tunnel", group: "Premium" },
  { value: "linear", label: "Linear", group: "Classic" },
  { value: "radial", label: "Radial", group: "Classic" },
  { value: "conic", label: "Conic", group: "Classic" },
  { value: "plasma", label: "Plasma", group: "Classic" },
  { value: "voronoi", label: "Voronoi", group: "Classic" },
  { value: "dither", label: "Dither", group: "Stylized" },
  { value: "scanline", label: "Scanline", group: "Stylized" },
  { value: "glitch", label: "Glitch", group: "Stylized" },
  { value: "image", label: "Image", group: "Media" },
];

export function defaultSoftnessForType(type: LayerParams["gradientType"]): number {
  return defaultSoftnessForGradientType(type);
}
