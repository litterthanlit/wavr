import { GradientConfig } from "../types";

export const northernLights: GradientConfig = {
  layers: [{
    type: "aurora",
    colors: [[0.01, 0.01, 0.05], [0.12, 0.08, 0.38], [0.1, 0.75, 0.6], [0.95, 0.5, 0.75]],
    speed: 0.2,
    complexity: 4,
    scale: 0.8,
    distortion: 0.55,
    softness: 0.8,
  }],
  realBloomEnabled: true,
  grain: 0.05,
  vignette: 0.3,
  oklabEnabled: true,
  toneMapMode: 2,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
};

export const deepSea: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.02, 0.05, 0.2], [0.05, 0.1, 0.35], [0.0, 0.65, 0.6], [0.01, 0.02, 0.08]],
    speed: 0.2,
    complexity: 4,
    scale: 1.3,
    distortion: 0.3,
  }],
  brightness: 0.7,
  saturation: 1.1,
  vignette: 0.35,
};

export const forestCanopy: GradientConfig = {
  layers: [{
    type: "linear",
    colors: [[0.13, 0.55, 0.13], [0.42, 0.56, 0.14], [0.85, 0.75, 0.2], [0.0, 0.39, 0.15]],
    speed: 0.3,
    complexity: 3,
    scale: 1.4,
    distortion: 0.25,
  }],
  brightness: 0.95,
  saturation: 1.1,
};

export const sandstorm: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.87, 0.77, 0.55], [0.7, 0.4, 0.2], [0.9, 0.6, 0.3], [0.55, 0.35, 0.2]],
    speed: 0.45,
    complexity: 6,
    scale: 1.1,
    distortion: 0.5,
  }],
  brightness: 1.1,
  grain: 0.08,
};
