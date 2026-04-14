import { Preset } from "./index";

export const NATURE_PRESETS: Preset[] = [
  {
    name: "Northern Lights",
    category: "nature",
    data: {
      gradientType: "mesh", speed: 0.25, complexity: 5, scale: 1.5, distortion: 0.35,
      brightness: 0.9, saturation: 1.2,
      colors: [[0.1, 0.85, 0.4], [0.0, 0.75, 0.7], [0.4, 0.15, 0.7], [0.15, 0.35, 0.9]],
      vignette: 0.2,
    },
  },
  {
    name: "Deep Sea",
    category: "nature",
    data: {
      gradientType: "mesh", speed: 0.2, complexity: 4, scale: 1.3, distortion: 0.3,
      brightness: 0.7, saturation: 1.1,
      colors: [[0.02, 0.05, 0.2], [0.05, 0.1, 0.35], [0.0, 0.65, 0.6], [0.01, 0.02, 0.08]],
      vignette: 0.35,
    },
  },
  {
    name: "Forest Canopy",
    category: "nature",
    data: {
      gradientType: "linear", speed: 0.3, complexity: 3, scale: 1.4, distortion: 0.25,
      brightness: 0.95, saturation: 1.1,
      colors: [[0.13, 0.55, 0.13], [0.42, 0.56, 0.14], [0.85, 0.75, 0.2], [0.0, 0.39, 0.15]],
    },
  },
  {
    name: "Sandstorm",
    category: "nature",
    data: {
      gradientType: "mesh", speed: 0.45, complexity: 6, scale: 1.1, distortion: 0.5,
      brightness: 1.1, saturation: 1.0,
      colors: [[0.87, 0.77, 0.55], [0.7, 0.4, 0.2], [0.9, 0.6, 0.3], [0.55, 0.35, 0.2]],
      grain: 0.08,
    },
  },
];
