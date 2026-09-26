import { PRESET_CATALOG, PRESET_CATEGORIES, type PresetCategory } from "@wavr/core/presets";
import { presetToStorePatch, type PresetData } from "../preset-patch";

// Presets are defined once, in @wavr/core/presets (catalog.ts). The editor
// loads them as flat patches; see presetToStorePatch.

export type { PresetCategory };

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory;
  data: PresetData;
}

export const CATEGORY_LABELS = Object.fromEntries(
  PRESET_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<PresetCategory, string>;

export const CATEGORY_ORDER: PresetCategory[] = PRESET_CATEGORIES.map((category) => category.id);

export const PRESETS: Preset[] = PRESET_CATALOG.map((entry) => ({
  id: entry.id,
  name: entry.name,
  category: entry.category,
  data: presetToStorePatch(entry.config),
}));
