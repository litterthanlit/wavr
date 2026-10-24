"use client";

import { useGradientStore, canUndo, canRedo } from "@/lib/store";
import { useTheme, type Theme } from "@/lib/useTheme";
import { copyShareUrl } from "@/lib/url";
import { preloadUrlCodec } from "@/lib/url-sync";
import {
  preloadExportModal,
  preloadProjectsModal,
  preloadSceneGalleryModal,
  preloadShortcutsModal,
} from "@/components/lazy";
import { Button } from "@/components/litt/button";
import { Tooltip } from "@/components/litt/tooltip";
import { Kbd } from "@/components/litt/kbd";
import { Menu, MenuItem, MenuRadioGroup, MenuRadioItem, MenuSeparator } from "@/components/litt/menu";
import { toast } from "@/components/litt/toast";
import {
  DownloadIcon,
  FolderIcon,
  HelpIcon,
  MonitorIcon,
  MoonIcon,
  MoreIcon,
  PauseIcon,
  PlayIcon,
  RedoIcon,
  SearchIcon,
  ShareIcon,
  SparkleIcon,
  SunIcon,
  UndoIcon,
} from "@/components/litt/icons";

interface TopBarProps {
  onScenes: () => void;
  onExport: () => void;
  onShowShortcuts: () => void;
  onProjects: () => void;
  onSearch: () => void;
}

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: "system", label: "Auto", icon: <MonitorIcon /> },
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
];

/* The bar's own actions fold into a menu below the sidebar breakpoint, where there is no room for them. */
const WIDE = "max-[900px]:hidden";
const NARROW = "min-[901px]:hidden";

export default function TopBar({ onScenes, onExport, onShowShortcuts, onProjects, onSearch }: TopBarProps) {
  const store = useGradientStore();
  const { playing, randomize, set, undo, redo } = store;
  const { theme, setTheme, cycleTheme } = useTheme();
  const current = THEMES.find((t) => t.value === theme) ?? THEMES[0];

  const share = async () => {
    await copyShareUrl(store);
    toast({ title: "Link copied", description: "The link opens this scene as it is now.", tone: "success" });
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-litt-line bg-litt-surface-1 px-3">
      <div className="flex items-center gap-1">
        <span className="mr-2 font-litt-title text-litt-body text-litt-fg">Wavr</span>
        <Tooltip content="Undo" shortcut="⌘Z">
          <Button variant="ghost" size="sm" iconOnly aria-label="Undo" icon={<UndoIcon />} onClick={undo} disabled={!canUndo()} />
        </Tooltip>
        <Tooltip content="Redo" shortcut="⇧⌘Z">
          <Button variant="ghost" size="sm" iconOnly aria-label="Redo" icon={<RedoIcon />} onClick={redo} disabled={!canRedo()} />
        </Tooltip>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip content={playing ? "Pause" : "Play"} shortcut="Space">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={playing ? "Pause" : "Play"}
            icon={playing ? <PauseIcon /> : <PlayIcon />}
            onClick={() => set({ playing: !playing })}
          />
        </Tooltip>
        <Tooltip content="Randomize" shortcut="R">
          <Button variant="ghost" size="sm" iconOnly aria-label="Randomize" icon={<SparkleIcon />} onClick={randomize} />
        </Tooltip>
        <Button
          size="sm"
          onClick={onScenes}
          onPointerEnter={preloadSceneGalleryModal}
          onFocus={preloadSceneGalleryModal}
        >
          Scenes
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<SearchIcon />}
          onClick={onSearch}
          aria-label="Search commands"
          className={WIDE}
        >
          <span className="flex items-center gap-2">
            Search <Kbd>⌘K</Kbd>
          </span>
        </Button>
        <Tooltip content="Keyboard shortcuts" shortcut="?">
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label="Keyboard shortcuts"
            icon={<HelpIcon />}
            onClick={onShowShortcuts}
            onPointerEnter={preloadShortcutsModal}
            onFocus={preloadShortcutsModal}
            className={WIDE}
          />
        </Tooltip>
        <Tooltip content={`Theme: ${current.label}`}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Theme: ${current.label}`}
            icon={current.icon}
            onClick={cycleTheme}
            className={WIDE}
          />
        </Tooltip>
        <div className={`mx-1 h-4 w-px bg-litt-line ${WIDE}`} />
        <Button
          size="sm"
          icon={<ShareIcon />}
          onClick={share}
          onPointerEnter={preloadUrlCodec}
          onFocus={preloadUrlCodec}
          className={WIDE}
        >
          Share
        </Button>
        <Button
          size="sm"
          icon={<FolderIcon />}
          onClick={onProjects}
          onPointerEnter={preloadProjectsModal}
          onFocus={preloadProjectsModal}
          className={WIDE}
        >
          Projects
        </Button>
        <Menu
          label="More"
          align="end"
          trigger={
            <Button variant="ghost" size="sm" iconOnly aria-label="More" icon={<MoreIcon />} className={NARROW} />
          }
        >
          <MenuItem icon={<ShareIcon />} onSelect={share}>
            Share link
          </MenuItem>
          <MenuItem icon={<FolderIcon />} onSelect={onProjects}>
            Projects
          </MenuItem>
          <MenuItem icon={<SearchIcon />} onSelect={onSearch}>
            Commands
          </MenuItem>
          <MenuSeparator />
          <MenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            {THEMES.map((t) => (
              <MenuRadioItem key={t.value} value={t.value}>
                {`${t.label} theme`}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </Menu>
        <Button
          variant="primary"
          size="sm"
          icon={<DownloadIcon />}
          onClick={onExport}
          onPointerEnter={preloadExportModal}
          onFocus={preloadExportModal}
        >
          Export
        </Button>
      </div>
    </header>
  );
}
