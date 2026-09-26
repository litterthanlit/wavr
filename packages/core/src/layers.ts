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
    default:
      return 0;
  }
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
