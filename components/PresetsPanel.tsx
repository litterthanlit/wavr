"use client";

import { useState } from "react";
import { useGradientStore, GradientState } from "@/lib/store";
import { PRESETS, CATEGORY_ORDER, CATEGORY_LABELS, PresetCategory } from "@/lib/presets";

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function PresetsPanel() {
  const loadPreset = useGradientStore((s: GradientState) => s.loadPreset);
  const [collapsed, setCollapsed] = useState<Set<PresetCategory>>(new Set());

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

        return (
          <div key={cat}>
            <button
              onClick={() => toggleCategory(cat)}
              className="flex items-center gap-1.5 w-full py-2 text-left"
            >
              <svg
                className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                viewBox="0 0 12 12"
                fill="currentColor"
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
              <div className="grid grid-cols-2 gap-2 pb-3">
                {catPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset.data)}
                    className="flex flex-col rounded-lg border border-border hover:border-border-active overflow-hidden
                      transition-all duration-150 hover:scale-[1.02] group"
                  >
                    <div
                      className="h-16 w-full"
                      style={{
                        background: `linear-gradient(135deg, ${preset.data.colors!
                          .map((c) => rgbToHex(...c))
                          .join(", ")})`,
                      }}
                    />
                    <div className="py-1.5 px-2 bg-surface w-full">
                      <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
