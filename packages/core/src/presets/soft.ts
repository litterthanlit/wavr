import { GradientConfig } from "../types";

export const silkEditorial: GradientConfig = {
  layers: [{
    type: "silk",
    colors: [[0.98, 0.78, 0.72], [0.8, 0.54, 0.86], [0.3, 0.25, 0.72], [0.04, 0.05, 0.1]],
    speed: 0.24,
    complexity: 5,
    scale: 1.15,
    distortion: 0.42,
    softness: 0.78,
  }],
  brightness: 1.05,
  saturation: 0.9,
  oklabEnabled: true,
  toneMapMode: 2,
  glow: { enabled: true, intensity: 0.22, radius: 0.04 },
  vignette: 0.18,
};

export const northernGlow: GradientConfig = {
  layers: [{
    type: "aurora",
    colors: [[0.04, 0.08, 0.16], [0.08, 0.72, 0.62], [0.38, 0.34, 1], [0.78, 0.95, 0.86]],
    speed: 0.2,
    complexity: 6,
    scale: 1.35,
    distortion: 0.4,
    softness: 0.74,
  }],
  brightness: 0.95,
  saturation: 1.25,
  bloom: { enabled: true, intensity: 0.24 },
  realBloomEnabled: true,
  vignette: 0.34,
};

export const liquidGlass: GradientConfig = {
  layers: [{
    type: "liquid",
    colors: [[0.93, 0.96, 1], [0.46, 0.63, 0.86], [0.12, 0.16, 0.25], [0.86, 0.9, 0.94]],
    speed: 0.28,
    complexity: 5,
    scale: 1,
    distortion: 0.48,
    softness: 0.68,
  }],
  brightness: 1.08,
  saturation: 0.72,
  glow: { enabled: true, intensity: 0.3, radius: 0.05 },
  caustic: { enabled: true, intensity: 0.28 },
  toneMapMode: 2,
};

export const velvetCells: GradientConfig = {
  layers: [{
    type: "softCells",
    colors: [[0.03, 0.02, 0.08], [0.18, 0.18, 0.48], [0.68, 0.34, 0.9], [0.96, 0.44, 0.62]],
    speed: 0.18,
    complexity: 6,
    scale: 1.45,
    distortion: 0.34,
    softness: 0.82,
  }],
  brightness: 0.9,
  saturation: 1.1,
  parallax: { enabled: true, strength: 0.3 },
  vignette: 0.38,
};

export const grainFlow: GradientConfig = {
  layers: [{
    type: "grainflow",
    colors: [[0.98, 0.86, 0.38], [0.95, 0.31, 0.28], [0.12, 0.11, 0.16], [0.94, 0.95, 0.88]],
    speed: 0.34,
    complexity: 5,
    scale: 1.05,
    distortion: 0.44,
    softness: 0.5,
  }],
  brightness: 1.02,
  saturation: 1.15,
  grain: 0.08,
  dither: { enabled: true, size: 4 },
  vignette: 0.24,
};
