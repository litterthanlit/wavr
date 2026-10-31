"use client";

import { useLayoutEffect, useState, type KeyboardEvent } from "react";
import { Slider as LittSlider } from "@/components/litt/slider";
import { createCommitGate } from "@/lib/commit-gate";
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

/** The gate plus the latest value and onCommit, which key and focus events read after the render that set them. */
function createSliderCommits() {
  const latest: { value: number; onCommit?: (value: number) => void } = { value: 0 };
  const gate = createCommitGate((v) => latest.onCommit?.(v));
  return {
    sync(value: number, onCommit?: (value: number) => void) {
      latest.value = value;
      latest.onCommit = onCommit;
    },
    moved(value: number) {
      latest.value = value;
    },
    keyDown: gate.keyDown,
    release: () => gate.keyUp(latest.value),
    valueCommit: gate.valueCommit,
  };
}

/**
 * litt's Slider, with Wavr's props. litt commits after every key move; the
 * commit gate turns a held key into one undo step, closed when it comes up.
 */
export default function Slider({ label, value, min, max, step, onChange, onCommit, disabled, format }: SliderProps) {
  const [commits] = useState(createSliderCommits);
  useLayoutEffect(() => commits.sync(value, onCommit));

  const onKeyDown = (e: KeyboardEvent) => {
    if (VALUE_KEYS.has(e.key)) commits.keyDown();
  };

  return (
    <div onKeyDown={onKeyDown} onKeyUp={commits.release} onBlur={commits.release}>
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
