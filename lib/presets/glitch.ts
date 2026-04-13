import { Preset } from "./index";

export const GLITCH_PRESETS: Preset[] = [
  {
    name: "Data Mosh",
    category: "glitch",
    data: {
      gradientType: "glitch", speed: 0.5, complexity: 7, scale: 1.0, distortion: 0.7,
      brightness: 1.0, saturation: 1.2,
      colors: [[0.95, 0.1, 0.15], [0.1, 0.3, 0.95], [0.0, 0.95, 0.4], [0.95, 0.95, 0.95]],
      chromaticAberration: 0.6,
    },
  },
  {
    name: "Slit Scan",
    category: "glitch",
    data: {
      gradientType: "glitch", speed: 0.3, complexity: 2, scale: 1.2, distortion: 0.3,
      brightness: 0.95, saturation: 1.1,
      colors: [[0.3, 0.35, 0.9], [0.55, 0.25, 0.85], [0.2, 0.5, 0.95], [0.15, 0.2, 0.5]],
      vignette: 0.15,
    },
  },
  {
    name: "Corruption",
    category: "glitch",
    data: {
      gradientType: "glitch", speed: 0.8, complexity: 8, scale: 0.8, distortion: 0.8,
      brightness: 1.1, saturation: 1.3,
      colors: [[0.0, 0.95, 0.2], [0.0, 0.0, 0.0], [0.95, 0.95, 0.95]],
      pixelSortEnabled: true, pixelSortIntensity: 0.6, pixelSortThreshold: 0.4,
    },
  },
  {
    name: "Signal Loss",
    category: "glitch",
    data: {
      gradientType: "glitch", speed: 0.2, complexity: 5, scale: 1.5, distortion: 0.5,
      brightness: 0.9, saturation: 0.3,
      colors: [[0.5, 0.5, 0.52], [0.3, 0.3, 0.32], [0.75, 0.75, 0.77], [0.15, 0.15, 0.18]],
      grain: 0.15,
    },
  },
];
