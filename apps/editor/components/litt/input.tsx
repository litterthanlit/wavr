"use client";
// @litt/input 2026.10.19. What changed: https://littmd.vercel.app/changelog.md

/**
 * Input: the text field (components.md, "Input"). Three parts, one look.
 *
 * - Input is the bare control, for inline forms where the label lives elsewhere.
 * - TextField is Input with a label above and a hint or error below, all wired up.
 * - Textarea is the same field for longer text (a spec extension: same edge, focus,
 *   error and label as Input, but taller).
 *
 * - Sizes sit on the shared control scale (P10): sm 32, md 44, lg 56, with the control
 *   radius. Text is 13, 15 and 16px, and 16px on coarse pointers so iOS never zooms.
 *   On a touch screen the sm input grows to 44px, like the small targets in Header and List.
 * - Edge: inset 1px --litt-line-control. Focus turns the edge --litt-focus and adds --litt-focus-ring
 *   (:focus-visible only). Error turns the edge --litt-danger and keeps the ring on focus.
 * - Typed text at the text weight and the label at the title weight (P9). The edge fades on the
 *   instant tier, the box never moves.
 * - No hover state: the spec and the specimen have none, and a text field that shifts
 *   its fill under the cursor reads as pressed.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from "react";

export type InputSize = "sm" | "md" | "lg";

/* The look every field shares: fill, edge, focus, error, disabled. */
const field =
  "w-full min-w-0 rounded-litt-control bg-litt-surface-1 font-normal text-litt-fg placeholder:text-litt-fg-subtle " +
  "pointer-coarse:text-(length:--litt-control-text-lg) " +
  "shadow-[inset_0_0_0_1px_var(--litt-line-control)] " +
  "transition-[box-shadow] duration-(--litt-dur-instant) ease-litt " +
  "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--litt-focus),var(--litt-focus-ring)] " +
  "aria-invalid:shadow-[inset_0_0_0_1px_var(--litt-danger)] " +
  "aria-invalid:focus-visible:shadow-[inset_0_0_0_1px_var(--litt-danger),var(--litt-focus-ring)] " +
  "disabled:cursor-not-allowed disabled:bg-litt-surface-2 disabled:text-litt-fg-disabled disabled:placeholder:text-litt-fg-disabled " +
  "disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  /* Forced colors (Windows high contrast) drops box-shadow, so the edge becomes a real border and focus gets an outline. */
  "forced-colors:border forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-offset-2";

const inputSizes: Record<InputSize, string> = {
  sm: "h-litt-control-sm px-litt-control-pad-sm text-litt-small pointer-coarse:h-litt-control-md",
  md: "h-litt-control-md px-litt-control-pad-md text-litt-body",
  lg: "h-litt-control-lg px-litt-control-pad-lg text-(length:--litt-control-text-lg)",
};

/* A textarea has no fixed height, so its size sets the air above and below the text instead. */
const textareaSizes: Record<InputSize, string> = {
  sm: "px-litt-control-pad-sm py-2 text-litt-small",
  md: "px-litt-control-pad-md py-3 text-litt-body",
  lg: "px-litt-control-pad-lg py-4 text-(length:--litt-control-text-lg)",
};

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Height on the shared control scale: sm is 32, md is 44, lg is 56. Use lg next to an lg button, and sm in tables and toolbars. */
  size?: InputSize;
  /** Draws the error edge and sets aria-invalid. The bare Input shows no message, so link yours with aria-describedby. */
  invalid?: boolean;
  /** Geist Mono, for slugs, domains and other data. */
  mono?: boolean;
  /** The underlying <input>, for focus or a form library. */
  ref?: Ref<HTMLInputElement>;
};

/**
 * The bare input, with no label. Use it in an inline form, such as an email field beside its submit button, and give it
 * an aria-label, because a placeholder is not a label. Every other input attribute goes through.
 */
export function Input({ size = "md", invalid = false, mono = false, className = "", ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={[field, inputSizes[size], mono ? "font-litt-mono" : "", className].join(" ")}
      {...rest}
    />
  );
}

/** The ids and text a labelled field needs: the control's id, the note under it, and what that note says. */
function useFieldParts(idProp: string | undefined, help: ReactNode, error: ReactNode, describedBy: string | undefined) {
  const auto = useId();
  const id = idProp ?? auto;
  const note = error ?? help;
  const noteId = `${id}-note`;
  return { id, note, noteId, describedBy: [describedBy, note ? noteId : undefined].filter(Boolean).join(" ") || undefined };
}

/* Label above, control, then a hint or an error below. The error replaces the hint. */
function Field({
  id,
  noteId,
  label,
  note,
  error,
  disabled,
  children,
}: {
  id: string;
  noteId: string;
  label: ReactNode;
  note: ReactNode;
  error: ReactNode;
  disabled: boolean | undefined;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={"text-litt-small font-litt-title " + (disabled ? "text-litt-fg-disabled" : "text-litt-fg")}>
        {label}
      </label>
      {children}
      {note && (
        <p id={noteId} className={"text-litt-small " + (error ? "text-litt-danger" : "text-litt-fg-subtle")}>
          {note}
        </p>
      )}
    </div>
  );
}

export type TextFieldProps = Omit<InputProps, "invalid"> & {
  /** The label above the field. Required, because a placeholder is not a label. Clicking it focuses the input. */
  label: ReactNode;
  /** A hint under the field. An error replaces it. */
  help?: ReactNode;
  /** Shown in danger color and linked to the input with aria-describedby. Also sets aria-invalid. Say how to fix it. */
  error?: ReactNode;
};

/** A labelled text input. The label, the hint and the error are wired to the input for you; every other input attribute goes through. */
export function TextField({
  label,
  help,
  error,
  size = "md",
  mono = false,
  id: idProp,
  "aria-describedby": describedByProp,
  className = "",
  ...rest
}: TextFieldProps) {
  const { id, note, noteId, describedBy } = useFieldParts(idProp, help, error, describedByProp);
  return (
    <Field id={id} noteId={noteId} label={label} note={note} error={error} disabled={rest.disabled}>
      <Input id={id} size={size} mono={mono} invalid={!!error} aria-describedby={describedBy} className={className} {...rest} />
    </Field>
  );
}

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  /** The label above the field. Required, because a placeholder is not a label. Clicking it focuses the textarea. */
  label: ReactNode;
  /** A hint under the field. An error replaces it. */
  help?: ReactNode;
  /** Shown in danger color and linked to the textarea with aria-describedby. Also sets aria-invalid. Say how to fix it. */
  error?: ReactNode;
  /** Sets the air around the text and its size, like Input: sm is 13px, md is 14px, lg is 16px. The height comes from rows. */
  size?: InputSize;
  /** Geist Mono, for code and data. */
  mono?: boolean;
  /** The id of the textarea, when you need your own. */
  id?: string;
  /** The underlying <textarea>, for focus or a form library. */
  ref?: Ref<HTMLTextAreaElement>;
};

/**
 * A labelled field for longer text, such as a project brief. It has the same edge, focus, error and label as TextField.
 * The height comes from rows, and people can drag it taller.
 */
export function Textarea({
  label,
  help,
  error,
  size = "md",
  mono = false,
  rows = 4,
  id: idProp,
  "aria-describedby": describedByProp,
  className = "",
  ...rest
}: TextareaProps) {
  const { id, note, noteId, describedBy } = useFieldParts(idProp, help, error, describedByProp);
  return (
    <Field id={id} noteId={noteId} label={label} note={note} error={error} disabled={rest.disabled}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[field, "block resize-y", textareaSizes[size], mono ? "font-litt-mono" : "", className].join(" ")}
        {...rest}
      />
    </Field>
  );
}
