import { GradientConfig } from "../types";
import * as soft from "./soft";
import * as classic from "./classic";
import * as dither from "./dither";
import * as scanline from "./scanline";
import * as glitch from "./glitch";
import * as cinematic from "./cinematic";
import * as nature from "./nature";
import * as abstract from "./abstract";

export type PresetCategory = "soft" | "classic" | "dither" | "scanline" | "glitch" | "cinematic" | "nature" | "abstract";

export interface PresetEntry {
  /** Export name in @wavr/core/presets. */
  id: string;
  name: string;
  category: PresetCategory;
  config: GradientConfig;
}

/** Categories in display order. */
export const PRESET_CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: "soft", label: "Soft" },
  { id: "classic", label: "Classic" },
  { id: "dither", label: "Dither" },
  { id: "scanline", label: "Scanline" },
  { id: "glitch", label: "Glitch" },
  { id: "cinematic", label: "Cinematic" },
  { id: "nature", label: "Nature" },
  { id: "abstract", label: "Abstract" },
];

/** Every preset with its display name, in display order. */
export const PRESET_CATALOG: PresetEntry[] = [
  { id: "silkEditorial", name: "Silk Editorial", category: "soft", config: soft.silkEditorial },
  { id: "northernGlow", name: "Northern Glow", category: "soft", config: soft.northernGlow },
  { id: "liquidGlass", name: "Liquid Glass", category: "soft", config: soft.liquidGlass },
  { id: "velvetCells", name: "Velvet Cells", category: "soft", config: soft.velvetCells },
  { id: "grainFlow", name: "Grain Flow", category: "soft", config: soft.grainFlow },
  { id: "aurora", name: "Aurora", category: "classic", config: classic.aurora },
  { id: "sunset", name: "Sunset", category: "classic", config: classic.sunset },
  { id: "midnight", name: "Midnight", category: "classic", config: classic.midnight },
  { id: "candy", name: "Candy", category: "classic", config: classic.candy },
  { id: "ocean", name: "Ocean", category: "classic", config: classic.ocean },
  { id: "lava", name: "Lava", category: "classic", config: classic.lava },
  { id: "cyber", name: "Cyber", category: "classic", config: classic.cyber },
  { id: "monochrome", name: "Monochrome", category: "classic", config: classic.monochrome },
  { id: "newspaper", name: "Newspaper", category: "dither", config: dither.newspaper },
  { id: "stipple", name: "Stipple", category: "dither", config: dither.stipple },
  { id: "dissolve", name: "Dissolve", category: "dither", config: dither.dissolve },
  { id: "morse", name: "Morse", category: "dither", config: dither.morse },
  { id: "retroCrt", name: "Retro CRT", category: "scanline", config: scanline.retroCrt },
  { id: "broadcastSignal", name: "Broadcast Signal", category: "scanline", config: scanline.broadcastSignal },
  { id: "vhs", name: "VHS", category: "scanline", config: scanline.vhs },
  { id: "neonBars", name: "Neon Bars", category: "scanline", config: scanline.neonBars },
  { id: "dataMosh", name: "Data Mosh", category: "glitch", config: glitch.dataMosh },
  { id: "slitScan", name: "Slit Scan", category: "glitch", config: glitch.slitScan },
  { id: "corruption", name: "Corruption", category: "glitch", config: glitch.corruption },
  { id: "signalLoss", name: "Signal Loss", category: "glitch", config: glitch.signalLoss },
  { id: "filmNoir", name: "Film Noir", category: "cinematic", config: cinematic.filmNoir },
  { id: "bladeRunner", name: "Blade Runner", category: "cinematic", config: cinematic.bladeRunner },
  { id: "tron", name: "Tron", category: "cinematic", config: cinematic.tron },
  { id: "vaporwave", name: "Vaporwave", category: "cinematic", config: cinematic.vaporwave },
  { id: "northernLights", name: "Northern Lights", category: "nature", config: nature.northernLights },
  { id: "deepSea", name: "Deep Sea", category: "nature", config: nature.deepSea },
  { id: "forestCanopy", name: "Forest Canopy", category: "nature", config: nature.forestCanopy },
  { id: "sandstorm", name: "Sandstorm", category: "nature", config: nature.sandstorm },
  { id: "liquidMetal", name: "Liquid Metal", category: "abstract", config: abstract.liquidMetal },
  { id: "oilSlick", name: "Oil Slick", category: "abstract", config: abstract.oilSlick },
  { id: "prism", name: "Prism", category: "abstract", config: abstract.prism },
  { id: "smoke", name: "Smoke", category: "abstract", config: abstract.smoke },
];
