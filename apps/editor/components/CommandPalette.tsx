"use client";

/**
 * CommandPalette — ⌘K fuzzy palette (spec 0005).
 *
 * Thin wrapper around cmdk's primitives. Dark-theme styling mirrors the
 * existing editor modals (border, rounded-xl, glass-blur). The registry is
 * rebuilt on every open via `getCommands(ui)` so disabled gates and
 * "(on)/(off)" suffixes always reflect the live store.
 */

import { useMemo, useCallback } from "react";
import { Command as CmdkCommand } from "cmdk";
import {
  getCommands,
  COMMAND_GROUP_ORDER,
  type Command,
  type CommandGroup,
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

  const grouped = useMemo(() => {
    const byGroup = new Map<CommandGroup, Command[]>();
    for (const cmd of commands) {
      const list = byGroup.get(cmd.group);
      if (list) list.push(cmd);
      else byGroup.set(cmd.group, [cmd]);
    }
    return COMMAND_GROUP_ORDER
      .filter((g) => byGroup.has(g))
      .map((g) => ({ name: g, items: byGroup.get(g)! }));
  }, [commands]);

  // Local ⌘K handler — belt-and-suspenders with the global handler in
  // page.tsx. Window keydown listeners should fire regardless of focus, but
  // a dialog that stops propagation on the input (defensive default in some
  // dialog primitives) would break the toggle. Handle ⌘K here too so
  // closing from inside the cmdk input is guaranteed.
  const onDialogKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  return (
    <CmdkCommand.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      onKeyDown={onDialogKeyDown}
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      contentClassName="fixed left-1/2 top-[20vh] z-50 w-[520px] max-w-[90vw] -translate-x-1/2 bg-base border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
    >
      <CmdkCommand.Input
        autoFocus
        placeholder="Type a command or search\u2026"
        className="w-full bg-transparent border-0 border-b border-border px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      <CmdkCommand.List className="max-h-[50vh] overflow-y-auto p-1">
        <CmdkCommand.Empty className="px-4 py-6 text-center text-xs text-text-tertiary">
          No matches.
        </CmdkCommand.Empty>
        {grouped.map((group) => (
          <CmdkCommand.Group
            key={group.name}
            heading={group.name}
            className="px-1 pt-2 first:pt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-text-tertiary"
          >
            {group.items.map((cmd) => {
              const isDisabled = cmd.disabled?.() ?? false;
              return (
                <CmdkCommand.Item
                  key={cmd.id}
                  value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
                  disabled={isDisabled}
                  onSelect={() => {
                    cmd.run();
                    onOpenChange(false);
                  }}
                  className={[
                    "flex items-center justify-between gap-2 rounded px-3 py-2 text-xs cursor-pointer",
                    "text-text-secondary",
                    "data-[selected=true]:bg-surface data-[selected=true]:text-text-primary",
                    "data-[disabled=true]:opacity-40 data-[disabled=true]:cursor-not-allowed",
                  ].join(" ")}
                >
                  <span className="flex-1 truncate">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="font-mono text-[10px] text-text-tertiary bg-surface border border-border rounded px-1.5 py-0.5">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </CmdkCommand.Item>
              );
            })}
          </CmdkCommand.Group>
        ))}
      </CmdkCommand.List>
    </CmdkCommand.Dialog>
  );
}
