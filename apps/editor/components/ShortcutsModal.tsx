"use client";

import { useEffect, useRef } from "react";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "\u2318/Ctrl + K", action: "Open command palette" },
  { key: "Space", action: "Play / Pause" },
  { key: "R", action: "Randomize" },
  { key: "E", action: "Export" },
  { key: "Esc", action: "Close modal" },
  { key: "1 / 2 / 3", action: "Switch tab" },
  { key: "\u2318/Ctrl + Z", action: "Undo" },
  { key: "\u2318/Ctrl + Shift + Z", action: "Redo" },
  { key: "?", action: "Toggle this overlay" },
];

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        className="relative bg-base border border-border rounded-xl p-6 w-[340px] shadow-2xl focus:outline-none"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-medium text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="text-text-tertiary hover:text-text-primary text-lg transition-colors"
          >
            x
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex justify-between items-center">
              <span className="text-xs text-text-secondary">{s.action}</span>
              <kbd className="font-mono text-[11px] text-text-tertiary bg-surface border border-border rounded px-1.5 py-0.5">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
