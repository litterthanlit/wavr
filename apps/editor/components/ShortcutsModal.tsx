"use client";

import { Dialog, DialogContent } from "@/components/litt/dialog";
import { Kbd } from "@/components/litt/kbd";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

/** What the editor page's key handler does (app/editor/page.tsx). */
const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["⌘K"], action: "Search commands" },
  { keys: ["Space"], action: "Play or pause" },
  { keys: ["R"], action: "Randomize" },
  { keys: ["E"], action: "Export" },
  { keys: ["P"], action: "Projects" },
  { keys: ["1", "2", "3", "4", "5"], action: "Switch panel" },
  { keys: ["⌘Z"], action: "Undo" },
  { keys: ["⇧⌘Z"], action: "Redo" },
  { keys: ["Esc"], action: "Close a dialog" },
  { keys: ["?"], action: "Show these shortcuts" },
];

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Keyboard shortcuts" description="On Windows and Linux, Ctrl stands in for ⌘.">
        <dl className="flex flex-col">
          {SHORTCUTS.map((s) => (
            <div key={s.action} className="flex items-center justify-between gap-4 border-b border-litt-line py-2 last:border-b-0">
              <dt className="text-litt-small text-litt-fg-muted">{s.action}</dt>
              <dd className="flex gap-1">
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
