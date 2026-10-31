"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { ColorProfile } from "@wavr/core";
import { cssColor } from "@/lib/css-color";
import { Button } from "@/components/litt/button";
import { XIcon } from "@/components/litt/icons";

interface ColorInputProps {
  color: [number, number, number];
  /** How the scene reads the colour: the swatch and picker show it that way (the hex is its values either way). */
  colorProfile?: ColorProfile;
  onChange: (color: [number, number, number]) => void;
  onCommit?: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

// --- Color math ---

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, v];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}


// --- Drag helper ---

function useDrag(onDrag: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handle = useCallback((e: PointerEvent | React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onDrag(x, y);
  }, [onDrag]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handle(e);
  }, [handle]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    handle(e);
  }, [handle]);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  return { ref, onPointerDown, onPointerMove, onPointerUp };
}

// --- Picker popup ---

// A ring that reads on any colour under it: white with a dark hairline.
const PICKER_CURSOR =
  "pointer-events-none absolute -mt-1.5 -ml-1.5 size-3 rounded-litt-pill border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.3)]";

function ColorPicker({ color, colorProfile, onChange, onCommit, onClose }: {
  color: [number, number, number];
  colorProfile: ColorProfile;
  onChange: (c: [number, number, number]) => void;
  onCommit?: () => void;
  onClose: () => void;
}) {
  const [hsv, setHsv] = useState(() => rgbToHsv(...color));
  const [hexInput, setHexInput] = useState(() => rgbToHex(...color).slice(1).toUpperCase());
  const popupRef = useRef<HTMLDivElement>(null);

  // Sync hex input when hsv changes (but not during typing)
  const hexFromHsv = rgbToHex(...hsvToRgb(hsv[0], hsv[1], hsv[2])).slice(1).toUpperCase();

  const updateFromHsv = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    setHexInput(rgbToHex(...hsvToRgb(h, s, v)).slice(1).toUpperCase());
    onChange(hsvToRgb(h, s, v));
  }, [onChange]);

  // SV area drag
  const {
    ref: svRef,
    onPointerDown: onSvPointerDown,
    onPointerMove: onSvPointerMove,
    onPointerUp: onSvPointerUp,
  } = useDrag(useCallback((x: number, y: number) => {
    updateFromHsv(hsv[0], x, 1 - y);
  }, [hsv, updateFromHsv]));

  // Hue bar drag
  const {
    ref: hueRef,
    onPointerDown: onHuePointerDown,
    onPointerMove: onHuePointerMove,
    onPointerUp: onHuePointerUp,
  } = useDrag(useCallback((x: number) => {
    updateFromHsv(x, hsv[1], hsv[2]);
  }, [hsv, updateFromHsv]));

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onCommit?.();
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, onCommit]);

  return (
    <div ref={popupRef} className="litt-glass absolute top-full left-0 z-50 mt-2 flex w-60 flex-col gap-3 p-3">
      {/* SV area */}
      <div
        ref={svRef}
        className="relative h-36 w-full cursor-crosshair touch-none overflow-hidden rounded-litt-control"
        style={{ backgroundColor: cssColor(hsvToRgb(hsv[0], 1, 1), colorProfile) }}
        onPointerDown={onSvPointerDown}
        onPointerMove={onSvPointerMove}
        onPointerUp={onSvPointerUp}
      >
        <div className="absolute inset-0 bg-linear-to-r from-white to-transparent" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-black" />
        <div
          className={PICKER_CURSOR}
          style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%` }}
        />
      </div>

      {/* Hue bar */}
      <div
        ref={hueRef}
        className="picker-hue relative h-3 w-full cursor-pointer touch-none rounded-litt-pill"
        onPointerDown={onHuePointerDown}
        onPointerMove={onHuePointerMove}
        onPointerUp={onHuePointerUp}
      >
        <div
          className={`${PICKER_CURSOR} top-1/2`}
          style={{ left: `${hsv[0] * 100}%` }}
        />
      </div>

      {/* Hex input */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={hexInput}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
            setHexInput(val);
            if (val.length === 6) {
              const rgb = hexToRgb(val);
              const newHsv = rgbToHsv(...rgb);
              setHsv(newHsv);
              onChange(rgb);
            }
          }}
          onBlur={() => {
            setHexInput(hexFromHsv);
            onCommit?.();
          }}
          aria-label="Hex"
          className="h-litt-control-sm min-w-0 flex-1 rounded-litt-control bg-litt-block px-litt-control-pad-sm font-litt-mono text-litt-caption text-litt-fg shadow-(--litt-block-lift) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus"
          spellCheck={false}
        />
        <span aria-hidden="true" className="text-litt-caption font-litt-label text-litt-fg-subtle">Hex</span>
      </div>
    </div>
  );
}

// --- Main export ---

export default function ColorInput({ color, colorProfile = "srgb", onChange, onCommit, onRemove, canRemove }: ColorInputProps) {
  const [open, setOpen] = useState(false);
  const hex = rgbToHex(...color);

  return (
    <div className="relative flex h-litt-control-sm items-center gap-2 rounded-litt-control bg-litt-block pr-1 pl-1 shadow-(--litt-block-lift)">
      <button
        type="button"
        aria-label="Pick a colour"
        aria-expanded={open}
        className="size-6 shrink-0 cursor-pointer rounded-litt-control shadow-[inset_0_0_0_1px_var(--litt-line-strong)]"
        style={{ backgroundColor: cssColor(color, colorProfile) }}
        onClick={() => setOpen(!open)}
      />
      <input
        type="text"
        value={hex.toUpperCase()}
        onChange={(e) => {
          const val = e.target.value;
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            onChange(hexToRgb(val));
          }
        }}
        onBlur={() => onCommit?.()}
        aria-label="Hex"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent font-litt-mono text-litt-caption text-litt-fg outline-none"
      />
      {canRemove && (
        <Button variant="ghost" size="sm" iconOnly aria-label="Remove colour" icon={<XIcon />} onClick={onRemove} />
      )}
      {open && (
        <ColorPicker
          color={color}
          colorProfile={colorProfile}
          onChange={onChange}
          onCommit={onCommit}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
