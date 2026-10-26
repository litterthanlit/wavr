import { GradientConfig } from "../types";
import * as lightFields from "./light-fields";
import * as light from "./light";
import * as soft from "./soft";
import * as classic from "./classic";
import * as dither from "./dither";
import * as scanline from "./scanline";
import * as glitch from "./glitch";
import * as cinematic from "./cinematic";
import * as nature from "./nature";
import * as abstract from "./abstract";

export type PresetCategory = "lightFields" | "light" | "soft" | "texture" | "archive";

export interface PresetEntry {
  /** Export name in @wavr/core/presets. */
  id: string;
  name: string;
  category: PresetCategory;
  config: GradientConfig;
}

/**
 * Categories in display order, strongest first. The archive holds the early
 * presets that have been retired from the editor's catalogue: they are still
 * exported under their names (and load in the editor from the Archive group,
 * which starts collapsed) so code that names them keeps working.
 */
export const PRESET_CATEGORIES: { id: PresetCategory; label: string; archived?: boolean }[] = [
  { id: "lightFields", label: "Light Fields" },
  { id: "light", label: "Light" },
  { id: "soft", label: "Soft" },
  { id: "texture", label: "Texture" },
  { id: "archive", label: "Archive", archived: true },
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
  { id: "aurora", name: "Aurora", category: "soft", config: classic.aurora },
  { id: "silkEditorial", name: "Silk Editorial", category: "soft", config: soft.silkEditorial },
  { id: "northernGlow", name: "Northern Glow", category: "soft", config: soft.northernGlow },
  { id: "bladeRunner", name: "Blade Runner", category: "soft", config: cinematic.bladeRunner },
  { id: "prism", name: "Prism", category: "soft", config: abstract.prism },
  { id: "ocean", name: "Ocean", category: "soft", config: classic.ocean },
  { id: "lava", name: "Lava", category: "soft", config: classic.lava },
  { id: "sunset", name: "Sunset", category: "soft", config: classic.sunset },
  { id: "velvetCells", name: "Velvet Cells", category: "soft", config: soft.velvetCells },
  { id: "midnight", name: "Midnight", category: "soft", config: classic.midnight },
  { id: "northernLights", name: "Northern Lights", category: "soft", config: nature.northernLights },
  { id: "liquidGlass", name: "Liquid Glass", category: "soft", config: soft.liquidGlass },
  { id: "grainFlow", name: "Grain Flow", category: "texture", config: soft.grainFlow },
  { id: "newspaper", name: "Newspaper", category: "texture", config: dither.newspaper },
  { id: "stipple", name: "Stipple", category: "texture", config: dither.stipple },
  { id: "dissolve", name: "Dissolve", category: "texture", config: dither.dissolve },
  { id: "slitScan", name: "Slit Scan", category: "texture", config: glitch.slitScan },
  { id: "corruption", name: "Corruption", category: "texture", config: glitch.corruption },
  { id: "candy", name: "Candy", category: "archive", config: classic.candy },
  { id: "cyber", name: "Cyber", category: "archive", config: classic.cyber },
  { id: "monochrome", name: "Monochrome", category: "archive", config: classic.monochrome },
  { id: "morse", name: "Morse", category: "archive", config: dither.morse },
  { id: "retroCrt", name: "Retro CRT", category: "archive", config: scanline.retroCrt },
  { id: "broadcastSignal", name: "Broadcast Signal", category: "archive", config: scanline.broadcastSignal },
  { id: "vhs", name: "VHS", category: "archive", config: scanline.vhs },
  { id: "neonBars", name: "Neon Bars", category: "archive", config: scanline.neonBars },
  { id: "dataMosh", name: "Data Mosh", category: "archive", config: glitch.dataMosh },
  { id: "signalLoss", name: "Signal Loss", category: "archive", config: glitch.signalLoss },
  { id: "filmNoir", name: "Film Noir", category: "archive", config: cinematic.filmNoir },
  { id: "tron", name: "Tron", category: "archive", config: cinematic.tron },
  { id: "vaporwave", name: "Vaporwave", category: "archive", config: cinematic.vaporwave },
  { id: "deepSea", name: "Deep Sea", category: "archive", config: nature.deepSea },
  { id: "forestCanopy", name: "Forest Canopy", category: "archive", config: nature.forestCanopy },
  { id: "sandstorm", name: "Sandstorm", category: "archive", config: nature.sandstorm },
  { id: "liquidMetal", name: "Liquid Metal", category: "archive", config: abstract.liquidMetal },
  { id: "oilSlick", name: "Oil Slick", category: "archive", config: abstract.oilSlick },
  { id: "smoke", name: "Smoke", category: "archive", config: abstract.smoke },
];
