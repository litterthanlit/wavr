"use client";

/**
 * CommandPalette — ⌘K palette (spec 0005), drawn by litt's CommandMenu.
 *
 * The registry is rebuilt on every open via `getCommands(ui)` so disabled
 * gates and "(on)/(off)" suffixes always reflect the live store. litt's menu
 * searches the label; the registry's keywords are not searched.
 */

import { useMemo } from "react";
import { CommandMenu, type CommandGroup as MenuGroup, type CommandItem } from "@/components/litt/command-menu";
import {
  getCommands,
  COMMAND_GROUP_ORDER,
  type Command,
  type UiActions,
} from "@/lib/commands";

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

  const groups = useMemo<MenuGroup[]>(
    () =>
      COMMAND_GROUP_ORDER.map((group) => ({
        id: group,
        heading: group,
        items: commands
          .filter((cmd) => cmd.group === group)
          .map((cmd) => ({
            id: cmd.id,
            label: cmd.label,
            shortcut: cmd.shortcut,
            disabled: cmd.disabled?.() ?? false,
          })),
      })).filter((group) => group.items.length > 0),
    [commands],
  );

  const run = (item: CommandItem) => {
    commands.find((cmd) => cmd.id === item.id)?.run();
  };

  return <CommandMenu open={open} onOpenChange={onOpenChange} groups={groups} onSelect={run} />;
}
