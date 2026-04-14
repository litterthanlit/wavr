import { Preset } from "./index";

export const DITHER_PRESETS: Preset[] = [
  {
    name: "Newspaper",
    category: "dither",
    data: {
      gradientType: "dither", speed: 0.1, complexity: 2, scale: 1.5, distortion: 0.1,
      brightness: 1.05, saturation: 0.9,
      colors: [[0.15, 0.12, 0.1], [0.96, 0.94, 0.88]],
      grain: 0.05,
    },
  },
  {
    name: "Stipple",
    category: "dither",
    data: {
      gradientType: "dither", speed: 0.2, complexity: 4, scale: 0.8, distortion: 0.15,
      brightness: 1.0, saturation: 0.8,
      colors: [[0.25, 0.25, 0.28], [0.98, 0.98, 0.98]],
    },
  },
  {
    name: "Dissolve",
    category: "dither",
    data: {
      gradientType: "dither", speed: 0.5, complexity: 6, scale: 1.0, distortion: 0.4,
      brightness: 1.0, saturation: 1.2,
      colors: [[0.85, 0.15, 0.55], [0.0, 0.8, 0.75], [0.05, 0.05, 0.05]],
    },
  },
  {
    name: "Morse",
    category: "dither",
    data: {
      gradientType: "dither", speed: 0.3, complexity: 3, scale: 2.0, distortion: 0.2,
      brightness: 1.0, saturation: 1.0,
      colors: [[0.0, 0.85, 0.3], [0.02, 0.05, 0.02]],
      grain: 0.1, vignette: 0.3,
    },
  },
];
