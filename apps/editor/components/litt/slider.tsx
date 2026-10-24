"use client";
// @litt/slider 2026.10.22. What changed: https://littmd.vercel.app/changelog.md

/**
 * Slider (components.md, "Slider"): one value on a continuous range, such as the default
 * animation speed. Built on Radix Slider (one thumb), which gives the role, the keys and the
 * pointer maths. litt owns the look, the label row and the end words. RangeSlider, in the same
 * file, is the same control with two thumbs for a span (see "Range" below).
 *
 * - Rail: 4px, the control radius, filled at fg 12%. The range from the start to the thumb is
 *   --litt-fg, never the accent (P1): a form can hold many sliders, and the accent stays on the one
 *   primary action. The thumb is a 20px circle (a slider thumb is a circle, v0.9) in --litt-surface-1
 *   with an inset --litt-line-control edge and the top highlight, --litt-surface-2 on hover.
 * - Label: above, like the Input's. The value can sit at the end of the label row in the mono
 *   at the small size. Words for the two ends sit under the rail ("Slower", "Faster").
 * - The label names the thumb (aria-labelledby), the help text describes it, and formatValue
 *   feeds both the visible value and aria-valuetext.
 * - Motion: none on the position. The thumb and the range follow the pointer and the keys at
 *   once, because position is a layout value and an eased jump would lag the input. Only colors
 *   fade, on the instant tier. The thumb never changes size on hover, focus or drag.
 * - Fun mode (motion/fun.tsx, a trial, off unless a <FunMode> is on): a thumb a finger holds lifts, stretches along
 *   the rail with the finger's speed (and thins across it), and wobbles back to its own size when let go
 *   (useFunGrab). Only its scale moves: it still sits exactly where the value puts it, and keys move it as before.
 *   Reduced motion turns it off.
 * - Keys: arrows step, Home and End go to the ends, Page Up and Page Down move about a tenth of
 *   the range (whole steps, never fewer than one). The focus ring is :focus-visible only.
 * - Touch: the hit area is 44px tall on coarse pointers. The row grows, the rail does not. The
 *   slider owns horizontal drags: it is marked data-no-drag, so a sheet never moves under it,
 *   and its touch-action leaves vertical scrolling to the page.
 * - Disabled: the rail at fg 6%, the range --litt-fg-disabled, the thumb --litt-surface-2 with a --litt-line edge. The
 *   label dims to --litt-fg-disabled; the value and the end words stay at --litt-fg-subtle, because they are still read.
 * - Forced colors drops box-shadow, so the rail and the thumb get real borders.
 *
 * Range (components.md, "Slider", the Range bullet): RangeSlider is two thumbs on one rail, such as
 * builds that took between 20s and 80s in a table filter. It reuses every class string, the label row,
 * the help text, the end words and the disabled look above. The part of the rail between the thumbs
 * is the range (--litt-fg); outside it the rail stays at fg 12%.
 * - Names: each thumb is named by the label and its end ("Build time, from", "Build time, to"), and
 *   gets its own aria-valuetext from formatValue. The shown value reads "20s to 80s": words, never a dash.
 *   The two thumbs sit in a group named by the label (and marked aria-disabled when it is), so a screen
 *   reader says they belong together, and the dimmed label of a disabled range is known to be inactive.
 * - The thumbs never cross and stay minStepsBetweenThumbs steps apart. Radix would swap them (or
 *   mis-round a decimal step), so Radix keeps their order (preserveThumbOrder) and this file holds the gap.
 * - Keys act on the focused thumb. The arrows are Radix's. Home, End, Page Up and Page Down are
 *   handled here, because Radix sends Home to the first thumb and End to the last, whichever has focus.
 * - A form sends both values under name (FormData.getAll(name) is [from, to]), not under name[].
 */
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref, type RefObject } from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { useFunGrab, type FunGrab } from "../../lib/litt/motion";

export type SliderProps = {
  /** The label above the slider. Required, because it names the thumb for screen readers. */
  label: ReactNode;
  /** A hint under the slider, linked to the thumb with aria-describedby. */
  help?: ReactNode;
  /** The value, when you control it. Pair it with onValueChange. */
  value?: number;
  /** The value it starts at when you do not control it. Without one, it starts at min. */
  defaultValue?: number;
  /** Called with the new value on every move of the thumb, by pointer or key. */
  onValueChange?: (value: number) => void;
  /** Called with the final value when a drag is released, or right after a key moves the thumb. Use it to save. */
  onValueCommit?: (value: number) => void;
  /** The lowest value, at the start of the rail. */
  min?: number;
  /** The highest value, at the end of the rail. */
  max?: number;
  /** The gap between values. The thumb snaps to it, and an arrow key moves one step. */
  step?: number;
  /** A word under the start of the rail, such as "Slower". Say which way is which. */
  minLabel?: ReactNode;
  /** A word under the end of the rail, such as "Faster". */
  maxLabel?: ReactNode;
  /** Shows the value at the end of the label row, in the mono. Off by default. */
  showValue?: boolean;
  /** Turns a value into text, such as 1 into "1.0x". It feeds the shown value and aria-valuetext. Without it, the number is shown as it is. */
  formatValue?: (value: number) => string;
  /** Makes the slider unavailable: muted, skipped by Tab, and left out of a form, like a native field. */
  disabled?: boolean;
  /** The field name a form sends the value under. */
  name?: string;
  /** The id of the thumb, when you need your own. The label and the help text derive their ids from it. */
  id?: string;
  /** Extra classes for the wrapper, such as a width. */
  className?: string;
  /** The thumb, for focus or a form library. */
  ref?: Ref<HTMLSpanElement>;
};

export type RangeSliderProps = {
  /** The label above the slider. Required: each thumb is named by it and its end, such as "Build time, from". */
  label: ReactNode;
  /** A hint under the slider, linked to both thumbs with aria-describedby. */
  help?: ReactNode;
  /** The two values, [from, to], when you control them. Pair it with onValueChange. */
  value?: [number, number];
  /** The values it starts at when you do not control them. Without them, it starts open, at [min, max]. */
  defaultValue?: [number, number];
  /** Called with [from, to] on every move of either thumb, by pointer or key. */
  onValueChange?: (value: [number, number]) => void;
  /** Called with [from, to] when a drag is released, or right after a key moves a thumb. Use it to save or to run the filter. */
  onValueCommit?: (value: [number, number]) => void;
  /** The lowest value, at the start of the rail. */
  min?: number;
  /** The highest value, at the end of the rail. */
  max?: number;
  /** The gap between values. Both thumbs snap to it, and an arrow key moves the focused thumb one step. */
  step?: number;
  /** How many steps the thumbs stay apart. They never cross, and never meet unless you pass 0. */
  minStepsBetweenThumbs?: number;
  /** The words that finish each thumb's name, "<label>, from" and "<label>, to". Change them for another language or another meaning. */
  thumbLabels?: [string, string];
  /** A word under the start of the rail, such as "Faster". Say which way is which. */
  minLabel?: ReactNode;
  /** A word under the end of the rail, such as "Slower". */
  maxLabel?: ReactNode;
  /** Shows the span at the end of the label row, in the mono: "20s to 80s". Off by default. */
  showValue?: boolean;
  /** Turns one value into text, such as 20 into "20s". It feeds the shown span ("20s to 80s") and each thumb's aria-valuetext. Without it, the number is shown as it is. */
  formatValue?: (value: number) => string;
  /** Makes the slider unavailable: muted, skipped by Tab, and left out of a form, like a native field. */
  disabled?: boolean;
  /** The field name a form sends both values under: FormData.getAll(name) is [from, to]. */
  name?: string;
  /** The id of the from thumb, when you need your own. The label, the help text and the to thumb ("<id>-to") derive their ids from it. */
  id?: string;
  /** Extra classes for the wrapper, such as a width. */
  className?: string;
  /** The from thumb, for focus or a form library. */
  ref?: Ref<HTMLSpanElement>;
};

/* The hit area: the thumb's own height on a fine pointer, 44px on a coarse one. The rail stays centered and 4px. */
const root =
  "relative flex h-5 w-full touch-pan-y select-none items-center pointer-coarse:h-litt-control-md " +
  "cursor-pointer data-disabled:cursor-not-allowed";

const rail =
  "relative h-1 grow rounded-litt-control bg-[color-mix(in_oklab,var(--litt-fg)_12%,transparent)] " +
  "transition-[background-color] duration-(--litt-dur-instant) ease-litt " +
  "data-disabled:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)] " +
  /* Forced colors drops background colors and box-shadow, so the rail is outlined and the range takes a system color. */
  "forced-colors:border";

const range =
  "absolute h-full rounded-litt-control bg-litt-fg " +
  "transition-[background-color] duration-(--litt-dur-instant) ease-litt " +
  "data-disabled:bg-litt-fg-disabled " +
  "forced-colors:bg-[Highlight]";

const thumb =
  "block size-5 rounded-litt-pill bg-litt-surface-1 " +
  "shadow-[inset_0_0_0_1px_var(--litt-line-control),var(--litt-highlight)] " +
  "transition-[background-color,box-shadow] duration-(--litt-dur-instant) ease-litt " +
  "hover:bg-litt-surface-2 pointer-coarse:active:bg-litt-surface-2 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus " +
  "data-disabled:bg-litt-surface-2 data-disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "forced-colors:border";


/** How many digits a number needs after the point, so snapping to a step of 0.1 never leaves 0.30000000000000004. */
function places(n: number) {
  return (String(n).split(".")[1] ?? "").length;
}

/** The nearest value on the step grid, kept on the rail. */
function snapToStep(raw: number, min: number, max: number, step: number) {
  const snapped = Math.round((raw - min) / step) * step + min;
  return Math.min(max, Math.max(min, Number(snapped.toFixed(Math.max(places(step), places(min))))));
}

/** What Page Up and Page Down move: about a tenth of the range, in whole steps, never fewer than one. Radix moves ten steps. */
function pageSteps(min: number, max: number, step: number) {
  return Math.max(1, Math.round((max - min) / step / 10));
}

/** Hands an element to a ref the caller passed, of either kind. */
function setRef<T>(ref: Ref<T> | undefined, el: T | null) {
  if (typeof ref === "function") ref(el);
  else if (ref) (ref as RefObject<T | null>).current = el;
}

/**
 * Fun mode's held thumb (useFunGrab): the pointer handler for the root, which takes hold of the thumb nearest the
 * finger, the refs for the root and the thumbs, and `moved`, which tells the grab where the value has gone.
 */
function useHeldThumb(grab: FunGrab | null, min: number, max: number, ref: Ref<HTMLSpanElement> | undefined) {
  const root = useRef<HTMLSpanElement>(null);
  const thumbs = useRef<(HTMLSpanElement | null)[]>([]);
  return {
    root,
    thumbRef: (i: number) => (el: HTMLSpanElement | null) => {
      thumbs.current[i] = el;
      if (i === 0) setRef(ref, el);
    },
    onPointerDown: (event: PointerEvent<HTMLSpanElement>) => {
      if (!grab || (event.pointerType === "mouse" && event.button !== 0)) return;
      let near: HTMLSpanElement | null = null;
      let best = Infinity;
      for (const el of thumbs.current) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs(event.clientX - (r.left + r.width / 2));
        if (d < best) [near, best] = [el, d];
      }
      grab.grab(near);
    },
    moved: (value: number) => grab?.move(((value - min) / (max - min || 1)) * (root.current?.offsetWidth ?? 0)),
  };
}

type FieldProps = {
  labelId: string;
  label: ReactNode;
  /** The value as it is shown at the end of the label row. Leave it out to show none. */
  shown?: string;
  helpId?: string;
  help?: ReactNode;
  minLabel?: ReactNode;
  maxLabel?: ReactNode;
  disabled: boolean;
  className: string;
  /** Marks the field as a group named by its label, for a control with more than one thumb. */
  group?: boolean;
  /** The rail, and anything that must sit inside the field. */
  children: ReactNode;
};

/** What the Slider and the RangeSlider share around the rail: the label row, the end words and the help text. */
function Field({ labelId, label, shown, helpId, help, minLabel, maxLabel, disabled, className, group = false, children }: FieldProps) {
  return (
    <div
      role={group ? "group" : undefined}
      aria-labelledby={group ? labelId : undefined}
      aria-disabled={group && disabled ? true : undefined}
      className={["grid gap-2", className].join(" ")}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span id={labelId} className={"text-litt-small font-litt-title " + (disabled ? "text-litt-fg-disabled" : "text-litt-fg")}>
          {label}
        </span>
        {shown !== undefined && (
          /* Disabled, the value steps down to --litt-fg-subtle, not --litt-fg-disabled: it is still information, and it must stay readable. */
          <span aria-hidden="true" className={"font-litt-mono text-litt-small tabular-nums " + (disabled ? "text-litt-fg-subtle" : "text-litt-fg-muted")}>
            {shown}
          </span>
        )}
      </div>
      <div className="grid gap-1">
        {children}
        {(minLabel || maxLabel) && (
          <div className="flex justify-between gap-4 text-litt-caption text-litt-fg-subtle">
            <span>{minLabel}</span>
            <span className="text-right">{maxLabel}</span>
          </div>
        )}
      </div>
      {help && (
        <p id={helpId} className="text-litt-small text-litt-fg-subtle">
          {help}
        </p>
      )}
    </div>
  );
}

/** One slider: a label above, a rail with one thumb, and optional words under its ends. Every value is a number, and a form sends it under name. */
export function Slider({
  label,
  help,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  showValue = false,
  formatValue,
  disabled = false,
  name,
  id: idProp,
  className = "",
  ref,
}: SliderProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const labelId = `${id}-label`;
  const helpId = help ? `${id}-help` : undefined;

  /* The slider keeps its own value when you do not control it, because Page Up needs to read it. */
  const [inner, setInner] = useState(defaultValue ?? min);
  const value = valueProp ?? inner;
  const text = formatValue ? formatValue(value) : String(value);
  /* Fun mode: the held thumb. With it off, the root and the thumb get exactly what they always got. */
  const grab = useFunGrab();
  const held = useHeldThumb(grab, min, max, ref);

  const change = (next: number | undefined) => {
    if (next === undefined) return;
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
    held.moved(next);
  };

  /* Radix moves ten steps on Page Up and Page Down. The spec says about a tenth of the range, in whole steps. */
  const pageKeys = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled || (event.key !== "PageUp" && event.key !== "PageDown")) return;
    event.preventDefault();
    const raw = value + (event.key === "PageUp" ? 1 : -1) * pageSteps(min, max, step) * step;
    const next = snapToStep(raw, min, max, step);
    if (next === value) return;
    change(next);
    onValueCommit?.(next);
  };

  return (
    <Field
      labelId={labelId}
      label={label}
      shown={showValue ? text : undefined}
      helpId={helpId}
      help={help}
      minLabel={minLabel}
      maxLabel={maxLabel}
      disabled={disabled}
      className={className}
    >
      <RadixSlider.Root
        name={disabled ? undefined : name}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={[value]}
        onValueChange={(v) => change(v[0])}
        onValueCommit={(v) => v[0] !== undefined && onValueCommit?.(v[0])}
        onKeyDown={pageKeys}
        ref={grab ? held.root : undefined}
        onPointerDown={grab ? held.onPointerDown : undefined}
        data-no-drag=""
        className={root}
      >
        <RadixSlider.Track className={rail}>
          <RadixSlider.Range className={range} />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          ref={grab ? held.thumbRef(0) : ref}
          id={id}
          aria-labelledby={labelId}
          aria-describedby={helpId}
          aria-valuetext={formatValue ? text : undefined}
          className={thumb}
        />
      </RadixSlider.Root>
    </Field>
  );
}

/** Two values on one rail, [from, to]. The thumbs never cross, each is named by the label and its end, and a form sends both under name. */
export function RangeSlider({
  label,
  help,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 100,
  step = 1,
  minStepsBetweenThumbs = 1,
  thumbLabels = ["from", "to"],
  minLabel,
  maxLabel,
  showValue = false,
  formatValue,
  disabled = false,
  name,
  id: idProp,
  className = "",
  ref,
}: RangeSliderProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const labelId = `${id}-label`;
  const helpId = help ? `${id}-help` : undefined;
  const thumbId = (i: 0 | 1) => (i === 0 ? id : `${id}-to`);
  const nameId = (i: 0 | 1) => `${id}-${i === 0 ? "from" : "to"}-name`;

  /* The slider keeps its own values when you do not control them, because Page Up needs to read them. They are
     sorted and kept on the rail, so a stray default can never draw the thumbs outside it or crossed. */
  const [inner, setInner] = useState<[number, number]>(defaultValue ?? [min, max]);
  const given = valueProp ?? inner;
  const from = Math.min(max, Math.max(min, Math.min(given[0], given[1])));
  const to = Math.min(max, Math.max(min, Math.max(given[0], given[1])));
  const values: [number, number] = [from, to];
  const fmt = (v: number) => (formatValue ? formatValue(v) : String(v));
  const text = `${fmt(from)} to ${fmt(to)}`;

  /* Radix keeps the thumbs in order (preserveThumbOrder) and could hold the gap too, but it rounds a decimal step badly
     (0.2 plus 0.1 is 0.30000000000000004). So Radix gets no gap, and the thumb that moved is held here, on the step grid.
     A thumb is never pushed back past where it already was. */
  const digits = Math.max(places(step), places(min));
  const gap = Math.max(0, minStepsBetweenThumbs) * step;
  const down = (n: number) => Number((Math.floor((n - min) / step + 1e-9) * step + min).toFixed(digits));
  const up = (n: number) => Number((Math.ceil((n - min) / step - 1e-9) * step + min).toFixed(digits));
  const hold = (next: number[]): [number, number] => {
    let [a = from, b = to] = next;
    if (a !== from) a = Math.min(a, Math.max(from, down(to - gap)));
    else if (b !== to) b = Math.max(b, Math.min(to, up(from + gap)));
    return [a, b];
  };
  const same = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];

  /* Fun mode: the held thumb. With it off, the root and the thumbs get exactly what they always got. */
  const grab = useFunGrab();
  const grip = useHeldThumb(grab, min, max, ref);

  const change = (next: number[]) => {
    const held = hold(next);
    if (same(held, values)) return;
    if (valueProp === undefined) setInner(held);
    onValueChange?.(held);
    grip.moved(held[0] !== from ? held[0] : held[1]);
  };

  /* Radix commits a key press with the move it wanted. When the other thumb held it back, nothing moved, so nothing is saved.
     A released drag commits the values as they are, which are always whole. */
  const commit = (next: number[]) => {
    const held = hold(next);
    if (!same(next, values) && same(held, values)) return;
    onValueCommit?.(held);
  };

  /* The keys act on the focused thumb. Radix sends Home to the first thumb and End to the last, whichever has focus, and
     moves ten steps on Page Up and Page Down. The spec says Home and End go to the end of the rail (the other thumb stops
     them) and the pages are about a tenth of the range, in whole steps. */
  const thumbKeys = (i: 0 | 1) => (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    const at = values[i];
    let target: number;
    if (event.key === "Home") target = min;
    else if (event.key === "End") target = max;
    else if (event.key === "PageUp") target = at + pageSteps(min, max, step) * step;
    else if (event.key === "PageDown") target = at - pageSteps(min, max, step) * step;
    else return;
    event.preventDefault();
    const snapped = snapToStep(target, min, max, step);
    const held = hold(i === 0 ? [snapped, to] : [from, snapped]);
    if (same(held, values)) return;
    change(held);
    onValueCommit?.(held);
  };

  return (
    <Field
      labelId={labelId}
      label={label}
      shown={showValue ? text : undefined}
      helpId={helpId}
      help={help}
      minLabel={minLabel}
      maxLabel={maxLabel}
      disabled={disabled}
      className={className}
      group
    >
      <RadixSlider.Root
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={values}
        preserveThumbOrder
        onValueChange={change}
        onValueCommit={commit}
        ref={grab ? grip.root : undefined}
        onPointerDown={grab ? grip.onPointerDown : undefined}
        data-no-drag=""
        className={root}
      >
        <RadixSlider.Track className={rail}>
          <RadixSlider.Range className={range} />
        </RadixSlider.Track>
        {([0, 1] as const).map((i) => (
          <RadixSlider.Thumb
            key={i}
            ref={grab ? grip.thumbRef(i) : i === 0 ? ref : undefined}
            id={thumbId(i)}
            /* A form sends both values under the same name (Radix would add [] to it). */
            name={disabled ? undefined : name}
            aria-labelledby={nameId(i)}
            aria-describedby={helpId}
            aria-valuetext={formatValue ? fmt(values[i]) : undefined}
            onKeyDown={thumbKeys(i)}
            className={thumb}
          />
        ))}
      </RadixSlider.Root>
      {/* The names: the label and the end, as one string, so a screen reader says "Build time, from". Hidden text still names a thumb. */}
      {([0, 1] as const).map((i) => (
        <span key={i} id={nameId(i)} hidden>
          {label}, {thumbLabels[i]}
        </span>
      ))}
    </Field>
  );
}
