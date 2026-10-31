"use client";

import { useState } from "react";
import { useGradientStore } from "@/lib/store";
import { PRESETS, CATEGORY_ORDER, CATEGORY_LABELS, PresetCategory, type Preset } from "@/lib/presets";
import { cssColor } from "@/lib/css-color";

function PresetCard({ preset, onLoad }: { preset: Preset; onLoad: (preset: Preset) => void }) {
  // The preset's colours as a fade sit behind the picture while it loads.
  const placeholder = `linear-gradient(135deg, ${preset.data.colors!
    .map((c) => cssColor(c, preset.data.colorProfile))
    .join(", ")})`;
  return (
    <button
      type="button"
      onClick={() => onLoad(preset)}
      // A litt card (raised, no outer shadow): hover moves its fill one step and nothing moves.
      className="litt-raised group flex flex-col gap-1 p-1 text-left transition-colors duration-(--litt-dur-instant) ease-litt hover:bg-litt-surface-2"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-litt-control" style={{ background: placeholder }}>
        {preset.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- pre-rendered, already-sized WebPs (`pnpm thumbnails`); the optimizer would only re-encode them
          <img
            src={preset.thumbnail}
            alt=""
            width={384}
            height={288}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </span>
      <span className="truncate px-1 pb-1 text-litt-small text-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt group-hover:text-litt-fg">
        {preset.name}
      </span>
    </button>
  );
}

export default function PresetsPanel() {
  const loadPreset = useGradientStore((s) => s.loadPreset);
  const [collapsed, setCollapsed] = useState<Set<PresetCategory>>(() => new Set());

  const toggleCategory = (cat: PresetCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1 p-4">
      {CATEGORY_ORDER.map((cat) => {
        const catPresets = PRESETS.filter((p) => p.category === cat);
        if (catPresets.length === 0) return null;
        const isCollapsed = collapsed.has(cat);
        const listId = `presets-${cat}`;

        return (
          <section key={cat} aria-label={CATEGORY_LABELS[cat]}>
            <button
              type="button"
              onClick={() => toggleCategory(cat)}
              aria-expanded={!isCollapsed}
              aria-controls={listId}
              className="flex items-center gap-2 w-full py-2 text-left"
            >
              <svg
                className={`w-3 h-3 text-litt-fg-subtle transition-transform duration-(--litt-dur-responsive) ease-litt-responsive ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 2l4 4-4 4z" />
              </svg>
              <span className="text-litt-caption font-litt-label text-litt-fg-subtle">
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-litt-caption font-normal text-litt-fg-subtle ml-auto">
                {catPresets.length}
              </span>
            </button>

            {!isCollapsed && (
              <div id={listId} className="grid grid-cols-2 gap-2 pb-3">
                {catPresets.map((preset) => (
                  <PresetCard key={preset.id} preset={preset} onLoad={(p) => loadPreset(p.data)} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
