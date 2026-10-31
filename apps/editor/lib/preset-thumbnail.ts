import thumbnailHashes from "../public/presets/thumbnails.json";

// Each preset has a pre-rendered 384×288 sRGB WebP in public/presets
// (`pnpm thumbnails`). Its URL carries a hash of the preset's config, so a
// remade preset never shows a cached old picture.

const THUMBNAIL_HASHES: Record<string, string | undefined> = thumbnailHashes;

/** URL of the preset's thumbnail, or null if it has none yet. */
export function presetThumbnail(id: string): string | null {
  const hash = THUMBNAIL_HASHES[id];
  return hash ? `/presets/${id}.webp?v=${hash}` : null;
}
