"use client";
// @litt/slider 2026.10.26. What changed: https://littmd.vercel.app/changelog.md

/**
 * Slider (components.md, "Slider"): one value on a continuous range, such as the default
 * animation speed. Built on Radix Slider (one thumb), which gives the role, the keys and the
 * form value. litt owns the look, the hand, the label row and the end words. RangeSlider, in the
 * same file, is the same control with two caps for a span (see "Range" below).
 *
 * - The post (material.md, 6; Nick's frames 119 and 121, made physical on the controls canvas, v1.0): a raised plate
 *   the control's height (44, md) at the control radius (--litt-block, --litt-plate-lift); a slot cut into it (--litt-slot,
 *   --litt-slot-shade: its top wall shades the floor and its lower wall catches the light); the part of the slot the cap has
 *   pulled out, a step darker (--litt-slot-fill); and a cap riding in the slot, 8px wide, standing taller than the plate
 *   (--litt-cap, --litt-cap-lift), with a grip line down its face. Only raised things cast, straight down (R3). Never the
 *   accent (R6): a form can hold many sliders.
 * - Notches: marks under the slot at the values you pass (marks), and a longer, darker one at home, the value the cap
 *   comes back to (by default the defaultValue). Home holds the cap a little: within about a step of it, the hand
 *   lets go there.
 * - Says its value (R5): at the end of the label row, at the small size in tabular figures, --litt-fg-muted, and --litt-fg
 *   while the cap is held. showValue={false} leaves it out. Words for the two ends sit under the plate ("Slower",
 *   "Faster").
 * - The label names the thumb (aria-labelledby), the help text describes it, and formatValue feeds both the shown
 *   value and aria-valuetext. The thumb Radix keeps is invisible; the cap you see is this file's, so it can glide.
 * - Hand (R4): press on the cap and it is held where it was taken, so it moves with the finger 1:1, with no easing;
 *   press on the slot and the cap goes there on the responsive spring, then follows. While held it sinks
 *   --litt-press-depth and its cast tightens (--litt-cap-press), at once. Pushed fast it leans into the move, at most 4°, and
 *   rights itself on the spring when the hand slows. The hand is this file's, not Radix's (Radix maps the pointer
 *   across the whole width, which would jump the cap under the finger).
 * - Keys: arrows step, Home and End go to the ends, Page Up and Page Down move about a tenth of the range (whole
 *   steps, never fewer than one); the cap glides there on the responsive spring. The focus ring is on the plate, for
 *   :focus-visible only.
 * - Motion moves only transforms: the cap and the fill slide by translate (the fill's rail is as wide as the cap's
 *   travel), and the lean and the sink are the cap's own transform. Reduced motion stills the glide and the lean.
 * - Touch: the plate is 44px tall. The slider owns horizontal drags: it is marked data-no-drag, so a sheet never moves
 *   under it, and its touch-action leaves vertical scrolling to the page.
 * - Disabled: everything lies flat (nothing to push): the plate --litt-surface-2 with a hairline, the slot --litt-surface-3,
 *   the cap --litt-surface-2 with a hairline. The label dims to --litt-fg-disabled; the value and the end words stay at
 *   --litt-fg-subtle, because they are still read.
 * - Forced colors drops box-shadow and background colors, so the plate, the slot and the cap get real borders and
 *   the cap takes the system highlight.
 *
 * Range (components.md, "Slider", the Range bullet): RangeSlider is two caps in one slot with the fill between them,
 * such as builds that took between 20s and 80s in a table filter. The span shows at the end of the label row ("20s
 * to 80s") when showValue is on. It reuses the plate, the label row, the help text, the end words and the disabled
 * look above.
 * - Names: each thumb is named by the label and its end ("Build time, from", "Build time, to"), and gets its own
 *   aria-valuetext from formatValue. The shown value reads "20s to 80s": words, never a dash. The two thumbs sit in a
 *   group named by the label (and marked aria-disabled when it is), so a screen reader says they belong together,
 *   and the dimmed label of a disabled range is known to be inactive.
 * - Hand: a press takes the nearer cap, held where it was taken when the press is on it, or sent to the finger when
 *   it is not. The focused cap draws the focus ring around itself, so you can tell which one the keys move.
 * - The caps never cross and stay minStepsBetweenThumbs steps apart. Radix would swap them (or mis-round a decimal
 *   step), so Radix keeps their order (preserveThumbOrder) and this file holds the gap.
 * - Keys act on the focused thumb. The arrows are Radix's. Home, End, Page Up and Page Down are handled here,
 *   because Radix sends Home to the first thumb and End to the last, whichever has focus.
 * - A form sends both values under name (FormData.getAll(name) is [from, to]), not under name[].
 */
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref, type RefObject } from "react";
import * as RadixSlider from "@radix-ui/react-slider";

export type SliderProps = {
  /** The label above the slider. Required, because it names the thumb for screen readers. */
  label: ReactNode;
  /** A hint under the slider, linked to the thumb with aria-describedby. */
  help?: ReactNode;
  /** The value, when you control it. Pair it with onValueChange. */
  value?: number;
  /** The value it starts at when you do not control it. Without one, it starts at min. */
  defaultValue?: number;
  /** Called with the new value on every move of the cap, by pointer or key. */
  onValueChange?: (value: number) => void;
  /** Called with the final value when a drag is released, or right after a key moves the cap. Use it to save. */
  onValueCommit?: (value: number) => void;
  /** The lowest value, with the cap at the start of the slot. */
  min?: number;
  /** The highest value, with the cap at the end of the slot. */
  max?: number;
  /** The gap between values. The cap snaps to it, and an arrow key moves one step. */
  step?: number;
  /** Values to mark with a notch under the slot, such as each whole step. Leave it out for a plain slot. */
  marks?: number[];
  /** The value the cap comes home to, marked with a longer notch: within about a step of it, the hand lets go there. Defaults to defaultValue; pass null for none. */
  home?: number | null;
  /** A word under the start of the plate, such as "Slower". Say which way is which. */
  minLabel?: ReactNode;
  /** A word under the end of the plate, such as "Faster". */
  maxLabel?: ReactNode;
  /** Says the value at the end of the label row (R5). On by default; false leaves it out. */
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
  /** Called with [from, to] on every move of either end, by pointer or key. */
  onValueChange?: (value: [number, number]) => void;
  /** Called with [from, to] when a drag is released, or right after a key moves an end. Use it to save or to run the filter. */
  onValueCommit?: (value: [number, number]) => void;
  /** The lowest value, at the start of the slot. */
  min?: number;
  /** The highest value, at the end of the slot. */
  max?: number;
  /** The gap between values. Both ends snap to it, and an arrow key moves the focused end one step. */
  step?: number;
  /** How many steps the ends stay apart. They never cross, and never meet unless you pass 0. */
  minStepsBetweenThumbs?: number;
  /** The words that finish each thumb's name, "<label>, from" and "<label>, to". Change them for another language or another meaning. */
  thumbLabels?: [string, string];
  /** A word under the start of the plate, such as "Faster". Say which way is which. */
  minLabel?: ReactNode;
  /** A word under the end of the plate, such as "Slower". */
  maxLabel?: ReactNode;
  /** Shows the span at the end of the label row, in tabular figures: "20s to 80s". Off by default. */
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

/* The plate: raised, the control's height, at the control radius (R3: --litt-block, --litt-plate-lift). It is the hit area and,
   for a single slider, carries the focus ring. Disabled, it lies flat. */
const plateBase =
  "group relative block h-litt-control-md w-full cursor-grab touch-pan-y select-none rounded-litt-control bg-litt-block shadow-(--litt-plate-lift) " +
  "data-held:cursor-grabbing " +
  "data-disabled:cursor-not-allowed data-disabled:bg-litt-surface-2 data-disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "forced-colors:border";
const plateRing = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-litt-focus";

/* The slot: 6px in from each end of the plate, 16px down and 12px tall, its corners the control radius less 2px. It
   clips the fill. Disabled, it is a flat --litt-surface-3. */
const slot =
  "pointer-events-none absolute inset-x-1.5 top-4 h-3 overflow-hidden rounded-[calc(var(--litt-radius-control)-2px)] bg-litt-slot shadow-(--litt-slot-shade) " +
  "group-data-disabled:bg-litt-surface-3 group-data-disabled:shadow-none forced-colors:border";

/* The cap's travel: 14px in from each end of the plate (PAD), which is 8px in from the slot's ends. A rail as wide as
   the travel moves by translate, with the cap on its right edge, so the cap and the fill move by transform only. */
const capTravel = "pointer-events-none absolute inset-y-0 left-3.5 right-3.5";
const fillTravel = "absolute inset-y-0 left-2 right-2";
const fillLook =
  "bg-litt-slot-fill shadow-(--litt-slot-fill-shade) " +
  "group-data-disabled:bg-[color-mix(in_oklab,var(--litt-fg)_12%,transparent)] group-data-disabled:shadow-none forced-colors:bg-[Highlight]";
/* The glide: a jump of the cap (a key, or a press on the slot) settles on the responsive spring. A drag follows 1:1. */
const glides = " transition-transform duration-(--litt-dur-responsive) ease-litt-responsive";

/* The cap: 8px wide and 36px tall, 4px from the plate's top, centered on its rail's right edge. It leans from its foot
   and sinks while held, on the responsive spring. */
const capBox = "absolute top-1 -right-1 h-9 w-2 origin-bottom transition-transform duration-(--litt-dur-responsive) ease-litt-responsive";
const capFace = (held: boolean) =>
  "absolute inset-0 rounded-[calc(var(--litt-radius-control)-2px)] forced-colors:border forced-colors:bg-[Highlight] " +
  (held ? "bg-litt-cap-held shadow-(--litt-cap-press) " : "bg-litt-cap shadow-(--litt-cap-lift) ") +
  "group-data-disabled:bg-litt-surface-2 group-data-disabled:shadow-[inset_0_0_0_1px_var(--litt-line)]";
const capGrip = "absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-litt-cap-grip group-data-disabled:bg-litt-line";

/* Radix's thumb holds the role, the keys and the value. The cap you see is drawn above it, so the thumb is invisible
   and as wide as the cap, which keeps it on the same travel. */
const thumbTrack = "absolute inset-y-0 left-2.5 right-2.5";
const thumbHidden = "block h-full w-2 opacity-0 focus-visible:outline-none";

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

/** How far in from each end of the plate the cap's center can go, in px. The travel is the plate less twice this. */
const PAD = 14;

/** The pointer on the plate, undoing any scale above it: its x and the plate's width, in the plate's own px. */
function measure(plate: HTMLElement, clientX: number) {
  const r = plate.getBoundingClientRect();
  const w = plate.offsetWidth || r.width;
  const scale = r.width / w || 1;
  return { x: (clientX - r.left) / scale, w };
}

/** Where x, on a plate w wide, is along the travel, from 0 to 1. */
const along = (x: number, w: number) => Math.min(1, Math.max(0, (x - PAD) / (w - 2 * PAD || 1)));

/** A rail as wide as the travel, moved so its right edge sits p of the way along. */
const railAt = (p: number): CSSProperties => ({ transform: `translateX(${((p - 1) * 100).toFixed(3)}%)` });

/** A notch under the slot, p of the way along. Home's is longer and darker. */
function Notch({ p, home }: { p: number; home: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        "pointer-events-none absolute w-px -translate-x-1/2 group-data-disabled:hidden forced-colors:bg-[CanvasText] " +
        (home ? "top-7 h-2 bg-litt-notch-home" : "top-8 h-1 bg-litt-notch")
      }
      style={{ left: `calc(${PAD}px + (100% - ${2 * PAD}px) * ${p.toFixed(4)})` }}
    />
  );
}

/** The value under the hand: home holds it within about a step, then the step grid. */
function valueAt(at: number, min: number, max: number, step: number, home: number | null) {
  const raw = min + at * (max - min);
  if (home !== null && Math.abs(raw - home) < step * 0.9) return home;
  return snapToStep(raw, min, max, step);
}

/** The lean (R4): a cap pushed fast tips into the move, at most 4°, eased toward the hand's speed, and rights itself
    when the hand slows or lets go. Reduced motion keeps it upright. */
function useLean() {
  const [lean, setLean] = useState(0);
  const last = useRef<{ x: number; t: number; still: boolean } | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settle.current), []);
  return {
    lean,
    start(x: number, t: number) {
      last.current = { x, t, still: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    },
    move(x: number, t: number) {
      const l = last.current;
      if (!l) return;
      last.current = { x, t, still: l.still };
      if (l.still) return;
      const target = Math.max(-4, Math.min(4, ((x - l.x) / Math.max(1, t - l.t)) * 5));
      setLean((now) => Math.round((now * 0.5 + target * 0.5) * 100) / 100);
      clearTimeout(settle.current);
      settle.current = setTimeout(() => setLean(0), 90);
    },
    end() {
      last.current = null;
      clearTimeout(settle.current);
      setLean(0);
    },
  };
}

/** One cap on its rail: the face, the grip line, the sink while held and the lean. The ring is drawn when `ring` is on. */
function Cap({ p, held, lean, glide, ring = false }: { p: number; held: boolean; lean: number; glide: boolean; ring?: boolean }) {
  return (
    <span aria-hidden="true" className={capTravel + (glide ? glides : "")} style={railAt(p)}>
      <span className={capBox} style={{ transform: `translateY(${held ? "var(--litt-press-depth)" : "0px"}) rotate(${lean}deg)` }}>
        <span className={capFace(held) + (ring ? " outline-2 outline-offset-2 outline-litt-focus" : "")} />
        <span className={capGrip} />
      </span>
    </span>
  );
}

type FieldProps = {
  labelId: string;
  label: ReactNode;
  /** The value as it is shown at the end of the label row. Leave it out to show none. */
  shown?: string;
  /** Whether a hand holds a cap: the shown value steps up to --litt-fg. */
  held?: boolean;
  helpId?: string;
  help?: ReactNode;
  minLabel?: ReactNode;
  maxLabel?: ReactNode;
  disabled: boolean;
  className: string;
  /** Marks the field as a group named by its label, for a control with more than one thumb. */
  group?: boolean;
  /** The plate, and anything that must sit inside the field. */
  children: ReactNode;
};

/** What the Slider and the RangeSlider share around the plate: the label row, the end words and the help text. */
function Field({ labelId, label, shown, held = false, helpId, help, minLabel, maxLabel, disabled, className, group = false, children }: FieldProps) {
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
          <span aria-hidden="true" className={"text-litt-small tabular-nums transition-colors duration-(--litt-dur-instant) ease-litt " + (disabled ? "text-litt-fg-subtle" : held ? "text-litt-fg" : "text-litt-fg-muted")}>
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

/** One slider: a label above that says the value, a cap riding in a slot on a raised plate, and optional words under its ends. Every value is a number, and a form sends it under name. */
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
  marks,
  home: homeProp,
  minLabel,
  maxLabel,
  showValue = true,
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

  /* The slider keeps its own value when you do not control it, because Page Up and the hand need to read it. */
  const [inner, setInner] = useState(defaultValue ?? min);
  const value = valueProp ?? inner;
  const fmt = (v: number) => (formatValue ? formatValue(v) : String(v));
  const text = fmt(value);
  const span = max - min || 1;
  const p = (value - min) / span;
  const home = homeProp === null ? null : (homeProp ?? defaultValue ?? null);

  const latest = useRef(value);
  latest.current = value;
  const change = (next: number | undefined) => {
    if (next === undefined || next === latest.current) return;
    latest.current = next;
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
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

  /* The hand. A press on the cap holds it where it was taken (offset); a press on the slot sends the cap there on the
     spring, then it follows. Each handler calls preventDefault, so Radix's own pointer handling stays out. */
  const plateRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const hand = useRef<{ id: number; offset: number } | null>(null);
  const [held, setHeld] = useState(false);
  const [glide, setGlide] = useState(true);
  const lean = useLean();
  const to = (x: number, w: number) => change(valueAt(along(x, w), min, max, step, home));
  const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0) || !plateRef.current) return;
    e.preventDefault();
    const m = measure(plateRef.current, e.clientX);
    const cap = PAD + p * (m.w - 2 * PAD);
    const onCap = Math.abs(m.x - cap) <= 10;
    hand.current = { id: e.pointerId, offset: onCap ? cap - m.x : 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    thumbRef.current?.focus({ preventScroll: true });
    setHeld(true);
    setGlide(!onCap);
    lean.start(m.x, e.timeStamp);
    if (!onCap) to(m.x, m.w);
  };
  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const h = hand.current;
    if (!h || h.id !== e.pointerId || !plateRef.current) return;
    e.preventDefault();
    const m = measure(plateRef.current, e.clientX);
    setGlide(false);
    lean.move(m.x, e.timeStamp);
    to(m.x + h.offset, m.w);
  };
  const onPointerEnd = (e: PointerEvent<HTMLSpanElement>) => {
    const h = hand.current;
    if (!h || h.id !== e.pointerId) return;
    e.preventDefault();
    hand.current = null;
    setHeld(false);
    setGlide(true);
    lean.end();
    if (e.type === "pointerup") onValueCommit?.(latest.current);
  };

  const notched = (marks ?? []).filter((v) => v !== home && v >= min && v <= max);

  return (
    <Field
      labelId={labelId}
      label={label}
      shown={showValue ? text : undefined}
      held={held}
      helpId={helpId}
      help={help}
      minLabel={minLabel}
      maxLabel={maxLabel}
      disabled={disabled}
      className={className}
    >
      <RadixSlider.Root
        ref={plateRef}
        /* The cap runs from the left and the hand is measured from the left, so Radix places the thumb from the left too, under any DirectionProvider. */
        dir="ltr"
        name={disabled ? undefined : name}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={[value]}
        onValueChange={(v) => change(v[0])}
        onValueCommit={(v) => v[0] !== undefined && onValueCommit?.(v[0])}
        onKeyDown={pageKeys}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        data-no-drag=""
        data-held={held ? "" : undefined}
        className={plateBase + " " + plateRing}
      >
        <span aria-hidden="true" className={slot}>
          <span className={fillTravel + (glide ? glides : "")} style={railAt(p)}>
            <span className={"absolute inset-y-0 right-0 w-[calc(100%+0.5rem)] " + fillLook} />
          </span>
        </span>
        {notched.map((v) => (
          <Notch key={v} p={(v - min) / span} home={false} />
        ))}
        {home !== null && home >= min && home <= max && <Notch p={(home - min) / span} home />}
        <Cap p={p} held={held} lean={lean.lean} glide={glide} />
        <RadixSlider.Track className={thumbTrack}>
          <RadixSlider.Thumb
            ref={(el: HTMLSpanElement | null) => {
              thumbRef.current = el;
              setRef(ref, el);
            }}
            id={id}
            aria-labelledby={labelId}
            aria-describedby={helpId}
            aria-valuetext={formatValue ? text : undefined}
            className={thumbHidden}
          />
        </RadixSlider.Track>
      </RadixSlider.Root>
    </Field>
  );
}

/** Two values in one slot, [from, to]: two caps with the fill between them. The caps never cross, each is named by the label and its end, and a form sends both under name. */
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

  /* The slider keeps its own values when you do not control them, because Page Up and the hand need to read them. They
     are sorted and kept in the slot, so a stray default can never draw the caps outside it or crossed. */
  const [inner, setInner] = useState<[number, number]>(defaultValue ?? [min, max]);
  const given = valueProp ?? inner;
  const from = Math.min(max, Math.max(min, Math.min(given[0], given[1])));
  const to = Math.min(max, Math.max(min, Math.max(given[0], given[1])));
  const values: [number, number] = [from, to];
  const fmt = (v: number) => (formatValue ? formatValue(v) : String(v));
  const text = `${fmt(from)} to ${fmt(to)}`;
  const span = max - min || 1;
  const pf = (from - min) / span;
  const pt = (to - min) / span;

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

  const latest = useRef(values);
  latest.current = values;
  const change = (next: number[]) => {
    const held = hold(next);
    if (same(held, latest.current)) return;
    latest.current = held;
    if (valueProp === undefined) setInner(held);
    onValueChange?.(held);
  };

  /* Radix commits a key press with the move it wanted. When the other thumb held it back, nothing moved, so nothing is saved.
     A released drag commits the values as they are, which are always whole. */
  const commit = (next: number[]) => {
    const held = hold(next);
    if (!same(next, values) && same(held, values)) return;
    onValueCommit?.(held);
  };

  /* The keys act on the focused thumb. Radix sends Home to the first thumb and End to the last, whichever has focus, and
     moves ten steps on Page Up and Page Down. The spec says Home and End go to the end of the slot (the other thumb stops
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

  /* The hand: a press takes the nearer cap, held where it was taken when the press is on it, or sent to the finger on
     the spring when it is not. Each handler calls preventDefault, so Radix's pointer handling stays out. */
  const plateRef = useRef<HTMLSpanElement>(null);
  const thumbs = useRef<(HTMLSpanElement | null)[]>([]);
  const hand = useRef<{ id: number; end: 0 | 1; offset: number } | null>(null);
  const [held, setHeld] = useState<0 | 1 | null>(null);
  const [glide, setGlide] = useState(true);
  const [ringed, setRinged] = useState<0 | 1 | null>(null);
  const lean = useLean();
  const moveEnd = (end: 0 | 1, x: number, w: number) => {
    const v = valueAt(along(x, w), min, max, step, null);
    const [a, b] = latest.current;
    change(end === 0 ? [v, b] : [a, v]);
  };
  const onPointerDown = (e: PointerEvent<HTMLSpanElement>) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0) || !plateRef.current) return;
    e.preventDefault();
    const m = measure(plateRef.current, e.clientX);
    const caps = [PAD + pf * (m.w - 2 * PAD), PAD + pt * (m.w - 2 * PAD)] as const;
    const end: 0 | 1 = caps[0] === caps[1] ? (m.x < caps[0] ? 0 : 1) : m.x < (caps[0] + caps[1]) / 2 ? 0 : 1;
    const onCap = Math.abs(m.x - caps[end]) <= 10;
    hand.current = { id: e.pointerId, end, offset: onCap ? caps[end] - m.x : 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
    thumbs.current[end]?.focus({ preventScroll: true });
    setHeld(end);
    setGlide(!onCap);
    lean.start(m.x, e.timeStamp);
    if (!onCap) moveEnd(end, m.x, m.w);
  };
  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const h = hand.current;
    if (!h || h.id !== e.pointerId || !plateRef.current) return;
    e.preventDefault();
    const m = measure(plateRef.current, e.clientX);
    setGlide(false);
    lean.move(m.x, e.timeStamp);
    moveEnd(h.end, m.x + h.offset, m.w);
  };
  const onPointerEnd = (e: PointerEvent<HTMLSpanElement>) => {
    const h = hand.current;
    if (!h || h.id !== e.pointerId) return;
    e.preventDefault();
    hand.current = null;
    setHeld(null);
    setGlide(true);
    lean.end();
    if (e.type === "pointerup") onValueCommit?.(latest.current);
  };

  return (
    <Field
      labelId={labelId}
      label={label}
      shown={showValue ? text : undefined}
      held={held !== null}
      helpId={helpId}
      help={help}
      minLabel={minLabel}
      maxLabel={maxLabel}
      disabled={disabled}
      className={className}
      group
    >
      <RadixSlider.Root
        ref={plateRef}
        dir="ltr" // as the Slider's: the caps and the hand run from the left
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        value={values}
        preserveThumbOrder
        onValueChange={change}
        onValueCommit={commit}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        data-no-drag=""
        data-held={held !== null ? "" : undefined}
        className={plateBase}
      >
        <span aria-hidden="true" className={slot}>
          {/* The fill between the caps: a rail-wide band moved to the first cap and scaled to the second, transform only. */}
          <span
            className={fillTravel + " origin-left" + (glide ? glides : "")}
            style={{ transform: `translateX(${(pf * 100).toFixed(3)}%) scaleX(${Math.max(0, pt - pf).toFixed(4)})` }}
          >
            <span className={"absolute inset-0 " + fillLook} />
          </span>
        </span>
        {([0, 1] as const).map((i) => (
          <Cap key={i} p={i === 0 ? pf : pt} held={held === i} lean={held === i ? lean.lean : 0} glide={glide} ring={ringed === i} />
        ))}
        <RadixSlider.Track className={thumbTrack}>
          {([0, 1] as const).map((i) => (
            <RadixSlider.Thumb
              key={i}
              ref={(el: HTMLSpanElement | null) => {
                thumbs.current[i] = el;
                if (i === 0) setRef(ref, el);
              }}
              id={thumbId(i)}
              /* A form sends both values under the same name (Radix would add [] to it). */
              name={disabled ? undefined : name}
              aria-labelledby={nameId(i)}
              aria-describedby={helpId}
              aria-valuetext={formatValue ? fmt(values[i]) : undefined}
              onKeyDown={thumbKeys(i)}
              /* The focused cap rings itself, for keyboard focus only, so you can tell which one the keys move. */
              onFocus={(e) => setRinged(e.currentTarget.matches(":focus-visible") ? i : null)}
              onBlur={() => setRinged(null)}
              className={thumbHidden}
            />
          ))}
        </RadixSlider.Track>
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
