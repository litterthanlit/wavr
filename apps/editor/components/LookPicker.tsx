"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ImageIcon } from "lucide-react";
import type { GradientType } from "@wavr/core";
import { GRADIENT_OPTIONS, lookThumbnail } from "@/lib/gradient-types";

const COLUMNS = 5;

/** Where each key moves focus from tile `i`, in a grid of `count` tiles; null for other keys. Off the grid's edge it stays. */
function keyTarget(key: string, i: number, count: number): number | null {
  const targets: Record<string, number> = {
    ArrowLeft: i - 1,
    ArrowRight: i + 1,
    ArrowUp: i - COLUMNS,
    ArrowDown: i + COLUMNS,
    Home: 0,
    End: count - 1,
  };
  if (!(key in targets)) return null;
  const target = targets[key];
  return target >= 0 && target < count ? target : i;
}

/**
 * The looks as a grid of picture tiles, a radio group. Arrow keys, Home and End
 * move focus; Enter or Space picks, so browsing with the keyboard doesn't make
 * an undo step (and a shader compile) per tile.
 */
export default function LookPicker({ value, onPick }: { value: GradientType; onPick: (type: GradientType) => void }) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const selected = Math.max(0, GRADIENT_OPTIONS.findIndex((option) => option.value === value));
  // Roving tabindex: Tab enters the grid on the picked tile, and leaves from the focused one.
  const tabStop = focused ?? selected;

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const target = keyTarget(e.key, i, GRADIENT_OPTIONS.length);
    if (target === null) return;
    e.preventDefault();
    tiles.current[target]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Look"
      className="grid grid-cols-5 gap-1.5"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null);
      }}
    >
      {GRADIENT_OPTIONS.map((option, i) => {
        const checked = i === selected;
        const thumbnail = lookThumbnail(option.value);
        return (
          <button
            key={option.value}
            ref={(el) => {
              tiles.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.label}
            tabIndex={i === tabStop ? 0 : -1}
            onFocus={() => setFocused(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onPick(option.value)}
            className={`group relative block aspect-[4/3] overflow-hidden rounded-md border bg-surface
              transition-colors duration-150 focus-visible:outline-offset-[3px] ${
                checked ? "border-transparent ring-2 ring-accent" : "border-border hover:border-border-active"
              }`}
          >
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-rendered, already-sized WebPs (`pnpm thumbnails`); the optimizer would only re-encode them
              <img
                src={thumbnail}
                alt=""
                width={384}
                height={288}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-300
                  motion-safe:group-hover:scale-[1.04]"
              />
            ) : (
              <ImageIcon aria-hidden="true" className="absolute inset-0 m-auto h-4 w-4 text-text-tertiary" />
            )}
          </button>
        );
      })}
    </div>
  );
}
