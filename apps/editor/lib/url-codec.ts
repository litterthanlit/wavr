/**
 * url-codec.ts — the zod-backed half of the URL bridge.
 *
 * `@wavr/schema`'s codec drags in zod, the LZ compressor, a Buffer polyfill and
 * the V1 migration: about 110 KB of JavaScript (28 KB gzipped) to download and
 * evaluate, none of it needed to paint the editor. url-sync.ts therefore loads
 * this module on demand through `loadUrlCodec()` (a hash to decode, the first
 * debounced write, a share-link copy) and warms it when the browser is idle.
 *
 * Don't import it statically from anything in the editor's initial bundle. Fine
 * places to import it directly: code that is itself lazy (ExportModal) and
 * routes that always decode a hash (/embed).
 */

import { GradientConfig, encodeUrl, tryDecodeUrl, MAX_URL_BYTES } from "@wavr/schema";
import type { GradientState } from "./store";
import { storeToConfig } from "./url-sync";

export { GradientConfig, encodeUrl, tryDecodeUrl, MAX_URL_BYTES };

/**
 * Encode the current state to a URL hash body (no leading `#`). Used by
 * ExportModal to build embed snippets. On failure, returns an empty string
 * rather than throwing — callers get a harmless empty iframe.
 */
export function encodeState(state: GradientState): string {
  try {
    const config = storeToConfig(state);
    const parsed = GradientConfig.safeParse(config);
    if (!parsed.success) return "";
    return encodeUrl(parsed.data);
  } catch {
    return "";
  }
}
