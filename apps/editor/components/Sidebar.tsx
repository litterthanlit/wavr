"use client";

import React from "react";
import GradientPanel from "@/components/GradientPanel";
import LayerPanel from "@/components/LayerPanel";
import {
  LazyScenePanel,
  LazyEffectsPanel,
  LazyPresetsPanel,
  LazyCustomGLSLPanel,
  preloadEffectsPanel,
  preloadPresetsPanel,
} from "@/components/lazy";
import { GradientEngine } from "@wavr/core";
import { SIDEBAR_TABS, TOOL_TABS, type SidebarTab } from "@/lib/types";

// The Gradient tab is the default, so it ships eagerly; the rest load on demand
// (and are prefetched on idle, see prefetchEditorChunks). The tool tabs' panels
// preload when the command palette, which opens them, opens.
const PRELOAD: Partial<Record<SidebarTab, () => void>> = {
  effects: preloadEffectsPanel,
  presets: preloadPresetsPanel,
};

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: React.RefObject<GradientEngine | null>;
}

export default function Sidebar({ activeTab, onTabChange, engineRef }: SidebarProps) {
  const toolTab = TOOL_TABS.find((tab) => tab.id === activeTab);
  return (
    <div className="sidebar">
      {/* Layer panel (always visible) */}
      <div className="border-b border-border shrink-0">
        <LayerPanel />
      </div>

      {/* Tab bar */}
      <div className="sidebar-tabs">
        {SIDEBAR_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            onPointerEnter={PRELOAD[tab.id]}
            onFocus={PRELOAD[tab.id]}
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
              {"\u00D7"}
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "effects" && <LazyEffectsPanel />}
        {activeTab === "presets" && <LazyPresetsPanel />}
        {activeTab === "scene" && <LazyScenePanel />}
        {activeTab === "code" && <LazyCustomGLSLPanel engineRef={engineRef} />}
      </div>
    </div>
  );
}
