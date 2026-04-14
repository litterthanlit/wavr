import { GradientConfig } from "../types";

export const dataMosh: GradientConfig = {
  layers: [{
    type: "glitch",
    colors: [[0.95, 0.1, 0.15], [0.1, 0.3, 0.95], [0.0, 0.95, 0.4], [0.95, 0.95, 0.95]],
    speed: 0.5,
    complexity: 7,
    distortion: 0.7,
  }],
  saturation: 1.2,
  chromaticAberration: 0.6,
};

export const slitScan: GradientConfig = {
  layers: [{
    type: "glitch",
    colors: [[0.3, 0.35, 0.9], [0.55, 0.25, 0.85], [0.2, 0.5, 0.95], [0.15, 0.2, 0.5]],
    speed: 0.3,
    complexity: 2,
    scale: 1.2,
    distortion: 0.3,
  }],
  brightness: 0.95,
  saturation: 1.1,
  vignette: 0.15,
};

export const corruption: GradientConfig = {
  layers: [{
    type: "glitch",
    colors: [[0.0, 0.95, 0.2], [0.0, 0.0, 0.0], [0.95, 0.95, 0.95]],
    speed: 0.8,
    complexity: 8,
    scale: 0.8,
    distortion: 0.8,
  }],
  brightness: 1.1,
  saturation: 1.3,
  pixelSort: { enabled: true, intensity: 0.6, threshold: 0.4 },
};

export const signalLoss: GradientConfig = {
  layers: [{
    type: "glitch",
    colors: [[0.5, 0.5, 0.52], [0.3, 0.3, 0.32], [0.75, 0.75, 0.77], [0.15, 0.15, 0.18]],
    speed: 0.2,
    complexity: 5,
    scale: 1.5,
    distortion: 0.5,
  }],
  brightness: 0.9,
  saturation: 0.3,
  grain: 0.15,
};
