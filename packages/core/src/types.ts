import type { BlendMode, ColorProfile, GradientType, ImageBlendMode, MaskBlendMode, MaskParams, TextMaskAlign } from "./layers";

/** RGB color as normalized floats [0-1, 0-1, 0-1] */
export type RGBColor = [number, number, number];

export interface LayerConfig {
  type: GradientType;
  colors: RGBColor[];
  speed?: number;
  complexity?: number;
  scale?: number;
  distortion?: number;
  softness?: number;
  fill?: number;
  focus?: number;
  scatter?: number;
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
  /**
   * "display-p3" reads every colour as Display P3 and presents on a wide-gamut
   * canvas: more saturated colour on P3 screens. Default "srgb".
   */
  colorProfile?: ColorProfile;
  /**
   * How far light may rise above white on an HDR display, in stops (1 = twice
   * white, at most 3). Default 0, standard range; standard displays and
   * exports show the scene as it looks at 0.
   */
  hdrHeadroom?: number;
  ripple?: { enabled: boolean; intensity: number };
  glow?: { enabled: boolean; intensity: number; radius: number };
  caustic?: { enabled: boolean; intensity: number };
  liquify?: { enabled: boolean; intensity: number; scale: number };
  trail?: { enabled: boolean; length: number; width: number };
  realBloomEnabled?: boolean;
  deband?: { enabled: boolean; strength: number };
}

export interface GradientHandle {
  update(config: Partial<GradientConfig>): void;
  play(): void;
  pause(): void;
  /** The pointer is at (x, y): 0..1 across the canvas, y up. Counts as present. */
  setMouse(x: number, y: number): void;
  /** The pointer entered (true) or left (false); the mouse effects ease in or out. attachPointer calls this. */
  setPointerActive(active: boolean): void;
  /** Starts a click ripple at (x, y), 0..1 with y up. Draws when `ripple` is enabled in the config. */
  triggerRipple(x: number, y: number): void;
  setTime(t: number): void;
  setSpeed(multiplier: number): void;
  setTimelineProgress(t: number): void;
  animateTo(config: Partial<GradientConfig>, options: AnimateOptions): void;
  resize(width: number, height: number): void;
  /** Render the current state once into an offscreen FBO and return RGBA bytes. */
  captureFrame(): Uint8Array;
  destroy(): void;
}

export interface AnimateOptions {
  duration: number;
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out" | "spring";
  onComplete?: () => void;
}

export interface CreateGradientOptions {
  onError?: (error: Error) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  /**
   * Caps the backing canvas pixel ratio. Lower values reduce GPU memory and
   * fragment shader cost on high-DPI displays.
   */
  maxPixelRatio?: number;
  /** Caps the render loop frame rate. */
  maxFrameRate?: number;
  /** Enable only for explicit capture paths; normal preview/runtime should keep this false. */
  preserveDrawingBuffer?: boolean;
  powerPreference?: WebGLPowerPreference;
}
