"use client";

import { useEffect, useSyncExternalStore, useCallback } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "wavr-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: Theme) {
  if (t === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
}

function getSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    // Storage unavailable (private mode, blocked cookies): fall back to system.
  }
  return "system";
}

// The theme lives outside React so the server render and the hydration pass can
// both use "system" (the server can't read localStorage) and the saved choice
// is swapped in right after. Reading localStorage during the first client
// render instead made the TopBar label differ from the server HTML, which is a
// hydration mismatch (React error #418) and forces a full client re-render.
let currentTheme: Theme | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): Theme {
  currentTheme ??= getSavedTheme();
  return currentTheme;
}

function getServerSnapshot(): Theme {
  return "system";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function commitTheme(next: Theme) {
  currentTheme = next;
  applyTheme(next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Not persisted, but the theme still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Reflect the saved theme on <html> once it is known (after hydration).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    commitTheme(t);
  }, []);

  const cycleTheme = useCallback(() => {
    const prev = getSnapshot();
    commitTheme(prev === "system" ? "light" : prev === "light" ? "dark" : "system");
  }, []);

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  return { theme, resolvedTheme, setTheme, cycleTheme };
}
