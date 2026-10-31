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
  flag("Noise overlay", "noiseEnabled"),
  flag("Reaction-diffusion", "reactionDiffEnabled"),
  flag("Classic bloom", "bloomEnabled"),
  flag("Soft glow", "glowEnabled"),
  flag("Caustics", "causticEnabled"),
  { label: "Radial blur", isOn: (state) => state.radialBlurAmount > 0, off: { radialBlurAmount: 0 } },
  flag("Curl noise", "curlEnabled"),
  flag("Liquify", "liquifyEnabled"),
  flag("Kaleidoscope", "kaleidoscopeEnabled"),
  flag("Dither", "ditherEnabled"),
  flag("ASCII", "asciiEnabled"),
  flag("Pixel sort", "pixelSortEnabled"),
  flag("Parallax", "parallaxEnabled"),
  flag("Mesh distortion", "meshDistortionEnabled"),
  flag("Shader shape projection", "threeDEnabled"),
  flag("Feedback loop", "feedbackEnabled"),
  value("Brightness", "brightness", 1),
  value("Saturation", "saturation", 1),
  value("Hue shift", "hueShift", 0),
  value("Chromatic aberration", "chromaticAberration", 0),
  flag("Blur", "blurEnabled"),
  flag("Click ripple", "rippleEnabled"),
  flag("Mouse trail", "trailEnabled"),
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
    label: "Texture overlay",
    isOn: (layer) => layer.gradientType !== "image" && layer.imageData !== null,
    clear: () => ({ imageData: null }),
  },
  {
    label: "Distortion map",
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
