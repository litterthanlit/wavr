"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type Theme = "light" | "dark" | "system";

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
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem("wavr-theme");
  if (saved === "light" || saved === "dark" || saved === "system") return saved;
  return "system";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getSavedTheme);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      applyTheme(theme);
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    localStorage.setItem("wavr-theme", t);
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "system" ? "light" : prev === "light" ? "dark" : "system";
      applyTheme(next);
      localStorage.setItem("wavr-theme", next);
      return next;
    });
  }, []);

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  return { theme, resolvedTheme, setTheme, cycleTheme };
}
