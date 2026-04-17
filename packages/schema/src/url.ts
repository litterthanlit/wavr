import LZString from "lz-string";
import { GradientConfig, type GradientConfig as GC } from "./schema";
import { LayerConfig } from "./layer";
import { DEFAULT_CONFIG } from "./defaults";
import { migrate } from "./migrate";

/** Final codec prefix. V2+ URLs always begin with `s2.`. */
export const V2_PREFIX = "s2.";

/** Hard ceiling. Configs larger than this refuse to encode — save as preset instead. */
export const MAX_URL_BYTES = 6 * 1024;

// ---------- encode ---------------------------------------------------------

/**
 * Encode a valid GradientConfig into a URL-safe string. Throws if the config
 * fails parse or if the encoded payload exceeds MAX_URL_BYTES.
 *
 * The output does not include a leading `#`; callers who want a full hash
 * should prepend it (e.g. `window.location.hash = "#" + encodeUrl(config)`).
 */
export function encodeUrl(config: GC): string {
  const parsed = GradientConfig.parse(config);
  const stripped = stripDefaults(parsed);
  const json = JSON.stringify(stripped);
  const compressed = LZString.compressToEncodedURIComponent(json);
  const encoded = `${V2_PREFIX}${compressed}`;
  if (encoded.length > MAX_URL_BYTES) {
    throw new Error(
      `@wavr/schema: encoded config is ${encoded.length} bytes, exceeds MAX_URL_BYTES=${MAX_URL_BYTES}. Save as a preset instead.`,
    );
  }
  return encoded;
}

// ---------- decode ---------------------------------------------------------

export type TryDecodeResult =
  | { ok: true; config: GC; migrated: boolean; droppedKeys: string[] }
  | { ok: false; error: string; detectedShape: "v1-legacy" | "unknown" };

/**
 * Decode a URL hash payload into a valid GradientConfig. Throws on failure.
 * Accepts:
 *   - `s2.<lz>`          — current format
 *   - `s=<base64url>`    — V1 legacy (apps/editor/lib/url.ts)
 *   - `<base64url>`      — V1 legacy with no prefix
 * A leading `#` is stripped if present.
 */
export function decodeUrl(encoded: string): GC {
  const result = tryDecodeUrl(encoded);
  if (!result.ok) throw new Error(result.error);
  return result.config;
}

export function tryDecodeUrl(encoded: string): TryDecodeResult {
  if (typeof encoded !== "string" || encoded.length === 0) {
    return { ok: false, error: "empty input", detectedShape: "unknown" };
  }

  let body = encoded;
  if (body.startsWith("#")) body = body.slice(1);

  try {
    if (body.startsWith(V2_PREFIX)) {
      return decodeV2(body.slice(V2_PREFIX.length));
    }

    // V1 path. Strip an optional `s=` prefix (matches apps/editor/lib/url.ts).
    if (body.startsWith("s=")) body = body.slice(2);
    return decodeV1(body);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      detectedShape: body.startsWith(V2_PREFIX) ? "unknown" : "v1-legacy",
    };
  }
}

function decodeV2(payload: string): TryDecodeResult {
  if (!payload) return { ok: false, error: "empty V2 payload", detectedShape: "unknown" };
  const json = LZString.decompressFromEncodedURIComponent(payload);
  if (!json) return { ok: false, error: "LZ decompression failed", detectedShape: "unknown" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "V2 JSON parse failed", detectedShape: "unknown" };
  }
  // Normal V2 payload goes through migrate for default-fill (payload may be
  // partial due to strip-defaults on encode). migrate() with v2 shape runs
  // GradientConfig.parse and throws on invalid.
  try {
    const result = migrate(parsed);
    return { ok: true, config: result.config, migrated: false, droppedKeys: result.droppedKeys };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      detectedShape: "unknown",
    };
  }
}

function decodeV1(payload: string): TryDecodeResult {
  if (!payload) return { ok: false, error: "empty V1 payload", detectedShape: "v1-legacy" };
  const json = base64urlDecode(payload);
  if (json === null) return { ok: false, error: "V1 base64 decode failed", detectedShape: "v1-legacy" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "V1 JSON parse failed", detectedShape: "v1-legacy" };
  }
  try {
    const result = migrate(parsed);
    return { ok: true, config: result.config, migrated: true, droppedKeys: result.droppedKeys };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      detectedShape: "v1-legacy",
    };
  }
}

// ---------- helpers --------------------------------------------------------

function base64urlDecode(s: string): string | null {
  // Convert base64url to base64, restore padding
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  try {
    // Prefer Buffer in Node; atob in the browser. Both are standard in current targets.
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf8");
    }
    // eslint-disable-next-line no-undef
    return atob(padded);
  } catch {
    return null;
  }
}

// Strip any field whose value deep-equals the schema default. The decoder fills
// defaults back in on parse, so output is lossless.
function stripDefaults(config: GC): Record<string, unknown> {
  const out: Record<string, unknown> = {
    version: config.version,
    // Always include layers (required). Per-layer strip runs below.
    layers: config.layers.map((l) => stripLayerDefaults(l)),
  };

  // colorSpace: keep only if non-default
  if (config.colorSpace !== DEFAULT_CONFIG.colorSpace) out.colorSpace = config.colorSpace;

  // Globals with scalar defaults
  const globals: Array<keyof GC> = [
    "brightness", "saturation", "grain", "vignette",
    "chromaticAberration", "hueShift", "domainWarp", "radialBlur",
    "mouseReact", "oklabEnabled", "toneMapMode",
  ];
  for (const k of globals) {
    if (config[k] !== DEFAULT_CONFIG[k]) out[k as string] = config[k];
  }

  // Effect groups: keep if present (they're optional; undefined means absent)
  const groups: Array<keyof GC> = [
    "noise", "bloom", "blur", "curl", "kaleidoscope", "reactionDiffusion",
    "pixelSort", "feedback", "ascii", "dither", "parallax", "shape3d",
    "meshDistortion", "ripple", "glow", "caustic", "liquify", "trail", "realBloom",
  ];
  for (const k of groups) {
    const v = config[k];
    if (v !== undefined) out[k as string] = v;
  }

  return out;
}

function stripLayerDefaults(layer: GC["layers"][number]): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: layer.type,
    colors: layer.colors,
  };
  // Layer default values sourced from the Zod schema defaults (see src/layer.ts).
  const layerDefaults = LayerConfig.parse({ type: layer.type, colors: layer.colors });
  const scalarKeys: Array<keyof typeof layer> = [
    "speed", "complexity", "scale", "distortion", "opacity", "blendMode", "depth",
  ];
  for (const k of scalarKeys) {
    if (layer[k] !== layerDefaults[k]) out[k as string] = layer[k];
  }
  return out;
}
