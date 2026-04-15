/** RGB color as normalized floats [0-1, 0-1, 0-1] */
export type RGBColor = [number, number, number];

export interface LayerConfig {
  type: "mesh" | "radial" | "linear" | "conic" | "plasma"
      | "dither" | "scanline" | "glitch";
  colors: RGBColor[];
  speed?: number;
  complexity?: number;
  scale?: number;
  distortion?: number;
  opacity?: number;
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "add";
  depth?: number;
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
}

export interface GradientHandle {
  update(config: Partial<GradientConfig>): void;
  play(): void;
  pause(): void;
  setMouse(x: number, y: number): void;
  setTime(t: number): void;
  setSpeed(multiplier: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface CreateGradientOptions {
  onError?: (error: Error) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}
