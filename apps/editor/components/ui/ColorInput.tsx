"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { ColorProfile } from "@wavr/core";
import { cssColor } from "@/lib/css-color";
import { Button } from "@/components/litt/button";
import { XIcon } from "@/components/litt/icons";
import { Input } from "@/components/litt/input";

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


/** Three or six hex digits, with or without the hash. */
function parseHex(text: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return null;
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return hexToRgb(digits);
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

// --- Pieces (litt's Color picker spec, components.md) ---

// The cut: an fg-14% hairline, so white still has an edge, and the cut's top wall shade.
const CUT =
  "pointer-events-none absolute inset-0 rounded-litt-control shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-fg)_14%,transparent),var(--litt-cut-shade)]";
// A cap seen from above: a 20px disc of the colour in a 3px --cap ring, with the cap's lift.
const THUMB =
  "pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-litt-pill border-[3px] border-litt-cap shadow-(--litt-cap-lift)";
// A chip of the colour with an fg-12% hairline.
const CHIP = "size-8 shrink-0 rounded-litt-control shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-fg)_12%,transparent)]";

/**
 * litt's Input at sm for the hex. A colour applies as soon as it is one; Enter or blur closes the
 * edit, and what was typed reads aria-invalid until it is a colour, then the last good one comes back.
 */
function HexField({ color, onChange, onCommit }: {
  color: [number, number, number];
  onChange: (c: [number, number, number]) => void;
  onCommit?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      size="sm"
      mono
      aria-label="Hex"
      spellCheck={false}
      className="flex-1"
      value={draft ?? rgbToHex(...color)}
      invalid={draft !== null && parseHex(draft) === null}
      onChange={(e) => {
        setDraft(e.target.value);
        const rgb = parseHex(e.target.value);
        if (rgb) onChange(rgb);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      onBlur={() => {
        setDraft(null);
        onCommit?.();
      }}
    />
  );
}

function ColorPicker({ color, colorProfile, onChange, onCommit, onClose }: {
  color: [number, number, number];
  colorProfile: ColorProfile;
  onChange: (c: [number, number, number]) => void;
  onCommit?: () => void;
  onClose: () => void;
}) {
  // The picker keeps hue, saturation and brightness of its own, so dragging to black or grey never loses the hue.
  const [hsv, setHsv] = useState(() => rgbToHsv(...color));
  const popupRef = useRef<HTMLDivElement>(null);

  const updateFromHsv = useCallback((h: number, s: number, v: number) => {
    setHsv([h, s, v]);
    onChange(hsvToRgb(h, s, v));
  }, [onChange]);

  const {
    ref: svRef,
    onPointerDown: onSvPointerDown,
    onPointerMove: onSvPointerMove,
    onPointerUp: onSvPointerUp,
  } = useDrag(useCallback((x: number, y: number) => {
    updateFromHsv(hsv[0], x, 1 - y);
  }, [hsv, updateFromHsv]));

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
    <div ref={popupRef} className="litt-glass absolute top-full left-0 z-50 mt-2 flex w-72 flex-col gap-4 p-4">
      {/* Saturation left to right, brightness bottom to top. */}
      <div
        ref={svRef}
        className="relative h-40 w-full cursor-crosshair touch-none rounded-litt-control"
        style={{ backgroundColor: cssColor(hsvToRgb(hsv[0], 1, 1), colorProfile) }}
        onPointerDown={onSvPointerDown}
        onPointerMove={onSvPointerMove}
        onPointerUp={onSvPointerUp}
      >
        <div className="absolute inset-0 rounded-litt-control bg-linear-to-r from-white to-transparent" />
        <div className="absolute inset-0 rounded-litt-control bg-linear-to-b from-transparent to-black" />
        <div className={CUT} />
        <div
          className={THUMB}
          style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, backgroundColor: cssColor(hsvToRgb(...hsv), colorProfile) }}
        />
      </div>

      {/* Hue: a 12px rail with the six hue stops, cut in as the area is. */}
      <div
        ref={hueRef}
        className="picker-hue relative h-3 w-full cursor-pointer touch-none rounded-litt-control"
        onPointerDown={onHuePointerDown}
        onPointerMove={onHuePointerMove}
        onPointerUp={onHuePointerUp}
      >
        <div className={CUT} />
        <div
          className={`${THUMB} top-1/2`}
          style={{ left: `${hsv[0] * 100}%`, backgroundColor: cssColor(hsvToRgb(hsv[0], 1, 1), colorProfile) }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div aria-hidden="true" className={CHIP} style={{ backgroundColor: cssColor(color, colorProfile) }} />
        <HexField
          color={color}
          onChange={(rgb) => {
            setHsv(rgbToHsv(...rgb));
            onChange(rgb);
          }}
          onCommit={onCommit}
        />
      </div>
    </div>
  );
}

// --- Main export ---

export default function ColorInput({ color, colorProfile = "srgb", onChange, onCommit, onRemove, canRemove }: ColorInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        aria-label="Pick a colour"
        aria-expanded={open}
        className={`${CHIP} cursor-pointer`}
        style={{ backgroundColor: cssColor(color, colorProfile) }}
        onClick={() => setOpen(!open)}
      />
      <HexField color={color} onChange={onChange} onCommit={onCommit} />
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
