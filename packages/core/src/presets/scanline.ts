import { GradientConfig } from "../types";

export const retroCrt: GradientConfig = {
  layers: [{
    type: "scanline",
    colors: [[0.9, 0.15, 0.15], [0.15, 0.85, 0.15], [0.2, 0.3, 0.95], [0.95, 0.85, 0.2]],
    speed: 0.3,
    complexity: 4,
    scale: 1.2,
    distortion: 0.3,
  }],
  saturation: 1.1,
  grain: 0.08,
  vignette: 0.4,
};

export const broadcastSignal: GradientConfig = {
  layers: [{
    type: "scanline",
    colors: [[0.95, 0.95, 0.95], [0.95, 0.95, 0.0], [0.0, 0.95, 0.95], [0.0, 0.95, 0.0], [0.95, 0.0, 0.95], [0.95, 0.0, 0.0], [0.0, 0.0, 0.95]],
    speed: 0.15,
    complexity: 6,
    distortion: 0.15,
  }],
  saturation: 1.2,
  chromaticAberration: 0.3,
};

export const vhs: GradientConfig = {
  layers: [{
    type: "scanline",
    colors: [[0.85, 0.55, 0.7], [0.5, 0.6, 0.9], [0.75, 0.65, 0.85]],
    speed: 0.4,
    complexity: 3,
    scale: 1.5,
    distortion: 0.5,
  }],
  brightness: 0.95,
  saturation: 0.9,
  grain: 0.12,
  chromaticAberration: 0.5,
};

export const neonBars: GradientConfig = {
  layers: [{
    type: "scanline",
    colors: [[1.0, 0.2, 0.6], [0.0, 1.0, 1.0], [0.5, 1.0, 0.0], [1.0, 1.0, 0.0]],
    speed: 0.6,
    complexity: 5,
    scale: 0.8,
    distortion: 0.25,
  }],
  brightness: 1.1,
  saturation: 1.5,
  bloom: { enabled: true, intensity: 0.5 },
};
