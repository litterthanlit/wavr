"use client";

import { useState } from "react";
import { useGradientStore, canUndo, canRedo } from "@/lib/store";
import { useTheme } from "@/lib/useTheme";
import { copyShareUrl } from "@/lib/url";

interface TopBarProps {
  onExport: () => void;
  onShowShortcuts: () => void;
  onProjects: () => void;
}

export default function TopBar({ onExport, onShowShortcuts, onProjects }: TopBarProps) {
  const store = useGradientStore();
  const { playing, randomize, set, undo, redo } = store;
  const { theme, cycleTheme } = useTheme();
  const [linkCopied, setLinkCopied] = useState(false);

  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  return (
    <header className="topbar">
      {/* Left: Logo + History */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] font-bold text-text-primary tracking-[0.15em] mr-1">WAVR</span>
        <div className="topbar-divider" />
        <button onClick={undo} disabled={!canUndo()} aria-label="Undo" className="topbar-btn">
          &#8592;
        </button>
        <button onClick={redo} disabled={!canRedo()} aria-label="Redo" className="topbar-btn">
          &#8594;
        </button>
      </div>

      {/* Center: Playback + Utils */}
      <div className="flex items-center gap-2">
        <button onClick={randomize} className="topbar-btn">
          Randomize
        </button>
        <button onClick={() => set({ playing: !playing })} className="topbar-btn" style={{ minWidth: 56 }}>
          {playing ? "Pause" : "Play"}
        </button>
        <div className="topbar-divider" />
        <button onClick={onShowShortcuts} aria-label="Keyboard shortcuts" className="topbar-btn">
          ?
        </button>
        <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}`} className="topbar-btn">
          {themeLabel}
        </button>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={async () => {
            await copyShareUrl(store);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          className="topbar-btn"
        >
          {linkCopied ? "Copied!" : "Share"}
        </button>
        <button onClick={onProjects} className="topbar-btn">
          Projects
        </button>
        <div className="topbar-divider" />
        <button onClick={onExport} className="topbar-btn topbar-btn-accent">
          Export
        </button>
      </div>
    </header>
  );
}
