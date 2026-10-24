"use client";

import GradientPanel from "@/components/GradientPanel";
import PanelTabs from "@/components/PanelTabs";
import { LazyScenePanel, LazyEffectsPanel, LazyPresetsPanel } from "@/components/lazy";
import type { SidebarTab } from "@/lib/types";

interface MobileDrawerBodyProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

/** Tab bar and panels of the mobile drawer; loaded the first time it opens. */
export default function MobileDrawerBody({ activeTab, onTabChange }: MobileDrawerBodyProps) {
  return (
    <PanelTabs
      activeTab={activeTab}
      onTabChange={onTabChange}
      tabs={[
        { id: "gradient", label: "Gradient", panel: <GradientPanel /> },
        { id: "scene", label: "Scene", panel: <LazyScenePanel /> },
        { id: "effects", label: "Effects", panel: <LazyEffectsPanel /> },
        { id: "presets", label: "Presets", panel: <LazyPresetsPanel /> },
      ]}
    />
  );
}
