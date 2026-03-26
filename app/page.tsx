"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ExportModal from "@/components/ExportModal";
import ShortcutsModal from "@/components/ShortcutsModal";
import MobileDrawer from "@/components/MobileDrawer";
import Timeline from "@/components/Timeline";
import ProjectsModal from "@/components/ProjectsModal";
import { useGradientStore } from "@/lib/store";
import { decodeState } from "@/lib/url";

export type SidebarTab = "gradient" | "effects" | "presets";

export default function Home() {
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("gradient");
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.shiftKey && e.key === "z") {
        e.preventDefault();
        useGradientStore.getState().redo();
        return;
      }
      if (isMeta && e.key === "z") {
        e.preventDefault();
        useGradientStore.getState().undo();
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          useGradientStore.getState().set({
            playing: !useGradientStore.getState().playing,
          });
          break;
        case "r":
          useGradientStore.getState().randomize();
          break;
        case "e":
          setExportOpen(true);
          break;
        case "p":
          setProjectsOpen((prev) => !prev);
          break;
        case "Escape":
          setExportOpen(false);
          setShortcutsOpen(false);
          setProjectsOpen(false);
          break;
        case "1":
          setActiveTab("gradient");
          break;
        case "2":
          setActiveTab("effects");
          break;
        case "3":
          setActiveTab("presets");
          break;
        case "?":
          setShortcutsOpen((prev) => !prev);
          break;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Load state from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith("#s=")) {
      const state = decodeState(hash);
      if (state) {
        useGradientStore.getState().loadPreset(state);
      }
    }
  }, []);

  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      <TopBar
        onExport={() => setExportOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onProjects={() => setProjectsOpen(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <Canvas onCanvasReady={(el) => { canvasElRef.current = el; }} />
          <Timeline />
        </div>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasElRef}
      />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ProjectsModal
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
      />
      <MobileDrawer activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
