import { presets as allPresets } from "@wavr/core/presets/all";
import type { GradientConfig } from "@wavr/core";

export const presets: Record<string, GradientConfig> = allPresets;

export const PRESET_OPTIONS: { id: string; label: string }[] = [
  { id: "aurora", label: "Aurora" },
  { id: "sunset", label: "Sunset" },
  { id: "midnight", label: "Midnight" },
  { id: "candy", label: "Candy" },
  { id: "ocean", label: "Ocean" },
  { id: "lava", label: "Lava" },
  { id: "cyber", label: "Cyber" },
  { id: "monochrome", label: "Mono" },
  { id: "newspaper", label: "Newspaper" },
  { id: "stipple", label: "Stipple" },
  { id: "dissolve", label: "Dissolve" },
  { id: "morse", label: "Morse" },
  { id: "retroCrt", label: "CRT" },
  { id: "broadcastSignal", label: "Broadcast" },
  { id: "vhs", label: "VHS" },
  { id: "neonBars", label: "Neon Bars" },
  { id: "dataMosh", label: "Data Mosh" },
  { id: "slitScan", label: "Slit Scan" },
  { id: "corruption", label: "Corruption" },
  { id: "signalLoss", label: "Signal Loss" },
  { id: "filmNoir", label: "Film Noir" },
  { id: "bladeRunner", label: "Blade Runner" },
  { id: "tron", label: "Tron" },
  { id: "vaporwave", label: "Vaporwave" },
  { id: "northernLights", label: "North Lights" },
  { id: "deepSea", label: "Deep Sea" },
  { id: "forestCanopy", label: "Canopy" },
  { id: "sandstorm", label: "Sandstorm" },
  { id: "liquidMetal", label: "Liquid Metal" },
  { id: "oilSlick", label: "Oil Slick" },
  { id: "prism", label: "Prism" },
  { id: "smoke", label: "Smoke" },
];

export function getPreset(id: string): GradientConfig | undefined {
  return presets[id];
}
