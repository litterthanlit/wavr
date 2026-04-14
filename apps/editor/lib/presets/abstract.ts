import { Preset } from "./index";

export const ABSTRACT_PRESETS: Preset[] = [
  {
    name: "Liquid Metal",
    category: "abstract",
    data: {
      gradientType: "mesh", speed: 0.4, complexity: 5, scale: 1.0, distortion: 0.4,
      brightness: 1.2, saturation: 0.3,
      colors: [[0.78, 0.78, 0.8], [0.55, 0.62, 0.75], [0.95, 0.95, 0.97], [0.3, 0.3, 0.35]],
      bloomEnabled: true, bloomIntensity: 0.3,
    },
  },
  {
    name: "Oil Slick",
    category: "abstract",
    data: {
      gradientType: "conic", speed: 0.35, complexity: 4, scale: 1.2, distortion: 0.35,
      brightness: 1.0, saturation: 1.3,
      colors: [[0.5, 0.1, 0.7], [0.0, 0.7, 0.65], [0.85, 0.7, 0.1], [0.9, 0.15, 0.55], [0.15, 0.75, 0.3]],
    },
  },
  {
    name: "Prism",
    category: "abstract",
    data: {
      gradientType: "linear", speed: 0.3, complexity: 2, scale: 1.0, distortion: 0.15,
      brightness: 1.1, saturation: 1.5,
      colors: [[0.95, 0.1, 0.1], [1.0, 0.55, 0.0], [1.0, 1.0, 0.0], [0.0, 0.85, 0.2], [0.1, 0.3, 0.95], [0.5, 0.0, 0.8]],
      bloomEnabled: true, bloomIntensity: 0.2,
    },
  },
  {
    name: "Smoke",
    category: "abstract",
    data: {
      gradientType: "mesh", speed: 0.2, complexity: 6, scale: 1.5, distortion: 0.35,
      brightness: 1.0, saturation: 0.1,
      colors: [[0.3, 0.3, 0.32], [0.15, 0.15, 0.17], [0.7, 0.7, 0.72], [0.95, 0.95, 0.95]],
      vignette: 0.3,
    },
  },
];
