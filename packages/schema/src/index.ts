// Public surface of @wavr/schema.
// §12 of specs/0001-schema.md grows this in order. Current step: 5 (url) + 6 (migrate).

export { GradientConfig } from "./schema";
export { LayerConfig } from "./layer";
export {
  RGBColor,
  ColorSpace,
  GradientType,
  BlendMode,
  Shape3DKind,
} from "./primitives";
export * as effects from "./effects";
export {
  EFFECT_DEFINITIONS,
  EFFECT_REGISTRY,
  getEffectDefinition,
  defaultParamsForEffect,
  listAnimatableEffectPaths,
  effectNodesFromGradientConfig,
  applyEffectNodesToGradientConfig,
  type EffectId,
  type EffectCategory,
  type EffectPassType,
  type EffectNode,
  type EffectDefinition,
} from "./effect-registry";
export {
  WavrAsset,
  WavrEffectNode,
  WavrTransform,
  WavrLayerSource,
  WavrLayerNode,
  WavrTimelineKeyframe,
  WavrTimelineTrack,
  WavrTimeline,
  WavrInteractionDriver,
  WavrExportProfile,
  WavrSceneGlobals,
  WavrSceneDocument,
  sceneDocumentFromGradientConfig,
  gradientConfigFromSceneDocument,
  type SceneDocumentFromConfigOptions,
  type WavrAsset as WavrAssetValue,
  type WavrEffectNode as WavrEffectNodeValue,
  type WavrTransform as WavrTransformValue,
  type WavrLayerSource as WavrLayerSourceValue,
  type WavrLayerNode as WavrLayerNodeValue,
  type WavrTimelineKeyframe as WavrTimelineKeyframeValue,
  type WavrTimelineTrack as WavrTimelineTrackValue,
  type WavrTimeline as WavrTimelineValue,
  type WavrInteractionDriver as WavrInteractionDriverValue,
  type WavrExportProfile as WavrExportProfileValue,
  type WavrSceneGlobals as WavrSceneGlobalsValue,
  type WavrSceneDocument as WavrSceneDocumentValue,
} from "./scene-document";
export {
  compileRenderPlan,
  type RenderPassKind,
  type RenderResource,
  type RenderPass,
  type SceneCost,
  type CompatibilityWarning,
  type RenderPlan,
} from "./render-plan";
export type {
  PropertyValueType,
  PropertyCostHint,
  PropertySchema,
} from "./property-schema";
export { DEFAULT_CONFIG } from "./defaults";
export { SCHEMA_VERSION, type SchemaVersion } from "./version";

// Migration
export {
  migrate,
  detectVersion,
  detectShape,
  type LegacyShape,
  type DetectedShape,
  type MigrateResult,
  type MigrateWarning,
  type MigrateOptions,
} from "./migrate";

// URL codec
export {
  encodeUrl,
  decodeUrl,
  tryDecodeUrl,
  V2_PREFIX,
  MAX_URL_BYTES,
  type TryDecodeResult,
} from "./url";

// Render-parity hash (goldens compared via tolerance-bucketed SHA-256)
export {
  hashFramebuffer,
  compareHash,
  type CompareResult,
} from "./parity";
