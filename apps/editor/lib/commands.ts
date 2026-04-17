/**
 * commands.ts — palette action registry (spec 0005).
 *
 * Every palette-invokable action is a `Command` record. `getCommands(ui)` is a
 * pure function that returns a fresh list built from the live store at call
 * time, so it always reflects current state (layer count, effect toggles, etc.)
 * without closures going stale. `ui` holds modal-open callbacks owned by the
 * editor page.
 */

import { useGradientStore, canUndo, canRedo, GradientState } from "./store";
import { copyShareUrl } from "./url";
import { PRESETS } from "./presets";
import { MAX_LAYERS } from "@wavr/core";
import type { LayerParams } from "@wavr/core";
import type { SidebarTab } from "./types";

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
// Keep in sync with LayerParams["gradientType"]. Image requires a file-upload
// payload the palette can't provide; stays reachable via the Gradient panel.
const GRADIENT_TYPES: Exclude<LayerParams["gradientType"], "image">[] = [
  "mesh", "radial", "linear", "conic", "plasma",
  "dither", "scanline", "glitch", "voronoi",
];

// ── Effect flags on the store root. Hand-listed per spec; any missing field
// (e.g. `debandEnabled` before that PR merges) is skipped at runtime via the
// `typeof` guard in `getCommands`. ────────────────────────────────────────
const EFFECT_FLAGS = [
  "noiseEnabled", "bloomEnabled", "blurEnabled", "curlEnabled",
  "kaleidoscopeEnabled", "reactionDiffEnabled", "pixelSortEnabled",
  "feedbackEnabled", "asciiEnabled", "ditherEnabled", "parallaxEnabled",
  "threeDEnabled", "meshDistortionEnabled", "rippleEnabled", "glowEnabled",
  "causticEnabled", "liquifyEnabled", "trailEnabled", "realBloomEnabled",
  "debandEnabled",
] as const;

type EffectFlag = (typeof EFFECT_FLAGS)[number];

const EFFECT_LABELS: Record<EffectFlag, string> = {
  noiseEnabled: "noise",
  bloomEnabled: "bloom",
  blurEnabled: "blur",
  curlEnabled: "curl",
  kaleidoscopeEnabled: "kaleidoscope",
  reactionDiffEnabled: "reaction-diffusion",
  pixelSortEnabled: "pixel sort",
  feedbackEnabled: "feedback",
  asciiEnabled: "ASCII",
  ditherEnabled: "dither",
  parallaxEnabled: "parallax",
  threeDEnabled: "3D",
  meshDistortionEnabled: "mesh distortion",
  rippleEnabled: "ripple",
  glowEnabled: "glow",
  causticEnabled: "caustic",
  liquifyEnabled: "liquify",
  trailEnabled: "trail",
  realBloomEnabled: "real bloom",
  debandEnabled: "deband",
};

// Dev-only: tracks EFFECT_FLAGS entries we've already warned about, so each
// missing flag produces exactly one console.warn per session — not one per
// palette open. Cleared on module load; intentionally module-scoped.
const warnedMissingFlags = new Set<EffectFlag>();

// Tabs (keep local — the ordering matters for labels).
const TABS: { id: SidebarTab; label: string; shortcut: string }[] = [
  { id: "gradient", label: "Gradient", shortcut: "1" },
  { id: "effects", label: "Effects", shortcut: "2" },
  { id: "presets", label: "Presets", shortcut: "3" },
  { id: "code", label: "Code", shortcut: "4" },
];

// camelCase → [lower tokens]: "sunsetBloom" → ["sunset", "bloom"].
function tokenize(camel: string): string[] {
  return camel
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  for (const tab of TABS) {
    commands.push({
      id: `view.tab.${tab.id}`,
      label: `Switch to ${tab.label} tab`,
      group: "View",
      keywords: ["tab", "panel", "switch", tab.id],
      shortcut: tab.shortcut,
      run: () => ui.setTab(tab.id),
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

  // ── Gradient types (9, no image) ────────────────────────────────────────
  for (const type of GRADIENT_TYPES) {
    commands.push({
      id: `gradient.${type}`,
      label: `Set gradient: ${titleCase(type)}`,
      group: "Gradient",
      keywords: ["gradient", "type", type],
      run: () => useGradientStore.getState().setLayerParam({ gradientType: type }),
    });
  }

  // ── Effects (one toggle per effect flag present on the store) ──────────
  const stateRecord = state as unknown as Record<string, unknown>;
  for (const flag of EFFECT_FLAGS) {
    // Guard: skip flags the current store build doesn't have yet. In dev,
    // warn once so a typo in EFFECT_FLAGS (e.g. "noizeEnabled") surfaces
    // instead of being silently dropped by the typeof check. Gated on
    // process.env.NODE_ENV so production builds don't pay the string cost.
    if (typeof stateRecord[flag] === "undefined") {
      if (process.env.NODE_ENV !== "production" && !warnedMissingFlags.has(flag)) {
        warnedMissingFlags.add(flag);
        // eslint-disable-next-line no-console
        console.warn(
          `[commands] EFFECT_FLAGS entry "${flag}" is not present on the store. ` +
          `Typo? Or did an effect's enabled field get renamed? ` +
          `The palette row for this effect will be skipped until it's fixed.`,
        );
      }
      continue;
    }
    const name = EFFECT_LABELS[flag];
    commands.push({
      id: `effect.${flag}`,
      label: `Toggle ${name}`,
      group: "Effects",
      keywords: ["toggle", "effect", ...tokenize(name)],
      // Label extension: "(on)" / "(off)" — computed in getter because the
      // `Command.label` is static for this snapshot. We append post-hoc here
      // so palette rows read "Toggle bloom (on)" at open time.
      run: () => {
        const s = useGradientStore.getState() as unknown as Record<string, unknown>;
        const current = Boolean(s[flag]);
        useGradientStore.getState().setDiscrete({
          [flag]: !current,
        } as Partial<GradientState>);
      },
    });
    // Patch the label to include the current state (computed from the
    // snapshot we already took).
    const cmd = commands[commands.length - 1];
    const current = Boolean((state as unknown as Record<string, unknown>)[flag]);
    cmd.label = `Toggle ${name} (${current ? "on" : "off"})`;
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
