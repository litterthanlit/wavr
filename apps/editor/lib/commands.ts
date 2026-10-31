/**
 * commands.ts — palette action registry (spec 0005).
 *
 * Every palette-invokable action is a `Command` record. `getCommands(ui)` is a
 * pure function that returns a fresh list built from the live store at call
 * time, so it always reflects current state (layer count, effect toggles, etc.)
 * without closures going stale. `ui` holds modal-open callbacks owned by the
 * editor page.
 */

import { useGradientStore, canUndo, canRedo, GradientState, type PerformanceMode } from "./store";
import { copyShareUrl } from "./url";
import { PRESETS } from "./presets";
import { MAX_LAYERS } from "@wavr/core";
import type { LayerParams } from "@wavr/core";
import { SIDEBAR_TABS, TOOL_TABS, type SidebarTab } from "./types";
import { COMMAND_GRADIENT_TYPES, gradientTypeLabel } from "./gradient-types";
import { renderStatsShown, toggleRenderStats } from "./useRenderStats";
import { EFFECT_SWITCHES, isSwitchOn, switchPatch, type EffectSwitchKey } from "./effect-switches";

export type CommandGroup =
  | "Playback"
  | "Edit"
  | "View"
  | "Layers"
  | "Gradient"
  | "Effects"
  | "Presets"
  | "Export"
  | "Projects"
  | "Help";

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
  disabled?: () => boolean;
}

export interface UiActions {
  openExport: () => void;
  openProjects: () => void;
  openShortcuts: () => void;
  setTab: (tab: SidebarTab) => void;
}

// ── Gradient types (exclude "image", see spec §3.3) ────────────────────────
// Image requires a file-upload payload the palette can't provide; stays
// reachable via the Gradient panel.
const GRADIENT_TYPES: Exclude<LayerParams["gradientType"], "image">[] = COMMAND_GRADIENT_TYPES;

// The switches the panels offer: Bloom in Effects, 3D objects in 3D, and the
// amount switches (Grain, Pointer) from effect-switches.ts.
const EFFECT_TOGGLES = {
  realBloomEnabled: "bloom",
  scene3DEnabled: "3D objects",
} as const satisfies Partial<Record<keyof GradientState, string>>;

const PERFORMANCE_COMMANDS: { mode: PerformanceMode; label: string }[] = [
  { mode: "auto", label: "Performance: Auto" },
  { mode: "quality", label: "Performance: Quality" },
  { mode: "battery", label: "Performance: Battery" },
];

// camelCase → [lower tokens]: "sunsetBloom" → ["sunset", "bloom"].
function tokenize(camel: string): string[] {
  return camel
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

/**
 * Build the full command registry. Called fresh every time the palette
 * opens, so the `disabled()` gates and stateful labels (e.g. "Toggle bloom
 * (on)") always reflect the current store.
 */
export function getCommands(ui: UiActions): Command[] {
  const state = useGradientStore.getState();
  const commands: Command[] = [];

  // ── Playback ────────────────────────────────────────────────────────────
  commands.push({
    id: "playback.toggle",
    label: state.playing ? "Pause" : "Play",
    group: "Playback",
    keywords: ["play", "pause", "toggle"],
    shortcut: "Space",
    run: () => {
      const s = useGradientStore.getState();
      s.set({ playing: !s.playing });
    },
  });
  commands.push({
    id: "playback.randomize",
    label: "Randomize",
    group: "Playback",
    keywords: ["random", "shuffle", "rand"],
    shortcut: "R",
    run: () => useGradientStore.getState().randomize(),
  });

  // ── Edit ────────────────────────────────────────────────────────────────
  commands.push({
    id: "edit.undo",
    label: "Undo",
    group: "Edit",
    shortcut: "\u2318Z",
    disabled: () => !canUndo(),
    run: () => useGradientStore.getState().undo(),
  });
  commands.push({
    id: "edit.redo",
    label: "Redo",
    group: "Edit",
    shortcut: "\u2318\u21E7Z",
    disabled: () => !canRedo(),
    run: () => useGradientStore.getState().redo(),
  });

  // ── View (tab switch) ───────────────────────────────────────────────────
  for (const [i, tab] of SIDEBAR_TABS.entries()) {
    commands.push({
      id: `view.tab.${tab.id}`,
      label: `Switch to ${tab.label} tab`,
      group: "View",
      keywords: ["tab", "panel", "switch", tab.id],
      shortcut: String(i + 1),
      run: () => ui.setTab(tab.id),
    });
  }
  for (const tab of TOOL_TABS) {
    commands.push({
      id: `view.open.${tab.id}`,
      label: `Open ${tab.label}`,
      group: "View",
      keywords: ["tab", "panel", "tool", tab.id],
      run: () => ui.setTab(tab.id),
    });
  }

  commands.push({
    id: "view.renderStats",
    label: renderStatsShown() ? "Hide render stats" : "Show render stats",
    group: "View",
    keywords: ["fps", "performance", "debug", "stats", "frame rate"],
    shortcut: "S",
    run: toggleRenderStats,
  });

  for (const { mode, label } of PERFORMANCE_COMMANDS) {
    commands.push({
      id: `view.performance.${mode}`,
      label,
      group: "View",
      keywords: ["performance", "quality", "battery", "speed", mode],
      run: () => useGradientStore.getState().setDiscrete({ performanceMode: mode }),
      disabled: () => useGradientStore.getState().performanceMode === mode,
    });
  }

  // ── Layers ──────────────────────────────────────────────────────────────
  commands.push({
    id: "layer.add",
    label: "Add layer",
    group: "Layers",
    keywords: ["new", "create"],
    disabled: () => useGradientStore.getState().layers.length >= MAX_LAYERS,
    run: () => useGradientStore.getState().addLayer(),
  });
  commands.push({
    id: "layer.remove",
    label: "Remove active layer",
    group: "Layers",
    keywords: ["delete", "trash"],
    disabled: () => useGradientStore.getState().layers.length <= 1,
    run: () => {
      const s = useGradientStore.getState();
      s.removeLayer(s.activeLayerIndex);
    },
  });
  for (let i = 0; i < state.layers.length; i++) {
    const index = i;
    commands.push({
      id: `layer.select.${index}`,
      label: `Select layer ${index + 1}`,
      group: "Layers",
      keywords: ["layer", String(index + 1)],
      run: () => useGradientStore.getState().selectLayer(index),
    });
  }

  for (const type of GRADIENT_TYPES) {
    const label = gradientTypeLabel(type);
    commands.push({
      id: `gradient.${type}`,
      label: `Set gradient: ${label}`,
      group: "Gradient",
      keywords: ["gradient", "type", "look", type, ...tokenize(label)],
      run: () => useGradientStore.getState().setLook(type),
    });
  }

  for (const [flag, name] of Object.entries(EFFECT_TOGGLES) as [keyof typeof EFFECT_TOGGLES, string][]) {
    commands.push({
      id: `effect.${flag}`,
      label: `Toggle ${name} (${state[flag] ? "on" : "off"})`,
      group: "Effects",
      keywords: ["toggle", "effect", ...tokenize(name)],
      run: () => {
        const s = useGradientStore.getState();
        s.setDiscrete({ [flag]: !s[flag] });
      },
    });
  }

  for (const [key, { label }] of Object.entries(EFFECT_SWITCHES) as [EffectSwitchKey, { label: string }][]) {
    const name = label.toLowerCase();
    commands.push({
      id: `effect.${key}`,
      label: `Toggle ${name} (${isSwitchOn(state[key]) ? "on" : "off"})`,
      group: "Effects",
      keywords: ["toggle", "effect", ...tokenize(name)],
      run: () => {
        const s = useGradientStore.getState();
        s.setDiscrete(switchPatch(key, !isSwitchOn(s[key])));
      },
    });
  }

  // ── Presets ─────────────────────────────────────────────────────────────
  for (const preset of PRESETS) {
    commands.push({
      id: `preset.${preset.name.toLowerCase().replace(/\s+/g, "-")}`,
      label: `Load preset: ${preset.name}`,
      group: "Presets",
      keywords: [
        ...tokenize(preset.name),
        preset.category,
      ],
      run: () => useGradientStore.getState().loadPreset(preset.data),
    });
  }

  // ── Export ──────────────────────────────────────────────────────────────
  commands.push({
    id: "export.open",
    label: "Open Export\u2026",
    group: "Export",
    keywords: ["export", "download", "png", "css", "video", "webm", "gif"],
    shortcut: "E",
    run: () => ui.openExport(),
  });
  commands.push({
    id: "export.copy-share-url",
    label: "Copy share URL",
    group: "Export",
    keywords: ["copy", "link", "url", "share"],
    run: () => {
      void copyShareUrl(useGradientStore.getState());
    },
  });

  // ── Projects ────────────────────────────────────────────────────────────
  commands.push({
    id: "projects.open",
    label: "Open Projects\u2026",
    group: "Projects",
    keywords: ["projects", "save", "load"],
    shortcut: "P",
    run: () => ui.openProjects(),
  });

  // ── Help ────────────────────────────────────────────────────────────────
  commands.push({
    id: "help.shortcuts",
    label: "Keyboard shortcuts\u2026",
    group: "Help",
    keywords: ["help", "shortcuts", "keys", "hotkeys"],
    shortcut: "?",
    run: () => ui.openShortcuts(),
  });

  return commands;
}

// Exported for tests — ordering used by the palette UI.
export const COMMAND_GROUP_ORDER: CommandGroup[] = [
  "Playback", "Edit", "View", "Layers", "Gradient",
  "Effects", "Presets", "Export", "Projects", "Help",
];
