import { GradientConfig, type GradientConfig as GC } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";
import { SCHEMA_VERSION, type SchemaVersion } from "./version";

export type LegacyShape = "types-v1" | "project-state-v1";
export type DetectedShape = LegacyShape | "v2";

export interface MigrateWarning {
  path: string;
  message: string;
}

export interface MigrateResult {
  config: GC;
  droppedKeys: string[];
  warnings: MigrateWarning[];
  detectedShape: DetectedShape;
}

export interface MigrateOptions {
  from?: SchemaVersion;
  to?: SchemaVersion;
  onWarning?: (w: MigrateWarning) => void;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function detectVersion(input: unknown): SchemaVersion {
  if (isRecord(input) && input.version === "2.0.0") return "2.0.0";
  return "1.0.0";
}

/**
 * Shape detection heuristic:
 *   - version "2.0.0" → v2
 *   - any flat flag (e.g. `noiseEnabled`) OR any editor-only field
 *     (activeLayerIndex, colorBlend, timelineEnabled, keyframes) → project-state-v1
 *   - layers present with a `type` field → types-v1
 *   - anything else → project-state-v1 (best-effort; parse will reject)
 */
export function detectShape(input: unknown): DetectedShape {
  if (!isRecord(input)) return "project-state-v1";
  if (input.version === "2.0.0") return "v2";

  const flatMarkers = [
    "noiseEnabled", "bloomEnabled", "blurEnabled", "asciiEnabled", "ditherEnabled",
    "noiseIntensity", "bloomIntensity", "blurAmount", "asciiSize", "ditherSize",
    "activeLayerIndex", "colorBlend", "timelineEnabled", "keyframes",
    "radialBlurAmount",
  ];
  if (flatMarkers.some((k) => k in input)) return "project-state-v1";

  // types-v1 uses nested group names (same as V2 shape but no `version`)
  const nestedMarkers = ["noise", "bloom", "blur", "curl", "ascii", "dither", "shape3d"];
  if (nestedMarkers.some((k) => k in input && isRecord(input[k]))) return "types-v1";

  // types-v1 presets may just have `layers` + a few globals
  if (Array.isArray(input.layers)) return "types-v1";

  return "project-state-v1";
}

const WARN = (warnings: MigrateWarning[], opts: MigrateOptions | undefined, w: MigrateWarning) => {
  warnings.push(w);
  opts?.onWarning?.(w);
};

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Shared finalize: run GradientConfig.parse to catch structural errors and
 * trigger default-fill. Throws on invalid — tryDecodeUrl wraps.
 */
function finalize(
  candidate: unknown,
  droppedKeys: string[],
  warnings: MigrateWarning[],
  detectedShape: DetectedShape,
): MigrateResult {
  const config = GradientConfig.parse(candidate);
  return { config, droppedKeys, warnings, detectedShape };
}

// --- types-v1 → V2 ---------------------------------------------------------

/**
 * packages/core/src/types.ts::GradientConfig (V1, implicit). Same nested shape
 * as V2 but no `version`, no `colorSpace`, and a top-level `realBloomEnabled`
 * boolean that moves to `realBloom: { enabled }` in V2.
 */
function migrateTypesV1(input: Record<string, unknown>, opts: MigrateOptions | undefined): MigrateResult {
  const warnings: MigrateWarning[] = [];
  const droppedKeys: string[] = [];
  const out: Record<string, unknown> = {
    ...input,
    version: SCHEMA_VERSION,
    colorSpace: "linear",
  };

  // realBloomEnabled → realBloom.enabled (spec §4.3 rule 4)
  if ("realBloomEnabled" in input) {
    const v = input.realBloomEnabled;
    delete out.realBloomEnabled;
    if (typeof v === "boolean") {
      out.realBloom = { enabled: v };
    }
  }

  // Drop known legacy extras that V1 may or may not carry
  for (const k of ["activeLayerIndex", "colorBlend", "customGLSL"]) {
    if (k in out) {
      droppedKeys.push(k);
      delete out[k];
    }
  }

  // Migrate layers: drop layer-extension fields (visible, mask*, image*, textMask*)
  if (Array.isArray(out.layers)) {
    out.layers = out.layers.map((l: unknown, i: number) => migrateLayer(l, `layers[${i}]`, droppedKeys, warnings, opts));
  }

  return finalize(out, droppedKeys, warnings, "types-v1");
}

// --- project-state-v1 → V2 -------------------------------------------------

/**
 * apps/editor/lib/projects.ts::ProjectState (V1). Flat shape with
 * noiseEnabled/noiseIntensity/noiseScale style triples, plus editor-only
 * fields (activeLayerIndex, timeline*, keyframes) that we drop.
 */
function migrateProjectStateV1(input: Record<string, unknown>, opts: MigrateOptions | undefined): MigrateResult {
  const warnings: MigrateWarning[] = [];
  const droppedKeys: string[] = [];
  const out: Record<string, unknown> = {
    version: SCHEMA_VERSION,
    colorSpace: "linear",
  };

  // Simple passthrough globals (flat → flat, same name)
  const passthrough: string[] = [
    "brightness", "saturation", "grain", "vignette", "mouseReact",
    "chromaticAberration", "hueShift", "domainWarp",
    "oklabEnabled", "toneMapMode",
  ];
  for (const k of passthrough) {
    if (k in input) out[k] = input[k];
  }

  // Renamed flat globals
  if ("radialBlurAmount" in input) out.radialBlur = input.radialBlurAmount;

  // Flat triples/pairs → nested groups. We only emit a group if any of its
  // source fields is present in input, so round-trip preserves user state even
  // when enabled=false.
  type Triple = { group: string; en: string; fields: Record<string, string> };
  const triples: Triple[] = [
    { group: "noise", en: "noiseEnabled", fields: { intensity: "noiseIntensity", scale: "noiseScale" } },
    { group: "bloom", en: "bloomEnabled", fields: { intensity: "bloomIntensity" } },
    { group: "blur", en: "blurEnabled", fields: { amount: "blurAmount" } },
    { group: "ascii", en: "asciiEnabled", fields: { size: "asciiSize" } },
    { group: "dither", en: "ditherEnabled", fields: { size: "ditherSize" } },
    // Phase 11 effects not in ProjectState are omitted — stay undefined.
    { group: "curl", en: "curlEnabled", fields: { intensity: "curlIntensity", scale: "curlScale" } },
    { group: "kaleidoscope", en: "kaleidoscopeEnabled", fields: { segments: "kaleidoscopeSegments", rotation: "kaleidoscopeRotation" } },
    { group: "reactionDiffusion", en: "reactionDiffEnabled", fields: { intensity: "reactionDiffIntensity", scale: "reactionDiffScale" } },
    { group: "pixelSort", en: "pixelSortEnabled", fields: { intensity: "pixelSortIntensity", threshold: "pixelSortThreshold" } },
    { group: "feedback", en: "feedbackEnabled", fields: { decay: "feedbackDecay" } },
    { group: "parallax", en: "parallaxEnabled", fields: { strength: "parallaxStrength" } },
    { group: "meshDistortion", en: "meshDistortionEnabled", fields: { displacement: "meshDisplacement", frequency: "meshFrequency", speed: "meshSpeed" } },
    { group: "ripple", en: "rippleEnabled", fields: { intensity: "rippleIntensity" } },
    { group: "glow", en: "glowEnabled", fields: { intensity: "glowIntensity", radius: "glowRadius" } },
    { group: "caustic", en: "causticEnabled", fields: { intensity: "causticIntensity" } },
    { group: "liquify", en: "liquifyEnabled", fields: { intensity: "liquifyIntensity", scale: "liquifyScale" } },
    { group: "trail", en: "trailEnabled", fields: { length: "trailLength", width: "trailWidth" } },
  ];

  for (const { group, en, fields } of triples) {
    const anyPresent = en in input || Object.values(fields).some((src) => src in input);
    if (!anyPresent) continue;
    const g: Record<string, unknown> = { enabled: Boolean(input[en] ?? false) };
    for (const [k, src] of Object.entries(fields)) {
      if (src in input) g[k] = input[src];
    }
    out[group] = g;
  }

  // realBloom — not normally in ProjectState, but handle if a future export adds it.
  if ("realBloomEnabled" in input) out.realBloom = { enabled: Boolean(input.realBloomEnabled) };

  // shape3d (threeD* flat) → shape3d nested. threeDShape is a number index
  // in the store; convert to the enum string via SHAPE_NAMES.
  if ("threeDEnabled" in input || "threeDShape" in input) {
    const SHAPE_NAMES = ["sphere", "torus", "plane", "cylinder", "cube"] as const;
    const idx = typeof input.threeDShape === "number" ? input.threeDShape : 0;
    const shape = SHAPE_NAMES[clamp(idx, 0, SHAPE_NAMES.length - 1)] ?? "sphere";
    out.shape3d = {
      enabled: Boolean(input.threeDEnabled ?? false),
      shape,
      ...(typeof input.threeDPerspective === "number" ? { perspective: input.threeDPerspective } : {}),
      ...(typeof input.threeDRotationSpeed === "number" ? { rotationSpeed: input.threeDRotationSpeed } : {}),
      ...(typeof input.threeDZoom === "number" ? { zoom: input.threeDZoom } : {}),
      ...(typeof input.threeDLighting === "number" ? { lighting: input.threeDLighting } : {}),
    };
  }

  // Editor-only fields → droppedKeys so Spec 0002 (editor-state) can pick them up.
  const editorOnly = [
    "activeLayerIndex", "colorBlend",
    "timelineEnabled", "timelineDuration", "timelinePlaybackMode", "keyframes", "timelinePosition",
    "audioEnabled", "audioSource", "audioBassTarget", "audioTrebleTarget", "audioEnergyTarget", "audioSensitivity",
    "customGLSL", "playing",
  ];
  for (const k of editorOnly) {
    if (k in input) droppedKeys.push(k);
  }

  // Layers. ProjectState stores LayerParams[] with `gradientType`, image fields, masks, etc.
  if (Array.isArray(input.layers)) {
    out.layers = input.layers.map((l: unknown, i: number) => migrateLayer(l, `layers[${i}]`, droppedKeys, warnings, opts));
  }

  return finalize(out, droppedKeys, warnings, "project-state-v1");
}

// --- Layer migration (shared) ----------------------------------------------

/**
 * V1 layers (both shapes) use `gradientType` in the store and LayerParams,
 * but the V1 types.ts LayerConfig uses `type`. Handle both. Drop layer-extension
 * fields (spec §3.2.2 — masks, image, text mask, visible) into droppedKeys with
 * their indexed path.
 */
function migrateLayer(
  layer: unknown,
  path: string,
  droppedKeys: string[],
  warnings: MigrateWarning[],
  opts: MigrateOptions | undefined,
): Record<string, unknown> {
  if (!isRecord(layer)) {
    WARN(warnings, opts, { path, message: "Layer is not an object; substituting default" });
    return { ...DEFAULT_CONFIG.layers[0]! };
  }
  const out: Record<string, unknown> = {};
  const type = layer.type ?? layer.gradientType;
  if (typeof type === "string") out.type = type;
  if (Array.isArray(layer.colors)) out.colors = layer.colors;

  const passthrough = ["speed", "complexity", "scale", "distortion", "opacity", "blendMode", "depth"];
  for (const k of passthrough) {
    if (k in layer) out[k] = layer[k];
  }

  // Drop layer-extension fields (Spec 0002 territory)
  const drop = [
    "visible", "gradientType",
    "imageData", "imageScale", "imageOffset",
    "distortionMapData", "distortionMapEnabled", "distortionMapIntensity",
    "imageBlendMode", "imageBlendOpacity",
    "maskEnabled", "mask1", "mask2", "maskBlendMode", "maskSmoothness",
    "textMaskEnabled", "textMaskContent", "textMaskFontSize",
    "textMaskFontWeight", "textMaskLetterSpacing", "textMaskAlign",
  ];
  for (const k of drop) {
    if (k in layer) droppedKeys.push(`${path}.${k}`);
  }

  return out;
}

// --- Public API ------------------------------------------------------------

export function migrate(input: unknown, opts?: MigrateOptions): MigrateResult {
  const shape = detectShape(input);
  if (shape === "v2") {
    // V2 is already valid; run parse for default-fill and strict validation.
    const config = GradientConfig.parse(input);
    return { config, droppedKeys: [], warnings: [], detectedShape: "v2" };
  }
  if (!isRecord(input)) {
    // Not an object — can't salvage. finalize will throw via parse.
    return finalize({}, [], [], shape);
  }
  if (shape === "types-v1") return migrateTypesV1(input, opts);
  return migrateProjectStateV1(input, opts);
}
