"use client";

import type { RefObject } from "react";
import SidebarTabs from "@/components/SidebarTabs";
import type { SidebarTab } from "@/lib/types";
import type { GradientEngine } from "@wavr/core";

interface MobileDrawerBodyProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: RefObject<GradientEngine | null>;
}

/** Tab bar and panels of the mobile drawer; loaded the first time it opens. */
export default function MobileDrawerBody({ activeTab, onTabChange, engineRef }: MobileDrawerBodyProps) {
  return <SidebarTabs activeTab={activeTab} onTabChange={onTabChange} engineRef={engineRef} />;
}
