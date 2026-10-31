"use client";

import type { RefObject } from "react";
import GradientPanel from "@/components/GradientPanel";
import { LazyCustomGLSLPanel, LazyEffectsPanel, LazyPresetsPanel, LazyScenePanel } from "@/components/lazy";
import { SIDEBAR_TABS, TOOL_TABS, type SidebarTab } from "@/lib/types";
import type { GradientEngine } from "@wavr/core";

interface MobileDrawerBodyProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: RefObject<GradientEngine | null>;
}

/** Tab bar and panels of the mobile drawer; loaded the first time it opens. */
export default function MobileDrawerBody({ activeTab, onTabChange, engineRef }: MobileDrawerBodyProps) {
  const toolTab = TOOL_TABS.find((tab) => tab.id === activeTab);
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
        {toolTab && (
          <div className="sidebar-tab sidebar-tab-active flex items-center justify-center gap-1">
            {toolTab.label}
            <button
              onClick={() => onTabChange("gradient")}
              aria-label={`Close ${toolTab.label}`}
              className="text-text-tertiary hover:text-text-primary transition-colors leading-none"
            >
              {"×"}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "effects" && <LazyEffectsPanel />}
        {activeTab === "presets" && <LazyPresetsPanel />}
        {activeTab === "scene" && <LazyScenePanel />}
        {activeTab === "code" && <LazyCustomGLSLPanel engineRef={engineRef} />}
      </div>
    </>
  );
}
