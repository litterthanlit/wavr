"use client";

import React from "react";
import GradientPanel from "@/components/GradientPanel";
import EffectsPanel from "@/components/EffectsPanel";
import PresetsPanel from "@/components/PresetsPanel";
import LayerPanel from "@/components/LayerPanel";
import CustomGLSLPanel from "@/components/CustomGLSLPanel";
import { GradientEngine } from "@wavr/core";
import type { SidebarTab } from "@/lib/types";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
  { id: "code", label: "Code" },
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
            className={`sidebar-tab ${activeTab === tab.id ? "sidebar-tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "effects" && <EffectsPanel />}
        {activeTab === "presets" && <PresetsPanel />}
        {activeTab === "code" && <CustomGLSLPanel engineRef={engineRef} />}
      </div>
    </div>
  );
}
