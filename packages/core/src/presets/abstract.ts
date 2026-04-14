import { GradientConfig } from "../types";

export const liquidMetal: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.78, 0.78, 0.8], [0.55, 0.62, 0.75], [0.95, 0.95, 0.97], [0.3, 0.3, 0.35]],
    complexity: 5,
    distortion: 0.4,
  }],
  brightness: 1.2,
  saturation: 0.3,
  bloom: { enabled: true, intensity: 0.3 },
};

export const oilSlick: GradientConfig = {
  layers: [{
    type: "conic",
    colors: [[0.5, 0.1, 0.7], [0.0, 0.7, 0.65], [0.85, 0.7, 0.1], [0.9, 0.15, 0.55], [0.15, 0.75, 0.3]],
    speed: 0.35,
    complexity: 4,
    scale: 1.2,
    distortion: 0.35,
  }],
  saturation: 1.3,
};

export const prism: GradientConfig = {
  layers: [{
    type: "linear",
    colors: [[0.95, 0.1, 0.1], [1.0, 0.55, 0.0], [1.0, 1.0, 0.0], [0.0, 0.85, 0.2], [0.1, 0.3, 0.95], [0.5, 0.0, 0.8]],
    speed: 0.3,
    complexity: 2,
    distortion: 0.15,
  }],
  brightness: 1.1,
  saturation: 1.5,
  bloom: { enabled: true, intensity: 0.2 },
};

export const smoke: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.3, 0.3, 0.32], [0.15, 0.15, 0.17], [0.7, 0.7, 0.72], [0.95, 0.95, 0.95]],
    speed: 0.2,
    complexity: 6,
    scale: 1.5,
    distortion: 0.35,
  }],
  saturation: 0.1,
  vignette: 0.3,
};
