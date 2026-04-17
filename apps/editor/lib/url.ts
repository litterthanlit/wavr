/**
 * url.ts — thin shim over `url-sync.ts`.
 *
 * History: this module used to own a bespoke base64-JSON codec via
 * `exportProjectStateForUrl`. Spec 0003 retires that internal codec in favor
 * of `@wavr/schema`'s V2 LZ-compressed codec. The public surface stays:
 *   - `getShareUrl(state)` — returns a full shareable URL with a `#s2.…` hash.
 *   - `copyShareUrl(state)` — copies that URL to the clipboard and flushes
 *     `replaceState` so the hash matches the clipboard.
 *   - `encodeState(state)` — returns the V2 hash body (no leading `#`).
 *     Kept for `components/ExportModal.tsx` embed-code generation.
 *
 * Decoding is not re-exported — callers go through
 * `@/lib/url-sync::applyHashToStore` on mount / popstate.
 */

import type { GradientState } from "./store";
import { getShareUrlV2, storeToConfig } from "./url-sync";
import { encodeUrl, GradientConfig } from "@wavr/schema";

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

export function getShareUrl(state: GradientState): string {
  return getShareUrlV2(state);
}

export function copyShareUrl(state: GradientState): Promise<void> {
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
