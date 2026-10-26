"use client";

import React from "react";
import GradientPanel from "@/components/GradientPanel";
import LayerPanel from "@/components/LayerPanel";
import {
  LazyScenePanel,
  LazyEffectsPanel,
  LazyPresetsPanel,
  LazyCustomGLSLPanel,
  preloadScenePanel,
  preloadEffectsPanel,
  preloadPresetsPanel,
  preloadCustomGLSLPanel,
} from "@/components/lazy";
import { GradientEngine } from "@wavr/core";
import type { SidebarTab } from "@/lib/types";

// The Gradient tab is the default, so it ships eagerly; the rest load on demand
// (and are prefetched on idle, see prefetchEditorChunks).
const TABS: { id: SidebarTab; label: string; preload?: () => void }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "scene", label: "3D", preload: preloadScenePanel },
  { id: "effects", label: "Effects", preload: preloadEffectsPanel },
  { id: "presets", label: "Presets", preload: preloadPresetsPanel },
  { id: "code", label: "Shader", preload: preloadCustomGLSLPanel },
];

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: React.RefObject<GradientEngine | null>;
}

export default function Sidebar({ activeTab, onTabChange, engineRef }: SidebarProps) {
  return (
    <div className="sidebar">
      {/* Layer panel (always visible) */}
      <div className="border-b border-border shrink-0">
        <LayerPanel />
      </div>

      {/* Tab bar */}
      <div className="sidebar-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            onPointerEnter={tab.preload}
            onFocus={tab.preload}
            className={`sidebar-tab ${activeTab === tab.id ? "sidebar-tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "scene" && <LazyScenePanel />}
        {activeTab === "effects" && <LazyEffectsPanel />}
        {activeTab === "presets" && <LazyPresetsPanel />}
        {activeTab === "code" && <LazyCustomGLSLPanel engineRef={engineRef} />}
      </div>
    </div>
  );
}
