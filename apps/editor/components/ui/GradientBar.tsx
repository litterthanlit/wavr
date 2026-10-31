"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColorProfile } from "@wavr/core";
import { cssColor } from "@/lib/css-color";
import {
  MAX_STOPS,
  MIN_STOPS,
  barPalette,
  insertStop,
  insertionIndex,
  moveStop,
  nearestSlot,
  stopPosition,
  type Rgb,
} from "@/lib/color-stops";

interface GradientBarProps {
  colors: Rgb[];
  selected: number;
  onSelect: (index: number) => void;
  /** A one-shot change to the whole list (insert, reorder, remove): one undo step. */
  onColorsChange: (colors: Rgb[]) => void;
  colorProfile: ColorProfile;
  oklab: boolean;
  softness: number;
}

// Samples of the baked palette in the bar's CSS gradient: enough that the
// browser's own interpolation between them can't be told from the table.
const BAR_SAMPLES = 33;

const hex = (c: Rgb) => cssColor(c, "srgb").toUpperCase();

/**
 * The layer's colours as a bar showing the palette the engine renders, with
 * a handle per stop. Click a handle to select it, drag it to reorder, click
 * the bar between handles to add the colour already there. Keyboard: arrows
 * move the selection, Alt+arrows move the stop, Delete removes it.
 */
export default function GradientBar({
  colors,
  selected,
  onSelect,
  onColorsChange,
  colorProfile,
  oklab,
  softness,
}: GradientBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const handleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // While a handle is dragged: where it started and the slot it is over.
  const [drag, setDrag] = useState<{ from: number; to: number; pointerId: number } | null>(null);

  const palette = useMemo(
    () => barPalette(colors, { oklab, softness, colorProfile }),
    [colors, oklab, softness, colorProfile],
  );
  const background = useMemo(() => {
    const stops = Array.from({ length: BAR_SAMPLES }, (_, i) => {
      const t = i / (BAR_SAMPLES - 1);
      return `${cssColor(palette.sample(t), colorProfile)} ${(t * 100).toFixed(2)}%`;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [palette, colorProfile]);

  // The order shown while dragging: the dragged stop in the slot it is over.
  const shown = drag ? moveStop(colors, drag.from, drag.to) : colors;
  const shownSelected = drag ? drag.to : selected;
  const count = shown.length;

  const xOf = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }, []);

  // Focus follows a stop that moved, was added or was removed, once the
  // render that put it in its new place has committed (each of those also
  // changes the colours or the selection, so a render always follows).
  const pendingFocus = useRef<number | null>(null);
  const focusHandle = (index: number) => {
    pendingFocus.current = index;
  };
  useEffect(() => {
    if (pendingFocus.current === null) return;
    handleRefs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  });

  const onTrackPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || colors.length >= MAX_STOPS) return;
    const x = xOf(e.clientX);
    const index = insertionIndex(x, colors.length);
    onColorsChange(insertStop(colors, index, palette.sample(x)));
    onSelect(index);
    focusHandle(index);
  };

  const onHandlePointerDown = (index: number) => (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onSelect(index);
    setDrag({ from: index, to: index, pointerId: e.pointerId });
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const to = nearestSlot(xOf(e.clientX), colors.length);
    if (to !== drag.to) setDrag({ ...drag, to });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    if (drag.to !== drag.from) {
      onColorsChange(moveStop(colors, drag.from, drag.to));
      onSelect(drag.to);
      focusHandle(drag.to);
    }
  };

  const onHandleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : 0;
    if (step !== 0) {
      e.preventDefault();
      const target = Math.min(colors.length - 1, Math.max(0, index + step));
      if (target === index) return;
      if (e.altKey) onColorsChange(moveStop(colors, index, target));
      onSelect(target);
      focusHandle(target);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const target = e.key === "Home" ? 0 : colors.length - 1;
      onSelect(target);
      focusHandle(target);
    } else if ((e.key === "Delete" || e.key === "Backspace") && colors.length > MIN_STOPS) {
      e.preventDefault();
      onColorsChange(colors.filter((_, i) => i !== index));
      const target = Math.min(index, colors.length - 2);
      onSelect(target);
      focusHandle(target);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative px-2 pt-1 pb-3">
        <div
          ref={trackRef}
          className={`relative h-litt-control-sm rounded-litt-control shadow-[inset_0_0_0_1px_var(--litt-line)] ${
            colors.length < MAX_STOPS ? "cursor-copy" : ""
          }`}
          style={{ background }}
          onPointerDown={onTrackPointerDown}
          aria-hidden="true"
        />
        <div role="group" aria-label="Color stops" className="absolute inset-x-2 bottom-3 h-0">
          {shown.map((color, i) => {
            const isSelected = i === shownSelected;
            return (
              <button
                key={i}
                ref={(el) => {
                  handleRefs.current[i] = el;
                }}
                type="button"
                tabIndex={isSelected ? 0 : -1}
                aria-pressed={isSelected}
                aria-label={`Color ${i + 1} of ${count}, ${hex(color)}`}
                onPointerDown={onHandlePointerDown(i)}
                onPointerMove={onHandlePointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onHandleKeyDown(i)}
                onFocus={() => {
                  if (!drag && i !== selected) onSelect(i);
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-litt-pill border-2 border-white touch-none
                  shadow-(--litt-cap-lift) cursor-grab active:cursor-grabbing
                  transition-[left,width,height] duration-(--litt-dur-responsive) ease-litt-responsive
                  ${isSelected ? "size-5 ring-2 ring-litt-fg z-10" : "size-4"}`}
                style={{ left: `${stopPosition(i, count) * 100}%`, backgroundColor: cssColor(color, colorProfile) }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
