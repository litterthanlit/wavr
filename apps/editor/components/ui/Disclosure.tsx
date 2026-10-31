"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRightIcon } from "@/components/litt/icons";

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
        className="flex h-litt-control-sm items-center gap-1 self-start rounded-litt-control text-litt-small font-litt-title text-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt hover:text-litt-fg"
      >
        <ChevronRightIcon
          className={`text-litt-fg-subtle transition-transform duration-(--litt-dur-responsive) ease-litt-responsive ${open ? "rotate-90" : ""}`}
        />
        {label}
      </button>
      <div id={panelId} className="flex flex-col gap-3 empty:hidden">
        {open && children}
      </div>
    </div>
  );
}
