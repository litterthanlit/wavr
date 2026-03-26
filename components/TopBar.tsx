"use client";

import { useGradientStore } from "@/lib/store";
import { useTheme } from "@/lib/useTheme";

interface TopBarProps {
  onExport: () => void;
}

export default function TopBar({ onExport }: TopBarProps) {
  const { playing, randomize, set } = useGradientStore();
  const { theme, cycleTheme } = useTheme();

  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  return (
    <header className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">WAVR</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={cycleTheme}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150"
          title={`Theme: ${themeLabel}`}
        >
          {themeLabel}
        </button>
        <button
          onClick={randomize}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150"
        >
          Randomize
        </button>
        <button
          onClick={() => set({ playing: !playing })}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150 w-16"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs text-white bg-accent hover:bg-accent/80
            rounded-md transition-all duration-150"
        >
          Export
        </button>
      </div>
    </header>
  );
}
