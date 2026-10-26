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
  { id: "lightFields", label: "Light Fields" },
  { id: "light", label: "Light" },
];

/** Every preset with its display name, in display order. */
export const PRESET_CATALOG: PresetEntry[] = [
  { id: "aperture", name: "Aperture", category: "lightFields", config: lightFields.aperture },
  { id: "cobaltAperture", name: "Cobalt Aperture", category: "lightFields", config: lightFields.cobaltAperture },
  { id: "duskAperture", name: "Dusk Aperture", category: "lightFields", config: lightFields.duskAperture },
  { id: "ganzfeld", name: "Ganzfeld", category: "lightFields", config: lightFields.ganzfeld },
  { id: "halo", name: "Halo", category: "lightFields", config: lightFields.halo },
  { id: "iceHalo", name: "Ice Halo", category: "lightFields", config: lightFields.iceHalo },
  { id: "lightWall", name: "Light Wall", category: "lightFields", config: lightFields.lightWall },
  { id: "lagoonWall", name: "Lagoon Wall", category: "lightFields", config: lightFields.lagoonWall },
  { id: "liquidChrome", name: "Liquid Chrome", category: "light", config: light.liquidChrome },
  { id: "goldChrome", name: "Gold Chrome", category: "light", config: light.goldChrome },
  { id: "horizonGlow", name: "Horizon Glow", category: "light", config: light.horizonGlow },
  { id: "iceHorizon", name: "Ice Horizon", category: "light", config: light.iceHorizon },
  { id: "inkSmoke", name: "Ink Smoke", category: "light", config: light.inkSmoke },
  { id: "roseSmoke", name: "Rose Smoke", category: "light", config: light.roseSmoke },
  { id: "plasmaOrb", name: "Plasma Orb", category: "light", config: light.plasmaOrb },
  { id: "limeOrb", name: "Lime Orb", category: "light", config: light.limeOrb },
  { id: "iridescentFoil", name: "Iridescent Foil", category: "light", config: light.iridescentFoil },
  { id: "midnightFoil", name: "Midnight Foil", category: "light", config: light.midnightFoil },
  { id: "lightLeak", name: "Light Leak", category: "light", config: light.lightLeak },
  { id: "violetLeak", name: "Violet Leak", category: "light", config: light.violetLeak },
];
