export { GradientEngine, GRADIENT_TYPE_IDS, FULL_RESOLUTION_GRADIENTS, TEXT_MASK_MIN_SCALE, fitSize } from "./engine";
export { createGradient } from "./create";
export { attachPointer } from "./attach-pointer";
export type { AttachPointerOptions, PointerTarget } from "./attach-pointer";
export type { EngineState, CaptureOptions } from "./engine";
export type { LayerParams, GradientType, BlendMode, ImageBlendMode, MaskParams, MaskShape, MaskBlendMode, TextMaskAlign } from "./layers";
export {
  createLayer, defaultSoftnessForGradientType, DEFAULT_LAYER, DEFAULT_MASK, MAX_LAYERS,
  LIGHT_GRADIENT_PALETTES, isLightGradientType, isLightRampPalette,
  LIGHT_FIELD_PALETTES, LIGHT_FIELD_PALETTE_ROLES, isLightFieldType,
} from "./layers";
export type { LightGradientType, LightFieldType } from "./layers";
export {
  GRADIENT_TYPES,
  BLEND_MODES,
  IMAGE_BLEND_MODES,
  MASK_SHAPES,
  MASK_BLEND_MODES,
  TEXT_MASK_ALIGNS,
} from "@wavr/schema/enums";
export { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply, mat4Identity, flipRowsRGBA } from "./math";
export type { GradientConfig, LayerConfig, RGBColor, GradientHandle, CreateGradientOptions, AnimateOptions } from "./types";
export { CONFIG_FIELD_STATE_KEYS, resolveConfig, stateToConfig } from "./config";
export { TweenManager } from "./animate";
export type { EasingFunction } from "./animate";
export {
  createEmptyEngineMetrics,
  estimateTextureBytes,
  summarizeGpuResources,
} from "./instrumentation";
export type { EngineMetrics, GpuResourceSample, GpuResourceSummary } from "./instrumentation";
export { SHADER_PARTS } from "./shader-sources";
export type { ShaderParts } from "./shader-sources";
export {
  MAX_POINTER_SPEED,
  MAX_POINTER_STEP,
  POINTER_OMEGA,
  PRESENCE_OMEGA_IN,
  PRESENCE_OMEGA_OUT,
  SNAP_PRESENCE,
} from "./pointer";
export {
  PALETTE_SIZE,
  MAX_PALETTE_COLORS,
  bakePalette,
  effectiveBlend,
  paletteDomain,
  paletteReach,
} from "./palette";
export {
  DEFAULT_MIN_RENDER_SCALE,
  RenderScaleController,
  createRenderScaleConfig,
  initialRenderScaleState,
  percentile,
  renderScaleLevels,
  stepRenderScale,
} from "./render-scale";
export type { RenderScaleConfig, RenderScaleOptions, RenderScaleState } from "./render-scale";
