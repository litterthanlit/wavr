"use client";

import { useState, type ReactElement } from "react";
import { Button } from "@/components/litt/button";
import {
  CheckIcon,
  CommandIcon,
  DownloadIcon,
  FolderIcon,
  HelpIcon,
  LinkIcon,
  MonitorIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  RedoIcon,
  SparkleIcon,
  SunIcon,
  UndoIcon,
} from "@/components/litt/icons";
import { useGradientStore, canUndo, canRedo } from "@/lib/store";
import { useTheme } from "@/lib/useTheme";
import { copyShareUrl } from "@/lib/url";
import { preloadUrlCodec } from "@/lib/url-sync";
import {
  useTooltip,
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

/**
 * A litt tooltip under a top-bar button, with its shortcut as a key cap. litt's Tooltip loads just after startup
 * (it brings Radix's popper, which the initial bundle doesn't carry); until then the button stands alone.
 */
function Tip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactElement }) {
  const Tooltip = useTooltip()?.Tooltip;
  if (!Tooltip) return children;
  return (
    <Tooltip content={label} shortcut={shortcut} side="bottom">
      {children}
    </Tooltip>
  );
}

/** One skip window for every tooltip in the bar, once litt's Tooltip has loaded. */
function Tooltips({ children }: { children: ReactElement }) {
  const Provider = useTooltip()?.TooltipProvider;
  return Provider ? <Provider>{children}</Provider> : children;
}

export default function TopBar({ onExport, onShowShortcuts, onProjects, onOpenPalette }: TopBarProps) {
  const store = useGradientStore();
  const { playing, randomize, set, undo, redo } = store;
  const { theme, cycleTheme } = useTheme();
  const [linkCopied, setLinkCopied] = useState(false);

  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";
  const ThemeIcon = theme === "system" ? MonitorIcon : theme === "light" ? SunIcon : MoonIcon;

  // litt buttons at the tool size. Labels sit beside their icons; on narrower
  // screens only the icon shows (Export keeps its label down to 640px), so every
  // button carries its name as aria-label. Export is the view's one primary
  // action, its only accent fill; the rest are ghost.
  return (
    <Tooltips>
      <header className="topbar">
        {/* Left: Logo + History */}
        <div className="topbar-group">
          <span className="topbar-logo mr-1 font-litt-mono text-litt-small font-litt-title text-litt-fg">Wavr</span>
          <div className="topbar-divider" />
          <Tip label="Undo" shortcut="⌘Z">
            <Button iconOnly size="sm" variant="ghost" onClick={undo} disabled={!canUndo()} aria-label="Undo">
              <UndoIcon />
            </Button>
          </Tip>
          <Tip label="Redo" shortcut="⇧⌘Z">
            <Button iconOnly size="sm" variant="ghost" onClick={redo} disabled={!canRedo()} aria-label="Redo">
              <RedoIcon />
            </Button>
          </Tip>
        </div>

        <div className="topbar-group">
          <Tip label="Randomize" shortcut="R">
            <Button size="sm" variant="ghost" icon={<SparkleIcon />} onClick={randomize} aria-label="Randomize" className="topbar-collapse">
              <span className="topbar-label">Randomize</span>
            </Button>
          </Tip>
          <Tip label={playing ? "Pause" : "Play"} shortcut="Space">
            <Button
              size="sm"
              variant="ghost"
              icon={playing ? <PauseIcon /> : <PlayIcon />}
              onClick={() => set({ playing: !playing })}
              aria-label={playing ? "Pause" : "Play"}
              className="topbar-collapse"
            >
              <span className="topbar-label topbar-label-fixed">{playing ? "Pause" : "Play"}</span>
            </Button>
          </Tip>
        </div>

        {/* Right: Preferences, then the scene's actions */}
        <div className="topbar-group">
          {/* Always shown: on a phone it is the only way to the menu's tools (3D, Shader, Performance). */}
          <Tip label="Command menu" shortcut="⌘K">
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              onClick={onOpenPalette}
              onPointerEnter={preloadCommandPalette}
              onFocus={preloadCommandPalette}
              aria-label="Open command menu"
            >
              <CommandIcon />
            </Button>
          </Tip>
          <Tip label="Keyboard shortcuts" shortcut="?">
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              onClick={onShowShortcuts}
              onPointerEnter={preloadShortcutsModal}
              onFocus={preloadShortcutsModal}
              aria-label="Keyboard shortcuts"
              className="topbar-hide-narrow"
            >
              <HelpIcon />
            </Button>
          </Tip>
          <Tip label={`Theme: ${themeLabel}`}>
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              onClick={cycleTheme}
              aria-label={`Theme: ${themeLabel}`}
              className="topbar-hide-narrow"
            >
              <ThemeIcon />
            </Button>
          </Tip>
          <div className="topbar-divider" />
          <Button
            size="sm"
            variant="ghost"
            icon={linkCopied ? <CheckIcon /> : <LinkIcon />}
            onClick={async () => {
              await copyShareUrl(store);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }}
            onPointerEnter={preloadUrlCodec}
            onFocus={preloadUrlCodec}
            aria-label={linkCopied ? "Link copied" : "Share"}
            className="topbar-collapse"
          >
            <span className="topbar-label">{linkCopied ? "Copied" : "Share"}</span>
          </Button>
          <Tip label="Projects" shortcut="P">
            <Button
              size="sm"
              variant="ghost"
              icon={<FolderIcon />}
              onClick={onProjects}
              onPointerEnter={preloadProjectsModal}
              onFocus={preloadProjectsModal}
              aria-label="Projects"
              className="topbar-collapse"
            >
              <span className="topbar-label">Projects</span>
            </Button>
          </Tip>
          <Tip label="Export" shortcut="E">
            <Button
              size="sm"
              variant="primary"
              icon={<DownloadIcon />}
              onClick={onExport}
              onPointerEnter={preloadExportModal}
              onFocus={preloadExportModal}
              aria-label="Export"
              className="topbar-collapse-primary"
            >
              <span className="topbar-label-primary">Export</span>
            </Button>
          </Tip>
        </div>
      </header>
    </Tooltips>
  );
}
