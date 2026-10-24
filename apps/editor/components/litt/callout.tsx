"use client";
// @litt/callout 2026.10.19. What changed: https://littmd.vercel.app/changelog.md

/**
 * Callout: an inline note in the page flow. A tip, a heads-up, or a result to act on, such as
 * "Try H to snooze" or "Your Framer plan renews in 3 days".
 *
 * - Surface (components.md, Callout): `.litt-raised`, because it sits in the flow. Never glass (P3),
 *   no shadow (P4), and never a left rail, a tinted background or a colored border. A status that
 *   colored the whole box would turn a note into an alarm, and a rail is the one thing litt bans.
 * - Anatomy: a 16px icon at the start, aligned with the title's first line; the title (body, fg);
 *   an optional description (small, fg-subtle); an optional `action` at the end (an sm secondary
 *   Button or a Kbd); and, with `onDismiss`, an icon-only ghost close button at the top end.
 *   Padding is space-4 and the gap space-3. Everything lines up on the title's first line through
 *   a one-line-tall cell (`1lh`), so a taller button hangs evenly above and below the line.
 * - Color: only the icon, in the tone's status color. Neutral is fg-subtle. A non-neutral tone also
 *   puts hidden text before the title ("Warning: "), so color is never the only signal.
 * - Container: the callout measures itself (a container query), not the window. Under 28rem wide
 *   the action drops below the text, aligned with it, so a narrow column or a phone never squeezes
 *   the words.
 * - Semantics: a `note` by default. `live` makes it a `status`, or an `alert` for danger, for a
 *   callout that appears after something the person did, so a screen reader hears it arrive.
 * - Touch: the close button and a Button action grow to 44px on a coarse pointer, and a Kbd action
 *   is hidden, as every key hint is on touch.
 * - Motion: none of its own. Dismissing just unmounts it, so the caller decides what replaces it.
 */
import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "./button";
import { XIcon } from "./icons";

/** Neutral for a tip or a note. Success, warning and danger color the icon and add a hidden word before the title. */
export type CalloutTone = "neutral" | "success" | "warning" | "danger";

/* The four default icons are drawn here: 16px, 1.5px stroke, currentColor, like every litt icon. */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ICON: Record<CalloutTone, ReactNode> = {
  neutral: (
    <Glyph>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 7.25v4M8 4.75v.01" />
    </Glyph>
  ),
  success: (
    <Glyph>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m5.25 8.25 2 2 3.5-4" />
    </Glyph>
  ),
  warning: (
    <Glyph>
      <path d="M8 2.25 14.25 13.25H1.75z" />
      <path d="M8 6.5v3M8 11.5v.01" />
    </Glyph>
  ),
  danger: (
    <Glyph>
      <circle cx="8" cy="8" r="6.25" />
      <path d="m6 6 4 4M10 6l-4 4" />
    </Glyph>
  ),
};

const COLOR: Record<CalloutTone, string> = {
  neutral: "text-litt-fg-subtle",
  success: "text-litt-success",
  warning: "text-litt-warning",
  danger: "text-litt-danger",
};

/* What a screen reader hears before the title, so the icon's color is never the only signal. */
const SAID: Record<CalloutTone, string> = { neutral: "", success: "Success: ", warning: "Warning: ", danger: "Error: " };

export type CalloutProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** What the note says, in a short sentence: "Your Framer plan renews in 3 days". */
  title: ReactNode;
  /** One line of detail under the title, in the quieter tone. */
  description?: ReactNode;
  /** Neutral is the default. Success, warning and danger color the icon, and a hidden word before the title says the same thing. */
  tone?: CalloutTone;
  /** Replaces the tone's icon, such as a lightbulb for a tip. It is drawn in the tone's color, so make it a 16px icon in currentColor. */
  icon?: ReactNode;
  /** The one thing to do about it, at the end: an sm secondary Button or a Kbd. It drops below the text when the callout is under 28rem wide. */
  action?: ReactNode;
  /** Shows an icon-only close button at the top end and calls this when it is pressed. Remove the callout in the handler, because it does not hide itself. */
  onDismiss?: () => void;
  /** Set it for a callout that appears after something the person did: a screen reader announces it as a status, or as an alert for danger. */
  live?: boolean;
  /** Extra classes for the callout, such as a top margin. It fills the width of its container. */
  className?: string;
};

/** An inline note: a raised surface with an icon, a title, a line of detail, an optional action and an optional close button. */
export function Callout({
  title,
  description,
  tone = "neutral",
  icon,
  action,
  onDismiss,
  live = false,
  className = "",
  ...rest
}: CalloutProps) {
  const role = live ? (tone === "danger" ? "alert" : "status") : "note";
  /* With an action there is a column for it; without one the close button takes its place. */
  const cols = action
    ? "grid-cols-[auto_minmax(0,1fr)_auto_auto] @max-[28rem]:grid-cols-[auto_minmax(0,1fr)_auto]"
    : "grid-cols-[auto_minmax(0,1fr)_auto]";
  const closeAt = action ? "col-start-4 @max-[28rem]:col-start-3" : "col-start-3";
  return (
    <div role={role} className={`@container ${className}`} {...rest}>
      <div className={`litt-raised grid items-start gap-x-3 p-4 ${cols}`}>
        <span className={`flex h-[1lh] items-center text-litt-body [&>svg]:size-4 [&>svg]:shrink-0 ${COLOR[tone]}`}>
          {icon ?? ICON[tone]}
        </span>
        <div className="min-w-0">
          <p className="text-litt-body font-litt-title text-litt-fg">
            {SAID[tone] && <span className="sr-only">{SAID[tone]}</span>}
            {title}
          </p>
          {description && <p className="mt-1 text-litt-small text-litt-fg-subtle">{description}</p>}
        </div>
        {action && (
          <div
            className={
              "col-start-3 flex h-[1lh] items-center text-litt-body " +
              "@max-[28rem]:col-start-2 @max-[28rem]:row-start-2 @max-[28rem]:mt-3 @max-[28rem]:h-auto " +
              "pointer-coarse:[&_button]:h-litt-control-md pointer-coarse:has-[>kbd]:hidden"
            }
          >
            {action}
          </div>
        )}
        {onDismiss && (
          <div className={`row-start-1 flex h-[1lh] items-center text-litt-body ${closeAt}`}>
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              aria-label="Dismiss"
              className="-mr-1 pointer-coarse:-mr-2.5 pointer-coarse:h-litt-control-md pointer-coarse:w-litt-control-md"
              onClick={onDismiss}
            >
              <XIcon />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
