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
