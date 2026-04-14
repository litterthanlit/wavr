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

function Divider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

const btn = "px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated border border-border rounded-md transition-all duration-150";
const btnDisabled = "disabled:opacity-30 disabled:pointer-events-none";

export default function TopBar({ onExport, onShowShortcuts, onProjects }: TopBarProps) {
  const store = useGradientStore();
  const { playing, randomize, set, undo, redo } = store;
  const { theme, cycleTheme } = useTheme();
  const [linkCopied, setLinkCopied] = useState(false);

  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  return (
    <header className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center justify-between px-4 z-10">
      {/* Left: Logo + History */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider mr-1">WAVR</span>
        <Divider />
        <button onClick={undo} disabled={!canUndo()} aria-label="Undo" className={`px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated border border-border rounded-md transition-all duration-150 ${btnDisabled}`}>
          &#8592;
        </button>
        <button onClick={redo} disabled={!canRedo()} aria-label="Redo" className={`px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated border border-border rounded-md transition-all duration-150 ${btnDisabled}`}>
          &#8594;
        </button>
      </div>

      {/* Center: Playback + Utils */}
      <div className="flex items-center gap-2">
        <button onClick={randomize} className={btn}>
          Randomize
        </button>
        <button onClick={() => set({ playing: !playing })} className={`${btn} w-16`}>
          {playing ? "Pause" : "Play"}
        </button>
        <Divider />
        <button onClick={onShowShortcuts} aria-label="Keyboard shortcuts" className={`px-2 py-1.5 text-xs text-text-tertiary hover:text-text-primary bg-surface hover:bg-elevated border border-border rounded-md transition-all duration-150`}>
          ?
        </button>
        <button onClick={cycleTheme} aria-label={`Theme: ${themeLabel}`} className={btn}>
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
          className={btn}
        >
          {linkCopied ? "Copied!" : "Share"}
        </button>
        <button onClick={onProjects} className={btn}>
          Projects
        </button>
        <Divider />
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs text-white bg-accent hover:bg-accent/80 rounded-md transition-all duration-150"
        >
          Export
        </button>
      </div>
    </header>
  );
}
