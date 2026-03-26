"use client";

import { useRef } from "react";

interface ColorInputProps {
  color: [number, number, number];
  onChange: (color: [number, number, number]) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

export default function ColorInput({ color, onChange, onRemove, canRemove }: ColorInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const hex = rgbToHex(...color);

  return (
    <div className="flex items-center gap-2 group">
      <button
        className="w-7 h-7 rounded-md border border-border-active shrink-0 cursor-pointer transition-transform hover:scale-105"
        style={{ backgroundColor: hex }}
        onClick={() => pickerRef.current?.click()}
      />
      <input
        ref={pickerRef}
        type="color"
        value={hex}
        onChange={(e) => onChange(hexToRgb(e.target.value))}
        className="sr-only"
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
        className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-xs font-mono text-text-primary
          focus:outline-none focus:border-border-active transition-colors duration-150"
      />
      {canRemove && (
        <button
          onClick={onRemove}
          className="text-text-tertiary hover:text-text-primary transition-colors text-sm opacity-0 group-hover:opacity-100"
        >
          x
        </button>
      )}
    </div>
  );
}
