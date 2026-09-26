"use client";

import { useEffect, useRef } from "react";
import type { StartupPhase } from "@/lib/use-startup-guard";

type RecoveryPhase = Extract<StartupPhase, { kind: "recovery" }>;

interface StartupRecoveryProps {
  phase: RecoveryPhase;
  onSafeStart: () => void;
  onResetScene: () => void;
  onNormalStart: () => void;
}

const COPY: Record<RecoveryPhase["reason"], { title: string; body: string }> = {
  "unclean-start": {
    title: "Wavr didn’t finish starting last time",
    body: "The last session stopped while it was drawing, which usually means the graphics card froze. Rendering is paused so this doesn’t happen again.",
  },
  stalled: {
    title: "Rendering was stopped to keep your computer responsive",
    body: "Frames were taking far too long to draw, so Wavr stopped the renderer before it could freeze the system.",
  },
  "context-lost": {
    title: "The graphics card was reset while drawing",
    body: "The browser lost its GPU context, which usually means the scene hung the graphics card. Wavr didn’t restart it automatically.",
  },
  forced: {
    title: "Recovery mode",
    body: "You opened the editor with ?safe, so rendering hasn’t started yet.",
  },
};

export default function StartupRecovery({
  phase,
  onSafeStart,
  onResetScene,
  onNormalStart,
}: StartupRecoveryProps) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const copy = COPY[phase.reason];
  const repeated = phase.failures >= 2;
  const safeAlreadyFailed = phase.lastMode === "safe" && phase.reason !== "forced";

  useEffect(() => {
    primaryRef.current?.focus();
  }, []);

  const primaryButton =
    "w-full rounded-lg bg-text-primary px-4 py-2.5 text-sm font-medium text-root transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-base";
  const secondaryButton =
    "w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors hover:border-border-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-y-auto bg-root px-4 py-8">
      <section
        role="alert"
        aria-labelledby="startup-recovery-title"
        aria-describedby="startup-recovery-body"
        className="w-full max-w-md rounded-xl border border-border bg-base p-6 shadow-2xl sm:p-8"
      >
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-text-tertiary">
          Crash guard
        </p>
        <h2 id="startup-recovery-title" className="text-lg font-medium leading-snug text-text-primary">
          {copy.title}
        </h2>
        <p id="startup-recovery-body" className="mt-3 text-sm leading-relaxed text-text-secondary">
          {copy.body}
          {repeated && ` This has happened ${phase.failures} times in a row.`}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          {safeAlreadyFailed ? (
            <>
              <button ref={primaryRef} type="button" onClick={onResetScene} className={primaryButton}>
                Reset the scene and open in safe mode
              </button>
              <button type="button" onClick={onSafeStart} className={secondaryButton}>
                Open this scene in safe mode again
              </button>
            </>
          ) : (
            <>
              <button ref={primaryRef} type="button" onClick={onSafeStart} className={primaryButton}>
                Open in safe mode
              </button>
              <button type="button" onClick={onResetScene} className={secondaryButton}>
                Reset the scene and open in safe mode
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onNormalStart}
            className="mt-1 rounded-lg px-4 py-2 text-xs text-text-tertiary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {repeated ? "Start normally anyway (it may freeze again)" : "Start normally"}
          </button>
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs leading-relaxed text-text-tertiary">
          Safe mode renders at half resolution on the low-power GPU, 30fps, paused, without the 3D
          overlay. Add <code className="font-mono text-text-secondary">?safe</code> to the editor URL to
          come back to this screen any time.
        </p>
      </section>
    </div>
  );
}
