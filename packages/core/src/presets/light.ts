import { LIGHT_GRADIENT_PALETTES } from "../layers";
import { GradientConfig } from "../types";

// The light modes (gradients.glsl, "Light gradients"). Their palettes run from
// the deepest shadow to the brightest light, so each preset carries one.

// Graphite and steel mirror metal.
export const liquidChrome: GradientConfig = {
  layers: [{
    type: "liquidChrome",
    colors: LIGHT_GRADIENT_PALETTES.liquidChrome,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0,
  }],
  grain: 0.04,
  vignette: 0.25,
};

export const goldChrome: GradientConfig = {
  layers: [{
    type: "liquidChrome",
    colors: [[0.039, 0.024, 0.012], [0.165, 0.102, 0.047], [0.478, 0.329, 0.125], [0.839, 0.635, 0.29], [1, 0.941, 0.8]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0,
  }],
  grain: 0.04,
  vignette: 0.25,
};

// Violet atmosphere over a dark planet, peach where the sun sits.
export const horizonGlow: GradientConfig = {
  layers: [{
    type: "horizonGlow",
    colors: LIGHT_GRADIENT_PALETTES.horizonGlow,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
  grain: 0.06,
};

export const iceHorizon: GradientConfig = {
  layers: [{
    type: "horizonGlow",
    colors: [[0.008, 0.024, 0.047], [0.039, 0.208, 0.345], [0.094, 0.643, 0.706], [0.886, 0.984, 1]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
  grain: 0.06,
};

export const inkSmoke: GradientConfig = {
  layers: [{
    type: "inkSmoke",
    colors: LIGHT_GRADIENT_PALETTES.inkSmoke,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.4,
    softness: 0,
  }],
  grain: 0.05,
  vignette: 0.2,
};

export const roseSmoke: GradientConfig = {
  layers: [{
    type: "inkSmoke",
    colors: [[0.039, 0.02, 0.031], [0.165, 0.063, 0.133], [0.549, 0.184, 0.369], [0.941, 0.541, 0.478], [1, 0.941, 0.902]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.4,
    softness: 0,
  }],
  grain: 0.05,
  vignette: 0.2,
};

export const plasmaOrb: GradientConfig = {
  layers: [{
    type: "plasmaOrb",
    colors: LIGHT_GRADIENT_PALETTES.plasmaOrb,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
};

export const limeOrb: GradientConfig = {
  layers: [{
    type: "plasmaOrb",
    colors: [[0.016, 0.071, 0.059], [0.059, 0.71, 0.627], [0.776, 0.957, 0.196], [0.957, 1, 0.816]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
};

// Its stops are shadow, then the film colours, then the pearl highlight.
export const iridescentFoil: GradientConfig = {
  layers: [{
    type: "iridescentFoil",
    colors: LIGHT_GRADIENT_PALETTES.iridescentFoil,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0,
  }],
  grain: 0.04,
  vignette: 0.2,
};

export const midnightFoil: GradientConfig = {
  layers: [{
    type: "iridescentFoil",
    colors: [[0.02, 0.043, 0.11], [0.498, 0.69, 1], [1, 0.886, 0.612], [0.498, 0.902, 0.949], [0.918, 0.957, 1]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0,
  }],
  grain: 0.04,
  vignette: 0.2,
};

// Heavy grain and ACES make it read as film.
export const lightLeak: GradientConfig = {
  layers: [{
    type: "lightLeak",
    colors: LIGHT_GRADIENT_PALETTES.lightLeak,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
  grain: 0.6,
  toneMapMode: 2,
};

export const violetLeak: GradientConfig = {
  layers: [{
    type: "lightLeak",
    colors: [[0.012, 0.004, 0.024], [0.165, 0.043, 0.29], [0.753, 0.165, 0.549], [1, 0.478, 0.416], [1, 0.89, 0.816]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
  grain: 0.6,
  toneMapMode: 2,
};
