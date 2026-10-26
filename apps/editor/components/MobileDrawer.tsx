"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { LazyMobileDrawerBody, preloadMobileDrawerBody } from "@/components/lazy";
import { useEverOpened } from "@/lib/useEverOpened";
import type { SidebarTab } from "@/lib/types";

interface MobileDrawerProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/**
 * The controls on a phone (≤900px; hidden above, where the sidebar shows).
 * A sheet in the layout rather than over it: in portrait it sits under the
 * canvas, which shrinks to fit above it, so the whole scene stays in view
 * while it is edited; its handle switches between half and most of the
 * screen. In landscape it is a panel at the side. Escape closes it.
 */
export default function MobileDrawer({ activeTab, onTabChange }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // The tabs and panels (a second copy of the sidebar) load on first open and
  // stay mounted after that.
  const bodyMounted = useEverOpened(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          onPointerDown={preloadMobileDrawerBody}
          onFocus={preloadMobileDrawerBody}
          aria-label="Open controls"
          aria-controls="mobile-controls"
          aria-expanded={false}
          className="mobile-controls-button fixed right-4 z-40 w-12 h-12 rounded-full bg-accent text-white
            items-center justify-center shadow-lg motion-safe:transition-transform duration-150
            hover:scale-105 active:scale-95"
        >
          <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
        </button>
      )}

      <section
        id="mobile-controls"
        aria-label="Controls"
        hidden={!open}
        data-expanded={expanded}
        className="mobile-sheet"
      >
        <div className="flex items-center shrink-0 h-11 pl-3 pr-1">
          {/* The handle: half height or most of the screen (portrait only). */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? "Shrink controls" : "Expand controls"}
            className="mobile-sheet-handle flex-1 h-full flex items-center justify-center"
          >
            <span className="w-10 h-1 rounded-full bg-border-active" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close controls"
            className="w-11 h-11 flex items-center justify-center rounded-full text-text-secondary
              hover:text-text-primary hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {bodyMounted && <LazyMobileDrawerBody activeTab={activeTab} onTabChange={onTabChange} />}
      </section>
    </>
  );
}
