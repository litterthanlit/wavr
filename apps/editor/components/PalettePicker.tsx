"use client";

import { sameStops, type Rgb } from "@/lib/color-stops";
import { NATURE_PALETTES, paletteSwatch } from "@/lib/nature-palettes";

/** Palettes from nature: one press swaps the layer's colours and keeps its look. */
export default function PalettePicker({ colors, onPick }: { colors: readonly Rgb[]; onPick: (colors: Rgb[]) => void }) {
  return (
    <div role="group" aria-label="Nature palettes" className="grid grid-cols-7 gap-2">
      {NATURE_PALETTES.map((palette) => {
        const current = sameStops(colors, palette.colors);
        return (
          <button
            key={palette.id}
            type="button"
            aria-label={palette.name}
            aria-pressed={current}
            title={palette.name}
            onClick={() => onPick(palette.colors.map((c) => [...c] as Rgb))}
            style={{ backgroundImage: paletteSwatch(palette.colors) }}
            className={`block h-6 rounded-litt-control border transition-colors duration-(--litt-dur-instant) ease-litt
              focus-visible:outline-offset-[3px] ${
                current
                  ? "border-transparent ring-2 ring-litt-fg ring-offset-2 ring-offset-litt-surface-1"
                  : "border-litt-line hover:border-litt-line-strong"
              }`}
          />
        );
      })}
    </div>
  );
}
