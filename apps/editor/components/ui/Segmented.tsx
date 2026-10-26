"use client";

import { useRef, type KeyboardEvent } from "react";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

const STEPS: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

export default function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const step = STEPS[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    buttons.current[next]?.focus();
    onChange(options[next].value);
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-lg bg-surface p-1">
      {options.map((option, i) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors duration-150 ${
              checked ? "bg-elevated text-text-primary" : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
