import type { GradientConfig } from "./schema";
import { SCHEMA_VERSION } from "./version";

// Minimal valid config — 2-color linear mesh, no effects.
// Used as the baseline for `migrate()` fills, `get_preset("default")`, and boot state.
export const DEFAULT_CONFIG: GradientConfig = {
  version: SCHEMA_VERSION,
  colorSpace: "linear",
  layers: [
    {
      type: "mesh",
      colors: [
        [0.388, 0.357, 1.0],
        [1.0, 0.42, 0.42],
      ],
      speed: 0.4,
      complexity: 3,
      scale: 1,
      distortion: 0.3,
      opacity: 1,
      blendMode: "normal",
      depth: 0,
    },
  ],
  brightness: 1,
  saturation: 1,
  grain: 0,
  vignette: 0,
  chromaticAberration: 0,
  hueShift: 0,
  domainWarp: 0,
  radialBlur: 0,
  mouseReact: 0.5,
  oklabEnabled: true,
  toneMapMode: 1,
};
