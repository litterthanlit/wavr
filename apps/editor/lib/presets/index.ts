import { PRESET_CATALOG, PRESET_CATEGORIES, type PresetCategory } from "@wavr/core/presets";
import { presetToStorePatch, type PresetData } from "../preset-patch";
import thumbnailHashes from "../../public/presets/thumbnails.json";

// Presets are defined once, in @wavr/core/presets (catalog.ts). The editor
// loads them as flat patches; see presetToStorePatch. Each has a pre-rendered
// thumbnail in public/presets (`pnpm thumbnails`), whose URL carries a hash of
// the preset's config so a remade preset never shows a cached old picture.

export type { PresetCategory };

export interface Preset {
  id: string;
  name: string;
  category: PresetCategory;
  data: PresetData;
  /** URL of its pre-rendered 4:3 WebP, or null if it has none yet. */
  thumbnail: string | null;
}

export const CATEGORY_LABELS = Object.fromEntries(
  PRESET_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<PresetCategory, string>;

export const CATEGORY_ORDER: PresetCategory[] = PRESET_CATEGORIES.map((category) => category.id);

const THUMBNAIL_HASHES: Record<string, string | undefined> = thumbnailHashes;

export const PRESETS: Preset[] = PRESET_CATALOG.map((entry) => ({
  id: entry.id,
  name: entry.name,
  category: entry.category,
  data: presetToStorePatch(entry.config),
  thumbnail: THUMBNAIL_HASHES[entry.id] ? `/presets/${entry.id}.webp?v=${THUMBNAIL_HASHES[entry.id]}` : null,
}));
