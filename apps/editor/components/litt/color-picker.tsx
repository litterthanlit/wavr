"use client";
// @litt/color-picker 2026.10.23. What changed: https://littmd.vercel.app/changelog.md

/**
 * Color picker: one color, picked by eye or typed as hex (components.md, "Color picker"). ColorPanel is the picker on
 * its own; ColorPicker is a field that opens it in a Popover.
 *
 * - Values are six-digit hex strings, lowercase, with the hash. The panel keeps hue, saturation and brightness of its
 *   own, so dragging to black or grey never loses the hue, and it takes a new value from outside only when that value
 *   is a different color.
 * - The color is the user's data, never chrome. It only ever fills the area, the rails, the thumbs and the chips. No
 *   color is written in this file: the gradient stops are computed from the hue, so the lint's rule on raw colors
 *   holds.
 * - Area: saturation left to right, brightness bottom to top, at the control radius with an inset --litt-line hairline so
 *   a white corner still has an edge. The thumb is a 20px circle filled with the color, a 2px --litt-surface-1 ring inside
 *   and a 1px --litt-line-strong edge outside, so it reads on any color in both themes. Its centre reaches the corners,
 *   because the corners are real colors (white, black, the pure hue). Focus swaps the outer edge for a 2px --litt-focus
 *   ring, which stays inside the popover's 12px padding.
 * - Hue: a 12px rail at the control radius with the six hue stops, and the same thumb filled with the pure hue.
 * - Keyboard (the React Aria ColorArea pattern, as the Pad): two visually hidden range inputs for the area, Saturation
 *   in the tab order and Brightness at tabindex -1, still reachable by a screen reader. ← → change saturation, ↑ ↓
 *   brightness, Shift makes it 10 steps, Page Up and Page Down move brightness by 10, Home and End take saturation to
 *   its ends. The hue is a native range input with the same Shift and Page steps. Each input's aria-valuetext says the
 *   color in words ("Dark blue, #1f3a8a").
 * - Pointer: pressing anywhere moves the thumb there and starts a drag; the area captures the pointer, so a drag may
 *   leave it. Both surfaces are data-no-drag and touch-action none.
 * - Hex: the Input at sm, in mono. It commits on Enter or when it loses focus, takes three or six digits with or
 *   without the hash, and puts the last good value back when what was typed is not a color. While it is not a color it
 *   is aria-invalid.
 * - Eyedropper: an icon-only ghost Button beside the hex, only where the browser has the EyeDropper API (Chromium on a
 *   desktop). It is read after hydration, so the server and the first render never show it.
 * - Swatches: optional, as native radios in a fieldset with a hidden legend, so the arrow keys move between them. Each
 *   chip is 24px (32 on a coarse pointer) at the control radius with an fg-12% hairline. The picked chip carries a
 *   16px check in black or white, whichever reads on that chip, because no token is sure to read on every color.
 * - Motion: none. The thumbs follow the pointer and the keys at once, and colors change at once: an eased color would
 *   lag the hand. The ColorPicker's popover carries the only motion, on the responsive tier.
 *
 * ColorPicker:
 * - Field: the Select trigger's look and sizes, as the Date picker's, with a 16px chip of the color, the hex in mono
 *   and a 16px chevron at the end, or a placeholder in --litt-fg-subtle. A button with aria-haspopup="dialog", named by its
 *   label and the color in words. Label above, hint or error below.
 * - It opens the ColorPanel in a PopoverContent (md, 320px, so eight swatches fit a row), which is a bottom sheet on compact screens. Focus lands on
 *   the area (the first control in it). The value changes live while the panel is open; Esc or a click outside closes it.
 * - A form gets the value through a hidden field named `name`.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button } from "./button";
import { Input } from "./input";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/* Radix's asChild, spread in: shadcn's CLI rewrites a written asChild to Base UI's render prop in base-* hosts. */
const asChildProps = { asChild: true } as const;

/* ----------------------------------------------------------------- color math */

/** Hue in degrees (0 to 360), saturation and brightness from 0 to 1. */
export type Hsv = { h: number; s: number; v: number };

/** One chip in the swatches row. */
export type ColorSwatch = {
  /** The color, as hex. */
  value: string;
  /** Its name, such as "Atelier blue". It names the chip for screen readers and shows as its tooltip. */
  label: string;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const HEX_DIGITS = /^[0-9a-f]{6}$/;
const SHORT_DIGITS = /^[0-9a-f]{3}$/;

/** Reads "#2f6fe4", "2F6FE4", "#26e" or "26e" as a six-digit lowercase hex with the hash. Anything else is null. */
export function parseHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  if (HEX_DIGITS.test(raw)) return "#" + raw;
  if (SHORT_DIGITS.test(raw)) return "#" + raw.split("").map((c) => c + c).join("");
  return null;
}

const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const byte = (n: number) => Math.round(clamp(n, 0, 1) * 255).toString(16).padStart(2, "0");

/** Hue, saturation and brightness to hex. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (k: number) => {
    const t = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(t, 4 - t, 1));
  };
  return "#" + byte(f(5)) + byte(f(3)) + byte(f(1));
}

/** Hex to hue, saturation and brightness. A grey has hue 0; the panel keeps its own hue, so it never jumps to red. */
export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = toRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

const WHITE = hsvToHex({ h: 0, s: 0, v: 1 });
const BLACK = hsvToHex({ h: 0, s: 0, v: 0 });

/** APCA's screen luminance (0.0.98G): sRGB to the 2.4 power, without the WCAG 2 linear toe. */
function screenY(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => (c / 255) ** 2.4) as [number, number, number];
  return 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
}

/** APCA lightness contrast (Lc) of text on a background, as a magnitude: 75 suits body text, 60 content, 45 large text. */
function apca(text: string, bg: string) {
  const soft = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const t = soft(screenY(text));
  const b = soft(screenY(bg));
  const s = b > t ? (b ** 0.56 - t ** 0.57) * 1.14 : (t ** 0.62 - b ** 0.65) * 1.14;
  return s < 0.1 ? 0 : (s - 0.027) * 100;
}

/**
 * Black or white as hex, whichever reads better on this color: for text or a mark drawn on the user's color, where no
 * token is sure to read. Chosen by APCA, not the WCAG 2 ratio: on mid tones such as a rust (#b3613c) the WCAG 2 ratio
 * calls black and white even (4.7 and 4.5) and picks black, where white reads twice as well (Lc 76 against 33).
 */
export const getContrastInk = (hex: string) => (apca(WHITE, hex) >= apca(BLACK, hex) ? WHITE : BLACK);

const HUES: [number, string][] = [
  [15, "red"],
  [40, "orange"],
  [65, "yellow"],
  [160, "green"],
  [195, "teal"],
  [255, "blue"],
  [290, "violet"],
  [340, "pink"],
  [360, "red"],
];

/** A color in words, such as "Dark blue" or "Light grey", for screen readers and for the field's name. */
export function describeColor(hex: string): string {
  const { h, s, v } = hexToHsv(hex);
  const l = v * (1 - s / 2); // the lightness of the same color in HSL
  const chroma = v * s;
  if (chroma < 0.08) {
    if (l > 0.95) return "White";
    if (l < 0.06) return "Black";
    return l > 0.7 ? "Light grey" : l < 0.3 ? "Dark grey" : "Grey";
  }
  const name = HUES.find(([end]) => h < end)?.[1] ?? "red";
  const tone = l < 0.3 ? "Dark " : l > 0.7 ? "Light " : "";
  return tone ? tone + name : name[0]!.toUpperCase() + name.slice(1);
}

const say = (hex: string) => `${describeColor(hex)}, ${hex}`;

/* ----------------------------------------------------------------- styles */

/* The thumb on the area and the hue: the color inside, a --litt-surface-1 ring, a --litt-line-strong edge. Focus makes the edge a 2px --litt-focus ring. */
const thumb =
  "pointer-events-none absolute block size-5 -translate-x-1/2 -translate-y-1/2 rounded-litt-pill " +
  "forced-colors:border ";
const thumbEdge = "shadow-[inset_0_0_0_2px_var(--litt-surface-1),0_0_0_1px_var(--litt-line-strong)]";
const thumbFocus = "shadow-[inset_0_0_0_2px_var(--litt-surface-1),0_0_0_2px_var(--litt-focus)]";

/* A hairline over the user's color, so white still has an edge on a light surface and black on a dark one. */
const hairline = "pointer-events-none absolute inset-0 rounded-litt-control shadow-[inset_0_0_0_1px_var(--litt-line)]";

/* The Select trigger's look and sizes (select.tsx), as the Date picker copies them. */
const field =
  "group/trigger flex w-full min-w-0 cursor-pointer items-center gap-litt-control rounded-litt-control bg-litt-surface-1 text-left font-normal text-litt-fg " +
  "data-placeholder:text-litt-fg-subtle " +
  "pointer-coarse:text-(length:--litt-control-text-lg) " +
  "[-webkit-tap-highlight-color:transparent] " +
  "shadow-[inset_0_0_0_1px_var(--litt-line-control)] " +
  "transition-[box-shadow] duration-(--litt-dur-instant) ease-litt " +
  "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--litt-focus),var(--litt-focus-ring)] " +
  "aria-invalid:shadow-[inset_0_0_0_1px_var(--litt-danger)] " +
  "aria-invalid:focus-visible:shadow-[inset_0_0_0_1px_var(--litt-danger),var(--litt-focus-ring)] " +
  "disabled:cursor-not-allowed disabled:bg-litt-surface-2 disabled:text-litt-fg-disabled disabled:data-placeholder:text-litt-fg-disabled " +
  "disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "forced-colors:border forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-offset-2";

export type ColorPickerSize = "sm" | "md" | "lg";

const sizes: Record<ColorPickerSize, string> = {
  sm: "h-litt-control-sm px-litt-control-pad-sm text-litt-small pointer-coarse:h-litt-control-md",
  md: "h-litt-control-md px-litt-control-pad-md text-litt-body",
  lg: "h-litt-control-lg px-litt-control-pad-lg text-(length:--litt-control-text-lg)",
};

/* ----------------------------------------------------------------- the eyedropper */

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };

/** The browser's EyeDropper, read after hydration so the server and the first render agree. Null where there is none. */
function useEyeDropper(): EyeDropperCtor | null {
  const [ctor, setCtor] = useState<EyeDropperCtor | null>(null);
  useEffect(() => {
    const found = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
    if (found) setCtor(() => found);
  }, []);
  return ctor;
}

const DropperIcon = () => (
  <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="m9.25 4.25 2.5 2.5M10.5 5.5 4.25 11.75 2.75 13.25M3.5 12.5l.75-.75M8.75 3.75l1.4-1.4a1.77 1.77 0 0 1 2.5 2.5l-1.4 1.4" />
  </svg>
);

/* ----------------------------------------------------------------- ColorPanel */

export type ColorPanelProps = {
  /** Names the panel for screen readers, such as "Brand color". It is not shown: put a visible label beside the panel, or use ColorPicker. */
  label: string;
  /** The color as hex, when you control it. Pair it with onValueChange. */
  value?: string;
  /** The color it starts at when you do not control it. Defaults to a mid blue. */
  defaultValue?: string;
  /** Called with the new hex on every move, by pointer, key, hex, swatch or eyedropper. */
  onValueChange?: (value: string) => void;
  /** Called with the final hex when a drag is released, a key moves a thumb, the hex is committed or a swatch is picked. Use it to save. */
  onValueCommit?: (value: string) => void;
  /** Colors to pick in one click, such as a brand's palette. Shown as a row of chips under the hex. */
  swatches?: ColorSwatch[];
  /** The legend of the swatches for screen readers. */
  swatchesLabel?: string;
  /** Height of the area in px. The width is the container's. */
  height?: number;
  /** Extra classes for the wrapper, such as a width. */
  className?: string;
};

const START = hsvToHex({ h: 220, s: 0.8, v: 0.85 });

/** The picker on its own: a saturation and brightness area, a hue rail, the hex, an eyedropper where the browser has one, and optional swatches. */
export function ColorPanel({
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  swatches,
  swatchesLabel = "Swatches",
  height = 160,
  className = "",
}: ColorPanelProps) {
  const id = useId().replace(/[^\w-]/g, "");
  const dropper = useEyeDropper();

  const [inner, setInner] = useState(() => parseHex(defaultValue ?? "") ?? START);
  const value = parseHex(valueProp ?? "") ?? inner;
  /* Hue, saturation and brightness are kept here, so black and grey keep their hue. A new value from outside replaces them only when it is another color. */
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const shown = hsvToHex(hsv) === value ? hsv : hexToHsv(value);
  if (shown !== hsv) setHsv(shown);

  const [draft, setDraft] = useState<string | null>(null); // the hex while it is being typed
  const sInput = useRef<HTMLInputElement>(null);
  const dragging = useRef<"area" | "hue" | null>(null);
  const [ring, setRing] = useState<"area" | "hue" | null>(null); // which thumb has keyboard focus, so its ring shows
  const last = useRef(value);

  const set = (next: Hsv, commit = false) => {
    const n = { h: clamp(next.h, 0, 360), s: clamp(next.s, 0, 1), v: clamp(next.v, 0, 1) };
    setHsv(n);
    const hex = hsvToHex(n);
    last.current = hex;
    if (hex !== value) {
      if (valueProp === undefined) setInner(hex);
      onValueChange?.(hex);
    }
    if (commit) onValueCommit?.(hex);
  };

  const setHex = (hex: string) => {
    const n = hexToHsv(hex);
    /* A grey has no hue of its own, so it keeps the one the panel shows. */
    set(n.s === 0 || n.v === 0 ? { ...n, h: hsv.h } : n, true);
  };

  /* ---- pointer */

  const fromArea = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    set({ h: hsv.h, s: (e.clientX - box.left) / Math.max(1, box.width), v: (box.bottom - e.clientY) / Math.max(1, box.height) });
  };
  const fromHue = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    set({ ...hsv, h: ((e.clientX - box.left) / Math.max(1, box.width)) * 360 });
  };
  const press = (kind: "area" | "hue", e: PointerEvent<HTMLDivElement>, focus: () => void) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = kind;
    setRing(null);
    (kind === "area" ? fromArea : fromHue)(e);
    focus();
  };
  const release = () => {
    if (!dragging.current) return;
    dragging.current = null;
    onValueCommit?.(last.current);
  };

  /* ---- keyboard on the area */

  const onAreaKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const n = (e.shiftKey ? 10 : 1) / 100;
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { s: hsv.s - n },
      ArrowRight: { s: hsv.s + n },
      ArrowDown: { v: hsv.v - n },
      ArrowUp: { v: hsv.v + n },
      PageDown: { v: hsv.v - 0.1 },
      PageUp: { v: hsv.v + 0.1 },
      Home: { s: 0 },
      End: { s: 1 },
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    setRing("area");
    set({ ...hsv, ...move }, true);
  };

  /* The hue input is native, so its own keys work; Shift adds ten-degree steps, as on the area. */
  const onHueKey = (e: KeyboardEvent<HTMLInputElement>) => {
    setRing("hue");
    if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const dir = e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 1;
    set({ ...hsv, h: hsv.h + dir * 10 }, true);
  };

  /* A press focuses the input for the keys that follow, and that is not keyboard focus, so only Tab shows the ring. */
  const focusProps = (kind: "area" | "hue") => ({
    onFocus: (e: { currentTarget: HTMLInputElement }) => {
      if (!dragging.current && e.currentTarget.matches(":focus-visible")) setRing(kind);
    },
    onBlur: () => setRing(null),
  });

  /* ---- hex */

  const typed = draft === null ? null : parseHex(draft);
  const commitDraft = () => {
    if (draft === null) return;
    if (typed && typed !== value) setHex(typed);
    setDraft(null);
  };

  const pickWithDropper = async () => {
    if (!dropper) return;
    try {
      const picked = parseHex((await new dropper().open()).sRGBHex);
      if (picked) setHex(picked);
    } catch {
      /* Esc in the eyedropper rejects; the color stays as it was. */
    }
  };

  /* ---- what is drawn */

  const words = say(value);
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const hueStops = [0, 60, 120, 180, 240, 300, 360].map((h) => hsvToHex({ h, s: 1, v: 1 })).join(", ");
  const areaInput = (axis: "s" | "v") => ({
    type: "range" as const,
    min: 0,
    max: 100,
    step: 1,
    value: Math.round(hsv[axis] * 100),
    "aria-label": axis === "s" ? "Saturation" : "Brightness",
    "aria-valuetext": `${axis === "s" ? "Saturation" : "Brightness"} ${Math.round(hsv[axis] * 100)}%, ${words}`,
    "aria-describedby": `${id}-area`,
    onKeyDown: onAreaKey,
    ...focusProps("area"),
    onChange: (e: ChangeEvent<HTMLInputElement>) => set({ ...hsv, [axis]: Number(e.target.value) / 100 }, true),
  });

  return (
    <div role="group" aria-label={label} className={"grid gap-3 " + className}>
      <span id={`${id}-area`} className="sr-only">
        {label}. Saturation left to right, brightness bottom to top.
      </span>

      {/* Saturation and brightness. */}
      <div
        data-no-drag=""
        className="relative w-full cursor-crosshair touch-none select-none rounded-litt-control"
        style={{
          height,
          backgroundColor: pure,
          backgroundImage: `linear-gradient(to top, ${BLACK}, transparent), linear-gradient(to right, ${WHITE}, transparent)`,
        }}
        onMouseDown={(e) => e.preventDefault() /* the press would blur the input it is about to focus */}
        onPointerDown={(e) => press("area", e, () => sInput.current?.focus({ preventScroll: true }))}
        onPointerMove={(e) => dragging.current === "area" && fromArea(e)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span aria-hidden="true" className={hairline} />
        <input ref={sInput} className="sr-only" {...areaInput("s")} />
        <input className="sr-only" tabIndex={-1} aria-orientation="vertical" {...areaInput("v")} />
        <span
          aria-hidden="true"
          className={thumb + (ring === "area" ? thumbFocus : thumbEdge)}
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: value }}
        />
      </div>

      {/* Hue. */}
      <div
        data-no-drag=""
        className="relative h-3 w-full cursor-pointer touch-none select-none rounded-litt-control pointer-coarse:my-2"
        style={{ backgroundImage: `linear-gradient(to right, ${hueStops})` }}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => press("hue", e, () => e.currentTarget.querySelector("input")?.focus({ preventScroll: true }))}
        onPointerMove={(e) => dragging.current === "hue" && fromHue(e)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        <span aria-hidden="true" className={hairline} />
        {/* A finger needs more than 12px: the target reaches 16px above and below the rail. */}
        <span aria-hidden="true" className="absolute inset-x-0 -inset-y-4 hidden pointer-coarse:block" />
        <input
          type="range"
          className="sr-only"
          min={0}
          max={360}
          step={1}
          value={Math.round(hsv.h)}
          aria-label="Hue"
          aria-valuetext={`Hue ${Math.round(hsv.h)} degrees, ${words}`}
          onKeyDown={onHueKey}
          {...focusProps("hue")}
          onChange={(e) => set({ ...hsv, h: Number(e.target.value) }, true)}
        />
        <span aria-hidden="true" className={thumb + (ring === "hue" ? thumbFocus : thumbEdge) + " top-1/2"} style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: pure }} />
      </div>

      {/* The hex, and the eyedropper where there is one. */}
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="relative size-8 shrink-0 rounded-litt-control pointer-coarse:size-11" style={{ backgroundColor: value }}>
          <span className={hairline} />
        </span>
        <Input
          size="sm"
          mono
          className="min-w-0 flex-1"
          aria-label="Hex"
          invalid={draft !== null && !typed}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          maxLength={7}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
        />
        {dropper && (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Pick a color from the screen"
            title="Pick from the screen"
            className="pointer-coarse:h-litt-control-md pointer-coarse:w-litt-control-md"
            onClick={pickWithDropper}
          >
            <DropperIcon />
          </Button>
        )}
      </div>

      {swatches && swatches.length > 0 && (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">{swatchesLabel}</legend>
          <div className="flex flex-wrap gap-2 pointer-coarse:gap-3">
            {swatches.map((sw) => {
              const hex = parseHex(sw.value);
              if (!hex) return null;
              const on = hex === value;
              return (
                <label key={sw.value + sw.label} title={sw.label} className="relative block cursor-pointer [-webkit-tap-highlight-color:transparent]">
                  <input
                    type="radio"
                    name={`${id}-swatch`}
                    className="peer sr-only"
                    checked={on}
                    aria-label={`${sw.label}, ${hex}`}
                    onChange={() => setHex(hex)}
                  />
                  <span
                    aria-hidden="true"
                    className={
                      "relative grid size-6 place-items-center rounded-litt-control pointer-coarse:size-8 " +
                      "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-litt-focus"
                    }
                    style={{ backgroundColor: hex, color: getContrastInk(hex) }}
                  >
                    <span className="pointer-events-none absolute inset-0 rounded-litt-control shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-fg)_12%,transparent)]" />
                    {on && <CheckIcon className="relative" />}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- ColorPicker */

export type ColorPickerProps = {
  /** The label above the field. It also names the popover, and the sheet's heading on a phone, so keep it short. */
  label: string;
  /** Help under the field, linked with aria-describedby. An error replaces it. */
  hint?: ReactNode;
  /** An error under the field in --litt-danger. It sets aria-invalid. */
  error?: ReactNode;
  /** What the field says when there is no color. */
  placeholder?: string;
  /** Height on the control scale: sm 32, md 44, lg 56. */
  size?: ColorPickerSize;
  /** The name a form sends the hex under, through a hidden field. */
  name?: string;
  /** Makes the field unavailable. */
  disabled?: boolean;
  /** The field's id. One is made if you leave it out. */
  id?: string;
  /** Extra classes for the wrapper, such as a width. */
  className?: string;
  /** The color as hex, or null for none, when you control it. Pair it with onValueChange. */
  value?: string | null;
  /** The color it starts at when you do not control it. */
  defaultValue?: string | null;
  /** Called with the new hex on every change while the panel is open. */
  onValueChange?: (value: string) => void;
  /** Called with the hex when a drag is released, a key moves a thumb, the hex is committed or a swatch is picked. Use it to save. */
  onValueCommit?: (value: string) => void;
  /** Colors to pick in one click, shown under the hex in the panel. */
  swatches?: ColorSwatch[];
};

/**
 * A form field that opens a ColorPanel: the Select trigger's look with a chip of the color and its hex, and the panel
 * in a popover (a bottom sheet on a phone). The color changes live while it is open. Pass name and a form gets the hex.
 */
export function ColorPicker({
  label,
  hint,
  error,
  placeholder = "Choose a color",
  size = "md",
  name,
  disabled = false,
  id: idProp,
  className = "",
  value: valueProp,
  defaultValue = null,
  onValueChange,
  onValueCommit,
  swatches,
}: ColorPickerProps) {
  const [inner, setInner] = useState<string | null>(() => (defaultValue ? parseHex(defaultValue) : null));
  const value = valueProp === undefined ? inner : valueProp ? parseHex(valueProp) : null;
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);

  const auto = useId();
  const id = idProp ?? auto;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const noteId = `${id}-note`;
  const note = error ?? hint;

  const change = (next: string) => {
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
  };

  return (
    <div className={"grid gap-2 " + className}>
      {/* The label points at the field, but a click only moves focus: a label click would otherwise open the panel. */}
      <label
        id={labelId}
        htmlFor={id}
        onClick={(e) => {
          e.preventDefault();
          trigger.current?.focus();
        }}
        className={"text-litt-small font-litt-title " + (disabled ? "text-litt-fg-disabled" : "text-litt-fg")}
      >
        {label}
      </label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger {...asChildProps}>
          <button
            ref={trigger}
            id={id}
            type="button"
            disabled={disabled}
            aria-labelledby={`${labelId} ${valueId}`}
            aria-describedby={note ? noteId : undefined}
            aria-invalid={error ? true : undefined}
            data-placeholder={value ? undefined : ""}
            className={field + " " + sizes[size]}
          >
            {value ? (
              <>
                <span aria-hidden="true" className="relative size-4 shrink-0 rounded-litt-control" style={{ backgroundColor: value }}>
                  <span className={hairline} />
                </span>
                <span className="min-w-0 flex-1 truncate font-litt-mono tabular-nums">{value}</span>
                <span id={valueId} className="sr-only">
                  {describeColor(value)}, {value}
                </span>
              </>
            ) : (
              <span id={valueId} className="min-w-0 flex-1 truncate">
                {placeholder}
              </span>
            )}
            <ChevronDownIcon className="shrink-0 text-litt-fg-subtle group-disabled/trigger:text-litt-fg-disabled" />
          </button>
        </PopoverTrigger>
        <PopoverContent label={label}>
          <ColorPanel
            label={label}
            value={value ?? undefined}
            onValueChange={change}
            onValueCommit={onValueCommit}
            swatches={swatches}
          />
        </PopoverContent>
      </Popover>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {note && (
        <p id={noteId} className={"text-litt-small " + (error ? "text-litt-danger" : "text-litt-fg-subtle")}>
          {note}
        </p>
      )}
    </div>
  );
}
