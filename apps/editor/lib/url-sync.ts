/**
 * url-sync.ts — URL <-> store state bridge.
 *
 * Coupling note: `store.ts` imports `markPushPoint` from this module. That is a
 * deliberate, documented coupling (spec 0003 §3.3) so discrete actions can
 * signal the subscriber to use pushState instead of replaceState. The
 * alternative (zustand middleware / diff classification / event bus) is
 * heavier than a single import.
 *
 * Responsibilities:
 *   - Subscribe to store changes, encode schema-owned slice, debounced-write
 *     to window.location.hash via pushState/replaceState.
 *   - Read hash on mount / popstate, migrate if needed, apply to store under
 *     an `applyingFromUrl` guard so the read does not re-trigger a URL write.
 *   - Expose `storeToConfig` / `configToStorePatch` adapters (pure, exported
 *     for unit tests) that bridge the flat store shape and the nested schema.
 *   - Expose `getShareUrlV2` used by `url.ts::copyShareUrl` — so the share
 *     button always reflects the latest state even mid-debounce.
 *
 * Silent on failure (spec §6): never throw into the subscriber, log to dev
 * console only, leave the hash untouched on parse/encode error.
 *
 * Only the pure adapters and `DEFAULT_CONFIG` are bundled here. Everything that
 * needs zod (decode, validate, encode) goes through `url-codec.ts`, loaded on
 * demand by `loadUrlCodec()`; see that file for why. The empty-hash path (a
 * fresh editor with no shared state) never needs it.
 */

import {
  DEFAULT_CONFIG,
  type GradientConfig,
  type Shape3DKind,
  type GradientType,
  type BlendMode as SchemaBlendMode,
} from "@wavr/schema";
import { createLayer, type LayerParams, type BlendMode as CoreBlendMode } from "@wavr/core";
import { useGradientStore, type GradientState } from "./store";
import { INITIAL_EFFECTS, INITIAL_LAYER_PARAMS } from "./initial-scene";

// ---------- lazy codec ---------------------------------------------------

type UrlCodec = typeof import("./url-codec");

let codec: UrlCodec | null = null;
let codecLoad: Promise<UrlCodec> | null = null;

/** True once `loadUrlCodec()` has resolved, so the sync code paths can run. */
export function isUrlCodecLoaded(): boolean {
  return codec !== null;
}

/**
 * Load the zod-backed codec (once). Resolves immediately if a route already
 * bundled it statically, e.g. /embed. A failed load can be retried.
 */
export function loadUrlCodec(): Promise<UrlCodec> {
  if (!codecLoad) {
    codecLoad = import("./url-codec").then(
      (loaded) => {
        codec = loaded;
        return loaded;
      },
      (error: unknown) => {
        codecLoad = null;
        throw error;
      },
    );
  }
  return codecLoad;
}

/** Fire-and-forget `loadUrlCodec()` for hover/idle warm-ups. */
export function preloadUrlCodec(): void {
  loadUrlCodec().catch(() => undefined);
}

// ---------- module-scope state -------------------------------------------

/**
 * When `true`, the store is currently being mutated from a URL read and the
 * subscriber must skip the write to avoid a ping-pong. Exposed (mutable) via
 * the getters/setters below for tests that need to poke it directly.
 */
let applyingFromUrl = false;
export function isApplyingFromUrl(): boolean {
  return applyingFromUrl;
}
export function setApplyingFromUrl(v: boolean): void {
  applyingFromUrl = v;
}

/**
 * Consumed by the subscriber on its next write. Set by `markPushPoint()`.
 * One-shot — cleared after a single write.
 */
let pushNextWrite = false;
export function markPushPoint(): void {
  pushNextWrite = true;
}
/** Cancels a pending `markPushPoint()`: the next write replaces the entry. */
export function replaceNextWrite(): void {
  pushNextWrite = false;
}

/** Pending debounced-write timer. */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** One-time warn guards so we don't spam the console each frame. */
let warnedOversized = false;
let warnedParseFailed = false;

/** One-shot init guard for React 18 dev double-effects. */
let initialized = false;

// ---------- shape conversion helpers -------------------------------------

const SHAPE_NAMES: readonly Shape3DKind[] = [
  "sphere",
  "torus",
  "plane",
  "cylinder",
  "cube",
];

function shapeNumberToKind(n: number): Shape3DKind {
  const i = Math.max(0, Math.min(SHAPE_NAMES.length - 1, Math.trunc(n)));
  return SHAPE_NAMES[i] ?? "sphere";
}

function shapeKindToNumber(k: Shape3DKind): number {
  const i = SHAPE_NAMES.indexOf(k);
  return i < 0 ? 0 : i;
}

// ---------- store → config -----------------------------------------------

/**
 * Build a GradientConfig from the store state. Only reads schema-owned fields
 * (spec 0001 §3.4 bucket A).
 */
export function storeToConfig(state: GradientState): GradientConfig {
  const layers = state.layers.map(layerParamsToConfig);

  const config: GradientConfig = {
    version: "2.0.0",
    colorSpace: "linear",
    layers,
    brightness: state.brightness,
    saturation: state.saturation,
    grain: state.grain,
    vignette: state.vignette,
    chromaticAberration: state.chromaticAberration,
    hueShift: state.hueShift,
    radialBlur: state.radialBlurAmount, // rename: radialBlurAmount → radialBlur
    mouseReact: state.mouseReact,
    oklabEnabled: state.oklabEnabled,
    toneMapMode: state.toneMapMode,
    colorProfile: state.colorProfile,
    hdrHeadroom: state.hdrHeadroom,
    // Effect groups. Always emit so store state round-trips (disabled-with-
    // tweaked-intensity is preserved). Schema tolerates presence.
    noise: {
      enabled: state.noiseEnabled,
      intensity: state.noiseIntensity,
      scale: state.noiseScale,
    },
    bloom: {
      enabled: state.bloomEnabled,
      intensity: state.bloomIntensity,
    },
    blur: {
      enabled: state.blurEnabled,
      amount: state.blurAmount,
    },
    curl: {
      enabled: state.curlEnabled,
      intensity: state.curlIntensity,
      scale: state.curlScale,
    },
    kaleidoscope: {
      enabled: state.kaleidoscopeEnabled,
      segments: state.kaleidoscopeSegments,
      rotation: state.kaleidoscopeRotation,
    },
    reactionDiffusion: {
      enabled: state.reactionDiffEnabled,
      intensity: state.reactionDiffIntensity,
      scale: state.reactionDiffScale,
    },
    pixelSort: {
      enabled: state.pixelSortEnabled,
      intensity: state.pixelSortIntensity,
      threshold: state.pixelSortThreshold,
    },
    feedback: {
      enabled: state.feedbackEnabled,
      decay: state.feedbackDecay,
    },
    ascii: {
      enabled: state.asciiEnabled,
      size: state.asciiSize,
    },
    dither: {
      enabled: state.ditherEnabled,
      size: state.ditherSize,
    },
    parallax: {
      enabled: state.parallaxEnabled,
      strength: state.parallaxStrength,
    },
    shape3d: {
      enabled: state.threeDEnabled,
      shape: shapeNumberToKind(state.threeDShape),
      perspective: state.threeDPerspective,
      rotationSpeed: state.threeDRotationSpeed,
      zoom: state.threeDZoom,
      lighting: state.threeDLighting,
    },
    meshDistortion: {
      enabled: state.meshDistortionEnabled,
      displacement: state.meshDisplacement,
      frequency: state.meshFrequency,
      speed: state.meshSpeed,
    },
    ripple: {
      enabled: state.rippleEnabled,
      intensity: state.rippleIntensity,
    },
    glow: {
      enabled: state.glowEnabled,
      intensity: state.glowIntensity,
      radius: state.glowRadius,
    },
    caustic: {
      enabled: state.causticEnabled,
      intensity: state.causticIntensity,
    },
    liquify: {
      enabled: state.liquifyEnabled,
      intensity: state.liquifyIntensity,
      scale: state.liquifyScale,
    },
    trail: {
      enabled: state.trailEnabled,
      length: state.trailLength,
      width: state.trailWidth,
    },
    realBloom: {
      enabled: state.realBloomEnabled,
    },
    deband: {
      enabled: state.debandEnabled,
      strength: state.debandStrength,
    },
  };

  return config;
}

function layerParamsToConfig(l: LayerParams): GradientConfig["layers"][number] {
  // Schema LayerConfig has exactly: type, colors, speed, complexity, scale,
  // distortion, softness, opacity, blendMode, depth. Skip: visible, imageData,
  // imageScale, imageOffset, distortionMap*, imageBlendMode, imageBlendOpacity,
  // mask*, textMask* — all layer-extension fields (editor-only).
  return {
    type: l.gradientType as GradientType,
    colors: l.colors.map((c) => [...c] as [number, number, number]),
    speed: l.speed,
    complexity: l.complexity,
    scale: l.scale,
    distortion: l.distortion,
    softness: l.softness,
    opacity: l.opacity,
    blendMode: l.blendMode as SchemaBlendMode,
    depth: l.depth,
  };
}

// ---------- config → store patch -----------------------------------------

/**
 * Build a partial store patch from a GradientConfig. Inverse of
 * `storeToConfig`. Editor-only fields on the store are left untouched (not
 * included in the returned patch), since `loadPreset` spreads the patch over
 * existing state.
 */
export function configToStorePatch(config: GradientConfig): Partial<GradientState> {
  const patch: Partial<GradientState> = {
    layers: config.layers.map(layerConfigToParams),
    brightness: config.brightness,
    saturation: config.saturation,
    grain: config.grain,
    vignette: config.vignette,
    chromaticAberration: config.chromaticAberration,
    hueShift: config.hueShift,
    radialBlurAmount: config.radialBlur,
    mouseReact: config.mouseReact,
    oklabEnabled: config.oklabEnabled,
    toneMapMode: config.toneMapMode,
    colorProfile: config.colorProfile,
    hdrHeadroom: config.hdrHeadroom,
  };

  // Effect groups: flatten back to triples. Each group is optional on the
  // schema; when absent we leave the store's existing value alone (don't
  // overwrite with undefined — loadPreset spreads the patch so undefined
  // would clobber). So we only set keys when the group is present.
  if (config.noise) {
    patch.noiseEnabled = config.noise.enabled;
    patch.noiseIntensity = config.noise.intensity;
    patch.noiseScale = config.noise.scale;
  }
  if (config.bloom) {
    patch.bloomEnabled = config.bloom.enabled;
    patch.bloomIntensity = config.bloom.intensity;
  }
  if (config.blur) {
    patch.blurEnabled = config.blur.enabled;
    patch.blurAmount = config.blur.amount;
  }
  if (config.curl) {
    patch.curlEnabled = config.curl.enabled;
    patch.curlIntensity = config.curl.intensity;
    patch.curlScale = config.curl.scale;
  }
  if (config.kaleidoscope) {
    patch.kaleidoscopeEnabled = config.kaleidoscope.enabled;
    patch.kaleidoscopeSegments = config.kaleidoscope.segments;
    patch.kaleidoscopeRotation = config.kaleidoscope.rotation;
  }
  if (config.reactionDiffusion) {
    patch.reactionDiffEnabled = config.reactionDiffusion.enabled;
    patch.reactionDiffIntensity = config.reactionDiffusion.intensity;
    patch.reactionDiffScale = config.reactionDiffusion.scale;
  }
  if (config.pixelSort) {
    patch.pixelSortEnabled = config.pixelSort.enabled;
    patch.pixelSortIntensity = config.pixelSort.intensity;
    patch.pixelSortThreshold = config.pixelSort.threshold;
  }
  if (config.feedback) {
    patch.feedbackEnabled = config.feedback.enabled;
    patch.feedbackDecay = config.feedback.decay;
  }
  if (config.ascii) {
    patch.asciiEnabled = config.ascii.enabled;
    patch.asciiSize = config.ascii.size;
  }
  if (config.dither) {
    patch.ditherEnabled = config.dither.enabled;
    patch.ditherSize = config.dither.size;
  }
  if (config.parallax) {
    patch.parallaxEnabled = config.parallax.enabled;
    patch.parallaxStrength = config.parallax.strength;
  }
  if (config.shape3d) {
    patch.threeDEnabled = config.shape3d.enabled;
    patch.threeDShape = shapeKindToNumber(config.shape3d.shape);
    patch.threeDPerspective = config.shape3d.perspective;
    patch.threeDRotationSpeed = config.shape3d.rotationSpeed;
    patch.threeDZoom = config.shape3d.zoom;
    patch.threeDLighting = config.shape3d.lighting;
  }
  if (config.meshDistortion) {
    patch.meshDistortionEnabled = config.meshDistortion.enabled;
    patch.meshDisplacement = config.meshDistortion.displacement;
    patch.meshFrequency = config.meshDistortion.frequency;
    patch.meshSpeed = config.meshDistortion.speed;
  }
  if (config.ripple) {
    patch.rippleEnabled = config.ripple.enabled;
    patch.rippleIntensity = config.ripple.intensity;
  }
  if (config.glow) {
    patch.glowEnabled = config.glow.enabled;
    patch.glowIntensity = config.glow.intensity;
    patch.glowRadius = config.glow.radius;
  }
  if (config.caustic) {
    patch.causticEnabled = config.caustic.enabled;
    patch.causticIntensity = config.caustic.intensity;
  }
  if (config.liquify) {
    patch.liquifyEnabled = config.liquify.enabled;
    patch.liquifyIntensity = config.liquify.intensity;
    patch.liquifyScale = config.liquify.scale;
  }
  if (config.trail) {
    patch.trailEnabled = config.trail.enabled;
    patch.trailLength = config.trail.length;
    patch.trailWidth = config.trail.width;
  }
  // Absent means off, as the engine reads it (resolveConfig), not "keep the
  // store's": the opening scene turns cinematic bloom on, and a config written
  // without it (a preset, a hand-made URL) must not pick that up.
  patch.realBloomEnabled = config.realBloom?.enabled ?? false;
  if (config.deband) {
    patch.debandEnabled = config.deband.enabled;
    patch.debandStrength = config.deband.strength;
  }

  return patch;
}

function layerConfigToParams(l: GradientConfig["layers"][number]): LayerParams {
  return createLayer({
    gradientType: l.type as LayerParams["gradientType"],
    speed: l.speed,
    complexity: l.complexity,
    scale: l.scale,
    distortion: l.distortion,
    softness: l.softness,
    colors: l.colors.map((c) => [...c] as [number, number, number]),
    opacity: l.opacity,
    blendMode: l.blendMode as CoreBlendMode,
    depth: l.depth,
  });
}

// ---------- share-URL helper ---------------------------------------------

/**
 * Produce a full shareable URL for `state` using the V2 codec. Returns the
 * current page's origin+pathname joined with `#<encoded>` — no `s=` prefix
 * (see spec §11: naked V2 prefix).
 *
 * On encode failure (oversized config or parse error), or if the codec isn't
 * loaded yet, returns the current `window.location.href` as a best-effort
 * fallback. `copyShareUrl` loads the codec first.
 */
export function getShareUrlV2(state: GradientState): string {
  if (!codec) {
    console.info("[wavr] share URL: codec not loaded, returning current URL");
    return typeof window !== "undefined" ? window.location.href : "";
  }
  try {
    const config = storeToConfig(state);
    const parsed = codec.GradientConfig.safeParse(config);
    if (!parsed.success) {
      console.info("[wavr] share URL: GradientConfig invalid, returning current URL");
      return typeof window !== "undefined" ? window.location.href : "";
    }
    const encoded = codec.encodeUrl(parsed.data);
    if (typeof window === "undefined") return `#${encoded}`;
    const url = new URL(window.location.href);
    url.hash = encoded;
    return url.toString();
  } catch (e) {
    console.info("[wavr] share URL: encode failed", e);
    return typeof window !== "undefined" ? window.location.href : "";
  }
}

// ---------- URL → store (read path) --------------------------------------

/**
 * Read `window.location.hash`, decode via `tryDecodeUrl`, and apply to the
 * store under the `applyingFromUrl` guard. Safe to call multiple times
 * (mount + popstate).
 *
 * - Silent on failure (spec §6). One dev console.info on decode error.
 * - On V1 detection, logs dropped keys + rewrites the hash to V2 via
 *   `history.replaceState` so subsequent edits use the new format.
 * - On empty hash (on mount, or via popstate to "#"), resets the schema-owned
 *   slice to DEFAULT_CONFIG with the editor's initial scene as its layer and
 *   its effects (grain, tone map, cinematic bloom, colour profile, HDR headroom), so /editor
 *   opens on that scene rather than on the schema's bare baseline.
 *
 * An empty hash is applied synchronously. A hash that needs decoding is applied
 * synchronously too once the codec is loaded; otherwise it waits for the codec
 * (the returned promise settles after the store is updated). The editor starts
 * fetching the codec when the page loads with a hash, so this normally lands
 * before the first frame.
 */
export function applyHashToStore(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const rawHash = window.location.hash;
  // Treat empty or bare "#" as "reset to default".
  if (!rawHash || rawHash === "#") {
    applyConfig({
      ...DEFAULT_CONFIG,
      layers: [layerParamsToConfig(createLayer(INITIAL_LAYER_PARAMS))],
      grain: INITIAL_EFFECTS.grain,
      toneMapMode: INITIAL_EFFECTS.toneMapMode,
      colorProfile: INITIAL_EFFECTS.colorProfile,
      hdrHeadroom: INITIAL_EFFECTS.hdrHeadroom,
      // DEFAULT_CONFIG has no realBloom, which reads as off.
      realBloom: { enabled: INITIAL_EFFECTS.realBloomEnabled },
    });
    return Promise.resolve();
  }

  if (!codec) {
    // Re-read the hash once loaded: it may have changed again while waiting.
    return loadUrlCodec().then(
      () => applyHashToStore(),
      (e: unknown) => console.info("[wavr] URL codec failed to load:", e),
    );
  }

  applyEncodedHash(codec, rawHash);
  return Promise.resolve();
}

function applyEncodedHash(c: UrlCodec, rawHash: string): void {
  const result = c.tryDecodeUrl(rawHash);
  if (!result.ok) {
    console.info("[wavr] URL hash decode failed:", result.error);
    return;
  }

  if (result.droppedKeys.length > 0) {
    console.info("[wavr] v1 URL migrated, dropped editor-only fields:", result.droppedKeys);
    // Stash for future EditorState plumbing (spec 0002).
    const w = window as unknown as { __wavrDroppedKeys?: string[] };
    w.__wavrDroppedKeys = result.droppedKeys;
  }

  applyConfig(result.config);

  // If this was a V1 hash, rewrite to V2 under the guard so subsequent edits
  // use the new format. migrated=true for V1-legacy path only.
  if (result.migrated) {
    try {
      const v2 = c.encodeUrl(result.config);
      applyingFromUrl = true;
      try {
        window.history.replaceState(null, "", `#${v2}`);
      } finally {
        applyingFromUrl = false;
      }
    } catch (e) {
      console.info("[wavr] V1→V2 hash rewrite failed:", e);
    }
  }
}

function applyConfig(config: GradientConfig): void {
  const patch = configToStorePatch(config);
  applyingFromUrl = true;
  try {
    useGradientStore.getState().loadPreset(patch);
  } finally {
    applyingFromUrl = false;
  }
}

// ---------- store → URL (write path) -------------------------------------

/**
 * Core write. Called from the debounced subscriber (async) and from the
 * beforeunload listener (sync, to flush any pending write).
 *
 * - Reads current state, runs `storeToConfig`, parses via
 *   `GradientConfig.safeParse`, encodes via `encodeUrl`.
 * - Skips on parse failure or oversize (one-time warn each).
 * - Uses `history.pushState` if `pushNextWrite` is set, else `replaceState`.
 *
 * Synchronous once the codec is loaded (the idle warm-up makes that the normal
 * case); until then it waits for the codec and writes the then-current state.
 * The beforeunload flush can't wait, so an edit made before the codec has
 * loaded is not mirrored to the URL if the tab closes first.
 */
function writeNow(): Promise<void> {
  if (codec) {
    writeEncoded(codec);
    return Promise.resolve();
  }
  return loadUrlCodec().then(writeEncoded, () => undefined);
}

function writeEncoded(c: UrlCodec): void {
  if (typeof window === "undefined") return;
  if (applyingFromUrl) return;

  const state = useGradientStore.getState();
  const config = storeToConfig(state);
  const parsed = c.GradientConfig.safeParse(config);
  if (!parsed.success) {
    if (!warnedParseFailed) {
      warnedParseFailed = true;
      console.warn("[wavr] URL sync skipped — GradientConfig parse failed:", parsed.error.issues);
    }
    return;
  }

  let encoded: string;
  try {
    encoded = c.encodeUrl(parsed.data);
  } catch (e) {
    // encodeUrl throws on MAX_URL_BYTES breach or schema mismatch.
    const msg = e instanceof Error ? e.message : String(e);
    if (!warnedOversized && msg.includes("MAX_URL_BYTES")) {
      warnedOversized = true;
      console.warn(
        `[wavr] URL sync skipped — encoded config exceeds ${c.MAX_URL_BYTES} bytes. Save as a preset instead.`,
      );
    } else {
      console.info("[wavr] URL encode failed:", msg);
    }
    return;
  }

  // Double-check the ceiling in case encodeUrl is mocked (test).
  if (encoded.length > c.MAX_URL_BYTES) {
    if (!warnedOversized) {
      warnedOversized = true;
      console.warn(
        `[wavr] URL sync skipped — encoded config is ${encoded.length} bytes, exceeds ${c.MAX_URL_BYTES}. Save as a preset instead.`,
      );
    }
    return;
  }

  const hash = `#${encoded}`;
  const usePush = pushNextWrite;
  pushNextWrite = false;

  if (usePush) {
    window.history.pushState(null, "", hash);
  } else {
    window.history.replaceState(null, "", hash);
  }
}

/** Debounced wrapper. 200ms trailing-edge. */
function scheduleWrite(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void writeNow();
  }, 200);
}

/** Flush any pending write now. Used by beforeunload. */
function flushWrite(): Promise<void> {
  if (debounceTimer === null) return Promise.resolve();
  clearTimeout(debounceTimer);
  debounceTimer = null;
  return writeNow();
}

// ---------- public init --------------------------------------------------

/**
 * Install the zustand subscriber, popstate listener, and beforeunload flush.
 * Idempotent — safe against React 18 strict-mode double-invoke.
 */
export function initializeUrlSync(): () => void {
  if (initialized) return () => {};
  initialized = true;

  // Subscribe to all store changes. `loadPreset` during read-path sets
  // `applyingFromUrl` which short-circuits writeNow.
  const unsubscribe = useGradientStore.subscribe(() => {
    if (applyingFromUrl) return;
    scheduleWrite();
  });

  const onPopState = (): void => {
    void applyHashToStore();
  };
  const onBeforeUnload = (): void => {
    void flushWrite();
  };

  window.addEventListener("popstate", onPopState);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    unsubscribe();
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("beforeunload", onBeforeUnload);
    initialized = false;
  };
}

// ---------- test hooks ---------------------------------------------------

/** Reset module-scope state. Test-only. */
export function __resetUrlSyncForTests(): void {
  applyingFromUrl = false;
  pushNextWrite = false;
  warnedOversized = false;
  warnedParseFailed = false;
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  initialized = false;
}

/** Trigger a write for tests without waiting for debounce. Resolves once it has run. */
export function __flushForTests(): Promise<void> {
  return flushWrite();
}
