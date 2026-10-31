"use client";

import React from "react";
import GradientPanel from "@/components/GradientPanel";
import LayerPanel from "@/components/LayerPanel";
import { useSidebarTabs } from "@/components/lazy";
import { GradientEngine } from "@wavr/core";
import { SIDEBAR_TABS, TOOL_TABS, type SidebarTab } from "@/lib/types";

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: React.RefObject<GradientEngine | null>;
}

/**
 * Until litt's Tabs have loaded (just after startup, see useLoaded): the same row drawn still, with the Gradient
 * panel under it, so the sidebar doesn't jump when they arrive. Nothing in the row is a control yet.
 */
function TabsPlaceholder({ activeTab }: { activeTab: SidebarTab }) {
  const toolTab = TOOL_TABS.find((tab) => tab.id === activeTab);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div aria-hidden="true" className="shrink-0 px-2">
        <div className="border-b border-litt-line">
          <div className="-mb-px flex pb-px">
            {[...SIDEBAR_TABS, ...(toolTab ? [toolTab] : [])].map((tab) => (
              <span
                key={tab.id}
                className={
                  "relative flex h-litt-control-sm flex-1 items-center justify-center px-litt-control-pad-sm text-litt-small font-litt-title " +
                  (tab.id === activeTab ? "text-litt-fg" : "text-litt-fg-subtle")
                }
              >
                <span className="litt-trim">{tab.label}</span>
                {tab.id === activeTab && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-litt-fg" />}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        {activeTab === "gradient" && <GradientPanel />}
      </div>
    </div>
  );
}

export default function Sidebar({ activeTab, onTabChange, engineRef }: SidebarProps) {
  const SidebarTabs = useSidebarTabs()?.default;
  return (
    <div className="sidebar">
      {/* Layer panel (always visible) */}
      <div className="shrink-0 border-b border-litt-line">
        <LayerPanel />
      </div>
      {SidebarTabs ? (
        <SidebarTabs activeTab={activeTab} onTabChange={onTabChange} engineRef={engineRef} />
      ) : (
        <TabsPlaceholder activeTab={activeTab} />
      )}
    </div>
  );
}
