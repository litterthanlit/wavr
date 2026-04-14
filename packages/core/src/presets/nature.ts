import { GradientConfig } from "../types";

export const northernLights: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.1, 0.85, 0.4], [0.0, 0.75, 0.7], [0.4, 0.15, 0.7], [0.15, 0.35, 0.9]],
    speed: 0.25,
    complexity: 5,
    scale: 1.5,
    distortion: 0.35,
  }],
  brightness: 0.9,
  saturation: 1.2,
  vignette: 0.2,
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
