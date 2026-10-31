"use client";

import type { RefObject } from "react";
import GradientPanel from "@/components/GradientPanel";
import {
  LazyScenePanel,
  LazyEffectsPanel,
  LazyPresetsPanel,
  LazyCustomGLSLPanel,
  preloadEffectsPanel,
  preloadPresetsPanel,
} from "@/components/lazy";
import { Tabs, TabsList, TabsTrigger, TabsPanels, TabsPanel } from "@/components/litt/tabs";
import { Button } from "@/components/litt/button";
import { XIcon } from "@/components/litt/icons";
import { Tooltip } from "@/components/litt/tooltip";
import { SIDEBAR_TABS, TOOL_TABS, type SidebarTab } from "@/lib/types";
import type { GradientEngine } from "@wavr/core";

// The Gradient tab is the default, so it ships eagerly; the rest load on demand
// (and are prefetched on idle, see prefetchEditorChunks). The tool tabs' panels
// preload when the command palette, which opens them, opens.
const PRELOAD: Partial<Record<SidebarTab, () => void>> = {
  effects: preloadEffectsPanel,
  presets: preloadPresetsPanel,
};

const ALL_TABS = [...SIDEBAR_TABS, ...TOOL_TABS];

interface SidebarTabsProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: RefObject<GradientEngine | null>;
}

/**
 * The sidebar's tabs and panels, shared by the desktop sidebar and the mobile drawer: litt's underline Tabs
 * (arrow keys from Radix; 1–3 from the editor page). A tool tab (3D, Shader) opens from the command palette as a
 * fourth tab. A litt tab holds only its label, so its close button sits beside it, at the end of the row.
 */
export default function SidebarTabs({ activeTab, onTabChange, engineRef }: SidebarTabsProps) {
  const toolTab = TOOL_TABS.find((tab) => tab.id === activeTab);
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        const tab = ALL_TABS.find((t) => t.id === value);
        if (tab) onTabChange(tab.id);
      }}
      size="sm"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="relative shrink-0 px-2">
        <TabsList aria-label="Panels" className={toolTab ? "pr-10" : ""}>
          {SIDEBAR_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onPointerEnter={PRELOAD[tab.id]}
              onFocus={PRELOAD[tab.id]}
              className="flex-1"
            >
              {tab.label}
            </TabsTrigger>
          ))}
          {toolTab && (
            <TabsTrigger value={toolTab.id} className="flex-1">
              {toolTab.label}
            </TabsTrigger>
          )}
        </TabsList>
        {toolTab && (
          <span className="absolute inset-y-0 right-2 flex items-center">
            <Tooltip content={`Close ${toolTab.label}`} side="bottom">
              <Button iconOnly size="sm" variant="ghost" aria-label={`Close ${toolTab.label}`} onClick={() => onTabChange("gradient")}>
                <XIcon />
              </Button>
            </Tooltip>
          </span>
        )}
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
        <TabsPanels>
          <TabsPanel value="gradient" tabIndex={-1}>
            <GradientPanel />
          </TabsPanel>
          <TabsPanel value="effects" tabIndex={-1}>
            <LazyEffectsPanel />
          </TabsPanel>
          <TabsPanel value="presets" tabIndex={-1}>
            <LazyPresetsPanel />
          </TabsPanel>
          <TabsPanel value="scene" tabIndex={-1}>
            <LazyScenePanel />
          </TabsPanel>
          <TabsPanel value="code" tabIndex={-1}>
            <LazyCustomGLSLPanel engineRef={engineRef} />
          </TabsPanel>
        </TabsPanels>
      </div>
    </Tabs>
  );
}
