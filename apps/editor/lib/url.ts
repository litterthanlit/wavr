/**
 * url.ts — thin shim over `url-sync.ts`.
 *
 * History: this module used to own a bespoke base64-JSON codec via
 * `exportProjectStateForUrl`. Spec 0003 retires that internal codec in favor
 * of `@wavr/schema`'s V2 LZ-compressed codec. The public surface stays:
 *   - `getShareUrl(state)` — returns a full shareable URL with a `#s2.…` hash.
 *   - `copyShareUrl(state)` — copies that URL to the clipboard and flushes
 *     `replaceState` so the hash matches the clipboard.
 *
 * `encodeState(state)` (the V2 hash body for embed snippets) lives in
 * `url-codec.ts`, next to the codec it needs; this module is part of the
 * editor's initial bundle and must stay free of it.
 *
 * Decoding is not re-exported — callers go through
 * `@/lib/url-sync::applyHashToStore` on mount / popstate.
 */

import type { GradientState } from "./store";
import { getShareUrlV2, isUrlCodecLoaded, loadUrlCodec } from "./url-sync";

export function getShareUrl(state: GradientState): string {
  return getShareUrlV2(state);
}

export async function copyShareUrl(state: GradientState): Promise<void> {
  // The codec is normally loaded long before anyone clicks Share; awaiting only
  // when it isn't keeps the clipboard write inside the click's call stack.
  if (!isUrlCodecLoaded()) await loadUrlCodec().catch(() => undefined);
  const url = getShareUrlV2(state);
  // Ensure the hash on the current page matches what we just copied — useful
  // when the user clicks share mid-debounce.
  if (typeof window !== "undefined") {
    const idx = url.indexOf("#");
    const hash = idx >= 0 ? url.slice(idx) : "";
    if (hash) window.history.replaceState(null, "", hash);
  }
  return navigator.clipboard.writeText(url);
}
