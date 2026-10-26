import { presets as allPresets } from "@wavr/core/presets/all";
import type { GradientConfig } from "@wavr/core";

export const presets: Record<string, GradientConfig> = allPresets;

// The overlay offers one preset per look; getPreset resolves any of them.
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
];

export function getPreset(id: string): GradientConfig | undefined {
  return presets[id];
}
