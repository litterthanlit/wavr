"use client";

/**
 * CommandPalette — ⌘K palette (spec 0005) on litt's Command menu.
 *
 * The registry is rebuilt on every open via `getCommands(ui)` so disabled
 * gates and "(on)/(off)" suffixes always reflect the live store. The search
 * matches a command's label and its `keywords` (a local extension to litt's
 * command menu, see CLAUDE.md).
 */

import { useEffect, useMemo } from "react";
import { CommandMenu, type CommandGroup as MenuGroup } from "@/components/litt/command-menu";
import { preloadCustomGLSLPanel, preloadScenePanel } from "@/components/lazy";
import { getCommands, type Command, type UiActions } from "@/lib/commands";
import { toMenuGroups } from "@/lib/command-groups";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ui: UiActions;
}

export default function CommandPalette({ open, onOpenChange, ui }: CommandPaletteProps) {
  // Rebuild the registry each time the palette opens. `open` in the dep
  // array ensures fresh state (layer count, effect on/off suffix, disabled
  // gates) on every re-open; when closed the memoized value is unused.
  const commands = useMemo<Command[]>(
    () => (open ? getCommands(ui) : []),
    [open, ui],
  );

  // 3D and Shader open only from here, so their panels load while it is open.
  useEffect(() => {
    if (!open) return;
    preloadScenePanel();
    preloadCustomGLSLPanel();
  }, [open]);

  const groups = useMemo<MenuGroup[]>(() => toMenuGroups(commands), [commands]);
  const byId = useMemo(() => new Map(commands.map((cmd) => [cmd.id, cmd])), [commands]);

  return (
    <CommandMenu
      open={open}
      onOpenChange={onOpenChange}
      groups={groups}
      onSelect={(item) => byId.get(item.id)?.run()}
    />
  );
}
