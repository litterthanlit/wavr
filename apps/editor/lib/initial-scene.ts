import { LIGHT_FIELD_PALETTES, type EngineState, type LayerParams } from "@wavr/core";

/**
 * The scene /editor opens with and "reset" returns to: the Aperture preset, a
 * tall opening of light in a slate wall, pale at its edges and deepening to a
 * cornflower core. It lives here, not in @wavr/core's DEFAULT_LAYER, because
 * that default is the schema's and the URL codec's baseline. It is the preset
 * (`aperture` in @wavr/core/presets) spelled out, so the initial bundle doesn't
 * pull in the preset catalogue; a test keeps the two the same.
 */
export const INITIAL_LAYER_PARAMS: Partial<LayerParams> = {
  gradientType: "aperture",
  colors: LIGHT_FIELD_PALETTES.aperture,
  speed: 0.3,
  complexity: 2,
  scale: 1.15,
  distortion: 0.12,
  softness: 0.9,
};

/**
 * The opening scene's global effects. The aperture rolls its own light toward
 * white, so the tone map is off (its shoulder would dim the most saturated
 * colours), cinematic bloom gives the glare a camera sees around light, and
 * its colours are Display P3.
 */
export const INITIAL_EFFECTS = {
  grain: 0.03,
  toneMapMode: 0,
  realBloomEnabled: true,
  colorProfile: "display-p3",
} satisfies Partial<EngineState>;
