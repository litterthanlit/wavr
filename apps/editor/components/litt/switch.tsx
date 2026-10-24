"use client";
// @litt/switch 2026.10.22. What changed: https://littmd.vercel.app/changelog.md

/**
 * Switch (components.md, "Switch"): an on or off setting that takes effect as a setting.
 *
 * - Built on @radix-ui/react-switch. The root is a <button role="switch"> with aria-checked,
 *   Space toggles it, and inside a <form> a hidden input sends the value like a checkbox:
 *   the value when on, nothing when off. The hidden input is Radix's, so name, value and
 *   required are passed straight to it.
 * - A pill track, 36 by 20, with a 16px round thumb inset 2px (litt.md v0.9). Off: a
 *   --litt-surface-1 track with the --litt-line-control edge and a --litt-line-control thumb, at the start.
 *   On: an --litt-fg track and a --litt-canvas thumb, at the end. Never the accent (P1): a form can
 *   hold many switches, and the accent stays on the one primary action. Position, fill and
 *   thumb color all change, so color is never the only signal.
 * - No invalid state. A choice that can be wrong, such as accepting terms, is a Checkbox.
 * - The label is a real <label for> stretched over the whole row, so a click anywhere in it
 *   toggles the switch. Its accessible name is only its text, and the description is linked
 *   with aria-describedby. By default the switch comes first, like the checkbox. With
 *   align="end" the label and description come first and the switch sits at the row's end,
 *   so the switches of a settings list line up in one column.
 * - Motion: the instant tier only. The thumb slides by translate and the fills fade. The
 *   box never moves. Hover and press show a wash over the track.
 * - Fun mode (motion/fun.tsx, a trial, off unless a <FunMode> is on): the thumb crosses on fun mode's glide spring, as
 *   a CSS linear() easing, so it lands a hair past its end and settles. While the row is held the thumb stretches 4px
 *   toward where it will go (a second circle under it slides out, by transform, and fades away when let go), so a
 *   press says which way it is about to move. At rest the thumb is exactly the circle above. Reduced motion turns it off.
 * - Touch: rows are at least 44px tall on coarse pointers.
 * - Forced colors drops box-shadow and background colors, so the track gets a real border and
 *   system colors mark the on state.
 */
import { useId, type CSSProperties, type ReactNode, type Ref } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useFun } from "../../lib/litt/motion";

export type SwitchAlign = "start" | "end";

export type SwitchProps = {
  /** The label, beside the switch. Required, because a switch alone has no name. The whole row is clickable. */
  label: ReactNode;
  /** A line of detail under the label. It is linked to the switch with aria-describedby. */
  description?: ReactNode;
  /** Whether the switch is on, when you control it. Pair it with onCheckedChange. */
  checked?: boolean;
  /** Whether the switch starts on, when you do not control it. */
  defaultChecked?: boolean;
  /** Called with the new state each time the switch is toggled, by click, tap, label or Space. */
  onCheckedChange?: (checked: boolean) => void;
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

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus";

/* The track is the button. Its edge is an inset box-shadow, which fades with the fill. The row's label is stretched over the
   whole row, so the track sits above it (z-1) and a click on the track itself still lands on the button. */
const trackBase =
  "peer relative z-1 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center self-start rounded-litt-pill p-0.5 " +
  "bg-litt-surface-1 shadow-[inset_0_0_0_1px_var(--litt-line-control)] " +
  "transition-[background-color,box-shadow] duration-(--litt-dur-instant) ease-litt " +
  "data-[state=checked]:bg-litt-fg data-[state=checked]:shadow-none " +
  "disabled:cursor-not-allowed disabled:bg-litt-surface-2 disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "disabled:data-[state=checked]:bg-litt-surface-3 disabled:data-[state=checked]:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "forced-colors:border forced-colors:p-px forced-colors:data-[state=checked]:bg-[Highlight] " + // the border is real, so the padding gives it back its px
  focusRing;

/* The thumb slides 16px: the track's 36, less 2px of inset on each side, less its own 16. Tailwind's translate-* sets the CSS
   `translate` property, so the transition names `translate`. */
const thumb =
  "pointer-events-none block size-4 rounded-litt-pill bg-litt-line-control " +
  "transition-[translate,background-color] duration-(--litt-dur-instant) ease-litt " +
  "data-[state=checked]:translate-x-4 data-[state=checked]:bg-litt-canvas " +
  "data-disabled:bg-litt-fg-disabled data-disabled:data-[state=checked]:bg-litt-fg-disabled " +
  "forced-colors:bg-[ButtonText] forced-colors:data-[state=checked]:bg-[HighlightText] " + // a token color would be forced to the canvas, so the thumb names system colors
  "forced-colors:data-disabled:bg-[GrayText] forced-colors:data-disabled:data-[state=checked]:bg-[GrayText]";

/* Fun mode's stretch: a second circle, the thumb's ::after in the thumb's own color, hidden at rest. While the row is held
   it shows and slides 4px toward the other end, so the thumb reads as a capsule leaning the way it will go. */
const stretch =
  "relative after:absolute after:inset-0 after:rounded-litt-pill after:bg-inherit after:opacity-0 " +
  "after:transition-[translate,opacity] after:duration-(--litt-dur-instant) after:ease-litt " +
  "group-active/switch:after:translate-x-1 group-active/switch:after:opacity-100 " +
  "group-active/switch:data-[state=checked]:after:-translate-x-1 data-disabled:after:hidden forced-colors:after:hidden";

/* Hover and press, as a wash over the track. It is not tied to the button's own :hover, because the row is the target.
   When on, the track is --litt-fg, so an --litt-fg wash would not show: the wash there is --litt-canvas instead. */
const wash =
  "pointer-events-none relative z-1 row-start-1 h-5 w-9 self-start rounded-litt-pill bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)] opacity-0 " +
  "transition-[opacity,background-color] duration-(--litt-dur-instant) ease-litt " +
  "group-hover/switch:opacity-100 group-active/switch:bg-[color-mix(in_oklab,var(--litt-fg)_10%,transparent)] group-active/switch:opacity-100 " +
  "peer-data-[state=checked]:bg-[color-mix(in_oklab,var(--litt-canvas)_12%,transparent)] " +
  "group-active/switch:peer-data-[state=checked]:bg-[color-mix(in_oklab,var(--litt-canvas)_20%,transparent)] " +
  "peer-disabled:hidden forced-colors:hidden";

/** One switch with its label. Use checked and onCheckedChange to control it, or defaultChecked to leave it alone. */
export function Switch({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
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
  /* Fun mode: the thumb's travel (the first transitioned property) takes the glide spring; its fill keeps the instant tier. */
  const fun = useFun();
  const glide: CSSProperties | undefined = fun
    ? {
        transitionDuration: `${fun.glideCss.duration}ms, var(--litt-dur-instant)`,
        transitionTimingFunction: `${fun.glideCss.easing}, var(--litt-ease-out)`,
      }
    : undefined;

  return (
    <div
      className={
        "group/switch relative grid select-none " +
        (end ? "w-full grid-cols-[1fr_auto] gap-x-4 py-3 " : "w-fit grid-cols-[auto_1fr] gap-x-2 py-2 pointer-coarse:py-3 ") +
        className
      }
    >
      <SwitchPrimitive.Root
        ref={ref}
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        required={required}
        name={name}
        value={value}
        aria-describedby={descriptionId}
        className={trackBase + (end ? " col-start-2 row-start-1" : " col-start-1 row-start-1")}
      >
        <SwitchPrimitive.Thumb className={fun ? thumb + " " + stretch : thumb} style={glide} />
      </SwitchPrimitive.Root>
      <span aria-hidden="true" className={wash + (end ? " col-start-2" : " col-start-1")} />
      {/* The label is stretched over the whole row, so a click anywhere in it toggles the switch. */}
      <label
        htmlFor={id}
        className={
          "row-start-1 min-h-5 cursor-pointer text-litt-small font-litt-title text-litt-fg after:absolute after:inset-0 peer-disabled:cursor-not-allowed peer-disabled:text-litt-fg-disabled " +
          (end ? "col-start-1" : "col-start-2")
        }
      >
        {label}
      </label>
      {description && (
        <p
          id={descriptionId}
          /* A disabled switch keeps its description at --litt-fg-subtle: it is often what says why the switch is off-limits. */
          className={"row-start-2 mt-1 text-litt-small text-litt-fg-subtle " + (end ? "col-start-1" : "col-start-2")}
        >
          {description}
        </p>
      )}
    </div>
  );
}
