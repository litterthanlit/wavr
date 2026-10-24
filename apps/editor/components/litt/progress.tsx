"use client";
// @litt/progress 2026.10.22. What changed: https://littmd.vercel.app/changelog.md

/**
 * Progress: how far along something is that is happening now, such as an upload, an import or a build
 * (components.md, "Progress"). A Meter shows a quantity against a limit and stands still; Progress moves while the
 * work goes on, then ends done or failed.
 *
 * - Anatomy: the Meter's lockup. The label at the small size in --litt-fg, the reading at the end in the mono at the caption
 *   size in --litt-fg-subtle ("3.2 of 8 MB", or the percent), and under them a 4px rail at the control radius: the track at
 *   fg 12%, the done part in --litt-fg. Never the accent and never a data hue: it is one quantity.
 * - Ending: done fills the rail and the reading says "Done"; failed keeps the rail where it stopped, in --litt-danger, and the
 *   reading says "Failed". A message under the rail says the rest (what failed and what to do, or the time left).
 * - Not known yet: with no value the rail stays empty and the reading says so in words ("Waiting"). Nothing moves on its
 *   own: no stripes, no shimmer, no sweep. A wait that has no end in sight is a spinner in a button, not a rail.
 * - Motion: the done part is a full-width band scaled from the left, so only a transform changes, on the instant tier,
 *   which keeps up with a value that updates often. Under reduced motion it jumps.
 * - Accessibility: role="progressbar", named by the label, with aria-valuenow while the value is known and the reading
 *   as aria-valuetext. Ending done or failed is said once in a polite status, so a long wait need not be watched.
 */
import { useId, type ReactNode } from "react";

export type ProgressStatus = "active" | "done" | "failed";

export type ProgressProps = {
  /** What is in progress: "Uploading brief.pdf", "Importing 1,204 pages". */
  label: ReactNode;
  /** How far along it is, from 0 to max. Leave it out while that is not known yet: the rail stays empty and nothing moves. */
  value?: number;
  /** The value that means finished. */
  max?: number;
  /** The reading at the end of the label row, and what a screen reader hears: "3.2 of 8 MB". Default: the percent. */
  valueText?: string;
  /** active while it runs; done fills the rail and says Done; failed keeps the rail where it stopped and says Failed. */
  status?: ProgressStatus;
  /** A line under the rail: the time left, or what failed and what to do about it. */
  message?: ReactNode;
  /** Hides the label row but keeps it as the name, for a row that already shows the name, such as a file in a list. */
  hideLabel?: boolean;
  className?: string;
};

const TRACK = "bg-[color-mix(in_oklab,var(--litt-fg)_12%,transparent)]";

/** A rail for work that is happening now: it fills as the value grows, then ends done or failed, said in words. */
export function Progress({ label, value, max = 100, valueText, status = "active", message, hideLabel = false, className = "" }: ProgressProps) {
  const labelId = useId();
  const messageId = useId();
  const known = value !== undefined || status === "done";
  const share = status === "done" ? 1 : max > 0 && value !== undefined ? Math.max(0, Math.min(1, value / max)) : 0;
  const reading =
    status === "done" ? "Done" : status === "failed" ? "Failed" : value === undefined ? (valueText ?? "Waiting") : (valueText ?? `${Math.round(share * 100)}%`);
  const tone = status === "failed" ? "text-litt-danger" : "text-litt-fg-subtle";

  return (
    <div className={"grid min-w-0 gap-2 " + className}>
      <div className={hideLabel ? "sr-only" : "flex items-baseline justify-between gap-4"}>
        <span id={labelId} className="min-w-0 truncate text-litt-small text-litt-fg">
          {label}
        </span>
        <span className={"shrink-0 font-litt-mono text-litt-caption font-normal tabular-nums " + tone}>{reading}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-describedby={message ? messageId : undefined}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={known ? Math.round(share * max) : undefined}
        aria-valuetext={reading}
        className={"h-1 overflow-hidden rounded-litt-control forced-colors:border " + TRACK}
      >
        {/* A full-width band scaled from the left: only a transform changes as the value grows. */}
        <div
          className={
            "h-full w-full origin-left rounded-litt-control transition-transform duration-(--litt-dur-instant) ease-litt " +
            (status === "failed" ? "bg-litt-danger" : "bg-litt-fg")
          }
          style={{ transform: `scaleX(${share})` }}
        />
      </div>
      {message && (
        <p id={messageId} className={"text-litt-small " + (status === "failed" ? "text-litt-danger" : "text-litt-fg-subtle")}>
          {message}
        </p>
      )}
      {/* The end is said once, so nobody has to watch the rail. Kept mounted, so the change is announced. */}
      <span role="status" className="sr-only">
        {status === "active" ? "" : `${typeof label === "string" ? `${label}: ` : ""}${status === "done" ? "done" : "failed"}.`}
      </span>
    </div>
  );
}
