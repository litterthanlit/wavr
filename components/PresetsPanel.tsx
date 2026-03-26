"use client";

import { useGradientStore, GradientState } from "@/lib/store";
import { PRESETS } from "@/lib/presets";

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function PresetsPanel() {
  const loadPreset = useGradientStore((s: GradientState) => s.loadPreset);

  return (
    <div className="p-4 grid grid-cols-2 gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.name}
          onClick={() => loadPreset(preset.data)}
          className="flex flex-col rounded-lg border border-border hover:border-border-active overflow-hidden
            transition-all duration-150 hover:scale-[1.02] group"
        >
          {/* Color preview */}
          <div
            className="h-20 w-full"
            style={{
              background: `linear-gradient(135deg, ${preset.data.colors!
                .map((c) => rgbToHex(...c))
                .join(", ")})`,
            }}
          />
          <div className="py-2 px-2.5 bg-surface w-full">
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              {preset.name}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
