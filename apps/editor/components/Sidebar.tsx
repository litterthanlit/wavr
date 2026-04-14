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
    <div className="w-[320px] shrink-0 bg-base border-l border-border flex flex-col h-full">
      {/* Layer panel (always visible) */}
      <div className="border-b border-border shrink-0">
        <LayerPanel />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors duration-150 ${
              activeTab === tab.id
                ? "text-text-primary border-b border-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
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
