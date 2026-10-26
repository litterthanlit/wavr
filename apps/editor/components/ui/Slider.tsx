"use client";

import { useRef, useCallback, useState } from "react";
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

const TICK_COUNT = 32;

function getTickColor(tickPercent: number, valuePercent: number): string {
  if (tickPercent > valuePercent) return "var(--color-tick-inactive)";
  // The accent with an opacity ramp: 10% → 100%
  return `color-mix(in srgb, var(--color-accent) ${Math.round(10 + tickPercent * 0.9)}%, transparent)`;
}

// Keys that move the value, as the WAI-ARIA slider pattern has them: a step,
// ten steps, or to either end.
function keyTarget(key: string, value: number, min: number, max: number, step: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      return value + step;
    case "ArrowLeft":
    case "ArrowDown":
      return value - step;
    case "PageUp":
      return value + step * 10;
    case "PageDown":
      return value - step * 10;
    case "Home":
      return min;
    case "End":
      return max;
    default:
      return null;
  }
}

export default function Slider({ label, value, min, max, step, onChange, onCommit, disabled, format }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const keyed = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);

  const clampToStep = useCallback((raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    // toFixed drops the float noise of the multiply (0.30000000000000004).
    return Number((Math.round(clamped / step) * step).toFixed(6));
  }, [min, max, step]);

  const handlePointer = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const ticksEl = el.querySelector(".slider-ticks") as HTMLElement | null;
    if (!ticksEl) return;
    const rect = ticksEl.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    onChange(clampToStep(raw));
  }, [min, max, onChange, clampToStep]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    dragging.current = true;
    setActive(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointer(e.clientX);
  }, [disabled, handlePointer]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    handlePointer(e.clientX);
  }, [handlePointer]);

  const onPointerUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      setActive(false);
      onCommit?.(value);
    }
  }, [onCommit, value]);

  // A held key repeats: the value moves with each repeat, and the undo step
  // closes when the key comes up, as a drag closes on pointer-up.
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    const target = keyTarget(e.key, value, min, max, step);
    if (target === null) return;
    e.preventDefault();
    keyed.current = true;
    const next = clampToStep(target);
    if (next !== value) onChange(next);
  }, [disabled, value, min, max, step, clampToStep, onChange]);

  const onKeyUp = useCallback(() => {
    if (!keyed.current) return;
    keyed.current = false;
    onCommit?.(value);
  }, [onCommit, value]);

  const valueText = (format ?? defaultFormat(min, max, step))(value);
  const showThumb = hovered || active || focused;

  // Tick height: uniform base, with a bulge around the thumb position
  const valueTick = (percent / 100) * (TICK_COUNT - 1);

  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-30 pointer-events-none" : ""}`}>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        className={`slider-track ${showThumb ? "slider-track-hover" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => { setHovered(false); if (!dragging.current) setActive(false); }}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onKeyUp(); }}
      >
        <span className="slider-label" aria-hidden="true">{label}</span>
        <div className="slider-ticks" aria-hidden="true">
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const tickPct = (i / (TICK_COUNT - 1)) * 100;
            // Bulge: ticks near the thumb grow taller (only when interacting)
            const dist = Math.abs(i - valueTick);
            const bulge = showThumb ? Math.max(0, 1 - dist / 4) : 0;
            const height = 10 + bulge * 10;
            return (
              <div
                key={i}
                className="slider-tick"
                style={{
                  backgroundColor: getTickColor(tickPct, percent),
                  height: `${height}px`,
                }}
              />
            );
          })}
          {/* Thumb line */}
          <div
            className={`slider-thumb ${showThumb ? "slider-thumb-visible" : ""} ${active ? "slider-thumb-active" : ""}`}
            style={{ left: `${percent}%` }}
          />
        </div>
        <span className="slider-value" aria-hidden="true">{valueText}</span>
      </div>
    </div>
  );
}
