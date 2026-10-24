"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsPanel, TabsPanels, TabsTrigger } from "@/components/litt/tabs";
import type { SidebarTab } from "@/lib/types";

export interface PanelTab {
  id: SidebarTab;
  label: string;
  panel: ReactNode;
  preload?: () => void;
}

interface PanelTabsProps {
  tabs: PanelTab[];
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/**
 * The sidebar's and the mobile drawer's tab switch: litt's segmented Tabs over
 * a scrolling panel. Only the selected panel is mounted, as before; panel state
 * lives in the store, so nothing resets when you switch.
 */
export default function PanelTabs({ tabs, activeTab, onTabChange }: PanelTabsProps) {
  // The drawer has no Lab tab, so a tab it lacks falls back to the first one.
  const value = tabs.some((tab) => tab.id === activeTab) ? activeTab : tabs[0].id;
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onTabChange(next as SidebarTab)}
      variant="segmented"
      size="sm"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 px-4 pt-4 pb-2">
        <TabsList aria-label="Panels" className="w-full!">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onPointerEnter={tab.preload}
              onFocus={tab.preload}
              className="flex-1"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <TabsPanels>
          {tabs.map((tab) => (
            <TabsPanel key={tab.id} value={tab.id} tabIndex={-1}>
              {tab.panel}
            </TabsPanel>
          ))}
        </TabsPanels>
      </div>
    </Tabs>
  );
}
