import {
  LIGHT_FIELD_PALETTES,
  LIGHT_GRADIENT_PALETTES,
  defaultSoftnessForGradientType,
  rotateHue,
  type ColorProfile,
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
  "aperture",
  "halo",
  "lightWall",
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

/** Each type's own palette, the one its presets open with. */
const CURATED_PALETTES = { ...LIGHT_GRADIENT_PALETTES, ...LIGHT_FIELD_PALETTES };

/** What Randomize picks from: every type with a palette of its own (all but image). */
export const RANDOM_GRADIENT_TYPES = Object.keys(CURATED_PALETTES) as (keyof typeof CURATED_PALETTES)[];

/**
 * A random look for a layer: a type, its own palette turned to a random hue,
 * and its softness. The palette is turned as a whole in OkLCh, so its roles
 * (a dark room to the brightest light, or the wall and then the lights) hold.
 */
export function randomLook(
  random: () => number,
  colorProfile: ColorProfile,
): Pick<LayerParams, "gradientType" | "colors" | "softness"> {
  const gradientType = RANDOM_GRADIENT_TYPES[Math.floor(random() * RANDOM_GRADIENT_TYPES.length)] ?? "lightWall";
  const degrees = random() * 360;
  return {
    gradientType,
    colors: CURATED_PALETTES[gradientType].map((color) => rotateHue(color, degrees, colorProfile === "display-p3")),
    softness: defaultSoftnessForGradientType(gradientType),
  };
}

export const COMMAND_GRADIENT_TYPES: Exclude<LayerParams["gradientType"], "image">[] = [
  "aperture",
  "halo",
  "lightWall",
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
  { value: "aperture", label: "Aperture", group: "Premium" },
  { value: "halo", label: "Halo", group: "Premium" },
  { value: "lightWall", label: "Light Wall", group: "Premium" },
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

/** The picker's name for a type ("Liquid Chrome"), for anywhere a type is shown. */
export function gradientTypeLabel(type: LayerParams["gradientType"]): string {
  return GRADIENT_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function defaultSoftnessForType(type: LayerParams["gradientType"]): number {
  return defaultSoftnessForGradientType(type);
}
