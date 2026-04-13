import { Preset } from "./index";

export const SCANLINE_PRESETS: Preset[] = [
  {
    name: "Retro CRT",
    category: "scanline",
    data: {
      gradientType: "scanline", speed: 0.3, complexity: 4, scale: 1.2, distortion: 0.3,
      brightness: 1.0, saturation: 1.1,
      colors: [[0.9, 0.15, 0.15], [0.15, 0.85, 0.15], [0.2, 0.3, 0.95], [0.95, 0.85, 0.2]],
      grain: 0.08, vignette: 0.4,
    },
  },
  {
    name: "Broadcast Signal",
    category: "scanline",
    data: {
      gradientType: "scanline", speed: 0.15, complexity: 6, scale: 1.0, distortion: 0.15,
      brightness: 1.0, saturation: 1.2,
      colors: [[0.95, 0.95, 0.95], [0.95, 0.95, 0.0], [0.0, 0.95, 0.95], [0.0, 0.95, 0.0], [0.95, 0.0, 0.95], [0.95, 0.0, 0.0], [0.0, 0.0, 0.95]],
      chromaticAberration: 0.3,
    },
  },
  {
    name: "VHS",
    category: "scanline",
    data: {
      gradientType: "scanline", speed: 0.4, complexity: 3, scale: 1.5, distortion: 0.5,
      brightness: 0.95, saturation: 0.9,
      colors: [[0.85, 0.55, 0.7], [0.5, 0.6, 0.9], [0.75, 0.65, 0.85]],
      grain: 0.12, chromaticAberration: 0.5,
    },
  },
  {
    name: "Neon Bars",
    category: "scanline",
    data: {
      gradientType: "scanline", speed: 0.6, complexity: 5, scale: 0.8, distortion: 0.25,
      brightness: 1.1, saturation: 1.5,
      colors: [[1.0, 0.2, 0.6], [0.0, 1.0, 1.0], [0.5, 1.0, 0.0], [1.0, 1.0, 0.0]],
      bloomEnabled: true, bloomIntensity: 0.5,
    },
  },
];
