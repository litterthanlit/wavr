"use client";

import { useState, type RefObject } from "react";
import { LazyMobileDrawerBody, preloadMobileDrawerBody } from "@/components/lazy";
import { useEverOpened } from "@/lib/useEverOpened";
import { Button } from "@/components/litt/button";
import { SlidersIcon, XIcon } from "@/components/litt/icons";
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
      <span className="mobile-controls-button fixed right-4 bottom-4 z-40">
        <Button
          iconOnly
          size="md"
          onClick={() => setOpen(!open)}
          onPointerDown={preloadMobileDrawerBody}
          onFocus={preloadMobileDrawerBody}
          aria-label={open ? "Close controls" : "Open controls"}
        >
          {open ? <XIcon /> : <SlidersIcon />}
        </Button>
      </span>

      <div
        className={`mobile-controls-drawer fixed inset-x-0 bottom-0 z-30 transition-transform duration-(--litt-dur-responsive) ease-litt-responsive ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex h-[60vh] flex-col rounded-t-litt-surface border-t border-litt-line bg-litt-surface-1">
          <div className="flex shrink-0 justify-center py-2">
            <div className="h-1 w-8 rounded-litt-pill bg-litt-line-strong" />
          </div>

          {bodyMounted && <LazyMobileDrawerBody activeTab={activeTab} onTabChange={onTabChange} engineRef={engineRef} />}
        </div>
      </div>
    </>
  );
}
