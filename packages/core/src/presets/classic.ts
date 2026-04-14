import { GradientConfig } from "../types";

export const aurora: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.0, 0.9, 0.8], [0.2, 0.8, 0.3], [0.3, 0.2, 0.7], [0.2, 0.4, 1.0]],
    complexity: 4,
    scale: 1.2,
    distortion: 0.35,
  }],
  saturation: 1.2,
  vignette: 0.2,
};

export const sunset: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[1.0, 0.5, 0.31], [1.0, 0.84, 0.0], [1.0, 0.65, 0.0], [0.94, 0.33, 0.48]],
    speed: 0.3,
    complexity: 3,
    distortion: 0.3,
  }],
  brightness: 1.1,
  saturation: 1.3,
  vignette: 0.3,
};

export const midnight: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.0, 0.0, 0.5], [0.29, 0.0, 0.51], [0.0, 0.8, 0.8], [0.0, 0.1, 0.4]],
    speed: 0.25,
    complexity: 4,
    scale: 1.3,
    distortion: 0.25,
  }],
  brightness: 0.8,
  grain: 0.08,
  vignette: 0.4,
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
};

export const ocean: GradientConfig = {
  layers: [{
    type: "linear",
    colors: [[0.0, 0.0, 1.0], [0.25, 0.41, 0.88], [0.53, 0.81, 0.92], [0.0, 0.5, 0.5]],
    speed: 0.35,
    complexity: 4,
    scale: 1.5,
    distortion: 0.4,
  }],
  brightness: 0.9,
  saturation: 1.2,
  vignette: 0.2,
};

export const lava: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[1.0, 0.0, 0.0], [1.0, 0.65, 0.0], [1.0, 0.84, 0.0], [0.55, 0.0, 0.0]],
    speed: 0.5,
    complexity: 5,
    distortion: 0.45,
  }],
  brightness: 1.2,
  saturation: 1.4,
  bloom: { enabled: true, intensity: 0.4 },
  grain: 0.06,
  vignette: 0.3,
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
};
