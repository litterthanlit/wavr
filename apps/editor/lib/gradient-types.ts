import {
  LIGHT_FIELD_PALETTES,
  LIGHT_FIELD_PALETTE_ROLES,
  LIGHT_GRADIENT_PALETTES,
  defaultSoftnessForGradientType,
  rotateHue,
  type ColorProfile,
  type GradientType,
  type LayerParams,
} from "@wavr/core";
import thumbnailHashes from "../public/presets/thumbnails.json";

export type GradientOption = {
  value: GradientType;
  label: string;
  /** The line under the Look grid: what it is, and how it reads its colours. */
  description: string;
};

/** The Look grid, in order: the light fields, the light modes, then an uploaded picture. */
export const GRADIENT_OPTIONS: GradientOption[] = [
  {
    value: "aperture",
    label: "Aperture",
    description: `An opening of light in a wall. ${LIGHT_FIELD_PALETTE_ROLES.aperture}`,
  },
  {
    value: "halo",
    label: "Halo",
    description: "A ring of light in a dark room. Colours run from the room to the hottest light.",
  },
  {
    value: "lightWall",
    label: "Light Wall",
    description: `Coloured light behind a wall of frosted glass. ${LIGHT_FIELD_PALETTE_ROLES.lightWall}`,
  },
  {
    value: "horizonGlow",
    label: "Horizon Glow",
    description: "A planet's rim lit against a dark sky. Colours run from the night to the brightest light.",
  },
  {
    value: "lightLeak",
    label: "Light Leak",
    description: "Warm light bleeding in over the edge of the film. Colours run from the dark frame to the hottest light.",
  },
  {
    value: "liquidChrome",
    label: "Liquid Chrome",
    description: "Flowing mirror metal. Colours run from its deepest shadow to its brightest highlight.",
  },
  {
    value: "iridescentFoil",
    label: "Iridescent Foil",
    description: "Holographic foil whose colour shifts across its folds. Colours run from the shadow to the brightest sheen.",
  },
  {
    value: "inkSmoke",
    label: "Ink Smoke",
    description: "A plume of smoke curling through dark water. Colours run from the water to the brightest strand.",
  },
  {
    value: "plasmaOrb",
    label: "Plasma Orb",
    description: "A glass orb of swirling light on a dark field. Colours run from the dark to the brightest light.",
  },
  {
    value: "image",
    label: "Image",
    description: "A picture you upload. The pointer warps it and the effects finish it.",
  },
];

/** The types the command palette can switch to, in picker order (image needs an upload). */
export const COMMAND_GRADIENT_TYPES = GRADIENT_OPTIONS.flatMap(({ value }) => (value === "image" ? [] : [value]));

/** Each type's own palette, the one its presets open with. */
export const CURATED_PALETTES = {
  ...LIGHT_GRADIENT_PALETTES,
  ...LIGHT_FIELD_PALETTES,
} satisfies Record<Exclude<GradientType, "image">, [number, number, number][]>;

/** A copy of the type's own palette; null for image, which has none. */
export function curatedPalette(type: GradientType): [number, number, number][] | null {
  return type === "image" ? null : CURATED_PALETTES[type].map((c) => [...c] as [number, number, number]);
}

/**
 * Picking a look: the type, its softness and its own palette. Every type reads
 * its colours by role or as a dark-to-light ramp, so a palette carried over
 * from another type looks wrong; image keeps the colours it doesn't use.
 */
export function lookPatch(type: GradientType): Pick<LayerParams, "gradientType" | "softness"> & Partial<Pick<LayerParams, "colors">> {
  const colors = curatedPalette(type);
  return {
    gradientType: type,
    softness: defaultSoftnessForGradientType(type),
    ...(colors && { colors }),
  };
}

const THUMBNAIL_HASHES: Record<string, string | undefined> = thumbnailHashes;

/**
 * The Look tile's picture: the pre-rendered thumbnail of the type's flagship
 * preset (which has the type's id), with the hash that changes with it. Null
 * for image.
 */
export function lookThumbnail(type: GradientType): string | null {
  const hash = THUMBNAIL_HASHES[type];
  return type === "image" || !hash ? null : `/presets/${type}.webp?v=${hash}`;
}

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
