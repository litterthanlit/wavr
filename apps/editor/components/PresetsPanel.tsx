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
      className="group flex flex-col rounded-lg border border-border hover:border-border-active overflow-hidden
        bg-surface text-left transition-colors duration-150"
    >
      <span className="block relative w-full aspect-[4/3] overflow-hidden" style={{ background: placeholder }}>
        {preset.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element -- pre-rendered, already-sized WebPs (`pnpm thumbnails`); the optimizer would only re-encode them
          <img
            src={preset.thumbnail}
            alt=""
            width={384}
            height={288}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-300
              motion-safe:group-hover:scale-[1.04]"
          />
        )}
      </span>
      <span className="py-1.5 px-2 text-[11px] text-text-secondary group-hover:text-text-primary transition-colors truncate">
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
              className="flex items-center gap-1.5 w-full py-2 text-left"
            >
              <svg
                className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 2l4 4-4 4z" />
              </svg>
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-[10px] text-text-tertiary ml-auto">
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
