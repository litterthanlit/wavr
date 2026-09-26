export { GradientEngine, GRADIENT_TYPE_IDS, fitSize } from "./engine";
export { createGradient } from "./create";
export type { EngineState, CaptureOptions } from "./engine";
export type { LayerParams, GradientType, BlendMode, ImageBlendMode, MaskParams, MaskShape, MaskBlendMode, TextMaskAlign } from "./layers";
export { createLayer, defaultSoftnessForGradientType, DEFAULT_LAYER, DEFAULT_MASK, MAX_LAYERS } from "./layers";
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
export { resolveConfig, stateToConfig } from "./config";
export { TweenManager } from "./animate";
export type { EasingFunction } from "./animate";
export {
  createEmptyEngineMetrics,
  estimateTextureBytes,
  summarizeGpuResources,
} from "./instrumentation";
export type { EngineMetrics, GpuResourceSample, GpuResourceSummary } from "./instrumentation";
