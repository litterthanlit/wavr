export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "add";

export interface LayerParams {
  gradientType: "mesh" | "radial" | "linear" | "conic" | "plasma";
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  colors: [number, number, number][];
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
}

export const DEFAULT_LAYER: LayerParams = {
  gradientType: "mesh",
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  colors: [
    [0.388, 0.357, 1.0],
    [1.0, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  opacity: 1.0,
  blendMode: "normal",
  visible: true,
};

export function createLayer(overrides?: Partial<LayerParams>): LayerParams {
  return {
    ...DEFAULT_LAYER,
    colors: DEFAULT_LAYER.colors.map((c) => [...c] as [number, number, number]),
    ...overrides,
  };
}

export const MAX_LAYERS = 4;
