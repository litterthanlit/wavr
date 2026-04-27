export type RGBColor = [number, number, number];

export type BlendMode =
  | "normal"
  | "darken" | "multiply" | "colorBurn" | "linearBurn" | "darkerColor"
  | "lighten" | "screen" | "colorDodge" | "add" | "lighterColor"
  | "overlay" | "softLight" | "hardLight" | "vividLight" | "linearLight" | "pinLight" | "hardMix"
  | "difference" | "exclusion" | "subtract" | "divide"
  | "hue" | "saturation" | "color" | "luminosity";

export type ImageBlendMode = "replace" | "normal" | "multiply" | "screen" | "overlay";
export type MaskShape = "none" | "circle" | "roundedRect" | "ellipse" | "polygon" | "star" | "blob";
export type MaskBlendMode = "union" | "subtract" | "intersect" | "smoothUnion";
export type TextMaskAlign = "left" | "center" | "right";

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

export interface LayerConfig {
  type: "mesh" | "radial" | "linear" | "conic" | "plasma"
      | "dither" | "scanline" | "glitch" | "image" | "voronoi";
  colors: RGBColor[];
  speed?: number;
  complexity?: number;
  scale?: number;
  distortion?: number;
  opacity?: number;
  blendMode?: BlendMode;
  depth?: number;
  visible?: boolean;
  imageData?: string | null;
  imageScale?: number;
  imageOffset?: [number, number];
  distortionMapData?: string | null;
  distortionMapEnabled?: boolean;
  distortionMapIntensity?: number;
  imageBlendMode?: ImageBlendMode;
  imageBlendOpacity?: number;
  maskEnabled?: boolean;
  mask1?: MaskParams;
  mask2?: MaskParams;
  maskBlendMode?: MaskBlendMode;
  maskSmoothness?: number;
  textMaskEnabled?: boolean;
  textMaskContent?: string;
  textMaskFontSize?: number;
  textMaskFontWeight?: number;
  textMaskLetterSpacing?: number;
  textMaskAlign?: TextMaskAlign;
}

export interface GradientConfig {
  layers: LayerConfig[];
  brightness?: number;
  saturation?: number;
  bloom?: { enabled: boolean; intensity: number };
  vignette?: number;
  grain?: number;
  noise?: { enabled: boolean; intensity: number; scale: number };
  chromaticAberration?: number;
  hueShift?: number;
  domainWarp?: number;
  mouseReact?: number;
  curl?: { enabled: boolean; intensity: number; scale: number };
  kaleidoscope?: { enabled: boolean; segments: number; rotation: number };
  reactionDiffusion?: { enabled: boolean; intensity: number; scale: number };
  pixelSort?: { enabled: boolean; intensity: number; threshold: number };
  blur?: { enabled: boolean; amount: number };
  radialBlur?: number;
  feedback?: { enabled: boolean; decay: number };
  ascii?: { enabled: boolean; size: number };
  dither?: { enabled: boolean; size: number };
  parallax?: { enabled: boolean; strength: number };
  shape3d?: {
    enabled: boolean;
    shape: "sphere" | "torus" | "plane" | "cylinder" | "cube";
    perspective: number;
    rotationSpeed: number;
    zoom: number;
    lighting: number;
  };
  meshDistortion?: {
    enabled: boolean;
    displacement: number;
    frequency: number;
    speed: number;
  };
  oklabEnabled?: boolean;
  toneMapMode?: number;
  ripple?: { enabled: boolean; intensity: number };
  glow?: { enabled: boolean; intensity: number; radius: number };
  caustic?: { enabled: boolean; intensity: number };
  liquify?: { enabled: boolean; intensity: number; scale: number };
  trail?: { enabled: boolean; length: number; width: number };
  realBloomEnabled?: boolean;
}

export type EasingFunction = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "spring";

export interface AnimateOptions {
  duration: number;
  easing: EasingFunction;
  onComplete?: () => void;
}

export interface GradientHandle {
  update(config: Partial<GradientConfig>): void;
  play(): void;
  pause(): void;
  setMouse(x: number, y: number): void;
  setTime(t: number): void;
  setSpeed(multiplier: number): void;
  setTimelineProgress(t: number): void;
  animateTo(config: Partial<GradientConfig>, options: AnimateOptions): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface HoverTrigger {
  enter: Partial<GradientConfig>;
  leave: Partial<GradientConfig>;
  duration: number;
  easing: AnimateOptions["easing"];
}

export interface ScrollTrigger {
  mode: "scrub" | "trigger";
  start: number;  // scroll % to start (0-1)
  end: number;    // scroll % to end (0-1)
}

export interface ClickTrigger {
  effect: "ripple" | "flash" | "custom";
  config?: Partial<GradientConfig>;
  duration?: number;
  easing?: AnimateOptions["easing"];
}

export interface InViewTrigger {
  threshold: number;  // 0-1
  animation: "play" | "scrub";
}

export interface EventTriggers {
  onHover?: HoverTrigger;
  onScroll?: ScrollTrigger;
  onClick?: ClickTrigger;
  onInView?: InViewTrigger;
}
