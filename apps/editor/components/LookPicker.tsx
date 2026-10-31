"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { ImageIcon } from "@/components/litt/icons";
import type { GradientType } from "@wavr/core";
import { GRADIENT_OPTIONS, lookThumbnail } from "@/lib/gradient-types";

const COLUMNS = 5;

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

export default function LookPicker({ value, onPick }: { value: GradientType; onPick: (type: GradientType) => void }) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const selected = GRADIENT_OPTIONS.findIndex((option) => option.value === value);
  const tabStop = focused ?? selected;

  // A listbox, not a radio group: arrows only move focus and Enter or Space picks, so browsing
  // the looks by keyboard doesn't make an undo step and a shader compile per tile.
  const moveFocus = (e: KeyboardEvent, i: number) => {
    const target = keyTarget(e.key, i, GRADIENT_OPTIONS.length);
    if (target === null) return;
    e.preventDefault();
    tiles.current[target]?.focus();
  };

  return (
    <div
      role="listbox"
      aria-label="Look"
      className="grid grid-cols-5 gap-2"
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
            role="option"
            aria-selected={checked}
            aria-label={option.label}
            title={option.label}
            tabIndex={i === tabStop ? 0 : -1}
            onFocus={() => setFocused(i)}
            onKeyDown={(e) => moveFocus(e, i)}
            onClick={() => onPick(option.value)}
            className={`group relative block aspect-[4/3] overflow-hidden rounded-litt-control border bg-litt-surface-2
              transition-colors duration-(--litt-dur-instant) ease-litt focus-visible:outline-offset-[3px] ${
                checked
                  ? "border-transparent ring-2 ring-litt-fg ring-offset-2 ring-offset-litt-surface-1"
                  : "border-litt-line hover:border-litt-line-strong"
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
              <ImageIcon className="absolute inset-0 m-auto text-litt-fg-subtle" />
            )}
          </button>
        );
      })}
    </div>
  );
}
