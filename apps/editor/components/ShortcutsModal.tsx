"use client";

import { Dialog, DialogContent } from "@/components/litt/dialog";
import { useReturnFocus } from "@/lib/useReturnFocus";
import { Kbd } from "@/components/litt/kbd";
import { SIDEBAR_TABS } from "@/lib/types";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

/** Each entry is the keys pressed one after another (a chord is one cap) and what they do. */
const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["⌘K"], action: "Open the command menu" },
  { keys: ["Space"], action: "Play or pause" },
  { keys: ["R"], action: "Randomize" },
  { keys: ["E"], action: "Export" },
  { keys: ["P"], action: "Projects" },
  { keys: ["esc"], action: "Close a dialog" },
  {
    keys: SIDEBAR_TABS.map((_, i) => String(i + 1)),
    action: `Tabs: ${SIDEBAR_TABS.map((tab) => tab.label).join(", ")}`,
  },
  { keys: ["S"], action: "Show or hide render stats" },
  { keys: ["⌘Z"], action: "Undo" },
  { keys: ["⇧⌘Z"], action: "Redo" },
  { keys: ["?"], action: "Show or hide this list" },
];

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  useReturnFocus(open);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent title="Keyboard shortcuts" description="On Windows and Linux, Ctrl does what ⌘ does.">
        <dl className="divide-y divide-litt-line">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex min-h-litt-control-sm items-center justify-between gap-4 py-1">
              <dt className="text-litt-small text-litt-fg">{s.action}</dt>
              <dd className="flex shrink-0 gap-1">
                {s.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
