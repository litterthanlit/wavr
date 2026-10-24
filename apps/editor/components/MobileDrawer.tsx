"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LazyMobileDrawerBody, preloadMobileDrawerBody } from "@/components/lazy";
import { Button } from "@/components/litt/button";
import { SlidersIcon, XIcon } from "@/components/litt/icons";
import { useTransition } from "@/lib/litt/motion";
import { useDismissDrag } from "@/lib/litt/motion/drag";
import type { SidebarTab } from "@/lib/types";

interface MobileDrawerProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/** Below the sidebar breakpoint (900px) the controls live in this drawer. */
const NARROW = "min-[901px]:hidden";

/**
 * The controls drawer on narrow screens. It is not a litt Dialog on purpose:
 * a dialog is modal and tints the canvas, and here the canvas has to stay
 * visible and live while you move a slider. It borrows litt's sheet instead:
 * glass with the top corners rounded, the grabber, the rise on the expressive
 * spring and litt's drag down to dismiss.
 */
export default function MobileDrawer({ activeTab, onTabChange }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {!open && (
        // Positioned by a wrapper: the Button's own classes set its position for the press scale.
        <div className={`absolute right-3 bottom-3 z-20 ${NARROW}`}>
          <Button
            iconOnly
            aria-label="Open controls"
            aria-expanded={false}
            icon={<SlidersIcon />}
            onClick={() => setOpen(true)}
            onPointerDown={preloadMobileDrawerBody}
            onFocus={preloadMobileDrawerBody}
          />
        </div>
      )}
      <AnimatePresence>
        {open && (
          <Sheet key="sheet" onClose={() => setOpen(false)}>
            <LazyMobileDrawerBody activeTab={activeTab} onTabChange={onTabChange} />
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const enter = useTransition("expressive");
  const drag = useDismissDrag({ direction: "down", onDismiss: onClose });

  return (
    <motion.section
      aria-label="Controls"
      {...drag.panel}
      onPointerDown={drag.onPointerDown}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      initial={{ y: "100%" }}
      animate={{ y: 0, transition: enter }}
      exit={{ y: "100%", transition: drag.exit }}
      className={`litt-glass fixed inset-x-0 bottom-0 z-30 flex h-[60dvh] flex-col rounded-t-litt-surface rounded-b-none ${NARROW}`}
    >
      <div className="relative flex shrink-0 items-center justify-end px-2 pt-2">
        <span aria-hidden="true" className="absolute top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-litt-pill bg-litt-line-strong" />
        <Button variant="ghost" size="sm" iconOnly aria-label="Close controls" icon={<XIcon />} onClick={onClose} />
      </div>
      {children}
    </motion.section>
  );
}
