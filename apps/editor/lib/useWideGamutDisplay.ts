"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(color-gamut: p3)";

function subscribe(listener: () => void): () => void {
  // The answer changes when the window moves to another screen.
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

// Unknown on the server and during hydration (the first client render must
// match the prerendered HTML); the real answer comes in right after.
function getServerSnapshot(): boolean | null {
  return null;
}

/** Whether this screen shows Display P3 colours; null until known. */
export function useWideGamutDisplay(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribe, getSnapshot, getServerSnapshot);
}
