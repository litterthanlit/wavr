"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "wavr-render-stats";

// The canvas's render stats (fps, CPU time, framebuffers, memory, render
// scale) are for tuning, so they are off until asked for (S, or the command
// palette), and the choice is remembered. Off on the server and during
// hydration (the server can't read localStorage), as in useTheme.
let shown: boolean | null = null;
const listeners = new Set<() => void>();

function readSaved(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the render stats are showing. */
export function renderStatsShown(): boolean {
  shown ??= readSaved();
  return shown;
}

export function toggleRenderStats() {
  shown = !renderStatsShown();
  try {
    localStorage.setItem(STORAGE_KEY, shown ? "1" : "0");
  } catch {
    // Not remembered, but it still toggles for this session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRenderStats(): boolean {
  return useSyncExternalStore(subscribe, renderStatsShown, () => false);
}
