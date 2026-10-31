import type { LayerParams } from "@wavr/core";
import type { GradientState } from "./store";
import { maskMode } from "./layer-mask";

export interface SceneExtra {
  label: string;
  isOn: (state: GradientState) => boolean;
  off: Partial<GradientState>;
}

type Flag = { [K in keyof GradientState]: GradientState[K] extends boolean ? K : never }[keyof GradientState];

const flag = (label: string, key: Flag): SceneExtra => ({
  label,
  isOn: (state) => state[key],
  off: { [key]: false },
});

type Amount = { [K in keyof GradientState]: GradientState[K] extends number ? K : never }[keyof GradientState];

const value = (label: string, key: Amount, rest: number): SceneExtra => ({
  label,
  isOn: (state) => state[key] !== rest,
  off: { [key]: rest },
});

export const SCENE_EXTRAS: readonly SceneExtra[] = [
  flag("Noise Overlay", "noiseEnabled"),
  flag("Reaction-Diffusion", "reactionDiffEnabled"),
  flag("Classic Bloom", "bloomEnabled"),
  flag("Soft Glow", "glowEnabled"),
  flag("Caustics", "causticEnabled"),
  { label: "Radial Blur", isOn: (state) => state.radialBlurAmount > 0, off: { radialBlurAmount: 0 } },
  flag("Curl Noise", "curlEnabled"),
  flag("Liquify", "liquifyEnabled"),
  flag("Kaleidoscope", "kaleidoscopeEnabled"),
  flag("Dither", "ditherEnabled"),
  flag("ASCII", "asciiEnabled"),
  flag("Pixel Sort", "pixelSortEnabled"),
  flag("Parallax", "parallaxEnabled"),
  flag("Mesh Distortion", "meshDistortionEnabled"),
  flag("Shader Shape Projection", "threeDEnabled"),
  flag("Feedback Loop", "feedbackEnabled"),
  value("Brightness", "brightness", 1),
  value("Saturation", "saturation", 1),
  value("Hue Shift", "hueShift", 0),
  value("Chromatic Aberration", "chromaticAberration", 0),
  flag("Blur", "blurEnabled"),
  flag("Click Ripple", "rippleEnabled"),
  flag("Mouse Trail", "trailEnabled"),
];

export function sceneExtrasOn(state: GradientState): SceneExtra[] {
  return SCENE_EXTRAS.filter((extra) => extra.isOn(state));
}

export interface LayerExtra {
  label: string;
  isOn: (layer: LayerParams) => boolean;
  clear: (layer: LayerParams) => Partial<LayerParams>;
}

export const LAYER_EXTRAS: readonly LayerExtra[] = [
  {
    label: "Texture Overlay",
    isOn: (layer) => layer.gradientType !== "image" && layer.imageData !== null,
    clear: () => ({ imageData: null }),
  },
  {
    label: "Distortion Map",
    isOn: (layer) => layer.distortionMapEnabled,
    clear: () => ({ distortionMapEnabled: false, distortionMapData: null }),
  },
  {
    label: "Mask 2",
    isOn: (layer) => maskMode(layer) === "shape" && layer.mask2.shape !== "none",
    clear: (layer) => ({ mask2: { ...layer.mask2, shape: "none" } }),
  },
];

export function layerExtrasOn(layer: LayerParams): LayerExtra[] {
  return LAYER_EXTRAS.filter((extra) => extra.isOn(layer));
}
