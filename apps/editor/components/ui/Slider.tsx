"use client";

import { Slider as LittSlider } from "@/components/litt/slider";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  /** The reading at the end of the label row. Defaults to the position in the range as a percentage. */
  format?: (value: number) => string;
}

/**
 * The panels' slider: litt's Slider with the label row and the reading on.
 * onChange runs on every move (the store's set()), onCommit when a drag is
 * released or a key moves the thumb (commitSet(), one undo step).
 */
export default function Slider({ label, value, min, max, step, onChange, onCommit, disabled, format }: SliderProps) {
  const percent = (v: number) => `${Math.round(((v - min) / (max - min)) * 100)}%`;
  return (
    <LittSlider
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onValueChange={onChange}
      onValueCommit={onCommit}
      disabled={disabled}
      showValue
      formatValue={format ?? percent}
    />
  );
}
