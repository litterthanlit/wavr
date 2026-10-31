import { PRESET_CATALOG, type PresetEntry } from "@wavr/core/presets";
import { presetToStorePatch } from "./preset-patch";
import { useGradientStore } from "./store";
import { replaceNextWrite } from "./url-sync";

// `/editor?preset=<id>` opens the editor on a catalogue preset: the landing's
// looks link here. The page imports this module only when the URL has a query,
// so the catalogue stays out of the initial /editor bundle.

export type PresetId = PresetEntry["id"];

/**
 * The catalogue preset `?preset=` names, or null: when it names none, or when
 * the hash already carries a scene (a shared link wins over the query).
 */
export function presetFromSearch(search: string, hash: string): PresetId | null {
  if (hash.length > 1) return null;
  const id = new URLSearchParams(search).get("preset");
  return PRESET_CATALOG.find((entry) => entry.id === id)?.id ?? null;
}

/**
 * Loads the preset `?preset=` names, as the Presets panel does, and drops the
 * query, so url-sync mirrors the scene into the hash as usual. The visit
 * starts here, so that write replaces the history entry rather than pushing
 * one Back would return to. An unknown name leaves the initial scene.
 */
export function openPresetFromSearch(): void {
  const { pathname, search, hash } = window.location;
  if (!new URLSearchParams(search).has("preset")) return;
  const id = presetFromSearch(search, hash);
  // State null, as url-sync writes it: Next.js leaves a replaceState that
  // carries its own state (`__NA`) out of its router, which would then put the
  // query back on its next history update.
  window.history.replaceState(null, "", pathname + hash);
  const entry = PRESET_CATALOG.find((preset) => preset.id === id);
  if (!entry) return;
  useGradientStore.getState().loadPreset(presetToStorePatch(entry.config));
  replaceNextWrite();
}
