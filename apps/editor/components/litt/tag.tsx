"use client";
// @litt/tag 2026.10.19. What changed: https://littmd.vercel.app/changelog.md

/**
 * Tag: a small label that names something (Framer, Site), files it under a category (Finance),
 * or reports its status (Live, Review).
 *
 * - The look is the selected segment's (components.md, Tag): 24px tall at the control radius,
 *   a surface-1 fill with an inset line hairline and the top highlight, and the sans at the
 *   caption size and the label weight (P9, v0.12), in sentence case. A plain tag is fg-muted.
 * - A status tag colors its text with the status color, never the fill, and there is no dot.
 *   The label says the status in words, so color never carries it alone.
 * - The status set is the tokens' own: success, warning and danger, plus neutral (fg-subtle).
 *   There is no accent status: the accent is chosen per project, and it does not promise
 *   4.5:1 for caption text.
 * - A hue tag (P11, v0.11) files the thing under a category, so its color carries data: the
 *   hue's tint as the fill, its -text tone for the label (4.5:1 on the tint, checked by
 *   check.mjs), and a hairline of the hue under the top highlight. One hue means one category
 *   in a view. A hue is never a status: a tag that says how something stands takes `status`.
 * - Static: no motion and no states. A tag is a label, not a control, so it never takes
 *   focus. If you need something to press, use Button or a chip.
 */
import type { HTMLAttributes, ReactNode } from "react";

export type TagStatus = "success" | "warning" | "danger" | "neutral";

/** The five data hues, in their fixed order (P11). */
export type TagHue = "blue" | "amber" | "teal" | "violet" | "rose";

const STATUS: Record<TagStatus, string> = {
  success: "text-litt-success",
  warning: "text-litt-warning",
  danger: "text-litt-danger",
  neutral: "text-litt-fg-subtle",
};

const HUE: Record<TagHue, string> = {
  blue: "bg-litt-data-blue-tint text-litt-data-blue-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-data-blue)_24%,transparent),var(--litt-highlight)]",
  amber: "bg-litt-data-amber-tint text-litt-data-amber-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-data-amber)_24%,transparent),var(--litt-highlight)]",
  teal: "bg-litt-data-teal-tint text-litt-data-teal-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-data-teal)_24%,transparent),var(--litt-highlight)]",
  violet: "bg-litt-data-violet-tint text-litt-data-violet-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-data-violet)_24%,transparent),var(--litt-highlight)]",
  rose: "bg-litt-data-rose-tint text-litt-data-rose-text shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-data-rose)_24%,transparent),var(--litt-highlight)]",
};

const PLAIN = "bg-litt-surface-1 shadow-[inset_0_0_0_1px_var(--litt-line),var(--litt-highlight)] ";

export type TagProps = HTMLAttributes<HTMLSpanElement> & {
  /** Leave it out for a plain label. Set it for a status: the text takes that color, and the fill never does. */
  status?: TagStatus;
  /** Files the thing under a category with one of the five data hues: a tinted fill and the hue's text tone. Use one hue per category in a view, and never for a status. */
  hue?: TagHue;
  /** The label. Keep it to a word or two, because a tag never wraps. */
  children: ReactNode;
  /** Extra classes for the tag. */
  className?: string;
};

/** A 24px label at the control radius, in the sans at the label weight. Add `status` to color its text, or `hue` to file it under a category. */
export function Tag({ status, hue, children, className = "", ...rest }: TagProps) {
  return (
    <span
      className={
        "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-litt-control px-2 text-litt-caption " +
        (hue ? HUE[hue] : PLAIN + (status ? STATUS[status] : "text-litt-fg-muted")) +
        " " +
        className
      }
      {...rest}
    >
      {children}
    </span>
  );
}
