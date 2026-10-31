"use client";
// @litt/switch 2026.10.26. What changed: https://littmd.vercel.app/changelog.md

/**
 * Switch (components.md, "Switch"): an on or off setting that takes effect as a setting.
 *
 * - Built on @radix-ui/react-switch. The root is a <button role="switch"> with aria-checked,
 *   Space toggles it, and inside a <form> a hidden input sends the value like a checkbox:
 *   the value when on, nothing when off. The hidden input is Radix's, so name, value and
 *   required are passed straight to it.
 * - A block in a tray (material.md, 6, "Press"; Nick's frames, v0.x). The tray is 92 by 32, sunken: --litt-tray with
 *   --litt-tray-shade, a hairline and its top wall's shade on the floor, at the control radius. The block fills half
 *   of it, 44 by 28, set 2px in, raised: --litt-block with --litt-block-lift, a contact line under its edge and a soft cast.
 *   Its corners are the control radius less those 2px, so the two stay concentric at every shape.
 * - The block says its state: "Off" in --litt-fg-muted at the start, "On" in --litt-fg at the end, at the caption size and
 *   the title weight, in sentence case. Position and word both change, so color is never the signal.
 * - Two tones. neutral (the default) keeps the block white when on. accent fills it with the accent and its word
 *   with --litt-accent-fg. The accent is one fill per view (R6), so accent is for a lone switch that is the view's
 *   main choice; a list of settings stays neutral.
 * - No invalid state. A choice that can be wrong, such as accepting terms, is a Checkbox.
 * - The label is a real <label for> stretched over the whole row, so a click anywhere in it toggles the switch. Its
 *   accessible name is only its text (the block's word is hidden from screen readers, aria-checked says the state),
 *   and the description is linked with aria-describedby. By default the switch comes first, like the checkbox.
 *   With align="end" the label and description come first and the switch sits at the row's end, so the switches
 *   of a settings list line up in one column.
 * - Hand: press anywhere on the row and the block presses down (its cast tightens). A click, a tap or Space toggles
 *   it. Or take the block and drag it: it follows the finger one to one, says the side it is over, and lands on the
 *   nearer side when let go. A drag that ends where it started changes nothing.
 * - Motion: the block crosses on the responsive tier (bounce 0), by translate; its fill, word and cast change on the
 *   instant tier. The tray never moves. Hover deepens the tray's floor a little.
 * - Fun mode (motion/fun.tsx, a trial, off unless a <FunMode> is on): the block crosses on fun mode's glide spring,
 *   as a CSS linear() easing, so it meets the far wall with a little life and settles. At rest it is exactly the
 *   block above. Reduced motion turns it off.
 * - Touch: rows are at least 44px tall. The tray owns a sideways drag and leaves vertical scrolling to the page.
 * - Forced colors drops box-shadow and background colors, so the tray and the block get real borders and system
 *   colors mark the on state.
 */
import { useId, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useFun } from "../../lib/litt/motion";

export type SwitchAlign = "start" | "end";
export type SwitchTone = "neutral" | "accent";

export type SwitchProps = {
  /** The label, beside the switch. Required, because a switch alone has no name. The whole row is clickable. */
  label: ReactNode;
  /** A line of detail under the label. It is linked to the switch with aria-describedby. */
  description?: ReactNode;
  /** Whether the switch is on, when you control it. Pair it with onCheckedChange. */
  checked?: boolean;
  /** Whether the switch starts on, when you do not control it. */
  defaultChecked?: boolean;
  /** Called with the new state each time the switch is toggled, by click, tap, drag, label or Space. */
  onCheckedChange?: (checked: boolean) => void;
  /** "neutral" keeps the block white when on. "accent" fills it with the accent: one per view (R6), for a lone switch that is the view's main choice. */
  tone?: SwitchTone;
  /** The block's two words, [off, on]. Keep them to three letters or so, such as ["Aus", "An"]. The state itself is read from aria-checked. */
  words?: [string, string];
  /** Mutes the row, skips it in the tab order and keeps a form from sending it. */
  disabled?: boolean;
  /** Marks the switch as required, for a form that must have it on. It sets aria-required. */
  required?: boolean;
  /** The name a form sends the value under. A form sends it only while the switch is on. */
  name?: string;
  /** What a form sends while the switch is on. */
  value?: string;
  /** The id of the switch, which the label points at. Made up for you when left out. */
  id?: string;
  /** "start" puts the switch first, then the label, like the checkbox. "end" puts the label first and the switch at the end of a full-width row, for settings lists. */
  align?: SwitchAlign;
  /** Extra classes for the row, such as a width. */
  className?: string;
  /** The switch button, for focus or a form library. */
  ref?: Ref<HTMLButtonElement>;
};

/** How far the block crosses, in px: the tray's 92, less 2px on each side, less the block's own 44. */
const TRAVEL = 44;
/** How far a finger moves before a press becomes a drag, in px. */
const SLOP = 4;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus";

/* The tray is the button. The row's label is stretched over the whole row, so the tray sits above it (z-1) and a
   press on the tray itself still lands on the button. It clips the block, so a cast never spills past its walls. */
const tray =
  "peer relative z-1 inline-flex h-8 w-23 shrink-0 cursor-pointer touch-pan-y items-center self-start overflow-hidden rounded-litt-control p-0.5 " +
  "bg-litt-tray shadow-(--litt-tray-shade) " +
  "transition-[background-color] duration-(--litt-dur-instant) ease-litt " +
  "enabled:group-hover/switch:bg-[color-mix(in_oklab,var(--litt-tray),var(--litt-fg)_4%)] " +
  "disabled:cursor-not-allowed disabled:bg-litt-surface-2 disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "forced-colors:border forced-colors:p-px " + // the border is real, so the padding gives it back its px
  focusRing;

/* The block. Its corners are the control radius less the 2px it is set in, so they stay concentric with the tray's. */
const blockBase =
  "pointer-events-none flex h-7 w-11 shrink-0 items-center justify-center rounded-[calc(var(--litt-radius-control)-2px)] " +
  "text-litt-caption font-litt-title select-none " +
  "forced-colors:border";

const blockOff = "bg-litt-block text-litt-fg-muted shadow-(--litt-block-lift) group-active/switch:shadow-(--litt-block-press)";
const blockOn: Record<SwitchTone, string> = {
  neutral: "bg-litt-block text-litt-fg shadow-(--litt-block-lift) group-active/switch:shadow-(--litt-block-press) forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
  accent: "bg-litt-accent text-litt-accent-fg shadow-(--litt-block-lift) group-active/switch:shadow-(--litt-block-press) forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
};
/* Disabled, the block lies flat: no cast, a hairline, and the word in --litt-fg-disabled. */
const blockDisabled = "bg-litt-surface-2 text-litt-fg-disabled shadow-[inset_0_0_0_1px_var(--litt-line)] forced-colors:text-[GrayText]";

/* The block's crossing on the responsive tier, and its fill, word and cast on the instant tier. While a hand drags it,
   it follows one to one, so only the colors keep their fade. */
const crossing: CSSProperties = {
  transitionProperty: "translate, background-color, color, box-shadow",
  transitionDuration: "var(--litt-dur-responsive), var(--litt-dur-instant), var(--litt-dur-instant), var(--litt-dur-instant)",
  transitionTimingFunction: "var(--litt-ease-responsive), var(--litt-ease-out), var(--litt-ease-out), var(--litt-ease-out)",
};
const following: CSSProperties = {
  transitionProperty: "background-color, color, box-shadow",
  transitionDuration: "var(--litt-dur-instant)",
  transitionTimingFunction: "var(--litt-ease-out)",
};

/** One switch with its label. Use checked and onCheckedChange to control it, or defaultChecked to leave it alone. */
export function Switch({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  tone = "neutral",
  words = ["Off", "On"],
  disabled,
  required,
  name,
  value,
  id: idProp,
  align = "start",
  className = "",
  ref,
}: SwitchProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const descriptionId = description ? `${id}-description` : undefined;
  const end = align === "end";

  /* The switch keeps its own state when you do not control it, because a drag sets it to a side, not a flip. */
  const [inner, setInner] = useState(defaultChecked ?? false);
  const on = checked ?? inner;
  const set = (next: boolean) => {
    if (checked === undefined) setInner(next);
    onCheckedChange?.(next);
  };

  /* A hand on the block: where it took hold, and where the block is now. A press becomes a drag past SLOP px. */
  const hand = useRef<{ id: number; x0: number; from: number; at: number; scale: number; moved: boolean } | null>(null);
  const dropped = useRef(-1);
  const [dragX, setDragX] = useState<number | null>(null);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const scale = el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
    const from = on ? TRAVEL : 0;
    hand.current = { id: e.pointerId, x0: e.clientX, from, at: from, scale, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const h = hand.current;
    if (!h || h.id !== e.pointerId) return;
    const dx = (e.clientX - h.x0) / h.scale;
    if (!h.moved && Math.abs(dx) < SLOP) return;
    h.moved = true;
    h.at = Math.min(TRAVEL, Math.max(0, h.from + dx));
    setDragX(h.at);
  };
  const onPointerEnd = (e: PointerEvent<HTMLButtonElement>) => {
    const h = hand.current;
    if (!h || h.id !== e.pointerId) return;
    hand.current = null;
    if (!h.moved) return;
    setDragX(null);
    if (e.type === "pointercancel") return;
    /* The click that follows a drag must not flip it back: the drop already chose the side. */
    dropped.current = e.timeStamp;
    const next = h.at > TRAVEL / 2;
    if (next !== on) set(next);
  };
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (dropped.current >= 0 && e.timeStamp - dropped.current < 500) e.preventDefault(); // Radix skips its toggle
    dropped.current = -1;
  };

  const dragging = dragX !== null;
  const shown = dragging ? dragX > TRAVEL / 2 : on;
  const x = dragging ? dragX : on ? TRAVEL : 0;

  /* Fun mode: the crossing (the first transitioned property) takes the glide spring; the rest keep the instant tier. */
  const fun = useFun();
  const motion: CSSProperties = dragging
    ? following
    : fun
      ? {
          ...crossing,
          transitionDuration: `${fun.glideCss.duration}ms, var(--litt-dur-instant), var(--litt-dur-instant), var(--litt-dur-instant)`,
          transitionTimingFunction: `${fun.glideCss.easing}, var(--litt-ease-out), var(--litt-ease-out), var(--litt-ease-out)`,
        }
      : crossing;

  const block = blockBase + " " + (disabled ? blockDisabled : shown ? blockOn[tone] : blockOff);

  return (
    <div
      className={
        "group/switch relative grid select-none py-1.5 " +
        (end ? "w-full grid-cols-[1fr_auto] gap-x-4 " : "w-fit grid-cols-[auto_1fr] gap-x-3 ") +
        className
      }
    >
      <SwitchPrimitive.Root
        ref={ref}
        id={id}
        checked={on}
        onCheckedChange={set}
        disabled={disabled}
        required={required}
        name={name}
        value={value}
        aria-describedby={descriptionId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={onClick}
        data-no-drag=""
        className={tray + (end ? " col-start-2 row-start-1" : " col-start-1 row-start-1")}
      >
        <SwitchPrimitive.Thumb className={block} style={{ ...motion, translate: `${x}px 0` }}>
          <span aria-hidden="true">{shown ? words[1] : words[0]}</span>
        </SwitchPrimitive.Thumb>
      </SwitchPrimitive.Root>
      {/* The label is stretched over the whole row, so a click anywhere in it toggles the switch. */}
      <label
        htmlFor={id}
        className={
          "row-start-1 flex min-h-8 cursor-pointer items-center text-litt-small font-litt-title text-litt-fg after:absolute after:inset-0 peer-disabled:cursor-not-allowed peer-disabled:text-litt-fg-disabled " +
          (end ? "col-start-1" : "col-start-2")
        }
      >
        {label}
      </label>
      {description && (
        <p
          id={descriptionId}
          /* A disabled switch keeps its description at --litt-fg-subtle: it is often what says why the switch is off-limits. */
          className={"row-start-2 text-litt-small text-litt-fg-subtle " + (end ? "col-start-1" : "col-start-2")}
        >
          {description}
        </p>
      )}
    </div>
  );
}
