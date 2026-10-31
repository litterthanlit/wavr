import { presets as allPresets } from "@wavr/core/presets/all";
import type { GradientConfig } from "@wavr/core";

export const presets: Record<string, GradientConfig> = allPresets;

export const PRESET_OPTIONS: { id: string; label: string }[] = [
  { id: "aperture", label: "Aperture" },
  { id: "ganzfeld", label: "Ganzfeld" },
  { id: "halo", label: "Halo" },
  { id: "corona", label: "Corona" },
  { id: "lightWall", label: "Light wall" },
  { id: "liquidChrome", label: "Liquid chrome" },
  { id: "horizonGlow", label: "Horizon glow" },
  { id: "inkSmoke", label: "Ink smoke" },
  { id: "plasmaOrb", label: "Orb" },
  { id: "iridescentFoil", label: "Iridescent foil" },
  { id: "lightLeak", label: "Light leak" },
];

export function getPreset(id: string): GradientConfig | undefined {
  return presets[id];
}
