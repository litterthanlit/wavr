"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface ColorInputProps {
  color: [number, number, number];
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

function hueToRgbHex(h: number): string {
  const [r, g, b] = hsvToRgb(h, 1, 1);
  return rgbToHex(r, g, b);
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

function ColorPicker({ color, onChange, onCommit, onClose }: {
  color: [number, number, number];
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
  const svDrag = useDrag(useCallback((x: number, y: number) => {
    updateFromHsv(hsv[0], x, 1 - y);
  }, [hsv, updateFromHsv]));

  // Hue bar drag
  const hueDrag = useDrag(useCallback((x: number) => {
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
    <div ref={popupRef} className="picker-popup">
      {/* SV area */}
      <div
        ref={svDrag.ref}
        className="picker-sv"
        style={{ backgroundColor: hueToRgbHex(hsv[0]) }}
        onPointerDown={svDrag.onPointerDown}
        onPointerMove={svDrag.onPointerMove}
        onPointerUp={svDrag.onPointerUp}
      >
        <div className="picker-sv-white" />
        <div className="picker-sv-black" />
        <div
          className="picker-sv-cursor"
          style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%` }}
        />
      </div>

      {/* Hue bar */}
      <div
        ref={hueDrag.ref}
        className="picker-hue"
        onPointerDown={hueDrag.onPointerDown}
        onPointerMove={hueDrag.onPointerMove}
        onPointerUp={hueDrag.onPointerUp}
      >
        <div
          className="picker-hue-cursor"
          style={{ left: `${hsv[0] * 100}%` }}
        />
      </div>

      {/* Hex input */}
      <div className="picker-hex-row">
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
          className="picker-hex-input"
          spellCheck={false}
        />
        <span className="picker-hex-label">HEX</span>
      </div>
    </div>
  );
}

// --- Main export ---

export default function ColorInput({ color, onChange, onCommit, onRemove, canRemove }: ColorInputProps) {
  const [open, setOpen] = useState(false);
  const hex = rgbToHex(...color);

  return (
    <div className="color-input-row group" style={{ position: "relative" }}>
      <button
        className="color-swatch"
        style={{ backgroundColor: hex }}
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
        className="color-hex-input"
      />
      {canRemove && (
        <button onClick={onRemove} className="color-remove">&times;</button>
      )}
      {open && (
        <ColorPicker
          color={color}
          onChange={onChange}
          onCommit={onCommit}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
