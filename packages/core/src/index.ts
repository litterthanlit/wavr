export { GradientEngine } from "./engine";
export { createGradient } from "./create";
export type { EngineState } from "./engine";
export type { LayerParams, BlendMode, ImageBlendMode, MaskParams, MaskShape, MaskBlendMode, TextMaskAlign } from "./layers";
export { createLayer, DEFAULT_LAYER, DEFAULT_MASK, MAX_LAYERS } from "./layers";
export { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply, mat4Identity } from "./math";
export type { GradientConfig, LayerConfig, RGBColor, GradientHandle, CreateGradientOptions } from "./types";
export { resolveConfig, stateToConfig } from "./config";
