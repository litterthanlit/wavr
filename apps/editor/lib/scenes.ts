import type { GradientState } from "@/lib/store";
import {
  DEFAULT_SCENE_3D_STATE,
  cloneScene3D,
  createParticleField,
  createSceneObject,
  type Scene3DState,
} from "@/lib/scene3d";

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

export type SceneThumbnailMotif =
  | "prism"
  | "tunnel"
  | "terrain"
  | "flare"
  | "orb"
  | "product"
  | "particles"
  | "liquid"
  | "aurora"
  | "signal"
  | "caustic"
  | "poster"
  | "space";

export interface SceneThumbnail {
  background: string;
  accent: string;
  motif: SceneThumbnailMotif;
}

export interface Scene {
  name: string;
  tagline: string;
  useCase: string;
  mood: string;
  colors: string[];
  thumbnail: SceneThumbnail;
  featured?: boolean;
  data: SceneData;
}

function thumbnail(background: string, accent: string, motif: SceneThumbnailMotif): SceneThumbnail {
  return { background, accent, motif };
}

function orbitalAuroraScene(): Scene3DState {
  const scene = cloneScene3D(DEFAULT_SCENE_3D_STATE);
  const orb = createSceneObject("sphere", 0);
  const ring = createSceneObject("torus", 1);
  scene.selectedObjectId = orb.id;
  scene.camera = { position: [0, 0.15, 5.2], fov: 40 };
  scene.lights = { ambient: 0.9, directional: 1.25 };
  scene.objects = [
    { ...orb, name: "Aurora Orb", color: "#dbeafe", scale: [1.05, 1.05, 1.05], metalness: 0.35, roughness: 0.18, floatAmplitude: 0.28 },
    { ...ring, name: "Orbit Ring", color: "#67e8f9", scale: [1.65, 1.65, 1.65], opacity: 0.72, metalness: 0.2, roughness: 0.28, motionSpeed: 0.18 },
  ];
  scene.particles = [{ ...createParticleField(0), name: "Aurora Dust", color: "#a7f3d0", count: 320, spread: 5.8, opacity: 0.5, speed: 0.2 }];
  scene.interaction.mouseReact = 0.42;
  return scene;
}

function chromeProductScene(): Scene3DState {
  const scene = cloneScene3D(DEFAULT_SCENE_3D_STATE);
  const cylinder = createSceneObject("cylinder", 0);
  const plane = createSceneObject("plane", 1);
  scene.selectedObjectId = cylinder.id;
  scene.camera = { position: [0, 0.05, 4.6], fov: 36 };
  scene.lights = { ambient: 0.72, directional: 1.8 };
  scene.objects = [
    { ...cylinder, name: "Chrome Column", color: "#f8fafc", scale: [0.85, 1.2, 0.85], metalness: 0.86, roughness: 0.12, floatAmplitude: 0.16 },
    { ...plane, name: "Glass Plate", color: "#93c5fd", position: [0, -1.05, -0.4], scale: [2.2, 2.2, 2.2], opacity: 0.34, metalness: 0.1, roughness: 0.08, motionSpeed: 0.05 },
  ];
  scene.particles = [{ ...createParticleField(0), name: "Specular Points", color: "#ffffff", count: 180, spread: 4.3, size: 0.018, opacity: 0.45, speed: 0.12 }];
  scene.interaction.mouseReact = 0.26;
  return scene;
}

function particleVeilScene(): Scene3DState {
  const scene = cloneScene3D(DEFAULT_SCENE_3D_STATE);
  const box = createSceneObject("box", 0);
  scene.selectedObjectId = box.id;
  scene.camera = { position: [0, 0.2, 5.8], fov: 48 };
  scene.lights = { ambient: 1, directional: 0.75 };
  scene.objects = [
    { ...box, name: "Soft Core", color: "#c084fc", scale: [0.72, 0.72, 0.72], opacity: 0.42, metalness: 0.15, roughness: 0.44, wireframe: true },
  ];
  scene.particles = [
    { ...createParticleField(0), name: "Near Veil", color: "#f0abfc", count: 520, spread: 6.5, size: 0.026, opacity: 0.5, speed: 0.34, depth: 2.6, mouseReact: 0.58 },
    { ...createParticleField(1), name: "Far Veil", color: "#38bdf8", count: 360, spread: 8, size: 0.018, opacity: 0.32, speed: 0.16, depth: 4, mouseReact: 0.28 },
  ];
  scene.interaction.mouseReact = 0.5;
  return scene;
}

function terrainFieldScene(): Scene3DState {
  const scene = cloneScene3D(DEFAULT_SCENE_3D_STATE);
  const ground = createSceneObject("plane", 0);
  const ridge = createSceneObject("plane", 1);
  scene.selectedObjectId = ground.id;
  scene.camera = { position: [0, 0.7, 5.6], fov: 46 };
  scene.lights = { ambient: 0.78, directional: 1.45 };
  scene.objects = [
    {
      ...ground,
      name: "Wire Terrain",
      color: "#67e8f9",
      position: [0, -0.72, -0.7],
      rotation: [-1.16, 0, 0.04],
      scale: [3.2, 2.2, 1],
      opacity: 0.52,
      metalness: 0.12,
      roughness: 0.36,
      wireframe: true,
      motionSpeed: 0.08,
      floatAmplitude: 0.06,
    },
    {
      ...ridge,
      name: "Back Ridge",
      color: "#bef264",
      position: [0.2, -0.2, -1.35],
      rotation: [-1.05, 0, -0.08],
      scale: [2.4, 1.35, 1],
      opacity: 0.28,
      metalness: 0.08,
      roughness: 0.42,
      wireframe: true,
      motionSpeed: 0.05,
      floatAmplitude: 0.04,
    },
  ];
  scene.particles = [
    { ...createParticleField(0), name: "Horizon Dust", color: "#a7f3d0", count: 220, spread: 6.2, size: 0.018, opacity: 0.36, speed: 0.12, depth: 3.4, mouseReact: 0.2 },
  ];
  scene.interaction.mouseReact = 0.24;
  return scene;
}

export const SCENES: Scene[] = [
  {
    name: "Prism Glass",
    tagline: "Glossy refraction sheets with caustic highlights and chromatic glow.",
    useCase: "Luxury hero",
    mood: "Refractive",
    colors: ["#e0f2fe", "#22d3ee", "#f97316", "#020617"],
    thumbnail: thumbnail("linear-gradient(135deg, #e0f2fe 0%, #22d3ee 34%, #f97316 66%, #020617 100%)", "#22d3ee", "prism"),
    featured: true,
    data: {
      gradientType: "prismGlass",
      speed: 0.26,
      complexity: 6,
      scale: 1.02,
      distortion: 0.48,
      softness: 0.72,
      brightness: 1.12,
      saturation: 1.05,
      colors: [[0.88, 0.95, 1], [0.13, 0.83, 0.93], [0.98, 0.45, 0.11], [0.01, 0.02, 0.09]],
      causticEnabled: true,
      causticIntensity: 0.72,
      chromaticAberration: 0.42,
      realBloomEnabled: true,
      glowEnabled: true,
      glowIntensity: 0.34,
      glowRadius: 0.035,
      debandEnabled: true,
      debandStrength: 0.6,
      vignette: 0.24,
    },
  },
  {
    name: "Neon Tunnel",
    tagline: "Portal-depth contour bands for event, music, and launch visuals.",
    useCase: "Campaign hero",
    mood: "Kinetic",
    colors: ["#f43f5e", "#f97316", "#22d3ee", "#020617"],
    thumbnail: thumbnail("radial-gradient(circle at 50% 46%, #22d3ee 0 8%, #f97316 9% 18%, #f43f5e 19% 30%, #020617 58%)", "#f97316", "tunnel"),
    featured: true,
    data: {
      gradientType: "neonTunnel",
      speed: 0.38,
      complexity: 7,
      scale: 1.12,
      distortion: 0.32,
      softness: 0.58,
      brightness: 1.03,
      saturation: 1.34,
      colors: [[0.96, 0.24, 0.36], [0.98, 0.45, 0.11], [0.13, 0.83, 0.93], [0.01, 0.02, 0.09]],
      bloomEnabled: true,
      bloomIntensity: 0.36,
      realBloomEnabled: true,
      glowEnabled: true,
      glowIntensity: 0.44,
      chromaticAberration: 0.28,
      vignette: 0.36,
      parallaxEnabled: true,
      parallaxStrength: 0.28,
    },
  },
  {
    name: "Terrain Field",
    tagline: "Glowing wire landscape over a soft spatial gradient.",
    useCase: "Spatial hero",
    mood: "Topographic",
    colors: ["#0f172a", "#22d3ee", "#bef264", "#0ea5e9"],
    thumbnail: thumbnail("linear-gradient(180deg, #0f172a 0%, #0ea5e9 52%, #bef264 100%)", "#bef264", "terrain"),
    featured: true,
    data: {
      gradientType: "aurora",
      speed: 0.2,
      complexity: 6,
      scale: 1.25,
      distortion: 0.28,
      softness: 0.68,
      brightness: 0.9,
      saturation: 1.18,
      colors: [[0.06, 0.09, 0.16], [0.13, 0.83, 0.93], [0.75, 0.95, 0.39], [0.06, 0.65, 0.91]],
      bloomEnabled: true,
      bloomIntensity: 0.3,
      glowEnabled: true,
      glowIntensity: 0.3,
      vignette: 0.34,
      parallaxEnabled: true,
      parallaxStrength: 0.36,
      scene3DEnabled: true,
      scene3D: terrainFieldScene(),
    },
  },
  {
    name: "Lens Burn",
    tagline: "Anamorphic streaks and soft blown highlights for cinematic exports.",
    useCase: "Motion card",
    mood: "Cinematic",
    colors: ["#020617", "#38bdf8", "#f97316", "#ffffff"],
    thumbnail: thumbnail("linear-gradient(105deg, #020617 0%, #38bdf8 35%, #ffffff 50%, #f97316 62%, #020617 100%)", "#f97316", "flare"),
    featured: true,
    data: {
      gradientType: "prismGlass",
      speed: 0.18,
      complexity: 5,
      scale: 0.9,
      distortion: 0.34,
      softness: 0.82,
      brightness: 1.22,
      saturation: 1.08,
      colors: [[0.01, 0.02, 0.09], [0.22, 0.74, 0.97], [0.98, 0.45, 0.11], [1, 1, 1]],
      grain: 0.16,
      blurEnabled: true,
      blurAmount: 0.18,
      radialBlurAmount: 0.22,
      chromaticAberration: 0.46,
      realBloomEnabled: true,
      glowEnabled: true,
      glowIntensity: 0.48,
      glowRadius: 0.05,
      debandEnabled: true,
      debandStrength: 0.72,
      vignette: 0.4,
    },
  },
  {
    name: "Orbital Aurora",
    tagline: "Atmospheric gradient curtains with a real 3D orb and particle depth.",
    useCase: "Immersive hero",
    mood: "Spatial",
    colors: ["#22c55e", "#14b8a6", "#4f46e5", "#020617"],
    thumbnail: thumbnail("radial-gradient(circle at 52% 52%, #dbeafe 0 16%, #14b8a6 17% 34%, #4f46e5 58%, #020617 100%)", "#14b8a6", "orb"),
    featured: true,
    data: {
      gradientType: "aurora",
      speed: 0.2,
      complexity: 5,
      scale: 1.35,
      distortion: 0.34,
      softness: 0.74,
      brightness: 0.96,
      saturation: 1.18,
      colors: [[0.13, 0.77, 0.37], [0.08, 0.72, 0.65], [0.31, 0.27, 0.9], [0.01, 0.02, 0.09]],
      glowEnabled: true,
      glowIntensity: 0.28,
      parallaxEnabled: true,
      parallaxStrength: 0.3,
      scene3DEnabled: true,
      scene3D: orbitalAuroraScene(),
    },
  },
  {
    name: "Chrome Product Field",
    tagline: "Reflective 3D product form over a soft liquid-metal field.",
    useCase: "Product reveal",
    mood: "Premium",
    colors: ["#f8fafc", "#94a3b8", "#111827", "#60a5fa"],
    thumbnail: thumbnail("linear-gradient(145deg, #f8fafc 0%, #94a3b8 30%, #111827 68%, #60a5fa 100%)", "#60a5fa", "product"),
    featured: true,
    data: {
      gradientType: "liquid",
      speed: 0.28,
      complexity: 6,
      scale: 0.92,
      distortion: 0.45,
      softness: 0.66,
      brightness: 1.12,
      saturation: 0.42,
      colors: [[0.97, 0.98, 0.99], [0.58, 0.64, 0.75], [0.07, 0.08, 0.12], [0.38, 0.64, 0.94]],
      realBloomEnabled: true,
      glowEnabled: true,
      glowIntensity: 0.26,
      scene3DEnabled: true,
      scene3D: chromeProductScene(),
    },
  },
  {
    name: "Particle Veil",
    tagline: "Layered particles and a soft wire core for AI and data storytelling.",
    useCase: "AI product",
    mood: "Electric",
    colors: ["#22d3ee", "#2563eb", "#a855f7", "#020617"],
    thumbnail: thumbnail("radial-gradient(circle at 45% 45%, #a855f7 0 10%, #2563eb 34%, #22d3ee 58%, #020617 100%)", "#a855f7", "particles"),
    featured: true,
    data: {
      gradientType: "grainflow",
      speed: 0.42,
      complexity: 7,
      scale: 0.9,
      distortion: 0.56,
      softness: 0.54,
      brightness: 1.04,
      saturation: 1.28,
      colors: [[0.13, 0.83, 0.93], [0.15, 0.39, 0.92], [0.66, 0.33, 0.97], [0.01, 0.02, 0.09]],
      bloomEnabled: true,
      bloomIntensity: 0.32,
      pixelSortEnabled: true,
      pixelSortIntensity: 0.18,
      scene3DEnabled: true,
      scene3D: particleVeilScene(),
    },
  },
  {
    name: "Liquid Chrome Hero",
    tagline: "Premium reflective motion for launch pages and product reveals.",
    useCase: "SaaS hero",
    mood: "Metallic",
    colors: ["#f3f4f6", "#9ca3af", "#111827", "#60a5fa"],
    thumbnail: thumbnail("linear-gradient(135deg, #f3f4f6 0%, #9ca3af 40%, #111827 72%, #60a5fa 100%)", "#9ca3af", "liquid"),
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
    thumbnail: thumbnail("linear-gradient(145deg, #22c55e 0%, #14b8a6 32%, #4f46e5 68%, #020617 100%)", "#22c55e", "aurora"),
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
    thumbnail: thumbnail("linear-gradient(135deg, #22d3ee 0%, #2563eb 36%, #a855f7 70%, #020617 100%)", "#22d3ee", "signal"),
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
    thumbnail: thumbnail("linear-gradient(135deg, #67e8f9 0%, #0f766e 38%, #334155 74%, #f8fafc 100%)", "#67e8f9", "caustic"),
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
    thumbnail: thumbnail("linear-gradient(135deg, #ef4444 0%, #facc15 42%, #111827 68%, #f8fafc 100%)", "#facc15", "poster"),
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
    thumbnail: thumbnail("radial-gradient(circle at 32% 28%, #fb7185 0 8%, #7c3aed 30%, #1d4ed8 58%, #020617 100%)", "#fb7185", "space"),
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
