"use client";

import { useState } from "react";
import GradientPanel from "@/components/GradientPanel";
import EffectsPanel from "@/components/EffectsPanel";
import PresetsPanel from "@/components/PresetsPanel";

const TABS = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabId>("gradient");

  return (
    <div className="w-[320px] shrink-0 bg-base border-l border-border flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
      </div>
    </div>
  );
}
