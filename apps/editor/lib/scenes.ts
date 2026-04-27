import type { GradientState } from "@/lib/store";

type SceneData = Partial<Omit<GradientState,
  | "set"
  | "setDiscrete"
  | "commitSet"
  | "setColor"
  | "addColor"
  | "removeColor"
  | "loadPreset"
  | "randomize"
>>;

export interface Scene {
  name: string;
  tagline: string;
  useCase: string;
  mood: string;
  colors: string[];
  data: SceneData;
}

export const SCENES: Scene[] = [
  {
    name: "Liquid Chrome Hero",
    tagline: "Premium reflective motion for launch pages and product reveals.",
    useCase: "SaaS hero",
    mood: "Metallic",
    colors: ["#f3f4f6", "#9ca3af", "#111827", "#60a5fa"],
    data: {
      gradientType: "liquid",
      speed: 0.32,
      complexity: 6,
      scale: 0.92,
      distortion: 0.46,
      softness: 0.64,
      brightness: 1.16,
      saturation: 0.34,
      colors: [[0.95, 0.96, 0.98], [0.58, 0.64, 0.75], [0.07, 0.08, 0.12], [0.38, 0.64, 0.94]],
      bloomEnabled: true,
      bloomIntensity: 0.24,
      realBloomEnabled: true,
      glowEnabled: true,
      glowIntensity: 0.32,
      glowRadius: 0.04,
      oklabEnabled: true,
      toneMapMode: 2,
      vignette: 0.18,
    },
  },
  {
    name: "Aurora Launch",
    tagline: "Soft atmospheric waves with enough energy for a first viewport.",
    useCase: "Landing page",
    mood: "Luminous",
    colors: ["#22c55e", "#14b8a6", "#4f46e5", "#020617"],
    data: {
      gradientType: "aurora",
      speed: 0.22,
      complexity: 5,
      scale: 1.45,
      distortion: 0.36,
      softness: 0.74,
      brightness: 0.95,
      saturation: 1.2,
      colors: [[0.13, 0.77, 0.37], [0.08, 0.72, 0.65], [0.31, 0.27, 0.9], [0.01, 0.02, 0.09]],
      bloomEnabled: true,
      bloomIntensity: 0.28,
      glowEnabled: true,
      glowIntensity: 0.25,
      vignette: 0.24,
      parallaxEnabled: true,
      parallaxStrength: 0.32,
    },
  },
  {
    name: "Data Veil",
    tagline: "Textured signal motion for AI, infra, and developer-tool pages.",
    useCase: "AI product",
    mood: "Electric",
    colors: ["#22d3ee", "#2563eb", "#a855f7", "#020617"],
    data: {
      gradientType: "grainflow",
      speed: 0.48,
      complexity: 7,
      scale: 0.92,
      distortion: 0.58,
      softness: 0.52,
      brightness: 1.04,
      saturation: 1.35,
      colors: [[0.13, 0.83, 0.93], [0.15, 0.39, 0.92], [0.66, 0.33, 0.97], [0.01, 0.02, 0.09]],
      chromaticAberration: 0.34,
      bloomEnabled: true,
      bloomIntensity: 0.36,
      pixelSortEnabled: true,
      pixelSortIntensity: 0.28,
      pixelSortThreshold: 0.45,
      vignette: 0.25,
    },
  },
  {
    name: "Glass Caustics",
    tagline: "Watery refractions for luxury pages, spatial UI, and editorial moments.",
    useCase: "Portfolio",
    mood: "Fluid",
    colors: ["#67e8f9", "#0f766e", "#334155", "#f8fafc"],
    data: {
      gradientType: "silk",
      speed: 0.26,
      complexity: 5,
      scale: 1.25,
      distortion: 0.42,
      softness: 0.76,
      brightness: 1.08,
      saturation: 0.95,
      colors: [[0.4, 0.91, 0.98], [0.06, 0.46, 0.43], [0.2, 0.25, 0.33], [0.97, 0.98, 0.99]],
      causticEnabled: true,
      causticIntensity: 0.62,
      liquifyEnabled: true,
      liquifyIntensity: 0.38,
      liquifyScale: 2.6,
      glowEnabled: true,
      glowIntensity: 0.24,
      vignette: 0.16,
    },
  },
  {
    name: "Signal Poster",
    tagline: "A bold animated poster treatment with texture and scanline character.",
    useCase: "Campaign",
    mood: "Graphic",
    colors: ["#ef4444", "#facc15", "#111827", "#f8fafc"],
    data: {
      gradientType: "grainflow",
      speed: 0.36,
      complexity: 4,
      scale: 1.1,
      distortion: 0.34,
      softness: 0.38,
      brightness: 1.05,
      saturation: 1.25,
      colors: [[0.94, 0.27, 0.27], [0.98, 0.8, 0.08], [0.07, 0.08, 0.12], [0.97, 0.98, 0.99]],
      grain: 0.12,
      ditherEnabled: true,
      ditherSize: 3,
      bloomEnabled: true,
      bloomIntensity: 0.18,
      vignette: 0.28,
    },
  },
  {
    name: "Deep Space Field",
    tagline: "Slow parallax color fields for immersive product storytelling.",
    useCase: "Immersive hero",
    mood: "Spatial",
    colors: ["#020617", "#1d4ed8", "#7c3aed", "#fb7185"],
    data: {
      gradientType: "softCells",
      speed: 0.18,
      complexity: 6,
      scale: 1.35,
      distortion: 0.28,
      softness: 0.78,
      brightness: 0.88,
      saturation: 1.25,
      colors: [[0.01, 0.02, 0.09], [0.11, 0.31, 0.85], [0.49, 0.23, 0.93], [0.98, 0.44, 0.52]],
      parallaxEnabled: true,
      parallaxStrength: 0.44,
      realBloomEnabled: true,
      glowEnabled: true,
      glowIntensity: 0.34,
      vignette: 0.42,
    },
  },
];
