import { LIGHT_FIELD_PALETTES, LIGHT_GRADIENT_PALETTES } from "../layers";
import { GradientConfig } from "../types";

// The light fields (gradients.glsl, "Light fields"): coloured light in a
// space. They roll their own light toward white, so they turn the global tone
// map off (its shoulder would dim their most saturated colours), and most use
// the cinematic bloom for the glare a camera sees around light. Their colours
// are Display P3: on a wide-gamut screen they reach saturation sRGB can't, and
// elsewhere they show as the nearest sRGB colours. On an HDR screen their
// light shines brighter than white (hdrHeadroom), by as much as the frame
// carries: a screen holds a small bright area far brighter than a full one, so
// a loop of light in a dark room gets two stops, an opening in a wall one and
// a half, and a room or wall of light, the whole frame, one.

// A tall opening in a slate wall: pale at its edges, through magenta and
// violet to a cornflower core.
export const aperture: GradientConfig = {
  layers: [{
    type: "aperture",
    colors: LIGHT_FIELD_PALETTES.aperture,
    speed: 0.3,
    complexity: 2,
    scale: 1.15,
    distortion: 0.12,
    softness: 0.9,
  }],
  grain: 0.03,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: true,
};

// A crisp cobalt core inside a cream rim, in a grey wall.
export const cobaltAperture: GradientConfig = {
  layers: [{
    type: "aperture",
    colors: [[0.464, 0.436, 0.468], [0.007, 0.436, 0.936], [0.959, 0.936, 0.796]],
    speed: 0.3,
    complexity: 3,
    scale: 0.95,
    distortion: 0.06,
    softness: 0.12,
  }],
  grain: 0.03,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: true,
};

// A wide opening of ember light in a dark room, haze carrying it onto the wall.
export const duskAperture: GradientConfig = {
  layers: [{
    type: "aperture",
    colors: [[0.1, 0.06, 0.12], [0.92, 0.3, 0.2], [1, 0.55, 0.33], [1, 0.86, 0.66]],
    speed: 0.3,
    complexity: 5,
    scale: 0.9,
    distortion: 0.35,
    softness: 0.8,
  }],
  grain: 0.04,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: true,
};

// A room filled with cyan light and fog; a band of pink light hangs in it and
// turns the fog around it violet.
export const ganzfeld: GradientConfig = {
  layers: [{
    type: "aperture",
    colors: [[0.136, 0.776, 0.967], [0.866, 0.411, 0.666], [0.93, 0.5, 0.72]],
    speed: 0.3,
    complexity: 7,
    scale: 0.34,
    distortion: 1,
    softness: 0.4,
  }],
  grain: 0.03,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1,
};

// A loop of rose light in a dark, hazy room; its ends burn white.
export const halo: GradientConfig = {
  layers: [{
    type: "halo",
    colors: LIGHT_GRADIENT_PALETTES.halo,
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
  grain: 0.08,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 2,
  realBloomEnabled: true,
};

export const iceHalo: GradientConfig = {
  layers: [{
    type: "halo",
    colors: [[0.01, 0.01, 0.03], [0.07, 0.06, 0.25], [0.25, 0.2, 0.75], [0.55, 0.5, 1], [0.92, 0.93, 1]],
    speed: 0.4,
    complexity: 1,
    scale: 1,
    distortion: 0.6,
    softness: 1,
  }],
  grain: 0.05,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 2,
  realBloomEnabled: true,
};

// Blue light pouring out in fine streamers round a dark eye, like a long
// exposure through ribbed glass.
export const corona: GradientConfig = {
  layers: [{
    type: "corona",
    colors: LIGHT_GRADIENT_PALETTES.corona,
    speed: 0.4,
    complexity: 6,
    scale: 1,
    distortion: 0.3,
    softness: 0.3,
  }],
  grain: 0.08,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: true,
};

// The corona close up: pale streamers hanging as curtains either side of the
// dark.
export const iceVeil: GradientConfig = {
  layers: [{
    type: "corona",
    colors: [[0.006, 0.008, 0.016], [0.035, 0.07, 0.16], [0.18, 0.34, 0.62], [0.5, 0.68, 0.9], [0.82, 0.9, 0.98], [0.98, 0.99, 1]],
    speed: 0.4,
    complexity: 6,
    scale: 2.5,
    distortion: 0.5,
    softness: 0.55,
  }],
  grain: 0.08,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: true,
};

// Magenta, coral and lavender light drifting behind frosted glass.
export const lightWall: GradientConfig = {
  layers: [{
    type: "lightWall",
    colors: LIGHT_FIELD_PALETTES.lightWall,
    speed: 0.4,
    complexity: 5,
    scale: 1,
    distortion: 0.4,
    softness: 0.6,
  }],
  grain: 0.04,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1,
};

export const lagoonWall: GradientConfig = {
  layers: [{
    type: "lightWall",
    colors: [[0.05, 0.12, 0.35], [0.1, 0.45, 0.95], [0.2, 0.85, 0.9], [0.55, 0.4, 1]],
    speed: 0.4,
    complexity: 4,
    scale: 1,
    distortion: 0.5,
    softness: 0.8,
  }],
  grain: 0.04,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1,
  realBloomEnabled: true,
};
