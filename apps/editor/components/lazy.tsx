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

import { useEffect, useState } from "react";
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
// litt's Select (Radix Select and the glide), Segmented (motion's animated components) and Toaster:
// only the mask controls use the first two, and a toast comes after startup, so none belongs in the
// initial bundle.
const loadSelect = () => import("@/components/litt/select");
const loadSegmented = () => import("@/components/litt/segmented");
const loadToast = () => import("@/components/litt/toast");
// litt's Tabs and Tooltip bring motion's animated components (Tabs) and Radix's popper (Tooltip), which the
// initial bundle must not carry; the sidebar's tab row and the top bar's tooltips arrive with them just after
// startup (see useLoaded).
const loadSidebarTabs = () => import("@/components/SidebarTabs");
const loadTooltip = () => import("@/components/litt/tooltip");
// litt's Combobox (Radix Popover), for the blend mode: it shows only once there are two layers.
const loadCombobox = () => import("@/components/litt/combobox");

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
// Holds the field's label row and height (sm) while it loads, so the layer controls don't jump.
export const LazyCombobox = dynamic(() => loadCombobox().then((m) => m.Combobox), {
  ssr: false,
  loading: () => <div className="h-[calc(var(--litt-control-sm)+28px)]" />,
});
// The bare litt Select (no label row), for a toolbar; named by its aria-label. Holds its height while it loads.
export const LazySelect = dynamic(() => loadSelect().then((m) => m.Select), {
  ssr: false,
  loading: () => <div className="h-litt-control-sm" />,
});
export const LazySelectField = dynamic(() => loadSelect().then((m) => m.SelectField), { ssr: false, loading: () => null });
// Holds the track's height (sm, 32px) while it loads, so the mask controls don't jump.
export const LazySegmented = dynamic(() => loadSegmented().then((m) => m.Segmented), {
  ssr: false,
  loading: () => <div className="h-litt-control-sm" />,
});
type ToastOptions = import("@/components/litt/toast").ToastOptions;

// Resolves once a Toaster has mounted. Its sink registers in an effect of the Toaster's own, which
// runs before the effect of the component around it, so toast() reaches it from then on.
let toasterMounted: (send: (options: ToastOptions) => void) => void = () => undefined;
const toasterReady = new Promise<(options: ToastOptions) => void>((resolve) => {
  toasterMounted = resolve;
});

export const LazyToaster = dynamic(
  () =>
    loadToast().then(({ Toaster, toast }) => {
      function MountedToaster() {
        useEffect(() => toasterMounted(toast), []);
        return <Toaster />;
      }
      return MountedToaster;
    }),
  { ssr: false, loading: () => null },
);

/** Shows a litt toast, waiting for LazyToaster (mounted with the editor) if it hasn't loaded yet. */
export function showToast(options: ToastOptions): void {
  void toasterReady.then((send) => send(options));
}

/**
 * A lazily loaded module, or null until it has loaded. It starts loading after the first render, so the server
 * and the client's first render agree (the prerendered /editor hydrates without a mismatch). A failed load is
 * tried again after 1s, then 2s, 4s and so on up to 30s, so a dropped chunk never strands the part that needs it.
 */
export function useLoaded<T>(load: () => Promise<T>): T | null {
  const [loaded, setLoaded] = useState<T | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    let retry: number | undefined;
    load().then(
      (mod) => live && setLoaded(() => mod),
      () => {
        if (live) retry = window.setTimeout(() => setAttempt((n) => n + 1), Math.min(30_000, 1000 * 2 ** attempt));
      },
    );
    return () => {
      live = false;
      window.clearTimeout(retry);
    };
  }, [load, attempt]);
  return loaded;
}

/** The sidebar's litt Tabs (components/SidebarTabs.tsx). */
export const useSidebarTabs = () => useLoaded(loadSidebarTabs);
/** litt's Tooltip and its provider. */
export const useTooltip = () => useLoaded(loadTooltip);

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
    loadSegmented,
    loadSelect,
    loadCombobox,
  ];
  if (window.matchMedia(MOBILE_QUERY).matches) loaders.unshift(loadMobileDrawerBody);

  return runOnePerIdle(loaders.map(preloader));
}
