/**
 * effects-catalog.ts — canonical list of toggleable effect entries.
 *
 * Single source of truth shared by:
 *   • AddEffectMenu (searchable picker at the top of EffectsPanel)
 *   • commands.ts (⌘K palette "Effects" group)
 *
 * A catalog entry is one row the user can pick to flip `*Enabled` on the
 * store. Sliders and sub-controls stay inside EffectsPanel — picking an entry
 * here just turns the effect on (or off, if already on). The user can then
 * tune it in the panel below.
 *
 * Ordering matches the visual grouping in EffectsPanel so the menu reads
 * top-to-bottom the same way the panel does.
 */
import type { GradientState } from "./store";

export type EffectFlag = Extract<
  keyof GradientState,
  | "debandEnabled"
  | "noiseEnabled"
  | "reactionDiffEnabled"
  | "bloomEnabled"
  | "realBloomEnabled"
  | "glowEnabled"
  | "causticEnabled"
  | "blurEnabled"
  | "curlEnabled"
  | "liquifyEnabled"
  | "kaleidoscopeEnabled"
  | "ditherEnabled"
  | "asciiEnabled"
  | "pixelSortEnabled"
  | "parallaxEnabled"
  | "threeDEnabled"
  | "meshDistortionEnabled"
  | "trailEnabled"
  | "rippleEnabled"
  | "feedbackEnabled"
  | "audioEnabled"
>;

export type EffectSection =
  | "Output quality"
  | "Texture"
  | "Lighting"
  | "Blur"
  | "Distortion"
  | "Stylize"
  | "3D Depth"
  | "Advanced"
  | "Audio";

export interface EffectEntry {
  flag: EffectFlag;
  label: string;
  section: EffectSection;
  keywords?: string[];
}

export const EFFECTS_CATALOG: EffectEntry[] = [
  { flag: "debandEnabled", label: "Anti-banding", section: "Output quality", keywords: ["deband", "dither", "quality", "8-bit"] },

  { flag: "noiseEnabled", label: "Noise Overlay", section: "Texture", keywords: ["noise", "grain", "texture"] },
  { flag: "reactionDiffEnabled", label: "Reaction-Diffusion", section: "Texture", keywords: ["reaction", "diffusion", "organic", "pattern"] },

  { flag: "bloomEnabled", label: "Bloom", section: "Lighting", keywords: ["glow", "highlight"] },
  { flag: "realBloomEnabled", label: "Real Bloom (GPU)", section: "Lighting", keywords: ["bloom", "gpu", "glow"] },
  { flag: "glowEnabled", label: "Soft Glow", section: "Lighting", keywords: ["glow", "halo", "bloom"] },
  { flag: "causticEnabled", label: "Caustics", section: "Lighting", keywords: ["caustic", "water", "light"] },

  { flag: "blurEnabled", label: "Gaussian Blur", section: "Blur", keywords: ["blur", "defocus", "soften"] },

  { flag: "curlEnabled", label: "Curl Noise", section: "Distortion", keywords: ["curl", "warp", "fluid"] },
  { flag: "liquifyEnabled", label: "Liquify", section: "Distortion", keywords: ["liquify", "warp", "smear"] },
  { flag: "kaleidoscopeEnabled", label: "Kaleidoscope", section: "Distortion", keywords: ["mirror", "symmetry", "radial"] },

  { flag: "ditherEnabled", label: "Dither", section: "Stylize", keywords: ["pixel", "ordered", "retro"] },
  { flag: "asciiEnabled", label: "ASCII", section: "Stylize", keywords: ["ascii", "text", "retro"] },
  { flag: "pixelSortEnabled", label: "Pixel Sort", section: "Stylize", keywords: ["glitch", "sort", "bands"] },

  { flag: "parallaxEnabled", label: "Parallax", section: "3D Depth", keywords: ["depth", "mouse", "3d"] },
  { flag: "threeDEnabled", label: "3D Shape", section: "3D Depth", keywords: ["3d", "sphere", "torus", "raymarch"] },
  { flag: "meshDistortionEnabled", label: "Mesh Distortion", section: "3D Depth", keywords: ["mesh", "3d", "vertex", "displace"] },

  { flag: "trailEnabled", label: "Mouse Trail", section: "Advanced", keywords: ["trail", "mouse", "cursor"] },
  { flag: "rippleEnabled", label: "Click Ripple", section: "Advanced", keywords: ["ripple", "click", "wave"] },
  { flag: "feedbackEnabled", label: "Feedback Loop", section: "Advanced", keywords: ["feedback", "echo", "trail", "fbo"] },

  { flag: "audioEnabled", label: "Audio Reactive", section: "Audio", keywords: ["audio", "music", "fft", "mic"] },
];

export const EFFECT_LABELS: Record<EffectFlag, string> = Object.fromEntries(
  EFFECTS_CATALOG.map((e) => [e.flag, e.label]),
) as Record<EffectFlag, string>;
