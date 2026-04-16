"use client";

import { useState } from "react";
import GradientPanel from "@/components/GradientPanel";
import EffectsPanel from "@/components/EffectsPanel";
import PresetsPanel from "@/components/PresetsPanel";
import type { SidebarTab } from "@/lib/types";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
];

interface MobileDrawerProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export default function MobileDrawer({ activeTab, onTabChange }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close controls" : "Open controls"}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-accent text-white
          flex items-center justify-center shadow-lg md:hidden transition-transform duration-150
          hover:scale-105 active:scale-95"
      >
        {open ? "\u2715" : "\u2699"}
      </button>

      <div
        className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-base border-t border-border rounded-t-xl h-[60vh] flex flex-col">
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border-active" />
          </div>

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

          <div className="flex-1 overflow-y-auto">
            {activeTab === "gradient" && <GradientPanel />}
            {activeTab === "effects" && <EffectsPanel />}
            {activeTab === "presets" && <PresetsPanel />}
          </div>
        </div>
      </div>
    </>
  );
}
