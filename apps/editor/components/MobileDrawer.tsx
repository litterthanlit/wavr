"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { LazyMobileDrawerBody, preloadMobileDrawerBody } from "@/components/lazy";
import { useEverOpened } from "@/lib/useEverOpened";
import { Button } from "@/components/litt/button";
import { SlidersIcon } from "@/components/litt/icons";
import { isToolTab, type SidebarTab } from "@/lib/types";
import type { GradientEngine } from "@wavr/core";

interface MobileDrawerProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: RefObject<GradientEngine | null>;
}

/**
 * The phone's controls: a button at the bottom right opens a sheet holding the sidebar's tabs. The sheet itself
 * (and motion's animated components, which it moves on) is the lazy MobileDrawerBody; this part is only the
 * button, hidden while the sheet is open so it never covers the controls. The sheet closes from its own top row.
 */
export default function MobileDrawer({ activeTab, onTabChange, engineRef }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
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

  const close = useCallback(() => {
    setOpen(false);
    // The button comes back as the sheet goes; focus returns to it, unless something else took focus meanwhile.
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!active || active === document.body) opener.current?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <>
      <span className={`mobile-controls-button fixed right-4 bottom-4 z-40 ${open ? "invisible" : ""}`}>
        <Button
          ref={opener}
          iconOnly
          size="md"
          onClick={() => setOpen(true)}
          onPointerDown={preloadMobileDrawerBody}
          onFocus={preloadMobileDrawerBody}
          aria-label="Open controls"
          aria-expanded={open}
        >
          <SlidersIcon />
        </Button>
      </span>

      {bodyMounted && (
        <LazyMobileDrawerBody open={open} onClose={close} activeTab={activeTab} onTabChange={onTabChange} engineRef={engineRef} />
      )}
    </>
  );
}
