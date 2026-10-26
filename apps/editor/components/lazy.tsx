"use client";

/**
 * Lazily loaded editor UI: every sidebar tab except the default one, the
 * modals, the command palette, the onboarding walkthrough and the mobile
 * drawer body (plus the URL codec, see lib/url-codec.ts). None of it is needed
 * before the canvas is interactive, so it stays out of the initial bundle.
 *
 * Each piece has a loader (shared by `dynamic` and the preload helpers, so a
 * preload warms exactly the chunk the component later uses), a lazy component,
 * and a `preload*` function for hover/focus intent. `prefetchEditorChunks`
 * warms everything one chunk per idle slot after startup.
 */

import dynamic from "next/dynamic";
import { runOnePerIdle, prefersSavedData } from "@/lib/idle";
import { loadUrlCodec } from "@/lib/url-sync";

type Loader = () => Promise<unknown>;

const loadScenePanel = () => import("@/components/ScenePanel");
const loadEffectsPanel = () => import("@/components/EffectsPanel");
const loadPresetsPanel = () => import("@/components/PresetsPanel");
const loadCustomGLSLPanel = () => import("@/components/CustomGLSLPanel");
const loadExportModal = () => import("@/components/ExportModal");
const loadProjectsModal = () => import("@/components/ProjectsModal");
const loadShortcutsModal = () => import("@/components/ShortcutsModal");
const loadCommandPalette = () => import("@/components/CommandPalette");
const loadOnboarding = () => import("@/components/Onboarding");
const loadMobileDrawerBody = () => import("@/components/MobileDrawerBody");

export const LazyScenePanel = dynamic(loadScenePanel, { ssr: false, loading: () => null });
export const LazyEffectsPanel = dynamic(loadEffectsPanel, { ssr: false, loading: () => null });
export const LazyPresetsPanel = dynamic(loadPresetsPanel, { ssr: false, loading: () => null });
export const LazyCustomGLSLPanel = dynamic(loadCustomGLSLPanel, { ssr: false, loading: () => null });
export const LazyExportModal = dynamic(loadExportModal, { ssr: false, loading: () => null });
export const LazyProjectsModal = dynamic(loadProjectsModal, { ssr: false, loading: () => null });
export const LazyShortcutsModal = dynamic(loadShortcutsModal, { ssr: false, loading: () => null });
export const LazyCommandPalette = dynamic(loadCommandPalette, { ssr: false, loading: () => null });
export const LazyOnboarding = dynamic(loadOnboarding, { ssr: false, loading: () => null });
export const LazyMobileDrawerBody = dynamic(loadMobileDrawerBody, { ssr: false, loading: () => null });

function preloader(load: Loader): () => void {
  return () => {
    // A failed prefetch is harmless: the real load retries when it's needed.
    load().catch(() => undefined);
  };
}

export const preloadScenePanel = preloader(loadScenePanel);
export const preloadEffectsPanel = preloader(loadEffectsPanel);
export const preloadPresetsPanel = preloader(loadPresetsPanel);
export const preloadCustomGLSLPanel = preloader(loadCustomGLSLPanel);
export const preloadExportModal = preloader(loadExportModal);
export const preloadProjectsModal = preloader(loadProjectsModal);
export const preloadShortcutsModal = preloader(loadShortcutsModal);
export const preloadCommandPalette = preloader(loadCommandPalette);
export const preloadMobileDrawerBody = preloader(loadMobileDrawerBody);

// Mirrors the breakpoint in globals.css where the sidebar becomes the drawer.
const MOBILE_QUERY = "(max-width: 900px)";

/**
 * Warm the lazy chunks one per idle slot, most likely needed first, so opening
 * a tab or modal feels instant without taxing startup. The drawer is only
 * fetched on viewports that can show it; the onboarding walkthrough is never
 * prefetched (the page loads it only when it will show). Returns a cancel
 * function.
 */
export function prefetchEditorChunks(): () => void {
  if (prefersSavedData()) return () => undefined;

  const loaders: Loader[] = [
    // Needed by the first URL write after an edit.
    loadUrlCodec,
    loadEffectsPanel,
    loadExportModal,
    loadPresetsPanel,
    loadScenePanel,
    loadCommandPalette,
    loadProjectsModal,
    loadShortcutsModal,
    loadCustomGLSLPanel,
  ];
  if (window.matchMedia(MOBILE_QUERY).matches) loaders.unshift(loadMobileDrawerBody);

  return runOnePerIdle(loaders.map(preloader));
}
