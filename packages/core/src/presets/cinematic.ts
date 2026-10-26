import { GradientConfig } from "../types";

export const filmNoir: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.05, 0.05, 0.05], [0.25, 0.25, 0.25], [0.92, 0.9, 0.85], [0.12, 0.12, 0.14]],
    speed: 0.2,
    complexity: 3,
    scale: 1.3,
    distortion: 0.25,
  }],
  brightness: 0.85,
  saturation: 0.0,
  grain: 0.15,
  vignette: 0.5,
};

export const bladeRunner: GradientConfig = {
  layers: [{
    type: "neonTunnel",
    colors: [[0.02, 0.02, 0.08], [0.1, 0.08, 0.4], [1, 0.22, 0.52], [1, 0.6, 0.2]],
    speed: 0.3,
    complexity: 5,
    scale: 1,
    distortion: 0.3,
    softness: 0.6,
  }],
  realBloomEnabled: true,
  grain: 0.05,
  vignette: 0.35,
  oklabEnabled: true,
  toneMapMode: 2,
  // Stated explicitly so loading this preset in the editor switches these off.
  noise: { enabled: false, intensity: 0.3, scale: 1 },
  bloom: { enabled: false, intensity: 0.3 },
};

export const tron: GradientConfig = {
  layers: [{
    type: "radial",
    colors: [[0.0, 0.9, 1.0], [0.1, 0.3, 0.95], [0.02, 0.02, 0.05]],
    complexity: 4,
    scale: 1.2,
    distortion: 0.3,
  }],
  saturation: 1.4,
  bloom: { enabled: true, intensity: 0.6 },
  vignette: 0.2,
};

export const vaporwave: GradientConfig = {
  layers: [{
    type: "plasma",
    colors: [[1.0, 0.25, 0.65], [0.0, 0.95, 0.95], [0.55, 0.15, 0.9], [1.0, 0.75, 0.6]],
    speed: 0.5,
    complexity: 3,
    scale: 0.9,
    distortion: 0.2,
  }],
  brightness: 1.05,
  saturation: 1.6,
  hueShift: 30,
  chromaticAberration: 0.2,
  bloom: { enabled: true, intensity: 0.3 },
};
