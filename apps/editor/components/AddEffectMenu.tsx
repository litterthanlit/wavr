"use client";

/**
 * AddEffectMenu — searchable picker for toggleable effects.
 *
 * Mounts at the top of EffectsPanel. The big accordion list stays intact for
 * browsing; this button is for the "I know what I want — where is it?" flow.
 *
 * UX mirrors the ⌘K command palette (cmdk.Dialog, same keyboard nav) but is
 * scoped to effect toggles only. Picking a row flips the effect on/off and
 * closes. The current on/off state is shown in a trailing pill so users know
 * whether the click will turn the effect on or off.
 */

import { useMemo, useState } from "react";
import { Command as CmdkCommand } from "cmdk";
import { useGradientStore, type GradientState } from "@/lib/store";
import {
  EFFECTS_CATALOG,
  type EffectEntry,
  type EffectSection,
} from "@/lib/effects-catalog";

const SECTION_ORDER: EffectSection[] = [
  "Output quality",
  "Texture",
  "Lighting",
  "Blur",
  "Distortion",
  "Stylize",
  "3D Depth",
  "Advanced",
  "Audio",
];

function groupBySection(entries: EffectEntry[]): { name: EffectSection; items: EffectEntry[] }[] {
  const map = new Map<EffectSection, EffectEntry[]>();
  for (const e of entries) {
    const list = map.get(e.section);
    if (list) list.push(e);
    else map.set(e.section, [e]);
  }
  return SECTION_ORDER.filter((s) => map.has(s)).map((s) => ({ name: s, items: map.get(s)! }));
}

export default function AddEffectMenu() {
  const [open, setOpen] = useState(false);
  const store = useGradientStore();

  const grouped = useMemo(() => groupBySection(EFFECTS_CATALOG), []);

  const toggle = (flag: EffectEntry["flag"]) => {
    const s = useGradientStore.getState() as unknown as Record<string, unknown>;
    const current = Boolean(s[flag]);
    // Mesh distortion and 3D shape are mutually exclusive (see EffectsPanel).
    // When enabling one, turn the other off so the user never lands in the
    // forbidden state via this menu.
    const patch: Partial<GradientState> = { [flag]: !current } as Partial<GradientState>;
    if (!current && flag === "meshDistortionEnabled" && store.threeDEnabled) {
      patch.threeDEnabled = false;
    }
    if (!current && flag === "threeDEnabled" && store.meshDistortionEnabled) {
      patch.meshDistortionEnabled = false;
    }
    useGradientStore.getState().setDiscrete(patch);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-[11px] font-medium rounded-md border border-border bg-surface text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors"
        aria-label="Add effect"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="flex-1 text-left">Add effect</span>
        <kbd className="font-mono text-[10px] text-text-tertiary">Search</kbd>
      </button>

      <CmdkCommand.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Add effect"
        overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        contentClassName="fixed left-1/2 top-[20vh] z-50 w-[480px] max-w-[90vw] -translate-x-1/2 bg-base border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        <CmdkCommand.Input
          autoFocus
          placeholder="Search effects\u2026"
          className="w-full bg-transparent border-0 border-b border-border px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
        <CmdkCommand.List className="max-h-[50vh] overflow-y-auto p-1">
          <CmdkCommand.Empty className="px-4 py-6 text-center text-xs text-text-tertiary">
            No matching effect.
          </CmdkCommand.Empty>
          {grouped.map((group) => (
            <CmdkCommand.Group
              key={group.name}
              heading={group.name}
              className="px-1 pt-2 first:pt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-text-tertiary"
            >
              {group.items.map((entry) => {
                const current = Boolean((store as unknown as Record<string, unknown>)[entry.flag]);
                return (
                  <CmdkCommand.Item
                    key={entry.flag}
                    value={`${entry.label} ${entry.keywords?.join(" ") ?? ""} ${entry.section}`}
                    onSelect={() => toggle(entry.flag)}
                    className="flex items-center justify-between gap-2 rounded px-3 py-2 text-xs cursor-pointer text-text-secondary data-[selected=true]:bg-surface data-[selected=true]:text-text-primary"
                  >
                    <span className="flex-1 truncate">{entry.label}</span>
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${
                        current
                          ? "bg-accent/10 border-accent/40 text-accent"
                          : "bg-surface border-border text-text-tertiary"
                      }`}
                    >
                      {current ? "on" : "off"}
                    </span>
                  </CmdkCommand.Item>
                );
              })}
            </CmdkCommand.Group>
          ))}
        </CmdkCommand.List>
      </CmdkCommand.Dialog>
    </>
  );
}
