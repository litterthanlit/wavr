"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MobileDrawer from "@/components/MobileDrawer";
import Timeline from "@/components/Timeline";
import {
  LazyExportModal,
  LazyShortcutsModal,
  LazyProjectsModal,
  LazyCommandPalette,
  LazyOnboarding,
  LazyToaster,
  prefetchEditorChunks,
} from "@/components/lazy";
import { useGradientStore } from "@/lib/store";
import { toggleRenderStats } from "@/lib/useRenderStats";
import { applyHashToStore, initializeUrlSync, preloadUrlCodec } from "@/lib/url-sync";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { useEverOpened } from "@/lib/useEverOpened";
import { GradientEngine } from "@wavr/core";
import { SIDEBAR_TABS, type SidebarTab } from "@/lib/types";
import type { SceneCapture } from "@/components/Scene3DCanvas";

// A shared link carries its state in the hash. Start fetching the decoder as
// soon as this module runs so it is ready by the time hydration applies the
// hash; without a hash the codec is only warmed later, when the browser is idle.
if (typeof window !== "undefined" && window.location.hash.length > 1) {
  preloadUrlCodec();
}

const Scene3DCanvas = dynamic(() => import("@/components/Scene3DCanvas"), {
  ssr: false,
  loading: () => null,
});

export default function EditorPage() {
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("gradient");
  // Each modal's code loads the first time it opens (or earlier, on hover or
  // idle, see prefetchEditorChunks) and then stays mounted so its state survives.
  const exportMounted = useEverOpened(exportOpen);
  const shortcutsMounted = useEverOpened(shortcutsOpen);
  const projectsMounted = useEverOpened(projectsOpen);
  const paletteMounted = useEverOpened(paletteOpen);
  const [onboardingNeeded, setOnboardingNeeded] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const sceneCanvasElRef = useRef<HTMLCanvasElement | null>(null);
  const sceneCaptureRef = useRef<SceneCapture | null>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  // Stable callbacks: Canvas and Scene3DCanvas re-run their setup effects (and
  // Scene3DCanvas clears these refs) whenever a callback identity changes, so
  // inline arrows would rebuild the WebGL engine on every page re-render, e.g.
  // each time a modal opens or the tab changes.
  const handleCanvasReady = useCallback((el: HTMLCanvasElement) => {
    canvasElRef.current = el;
  }, []);
  const handleEngineReady = useCallback((eng: GradientEngine) => {
    engineRef.current = eng;
  }, []);
  const handleSceneCanvasReady = useCallback((el: HTMLCanvasElement | null) => {
    sceneCanvasElRef.current = el;
  }, []);
  const handleSceneCaptureReady = useCallback((capture: SceneCapture | null) => {
    sceneCaptureRef.current = capture;
  }, []);
  const scene3DEnabled = useGradientStore((state) => state.scene3DEnabled);

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
          break;
        case "?":
          setShortcutsOpen((prev) => !prev);
          break;
        case "s":
          if (!isMeta) toggleRenderStats();
          break;
        default: {
          const tab = SIDEBAR_TABS.find((_, i) => e.key === String(i + 1));
          if (tab) setActiveTab(tab.id);
        }
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
    void applyHashToStore();
    const dispose = initializeUrlSync();
    // `?preset=<id>` (the landing's looks) opens on that preset once its module loads.
    if (window.location.search) {
      void import("@/lib/preset-entry").then((entry) => entry.openPresetFromSearch());
    }
    return dispose;
  }, []);

  useEffect(() => {
    if (!scene3DEnabled) {
      sceneCanvasElRef.current = null;
    }
  }, [scene3DEnabled]);

  // Warm the lazy chunks once startup has settled.
  useEffect(() => prefetchEditorChunks(), []);

  // The walkthrough only loads for first-time visitors. Deferred a frame so the
  // state update doesn't run synchronously inside the effect.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOnboardingNeeded(!hasSeenOnboarding()));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    // Edge to edge: the canvas is the product, so it gets the whole window.
    // dvh, so a phone's browser bars don't push the timeline off screen.
    <div className="h-dvh w-screen flex flex-col overflow-hidden bg-litt-canvas">
      <TopBar
        onExport={() => setExportOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
        onProjects={() => setProjectsOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            <Canvas
              onCanvasReady={handleCanvasReady}
              onEngineReady={handleEngineReady}
            />
            {scene3DEnabled && (
              <Scene3DCanvas onCanvasReady={handleSceneCanvasReady} onCaptureReady={handleSceneCaptureReady} />
            )}
          </div>
          <Timeline />
        </div>
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} engineRef={engineRef} />
      </div>
      {exportMounted && (
        <LazyExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          canvasRef={canvasElRef}
          sceneCanvasRef={sceneCanvasElRef}
          sceneCaptureRef={sceneCaptureRef}
          engineRef={engineRef}
        />
      )}
      {shortcutsMounted && (
        <LazyShortcutsModal
          open={shortcutsOpen}
          onClose={() => setShortcutsOpen(false)}
        />
      )}
      {projectsMounted && (
        <LazyProjectsModal
          open={projectsOpen}
          onClose={() => setProjectsOpen(false)}
        />
      )}
      {paletteMounted && (
        <LazyCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          ui={{
            openExport: () => setExportOpen(true),
            openProjects: () => setProjectsOpen(true),
            openShortcuts: () => setShortcutsOpen(true),
            setTab: setActiveTab,
          }}
        />
      )}
      <MobileDrawer activeTab={activeTab} onTabChange={setActiveTab} engineRef={engineRef} />
      {onboardingNeeded && <LazyOnboarding />}
      <LazyToaster />
    </div>
  );
}
