"use client";

import { useLayoutEffect, useState, type KeyboardEvent } from "react";
import { Slider as LittSlider } from "@/components/litt/slider";
import { createSliderCommits } from "@/lib/commit-gate";
import { defaultFormat, type ValueFormat } from "@/lib/units";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  /** How the value reads, beside the track and to assistive tech (lib/units.ts). Defaults to defaultFormat. */
  format?: ValueFormat;
}

// The keys that move litt's slider (WAI-ARIA: a step, a page, or either end).
const VALUE_KEYS = new Set(["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/**
 * litt's Slider, with Wavr's props. litt commits after every key move; the
 * commit gate turns a held key into one undo step, closed when it comes up.
 * The key handlers listen in the capture phase: Radix (arrows, Home, End) and
 * litt (Page Up/Down) commit inside the thumb's own keydown, so the gate has
 * to know a key is down before that.
 */
export default function Slider({ label, value, min, max, step, onChange, onCommit, disabled, format }: SliderProps) {
  const [commits] = useState(createSliderCommits);
  useLayoutEffect(() => commits.sync(value, onCommit));

  const onKeyDown = (e: KeyboardEvent) => {
    if (VALUE_KEYS.has(e.key)) commits.keyDown();
  };

  return (
    <div onKeyDownCapture={onKeyDown} onKeyUpCapture={commits.release} onBlur={commits.release}>
      <LittSlider
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        formatValue={format ?? defaultFormat(min, max, step)}
        onValueChange={(v) => {
          commits.moved(v);
          onChange(v);
        }}
        onValueCommit={commits.valueCommit}
      />
    </div>
  );
}
