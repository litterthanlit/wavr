import {
  defaultSoftnessForGradientType,
  type GradientType,
  type LayerParams,
} from "@wavr/core";

export type GradientOption = {
  value: GradientType;
  label: string;
  group: "Premium" | "Core" | "Graphic / Legacy" | "Media";
};

export const PREMIUM_GRADIENT_TYPES: GradientType[] = [
  "silk",
  "aurora",
  "liquid",
  "softCells",
  "grainflow",
  "prismGlass",
  "neonTunnel",
];

export const RANDOM_GRADIENT_TYPES: LayerParams["gradientType"][] = [
  "mesh",
  "prismGlass",
  "neonTunnel",
  "silk",
  "aurora",
  "liquid",
  "softCells",
  "grainflow",
  "plasma",
  "dither",
];

export const COMMAND_GRADIENT_TYPES: Exclude<LayerParams["gradientType"], "image">[] = [
  "silk",
  "aurora",
  "liquid",
  "softCells",
  "grainflow",
  "prismGlass",
  "neonTunnel",
  "mesh",
  "plasma",
  "dither",
  "radial",
  "linear",
  "conic",
  "scanline",
  "glitch",
  "voronoi",
];

export const GRADIENT_OPTIONS: GradientOption[] = [
  { value: "silk", label: "Silk", group: "Premium" },
  { value: "aurora", label: "Aurora", group: "Premium" },
  { value: "liquid", label: "Liquid", group: "Premium" },
  { value: "softCells", label: "Soft Cells", group: "Premium" },
  { value: "grainflow", label: "Grainflow", group: "Premium" },
  { value: "prismGlass", label: "Prism Glass", group: "Premium" },
  { value: "neonTunnel", label: "Neon Tunnel", group: "Premium" },
  { value: "mesh", label: "Mesh", group: "Core" },
  { value: "plasma", label: "Plasma", group: "Core" },
  { value: "dither", label: "Dither", group: "Core" },
  { value: "radial", label: "Radial", group: "Graphic / Legacy" },
  { value: "linear", label: "Linear", group: "Graphic / Legacy" },
  { value: "conic", label: "Conic", group: "Graphic / Legacy" },
  { value: "scanline", label: "Scanline", group: "Graphic / Legacy" },
  { value: "glitch", label: "Glitch", group: "Graphic / Legacy" },
  { value: "voronoi", label: "Voronoi", group: "Graphic / Legacy" },
  { value: "image", label: "Image", group: "Media" },
];

export function defaultSoftnessForType(type: LayerParams["gradientType"]): number {
  return defaultSoftnessForGradientType(type);
}
