"use client";

import { useSyncExternalStore } from "react";

/**
 * Where the canvas's HDR output stands (Canvas sets it, the Effects panel
 * shows it): "off" while the scene asks for no headroom or the screen can't
 * show HDR, "starting" while the WebGPU output is being made, "on" while
 * frames go through it, "unsupported" where the browser has no extended-range
 * WebGPU canvas, "lost" after its GPU device went away.
 */
export type HdrStatus = "off" | "starting" | "on" | "unsupported" | "lost";

let status: HdrStatus = "off";
const listeners = new Set<() => void>();

export function setHdrStatus(next: HdrStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHdrStatus(): HdrStatus {
  return useSyncExternalStore(subscribe, () => status, () => "off");
}
