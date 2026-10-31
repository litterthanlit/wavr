import { GradientConfig } from "../types";
import * as lightFields from "./light-fields";
import * as light from "./light";

export type PresetCategory = "lightFields" | "light";

export interface PresetEntry {
  /** Export name in @wavr/core/presets. */
  id: string;
  name: string;
  category: PresetCategory;
  config: GradientConfig;
}

/** Categories in display order, strongest first. */
export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: "lightFields", label: "Light fields" },
  { id: "light", label: "Light" },
];

/** Every preset with its display name, in display order. */
export const PRESET_CATALOG: PresetEntry[] = [
  { id: "aperture", name: "Aperture", category: "lightFields", config: lightFields.aperture },
  { id: "cobaltAperture", name: "Cobalt aperture", category: "lightFields", config: lightFields.cobaltAperture },
  { id: "duskAperture", name: "Dusk aperture", category: "lightFields", config: lightFields.duskAperture },
  { id: "ganzfeld", name: "Ganzfeld", category: "lightFields", config: lightFields.ganzfeld },
  { id: "halo", name: "Halo", category: "lightFields", config: lightFields.halo },
  { id: "iceHalo", name: "Ice halo", category: "lightFields", config: lightFields.iceHalo },
  { id: "corona", name: "Corona", category: "lightFields", config: lightFields.corona },
  { id: "iceVeil", name: "Ice veil", category: "lightFields", config: lightFields.iceVeil },
  { id: "lightWall", name: "Light wall", category: "lightFields", config: lightFields.lightWall },
  { id: "lagoonWall", name: "Lagoon wall", category: "lightFields", config: lightFields.lagoonWall },
  { id: "liquidChrome", name: "Liquid chrome", category: "light", config: light.liquidChrome },
  { id: "goldChrome", name: "Gold chrome", category: "light", config: light.goldChrome },
  { id: "horizonGlow", name: "Horizon glow", category: "light", config: light.horizonGlow },
  { id: "iceHorizon", name: "Ice horizon", category: "light", config: light.iceHorizon },
  { id: "inkSmoke", name: "Ink smoke", category: "light", config: light.inkSmoke },
  { id: "roseSmoke", name: "Rose smoke", category: "light", config: light.roseSmoke },
  { id: "plasmaOrb", name: "Orb", category: "light", config: light.plasmaOrb },
  { id: "limeOrb", name: "Lime orb", category: "light", config: light.limeOrb },
  { id: "iridescentFoil", name: "Iridescent foil", category: "light", config: light.iridescentFoil },
  { id: "midnightFoil", name: "Midnight foil", category: "light", config: light.midnightFoil },
  { id: "lightLeak", name: "Light leak", category: "light", config: light.lightLeak },
  { id: "violetLeak", name: "Violet leak", category: "light", config: light.violetLeak },
];
