"use client";

import GradientPanel from "@/components/GradientPanel";
import { LazyEffectsPanel, LazyPresetsPanel } from "@/components/lazy";
import { SIDEBAR_TABS, type SidebarTab } from "@/lib/types";

interface MobileDrawerBodyProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/** Tab bar and panels of the mobile drawer; loaded the first time it opens. */
export default function MobileDrawerBody({ activeTab, onTabChange }: MobileDrawerBodyProps) {
  return (
    <>
      <div className="sidebar-tabs">
        {SIDEBAR_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`sidebar-tab ${activeTab === tab.id ? "sidebar-tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "effects" && <LazyEffectsPanel />}
        {activeTab === "presets" && <LazyPresetsPanel />}
      </div>
    </>
  );
}
