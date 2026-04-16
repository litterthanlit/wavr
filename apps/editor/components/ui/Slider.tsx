"use client";

import { useRef, useCallback, useState } from "react";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
}

const TICK_COUNT = 32;

function getTickColor(tickPercent: number, valuePercent: number): string {
  if (tickPercent > valuePercent) return "var(--color-tick-inactive)";
  // #F51853 with opacity ramp: 10% → 100%
  const alpha = Math.round(0.1 * 255 + (tickPercent / 100) * 0.9 * 255);
  const hex = alpha.toString(16).padStart(2, "0");
  return `#F51853${hex}`;
}

export default function Slider({ label, value, min, max, step, onChange, onCommit, disabled }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);

  const clampToStep = useCallback((raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    return Math.round(clamped / step) * step;
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

  const displayPercent = Math.round(percent);
  const showThumb = hovered || active;

  // Tick height: uniform base, with a bulge around the thumb position
  const valueTick = (percent / 100) * (TICK_COUNT - 1);

  return (
    <div className={`flex flex-col gap-1 ${disabled ? "opacity-30 pointer-events-none" : ""}`}>
      <div
        ref={trackRef}
        className={`slider-track ${showThumb ? "slider-track-hover" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => { setHovered(false); if (!dragging.current) setActive(false); }}
      >
        <span className="slider-label">{label}</span>
        <div className="slider-ticks">
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
        <span className="slider-value">{displayPercent}%</span>
      </div>
    </div>
  );
}
