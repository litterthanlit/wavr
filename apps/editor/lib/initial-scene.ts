import type { LayerParams } from "@wavr/core";

/**
 * The scene /editor opens with and "reset" returns to: slow satin ribbons in a
 * deep violet-to-amber palette. It lives here, not in @wavr/core's DEFAULT_LAYER,
 * because that default is the schema's and the URL codec's baseline. Softness is
 * left to the per-type default (0.72 for silk).
 */
export const INITIAL_LAYER_PARAMS: Partial<LayerParams> = {
  gradientType: "silk",
  colors: [
    [0.102, 0.043, 0.18],
    [0.416, 0.106, 0.604],
    [1.0, 0.369, 0.494],
    [1.0, 0.761, 0.478],
  ],
  speed: 0.4,
  complexity: 3,
  scale: 1,
  distortion: 0.3,
};
