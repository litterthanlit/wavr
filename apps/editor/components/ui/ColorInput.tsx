"use client";

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/litt/popover";
import { ColorPanel, describeColor, parseHex } from "@/components/litt/color-picker";
import { Button } from "@/components/litt/button";
import { TrashIcon } from "@/components/litt/icons";

interface ColorInputProps {
  /** Names the chip and its popover, such as "Color 2". */
  label: string;
  color: [number, number, number];
  onChange: (color: [number, number, number]) => void;
  onCommit?: () => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseHex(hex) ?? "#000000";
  return [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/**
 * One palette stop: a chip of the color that opens litt's ColorPanel in a
 * popover. The canvas follows every move (onChange); a release, a key step or
 * a committed hex closes the undo step (onCommit).
 */
export default function ColorInput({ label, color, onChange, onCommit, onRemove, canRemove }: ColorInputProps) {
  const hex = rgbToHex(color);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}, ${describeColor(hex)}`}
          className="size-litt-control-sm cursor-pointer rounded-litt-control shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-fg)_12%,transparent)] transition-[scale] duration-(--litt-dur-instant) ease-litt active:scale-(--litt-press-scale)"
          // litt-allow: the chip is filled with the user's color, not chrome.
          style={{ backgroundColor: hex }}
        />
      </PopoverTrigger>
      <PopoverContent label={label} size="sm" side="left" align="start">
        <div className="flex flex-col gap-litt-control">
          <ColorPanel
            label={label}
            value={hex}
            onValueChange={(next) => onChange(hexToRgb(next))}
            onValueCommit={() => onCommit?.()}
          />
          {canRemove && onRemove && (
            <PopoverClose asChild>
              <Button variant="ghost" size="sm" icon={<TrashIcon />} onClick={onRemove}>
                Remove color
              </Button>
            </PopoverClose>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
