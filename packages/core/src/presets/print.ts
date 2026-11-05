import { PRINT_PALETTES } from "../layers";
import { GradientConfig } from "../types";

// Airbrushed prints: ink sprayed across a sheet of paper, the last stop the
// paper itself. Printed colour, so no tone map; the stipple is their own grain.
export const paper: GradientConfig = {
  layers: [{
    type: "paper",
    colors: PRINT_PALETTES.paper,
    speed: 0.4,
    complexity: 2,
    scale: 1,
    distortion: 0.4,
    softness: 0.4,
  }],
  toneMapMode: 0,
};

// Blue deepening to slate at a tape edge, then sprayed again and thinned out.
export const indigoPrint: GradientConfig = {
  layers: [{
    type: "paper",
    colors: [[0.33, 0.6, 0.85], [0.42, 0.52, 0.68], [0.2, 0.24, 0.35], [0.3, 0.6, 0.86], [0.74, 0.84, 0.94], [0.93, 0.92, 0.89]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.4,
    softness: 0.4,
  }],
  toneMapMode: 0,
};

// Ink to rose and a band of vermilion, cut by a tape edge.
export const rosePrint: GradientConfig = {
  layers: [{
    type: "paper",
    colors: [[0.24, 0.24, 0.34], [0.48, 0.34, 0.52], [0.87, 0.4, 0.62], [0.96, 0.45, 0.32], [0.93, 0.62, 0.78], [0.95, 0.92, 0.88]],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.4,
    softness: 0.5,
  }],
  toneMapMode: 0,
};
