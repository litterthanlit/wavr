"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ExportModal from "@/components/ExportModal";
import ShortcutsModal from "@/components/ShortcutsModal";
import MobileDrawer from "@/components/MobileDrawer";
import Timeline from "@/components/Timeline";
import ProjectsModal from "@/components/ProjectsModal";
import SceneGalleryModal from "@/components/SceneGalleryModal";
import Onboarding from "@/components/Onboarding";
import CommandPalette from "@/components/CommandPalette";
import StartupRecovery from "@/components/StartupRecovery";
import { useGradientStore } from "@/lib/store";
import { applyHashToStore, initializeUrlSync } from "@/lib/url-sync";
import { FORCE_RECOVERY_PARAM, type StartupMode } from "@/lib/startup-guard";
import { useStartupGuard } from "@/lib/use-startup-guard";
import { GradientEngine } from "@wavr/core";
import type { SidebarTab } from "@/lib/types";
import type { SceneCapture } from "@/components/Scene3DCanvas";

const Scene3DCanvas = dynamic(() => import("@/components/Scene3DCanvas"), {
  ssr: false,
  loading: () => null,
});

export default function EditorPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("gradient");
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const sceneCanvasElRef = useRef<HTMLCanvasElement | null>(null);
  const sceneCaptureRef = useRef<SceneCapture | null>(null);
  // Stable callbacks: Scene3DCanvas clears these refs whenever the callback
  // identity changes, so inline arrows would null them on every re-render.
  const handleSceneCanvasReady = useCallback((el: HTMLCanvasElement | null) => {
    sceneCanvasElRef.current = el;
  }, []);
  const handleSceneCaptureReady = useCallback((capture: SceneCapture | null) => {
    sceneCaptureRef.current = capture;
  }, []);
  const engineRef = useRef<GradientEngine | null>(null);
  const scene3DEnabled = useGradientStore((state) => state.scene3DEnabled);
  const { phase, start, reportHealthy, reportStall } = useStartupGuard();
  const running = phase.kind === "running";
  const safeMode = phase.kind === "running" && phase.mode === "safe";
  const handleCanvasReady = useCallback((el: HTMLCanvasElement) => {
    canvasElRef.current = el;
  }, []);
  const handleEngineReady = useCallback((eng: GradientEngine) => {
    engineRef.current = eng;
  }, []);

  const startFromRecovery = useCallback(
    (mode: StartupMode, resetScene = false) => {
      // Drop ?safe so the next reload doesn't land on the recovery screen again.
      const url = new URL(window.location.href);
      url.searchParams.delete(FORCE_RECOVERY_PARAM);
      if (resetScene) url.hash = "";
      window.history.replaceState(window.history.state, "", url);
      if (resetScene) applyHashToStore();
      if (mode === "safe") useGradientStore.getState().set({ playing: false });
      void start(mode);
    },
    [start],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // ⌘K / Ctrl-K — open palette. Must come *before* the INPUT/SELECT/TEXTAREA
      // early-return so the palette works from inside text fields too (spec §3.5).
      if (isMeta && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

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
          setScenesOpen(false);
          break;
        case "1":
          setActiveTab("gradient");
          break;
        case "2":
          setActiveTab("scene");
          break;
        case "3":
          setActiveTab("effects");
          break;
        case "4":
          setActiveTab("presets");
          break;
        case "5":
          setActiveTab("code");
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

  // URL-state bridge: apply any incoming hash to the store, then install the
  // subscriber + popstate + beforeunload listeners. See apps/editor/lib/url-sync.ts.
  useEffect(() => {
    applyHashToStore();
    const dispose = initializeUrlSync();
    return dispose;
  }, []);

  // The engine is destroyed whenever the canvas unmounts (recovery screen).
  useEffect(() => {
    if (!running) engineRef.current = null;
  }, [running]);

  useEffect(() => {
    if (!scene3DEnabled) {
      sceneCanvasElRef.current = null;
    }
  }, [scene3DEnabled]);

  return (
    <div className="h-screen w-screen bg-root flex items-center justify-center">
    <div className="h-[90vh] w-[90vw] flex flex-col rounded-xl overflow-hidden border border-border shadow-2xl">
      <TopBar
        onScenes={() => setScenesOpen(true)}
        onExport={() => setExportOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onProjects={() => setProjectsOpen(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            {running ? (
              <Canvas
                onCanvasReady={handleCanvasReady}
                onEngineReady={handleEngineReady}
                safeMode={safeMode}
                onStartupHealthy={reportHealthy}
                onStartupStall={reportStall}
              />
            ) : phase.kind === "recovery" ? (
              <StartupRecovery
                phase={phase}
                onSafeStart={() => startFromRecovery("safe")}
                onResetScene={() => startFromRecovery("safe", true)}
                onNormalStart={() => startFromRecovery("normal")}
              />
            ) : (
              <div className="flex-1 bg-root" aria-busy="true" aria-label="Starting renderer" />
            )}
            {safeMode && (
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-full border border-border bg-base/80 py-1 pl-3 pr-1 text-[11px] text-text-secondary backdrop-blur">
                <span>Safe mode · half resolution</span>
                <button
                  type="button"
                  onClick={() => startFromRecovery("normal")}
                  className="rounded-full bg-surface px-2 py-0.5 text-text-primary transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  Exit safe mode
                </button>
              </div>
            )}
            {scene3DEnabled && running && !safeMode && (
              <Scene3DCanvas onCanvasReady={handleSceneCanvasReady} onCaptureReady={handleSceneCaptureReady} />
            )}
          </div>
          <Timeline />
        </div>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} engineRef={engineRef} />
      </div>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasElRef}
        sceneCanvasRef={sceneCanvasElRef}
        sceneCaptureRef={sceneCaptureRef}
        engineRef={engineRef}
      />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ProjectsModal
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
      />
      <SceneGalleryModal
        open={scenesOpen}
        onClose={() => setScenesOpen(false)}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        ui={{
          openExport: () => setExportOpen(true),
          openProjects: () => setProjectsOpen(true),
          openShortcuts: () => setShortcutsOpen(true),
          setTab: setActiveTab,
        }}
      />
      <MobileDrawer activeTab={activeTab} onTabChange={setActiveTab} />
      {running && <Onboarding />}
    </div>
    </div>
  );
}
