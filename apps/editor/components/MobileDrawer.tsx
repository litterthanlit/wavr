"use client";

import { useState, type RefObject } from "react";
import { LazyMobileDrawerBody, preloadMobileDrawerBody } from "@/components/lazy";
import { useEverOpened } from "@/lib/useEverOpened";
import { isToolTab, type SidebarTab } from "@/lib/types";
import type { GradientEngine } from "@wavr/core";

interface MobileDrawerProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: RefObject<GradientEngine | null>;
}

export default function MobileDrawer({ activeTab, onTabChange, engineRef }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  // A tool tab opens from the command palette; on a phone the drawer is the only
  // place it shows, so opening one opens the drawer (hidden on desktop anyway).
  const [shownTab, setShownTab] = useState(activeTab);
  if (shownTab !== activeTab) {
    setShownTab(activeTab);
    if (isToolTab(activeTab)) setOpen(true);
  }
  // The drawer is hidden on desktop and closed on mobile until tapped, so its
  // tabs and panels (a second copy of the sidebar) load on first open and stay
  // mounted after that.
  const bodyMounted = useEverOpened(open);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        onPointerDown={preloadMobileDrawerBody}
        onFocus={preloadMobileDrawerBody}
        aria-label={open ? "Close controls" : "Open controls"}
        className="mobile-controls-button fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-litt-block text-litt-fg shadow-(--litt-block-lift)
          items-center justify-center transition-transform duration-150
          hover:scale-105 active:scale-95"
      >
        {open ? "✕" : "⚙"}
      </button>

      <div
        className={`mobile-controls-drawer fixed inset-x-0 bottom-0 z-30 transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-base border-t border-border rounded-t-xl h-[60vh] flex flex-col">
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border-active" />
          </div>

          {bodyMounted && <LazyMobileDrawerBody activeTab={activeTab} onTabChange={onTabChange} engineRef={engineRef} />}
        </div>
      </div>
    </>
  );
}
