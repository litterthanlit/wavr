import { Preset } from "./index";

export const CINEMATIC_PRESETS: Preset[] = [
  {
    name: "Film Noir",
    category: "cinematic",
    data: {
      gradientType: "mesh", speed: 0.2, complexity: 3, scale: 1.3, distortion: 0.25,
      brightness: 0.85, saturation: 0.0,
      colors: [[0.05, 0.05, 0.05], [0.25, 0.25, 0.25], [0.92, 0.9, 0.85], [0.12, 0.12, 0.14]],
      grain: 0.15, vignette: 0.5,
    },
  },
  {
    name: "Blade Runner",
    category: "cinematic",
    data: {
      gradientType: "mesh", speed: 0.35, complexity: 5, scale: 1.0, distortion: 0.4,
      brightness: 1.0, saturation: 1.2,
      colors: [[1.0, 0.2, 0.55], [0.05, 0.1, 0.45], [1.0, 0.55, 0.1], [0.0, 0.7, 0.7]],
      bloomEnabled: true, bloomIntensity: 0.5, chromaticAberration: 0.3,
      grain: 0.06, vignette: 0.3,
    },
  },
  {
    name: "Tron",
    category: "cinematic",
    data: {
      gradientType: "radial", speed: 0.4, complexity: 4, scale: 1.2, distortion: 0.3,
      brightness: 1.0, saturation: 1.4,
      colors: [[0.0, 0.9, 1.0], [0.1, 0.3, 0.95], [0.02, 0.02, 0.05]],
      bloomEnabled: true, bloomIntensity: 0.6, vignette: 0.2,
    },
  },
  {
    name: "Vaporwave",
    category: "cinematic",
    data: {
      gradientType: "plasma", speed: 0.5, complexity: 3, scale: 0.9, distortion: 0.2,
      brightness: 1.05, saturation: 1.6,
      colors: [[1.0, 0.25, 0.65], [0.0, 0.95, 0.95], [0.55, 0.15, 0.9], [1.0, 0.75, 0.6]],
      hueShift: 30, chromaticAberration: 0.2,
      bloomEnabled: true, bloomIntensity: 0.3,
    },
  },
];
