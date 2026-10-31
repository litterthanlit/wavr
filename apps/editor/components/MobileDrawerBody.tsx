"use client";

import { useEffect, useRef, type RefObject } from "react";
import { motion } from "motion/react";
import SidebarTabs from "@/components/SidebarTabs";
import { Button } from "@/components/litt/button";
import { XIcon } from "@/components/litt/icons";
import { useSheetPresence, useTransition } from "@/lib/litt/motion";
import { useDismissDrag } from "@/lib/litt/motion/drag";
import type { SidebarTab } from "@/lib/types";
import type { GradientEngine } from "@wavr/core";

interface MobileDrawerBodyProps {
  open: boolean;
  onClose: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: RefObject<GradientEngine | null>;
}

/**
 * The phone's sheet of controls, loaded the first time it opens and kept mounted after that. It is litt's bottom
 * sheet without the dialog: no scrim, since the canvas above it shows each change. It rises on the expressive
 * spring, follows a finger down through useDismissDrag (from anywhere the guards allow; sliders keep theirs) and
 * leaves on the exit token from where the finger let go. --litt-space-6 of it hides below the screen edge, so a
 * pull upward never shows a gap. While closed it is inert, so focus and the screen reader skip it.
 */
export default function MobileDrawerBody({ open, onClose, activeTab, onTabChange, engineRef }: MobileDrawerBodyProps) {
  const enter = useTransition("expressive");
  const drag = useDismissDrag({ direction: "down", onDismiss: onClose, enabled: open });
  const closeButton = useRef<HTMLButtonElement>(null);
  // A toast fired while the sheet is up docks at the top edge instead of covering it.
  useSheetPresence(open);

  // The button that opened the sheet hides as it rises, which leaves focus on the page; it moves to Close.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    if (!active || active === document.body) closeButton.current?.focus({ preventScroll: true });
  }, [open]);

  return (
    <motion.div
      {...drag.panel}
      onPointerDown={drag.onPointerDown}
      inert={!open}
      role="region"
      aria-label="Controls"
      className={
        "mobile-controls-drawer fixed inset-x-0 bottom-[calc(-1*var(--litt-space-6))] z-30 flex h-[calc(60vh+var(--litt-space-6))] flex-col " +
        "rounded-t-litt-surface border-t border-litt-line bg-litt-surface-1 pb-6"
      }
      style={drag.panel.style}
      initial={{ y: "100%" }}
      animate={open ? { y: 0, transition: enter } : { y: "100%", transition: drag.exit }}
    >
      <div className="relative flex h-litt-control-md shrink-0 items-center justify-end px-2">
        <span aria-hidden className="pointer-events-none absolute top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-litt-pill bg-litt-line-strong" />
        <Button ref={closeButton} iconOnly size="sm" variant="ghost" aria-label="Close controls" onClick={onClose} className="pointer-coarse:h-litt-control-md pointer-coarse:w-litt-control-md">
          <XIcon />
        </Button>
      </div>
      <SidebarTabs activeTab={activeTab} onTabChange={onTabChange} engineRef={engineRef} />
    </motion.div>
  );
}
