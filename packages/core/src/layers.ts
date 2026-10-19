import type {
  BlendMode,
  GradientType,
  ImageBlendMode,
  MaskBlendMode,
  MaskShape,
  TextMaskAlign,
} from "@wavr/schema/enums";

// Canonical lists live in @wavr/schema/enums; re-exported for engine users.
export type { BlendMode, GradientType, ImageBlendMode, MaskBlendMode, MaskShape, TextMaskAlign };

export function defaultSoftnessForGradientType(type: GradientType): number {
  switch (type) {
    case "silk":
      return 0.72;
    case "aurora":
      return 0.68;
    case "liquid":
      return 0.62;
    case "softCells":
      return 0.76;
    case "grainflow":
      return 0.48;
    case "prismGlass":
      return 0.7;
    case "neonTunnel":
      return 0.56;
    case "horizonGlow":
    case "lightLeak":
    case "plasmaOrb":
      return 0.5;
    default:
      return 0;
  }
}

/**
 * The light modes ("Light gradients" in gradients.glsl) read the palette as a
 * light ramp, the deepest shadow first and the brightest light last. These are
 * their curated palettes, the ones their presets open with.
 */
export const LIGHT_GRADIENT_PALETTES = {
  liquidChrome: [[0.02, 0.024, 0.031], [0.106, 0.122, 0.153], [0.357, 0.392, 0.447], [0.667, 0.714, 0.784], [0.933, 0.957, 1]],
  iridescentFoil: [[0.039, 0.031, 0.075], [0.725, 0.655, 1], [1, 0.663, 0.741], [0.635, 0.925, 0.847], [0.953, 0.933, 0.98]],
  horizonGlow: [[0.016, 0.02, 0.047], [0.114, 0.137, 0.475], [0.482, 0.322, 0.878], [1, 0.769, 0.631]],
  lightLeak: [[0.008, 0.004, 0.008], [0.173, 0.031, 0.098], [0.584, 0.086, 0.161], [1, 0.29, 0.11], [1, 0.647, 0.18], [1, 0.945, 0.824]],
  inkSmoke: [[0.016, 0.02, 0.047], [0.055, 0.082, 0.212], [0.204, 0.275, 0.71], [0.608, 0.698, 1], [0.945, 0.957, 1]],
  plasmaOrb: [[0.047, 0.055, 0.267], [0.169, 0.275, 1], [0.545, 0.302, 1], [1, 0.31, 0.627], [1, 0.816, 0.761]],
} satisfies Partial<Record<GradientType, [number, number, number][]>>;

export type LightGradientType = keyof typeof LIGHT_GRADIENT_PALETTES;

export function isLightGradientType(type: GradientType): type is LightGradientType {
  return Object.prototype.hasOwnProperty.call(LIGHT_GRADIENT_PALETTES, type);
}

/**
 * Whether a palette runs the way the light modes read it: a dark first stop and
 * a clearly lighter last one (luma of the sRGB values).
 */
export function isLightRampPalette(colors: readonly (readonly number[])[]): boolean {
  const first = colors[0];
  const last = colors[colors.length - 1];
  if (!first || !last || colors.length < 2) return false;
  const luma = (c: readonly number[]) => 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
  return luma(first) <= 0.2 && luma(last) >= luma(first) + 0.35;
}

export interface MaskParams {
  shape: MaskShape;
  position: [number, number];
  scale: [number, number];
  rotation: number;
  feather: number;
  invert: boolean;
  cornerRadius: number;
  sides: number;
  starInnerRadius: number;
  noiseDistortion: number;
}

export const DEFAULT_MASK: MaskParams = {
  shape: "none",
  position: [0, 0],
  scale: [1, 1],
  rotation: 0,
  feather: 0.01,
  invert: false,
  cornerRadius: 0.1,
  sides: 6,
  starInnerRadius: 0.4,
  noiseDistortion: 0,
};

export interface LayerParams {
  gradientType: GradientType;
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  softness: number;
  colors: [number, number, number][];
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  // Image / texture
  imageData: string | null;
  imageScale: number;
  imageOffset: [number, number];
  distortionMapData: string | null;
  distortionMapEnabled: boolean;
  distortionMapIntensity: number;
  imageBlendMode: ImageBlendMode;
  imageBlendOpacity: number;
  // Mask
  maskEnabled: boolean;
  mask1: MaskParams;
  mask2: MaskParams;
  maskBlendMode: MaskBlendMode;
  maskSmoothness: number;
  // Text mask
  textMaskEnabled: boolean;
  textMaskContent: string;
  textMaskFontSize: number;
  textMaskFontWeight: number;
  textMaskLetterSpacing: number;
  textMaskAlign: TextMaskAlign;
  // Parallax depth
  depth: number;
}

export const DEFAULT_LAYER: LayerParams = {
  gradientType: "mesh",
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  softness: 0,
  colors: [
    [0.388, 0.357, 1.0],
    [1.0, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  opacity: 1.0,
  blendMode: "normal",
  visible: true,
  imageData: null,
  imageScale: 1.0,
  imageOffset: [0, 0],
  distortionMapData: null,
  distortionMapEnabled: false,
  distortionMapIntensity: 0.3,
  imageBlendMode: "replace",
  imageBlendOpacity: 1.0,
  maskEnabled: false,
  mask1: { ...DEFAULT_MASK },
  mask2: { ...DEFAULT_MASK },
  maskBlendMode: "union",
  maskSmoothness: 0.1,
  textMaskEnabled: false,
  textMaskContent: "",
  textMaskFontSize: 80,
  textMaskFontWeight: 700,
  textMaskLetterSpacing: 0,
  textMaskAlign: "center",
  depth: 0,
};

export function createLayer(overrides?: Partial<LayerParams>): LayerParams {
  const cleaned = Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined),
  ) as Partial<LayerParams>;

  return {
    ...DEFAULT_LAYER,
    ...(cleaned.gradientType && cleaned.softness === undefined
      ? { softness: defaultSoftnessForGradientType(cleaned.gradientType) }
      : {}),
    colors: (cleaned.colors ?? DEFAULT_LAYER.colors).map((c) => [...c] as [number, number, number]),
    mask1: { ...DEFAULT_MASK, ...(cleaned.mask1 ?? {}) },
    mask2: { ...DEFAULT_MASK, ...(cleaned.mask2 ?? {}) },
    ...cleaned,
  };
}

export const MAX_LAYERS = 4;
