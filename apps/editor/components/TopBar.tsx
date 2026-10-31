"use client";

import { useState } from "react";
import {
  Check,
  Command,
  Download,
  FolderOpen,
  Keyboard,
  Link2,
  Moon,
  Pause,
  Play,
  Redo2,
  Shuffle,
  Sun,
  SunMoon,
  Undo2,
} from "lucide-react";
import { useGradientStore, canUndo, canRedo } from "@/lib/store";
import { useTheme } from "@/lib/useTheme";
import { copyShareUrl } from "@/lib/url";
import { preloadUrlCodec } from "@/lib/url-sync";
import {
  preloadCommandPalette,
  preloadExportModal,
  preloadProjectsModal,
  preloadShortcutsModal,
} from "@/components/lazy";

interface TopBarProps {
  onExport: () => void;
  onShowShortcuts: () => void;
  onProjects: () => void;
  onOpenPalette: () => void;
}

export default function TopBar({ onExport, onShowShortcuts, onProjects, onOpenPalette }: TopBarProps) {
  const store = useGradientStore();
  const { playing, randomize, set, undo, redo } = store;
  const { theme, cycleTheme } = useTheme();
  const [linkCopied, setLinkCopied] = useState(false);

  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";
  const ThemeIcon = theme === "system" ? SunMoon : theme === "light" ? Sun : Moon;

  // Icons with a label beside them; on narrower screens only the icon shows
  // (Export keeps its label down to 640px), so every button carries its name
  // as aria-label. Export is the one primary action, the only filled button.
  return (
    <header className="topbar">
      {/* Left: Logo + History */}
      <div className="topbar-group">
        <span className="topbar-logo font-mono text-[13px] font-bold text-text-primary tracking-[0.15em] mr-1">WAVR</span>
        <div className="topbar-divider" />
        <button onClick={undo} disabled={!canUndo()} aria-label="Undo" title="Undo (⌘Z)" className="topbar-btn topbar-btn-icon">
          <Undo2 size={14} aria-hidden="true" />
        </button>
        <button onClick={redo} disabled={!canRedo()} aria-label="Redo" title="Redo (⌘⇧Z)" className="topbar-btn topbar-btn-icon">
          <Redo2 size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="topbar-group">
        <button onClick={randomize} aria-label="Randomize" title="Randomize (R)" className="topbar-btn">
          <Shuffle size={14} aria-hidden="true" />
          <span className="topbar-label">Randomize</span>
        </button>
        <button
          onClick={() => set({ playing: !playing })}
          aria-label={playing ? "Pause" : "Play"}
          title={`${playing ? "Pause" : "Play"} (Space)`}
          className="topbar-btn"
        >
          {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          <span className="topbar-label topbar-label-fixed">{playing ? "Pause" : "Play"}</span>
        </button>
      </div>

      {/* Right: Preferences, then the scene's actions */}
      <div className="topbar-group">
        {/* Always shown: on a phone it is the only way to the palette's tools (3D, Shader, Performance). */}
        <button
          onClick={onOpenPalette}
          onPointerEnter={preloadCommandPalette}
          onFocus={preloadCommandPalette}
          aria-label="Open command palette"
          title="Command palette (⌘K)"
          className="topbar-btn topbar-btn-icon"
        >
          <Command size={14} aria-hidden="true" />
        </button>
        <button
          onClick={onShowShortcuts}
          onPointerEnter={preloadShortcutsModal}
          onFocus={preloadShortcutsModal}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="topbar-btn topbar-btn-icon topbar-hide-narrow"
        >
          <Keyboard size={14} aria-hidden="true" />
        </button>
        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${themeLabel}`}
          title={`Theme: ${themeLabel}`}
          className="topbar-btn topbar-btn-icon topbar-hide-narrow"
        >
          <ThemeIcon size={14} aria-hidden="true" />
        </button>
        <div className="topbar-divider" />
        <button
          onClick={async () => {
            await copyShareUrl(store);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
          }}
          onPointerEnter={preloadUrlCodec}
          onFocus={preloadUrlCodec}
          aria-label={linkCopied ? "Link copied" : "Share"}
          className="topbar-btn"
        >
          {linkCopied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
          <span className="topbar-label">{linkCopied ? "Copied!" : "Share"}</span>
        </button>
        <button
          onClick={onProjects}
          onPointerEnter={preloadProjectsModal}
          onFocus={preloadProjectsModal}
          aria-label="Projects"
          title="Projects (P)"
          className="topbar-btn"
        >
          <FolderOpen size={14} aria-hidden="true" />
          <span className="topbar-label">Projects</span>
        </button>
        <button
          onClick={onExport}
          onPointerEnter={preloadExportModal}
          onFocus={preloadExportModal}
          aria-label="Export"
          title="Export (E)"
          className="topbar-btn topbar-btn-accent"
        >
          <Download size={14} aria-hidden="true" />
          <span className="topbar-label-primary">Export</span>
        </button>
      </div>
    </header>
  );
}
