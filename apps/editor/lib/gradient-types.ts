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
  group: "Light fields" | "Light" | "Media";
};

export const GRADIENT_OPTIONS: GradientOption[] = [
  { value: "aperture", label: "Aperture", group: "Light fields" },
  { value: "halo", label: "Halo", group: "Light fields" },
  { value: "lightWall", label: "Light Wall", group: "Light fields" },
  { value: "liquidChrome", label: "Liquid Chrome", group: "Light" },
  { value: "horizonGlow", label: "Horizon Glow", group: "Light" },
  { value: "inkSmoke", label: "Ink Smoke", group: "Light" },
  { value: "plasmaOrb", label: "Plasma Orb", group: "Light" },
  { value: "iridescentFoil", label: "Iridescent Foil", group: "Light" },
  { value: "lightLeak", label: "Light Leak", group: "Light" },
  { value: "image", label: "Image", group: "Media" },
];

/** The types the command palette can switch to, in picker order (image needs an upload). */
export const COMMAND_GRADIENT_TYPES = GRADIENT_OPTIONS.flatMap(({ value }) => (value === "image" ? [] : [value]));

/** Each type's own palette, the one its presets open with. */
const CURATED_PALETTES = {
  ...LIGHT_GRADIENT_PALETTES,
  ...LIGHT_FIELD_PALETTES,
} satisfies Record<Exclude<GradientType, "image">, [number, number, number][]>;

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

/** The picker's name for a type ("Liquid Chrome"), for anywhere a type is shown. */
export function gradientTypeLabel(type: LayerParams["gradientType"]): string {
  return GRADIENT_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

export function defaultSoftnessForType(type: LayerParams["gradientType"]): number {
  return defaultSoftnessForGradientType(type);
}
