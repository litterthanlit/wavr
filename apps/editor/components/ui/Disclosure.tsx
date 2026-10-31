"use client";

import { useId, useState, type ReactNode } from "react";

export default function Disclosure({ label, ariaLabel, children }: { label: string; ariaLabel?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 self-start py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
      >
        <svg
          className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4 2l4 4-4 4z" />
        </svg>
        {label}
      </button>
      <div id={panelId} className="flex flex-col gap-3 empty:hidden">
        {open && children}
      </div>
    </div>
  );
}
