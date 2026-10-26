import { GradientConfig } from "../types";

export const aurora: GradientConfig = {
  layers: [{
    type: "aurora",
    colors: [[0.01, 0.02, 0.06], [0.02, 0.3, 0.32], [0.18, 0.92, 0.55], [0.78, 1, 0.86]],
    speed: 0.18,
    complexity: 6,
    scale: 1.3,
    distortion: 0.38,
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

export const sunset: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.08, 0.03, 0.16], [0.55, 0.1, 0.34], [1, 0.38, 0.24], [1, 0.78, 0.4]],
    speed: 0.22,
    complexity: 4,
    scale: 1.2,
    distortion: 0.4,
    softness: 0.75,
  }],
  grain: 0.05,
  vignette: 0.3,
  oklabEnabled: true,
  toneMapMode: 2,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
};

export const midnight: GradientConfig = {
  layers: [{
    type: "softCells",
    colors: [[0, 0, 0.03], [0.03, 0.05, 0.18], [0.12, 0.14, 0.5], [0.42, 0.5, 0.95]],
    speed: 0.15,
    complexity: 5,
    scale: 1.1,
    distortion: 0.3,
    softness: 0.9,
  }],
  brightness: 0.95,
  grain: 0.05,
  vignette: 0.45,
  oklabEnabled: true,
  toneMapMode: 2,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
};

export const candy: GradientConfig = {
  layers: [{
    type: "plasma",
    colors: [[1.0, 0.41, 0.71], [0.58, 0.0, 0.83], [0.0, 1.0, 1.0], [1.0, 1.0, 0.0]],
    speed: 0.6,
    complexity: 3,
    scale: 0.8,
    distortion: 0.2,
  }],
  brightness: 1.1,
  saturation: 1.4,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
  grain: 0,
  vignette: 0,
};

export const ocean: GradientConfig = {
  layers: [{
    type: "silk",
    colors: [[0, 0.02, 0.07], [0.02, 0.16, 0.38], [0.08, 0.55, 0.72], [0.78, 0.95, 0.98]],
    speed: 0.18,
    complexity: 3,
    scale: 0.7,
    distortion: 0.55,
    softness: 0.85,
  }],
  grain: 0.05,
  vignette: 0.3,
  oklabEnabled: true,
  toneMapMode: 2,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
};

export const lava: GradientConfig = {
  layers: [{
    type: "silk",
    colors: [[0.05, 0, 0.01], [0.55, 0.04, 0.03], [1, 0.36, 0.08], [1, 0.82, 0.5]],
    speed: 0.25,
    complexity: 5,
    scale: 1.1,
    distortion: 0.45,
    softness: 0.75,
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

export const cyber: GradientConfig = {
  layers: [{
    type: "conic",
    colors: [[0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [0.29, 0.0, 0.51], [0.2, 0.8, 0.4]],
    complexity: 3,
    scale: 1.2,
    distortion: 0.3,
  }],
  saturation: 1.3,
  vignette: 0.15,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
  grain: 0,
};

export const monochrome: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.2, 0.2, 0.2], [0.5, 0.5, 0.5], [0.95, 0.95, 0.95], [0.44, 0.5, 0.56]],
    speed: 0.3,
    complexity: 4,
    distortion: 0.3,
  }],
  saturation: 0.1,
  grain: 0.1,
  vignette: 0.25,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
};
