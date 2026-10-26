import { presets as allPresets } from "@wavr/core/presets/all";
import type { GradientConfig } from "@wavr/core";

export const presets: Record<string, GradientConfig> = allPresets;

// The overlay offers the catalogue's current presets; getPreset still resolves an
// archived one, so a page that names one keeps loading it.
export const PRESET_OPTIONS: { id: string; label: string }[] = [
  { id: "aperture", label: "Aperture" },
  { id: "ganzfeld", label: "Ganzfeld" },
  { id: "halo", label: "Halo" },
  { id: "lightWall", label: "Light Wall" },
  { id: "liquidChrome", label: "Liquid Chrome" },
  { id: "horizonGlow", label: "Horizon Glow" },
  { id: "inkSmoke", label: "Ink Smoke" },
  { id: "plasmaOrb", label: "Plasma Orb" },
  { id: "iridescentFoil", label: "Iridescent Foil" },
  { id: "lightLeak", label: "Light Leak" },
  { id: "aurora", label: "Aurora" },
  { id: "sunset", label: "Sunset" },
  { id: "midnight", label: "Midnight" },
  { id: "ocean", label: "Ocean" },
  { id: "lava", label: "Lava" },
  { id: "newspaper", label: "Newspaper" },
  { id: "stipple", label: "Stipple" },
  { id: "dissolve", label: "Dissolve" },
  { id: "slitScan", label: "Slit Scan" },
  { id: "corruption", label: "Corruption" },
  { id: "bladeRunner", label: "Blade Runner" },
  { id: "northernLights", label: "North Lights" },
  { id: "prism", label: "Prism" },
];

export function getPreset(id: string): GradientConfig | undefined {
  return presets[id];
}
