"use client";

import React from "react";
import GradientPanel from "@/components/GradientPanel";
import LayerPanel from "@/components/LayerPanel";
import PanelTabs from "@/components/PanelTabs";
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

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: React.RefObject<GradientEngine | null>;
}

export default function Sidebar({ activeTab, onTabChange, engineRef }: SidebarProps) {
  return (
    <aside
      aria-label="Controls"
      className="flex h-full w-[clamp(336px,30vw,420px)] min-w-0 shrink-0 flex-col overflow-hidden border-l border-litt-line bg-litt-surface-1 max-[900px]:hidden"
    >
      {/* Layer panel (always visible) */}
      <div className="shrink-0 border-b border-litt-line">
        <LayerPanel />
      </div>

      {/* The Gradient tab is the default, so it ships eagerly; the rest load on demand
          (and are prefetched on idle, see prefetchEditorChunks). */}
      <PanelTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabs={[
          { id: "gradient", label: "Gradient", panel: <GradientPanel /> },
          { id: "scene", label: "Scene", panel: <LazyScenePanel />, preload: preloadScenePanel },
          { id: "effects", label: "Effects", panel: <LazyEffectsPanel />, preload: preloadEffectsPanel },
          { id: "presets", label: "Presets", panel: <LazyPresetsPanel />, preload: preloadPresetsPanel },
          { id: "code", label: "Lab", panel: <LazyCustomGLSLPanel engineRef={engineRef} />, preload: preloadCustomGLSLPanel },
        ]}
      />
    </aside>
  );
}
