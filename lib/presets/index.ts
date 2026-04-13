import { GradientState } from "../store";
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
import { SCANLINE_PRESETS } from "./scanline";
import { GLITCH_PRESETS } from "./glitch";
import { CINEMATIC_PRESETS } from "./cinematic";
import { NATURE_PRESETS } from "./nature";
import { ABSTRACT_PRESETS } from "./abstract";

type PresetData = Partial<Omit<GradientState, "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize">>;

export interface Preset {
  name: string;
  category: PresetCategory;
  data: PresetData;
}

export type PresetCategory = "classic" | "dither" | "scanline" | "glitch" | "cinematic" | "nature" | "abstract";

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  classic: "Classic",
  dither: "Dither",
  scanline: "Scanline",
  glitch: "Glitch",
  cinematic: "Cinematic",
  nature: "Nature",
  abstract: "Abstract",
};

export const CATEGORY_ORDER: PresetCategory[] = [
  "classic", "dither", "scanline", "glitch", "cinematic", "nature", "abstract",
];

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
  ...SCANLINE_PRESETS,
  ...GLITCH_PRESETS,
  ...CINEMATIC_PRESETS,
  ...NATURE_PRESETS,
  ...ABSTRACT_PRESETS,
];
