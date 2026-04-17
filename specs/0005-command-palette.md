# Spec 0005 — ⌘K command palette

> **Status:** Draft
> **Blocks:** Step 1 completion in HANDOFF.md
> **Depends on:** existing editor state (store, TopBar, Sidebar, presets).
> **Related:** spec 0003 (URL-state) — palette actions go through the same store paths, no URL-sync changes.

---

## 1. What this delivers

HANDOFF.md Step 1: *"Command palette (⌘K): fuzzy search over every action, preset, and effect. Use `cmdk` or a hand-rolled equivalent. Every sidebar control must also be invokable from here."*

Concrete UX promise:
- Press ⌘K anywhere in the editor (even in an input) → palette opens, search focused.
- Type "rand", press Enter → randomize fires.
- Type "mid", press Enter → Midnight preset loads.
- Type "bloom", press Enter → toggles bloom.
- Type "plasma", press Enter → sets active layer's gradient type to plasma.
- Every existing single-key shortcut (space, r, e, p, ?, 1–4) has a palette equivalent.

Keyboard navigation inside the palette: ↑/↓ to navigate, Enter to execute, Esc to close. Same semantics as Linear/Raycast/Vercel.

---

## 2. Library choice

**Use `cmdk`** (the Vercel-maintained palette primitive, ~4 KB gzipped). Industry standard: Vercel dashboard, Linear, Cal.com, all ship it. Has sensible defaults for fuzzy ranking, keyboard nav, accessibility (ARIA combobox). Hand-rolling is doable but the accessibility surface alone makes it not worth it.

Install: `pnpm --filter editor add cmdk`.

No other deps. No fuzzy-search library — cmdk has one built in.

---

## 3. Architecture

### 3.1 Files

```
apps/editor/
├── components/
│   └── CommandPalette.tsx        ← new, ~200 lines
├── lib/
│   ├── commands.ts               ← new, action registry
│   └── commands.test.ts          ← new, registry integrity
└── app/editor/page.tsx           ← modified: ⌘K binding + mount
```

### 3.2 Action registry (`lib/commands.ts`)

Every palette-invokable action is a `Command` object:

```ts
export interface Command {
  id: string;                    // stable, kebab-case: "layer.add", "preset.midnight"
  label: string;                 // human shown in the row: "Add layer", "Load preset: Midnight"
  group: CommandGroup;           // for section headers in the palette
  keywords?: string[];           // extra fuzzy-match terms the label doesn't cover
  shortcut?: string;             // display-only hint, e.g. "⌘Z", " "
  icon?: ReactNode;              // optional leading icon
  run: () => void;               // invoked on Enter
  disabled?: () => boolean;      // gates the action (e.g. "undo" when history empty)
}

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
```

The registry is a **function** `getCommands(ui: UiActions): Command[]` that returns a fresh list per palette open — avoids stale closures. Each command's `run` closure calls `useGradientStore.getState().whatever()` at invocation time, so it sees current state without needing the store passed in. `ui` is only for modal-toggle callbacks (`openExport`, `openProjects`, `openShortcuts`) that live outside the store.

### 3.3 Command sources

- **Playback:** play/pause, randomize.
- **Edit:** undo (disabled when `canUndo()` false), redo (disabled when `canRedo()` false).
- **View:** switch sidebar tab × 4 (Gradient / Effects / Presets / Code).
- **Layers:** add layer (disabled at MAX_LAYERS), remove active layer, select layer N (one row per existing layer).
- **Gradient:** set active layer's gradient type × 9 (mesh, radial, linear, conic, plasma, dither, scanline, glitch, voronoi). **`image` is excluded** — it needs a file upload payload the palette can't provide; stays reachable via the image upload button in the Gradient panel.
- **Effects:** one toggle per effect group present on `GradientConfig`. The registry introspects the store's effect-enabled flags at call time and emits one command per — no hardcoded count. Label reads "Toggle [name]" with a suffix indicating current state: "Toggle bloom (on)" / "(off)". As effects ship (e.g. `deband` from spec 0004), they automatically appear without spec revision.
- **Presets:** every entry in `packages/core/src/presets/all.ts`. Label: "Load preset: [name]".
- **Export:** open Export modal, copy share URL.
- **Projects:** open Projects modal, save current as preset (disabled if no name entered — opens modal first).
- **Help:** open Shortcuts modal.

Rough count: Playback 2, Edit 2, View 4, Layers ≤ 2 + MAX_LAYERS, Gradient 9, Effects ≈ 19–20 (depending on what's shipped), Presets ≈ 30 (whatever `all.ts` exports), Export 2, Projects 2, Help 1 — roughly **75–80 total**. cmdk handles this trivially fast.

### 3.4 Palette component (`components/CommandPalette.tsx`)

Thin wrapper around cmdk's `<Command>` primitive. Dark theme mirrors the existing modal styling (border, rounded-xl, glass-blur). Structure:

```tsx
<Command.Dialog open={open} onOpenChange={onOpenChange} label="Command palette">
  <Command.Input placeholder="Type a command or search..." autoFocus />
  <Command.List>
    <Command.Empty>No matches.</Command.Empty>
    {groupedCommands.map((group) => (
      <Command.Group key={group.name} heading={group.name}>
        {group.items.map((cmd) => (
          <Command.Item
            key={cmd.id}
            value={`${cmd.label} ${cmd.keywords?.join(" ") ?? ""}`}
            onSelect={() => { cmd.run(); onOpenChange(false); }}
            disabled={cmd.disabled?.()}
          >
            {cmd.icon}
            <span>{cmd.label}</span>
            {cmd.shortcut && <kbd>{cmd.shortcut}</kbd>}
          </Command.Item>
        ))}
      </Command.Group>
    ))}
  </Command.List>
</Command.Dialog>
```

Styling: use the existing `components/ui` tokens. The palette should feel like it belongs — border color, font, spacing all match the Sidebar and Modals.

### 3.5 Binding ⌘K

`apps/editor/app/editor/page.tsx`'s `handleKeyDown`:
- **⌘K / Ctrl-K** → open palette. **Override the "ignore in INPUT/SELECT/TEXTAREA" early-return** for this specific combo — the palette should work from anywhere, including inside a text input (standard industry behavior; Linear/Raycast/VS Code all do this).
- All other existing shortcuts stay exactly as they are.

---

## 4. Accessibility

cmdk provides the heavy lifting: role=combobox, aria-activedescendant, keyboard navigation, focus trap when Dialog is open. We layer in:
- Labeled by "Command palette" (visually hidden label).
- Items have accessible names from their `value` prop.
- Disabled items are announced as such.
- Escape closes and returns focus to whatever triggered the open.

No extra work beyond using cmdk's primitives correctly.

---

## 5. Behavior details

### 5.1 Disabled commands

Stay in the list, greyed out, not keyboard-selectable. Example: "Undo" with no history → label shows greyed; pressing Enter on it does nothing (cmdk handles the gate).

### 5.2 Stateful labels

"Toggle bloom" shows "(on)" or "(off)" at the end of the label based on current store state. Regenerated on every palette open — stale state can't leak because `getCommands()` reads fresh.

### 5.3 Layer selection

Each existing layer gets its own "Select layer N" row. Layers count changes (add/remove) → next palette open reflects the current count.

### 5.4 Fuzzy matching

cmdk's default scoring: exact matches > prefix > substring > fuzzy. Works well for:
- "mid" → Midnight preset (prefix match on keyword)
- "plasma" → Gradient: plasma (exact substring)
- "cmd z" → Undo (shortcut display matches)
- "effects 2" → Switch to Effects tab (label contains "2")

### 5.5 Performance

77 commands × fuzzy ranking on keystroke is trivially fast (cmdk uses a linear scan + memoized scores). No virtualization needed.

### 5.6 Preset keywords (no preset-file changes)

Derive keywords automatically at registry-build time from two sources:
- The category filename the preset came from (`classic`, `abstract`, `cinematic`, `dither`, `glitch`, `nature`, `scanline`) — exposes "show me all nature presets" queries.
- The preset's own camelCase variable name tokenized on case boundaries ("midnight" → ["midnight"], "sunsetBloom" → ["sunset", "bloom"]).

No changes to preset source files. Hand-tuned mood keywords ("dark", "moody", "neon") are a follow-up PR if users complain searches miss — this spec ships with filename-plus-variable coverage, which handles ~80% of natural queries.

---

## 6. What stays the same

- Every existing single-key shortcut keeps working. Palette is **additive**, not a replacement for hotkeys.
- Existing modals (Export, Projects, Shortcuts) are unchanged.
- No URL-state changes. The palette calls the same store actions the sidebar clicks do; spec 0003's subscriber handles the URL.
- No schema changes. Palette actions operate entirely on the editor's mutable state.

---

## 7. Acceptance criteria

- [ ] Press ⌘K anywhere; palette opens with focused input and a full command list.
- [ ] Type "rand" + Enter → randomize fires, palette closes.
- [ ] Type "mid" + Enter → Midnight preset loads.
- [ ] Type "bloom" + Enter → bloom toggles (verify by opening palette again and confirming the "on/off" suffix flipped).
- [ ] Type "plasma" + Enter → active layer's gradient type is now plasma.
- [ ] Undo with no history → "Undo" row is visible but greyed out; pressing Enter on it is a no-op.
- [ ] Add 4 layers (MAX_LAYERS); "Add layer" command is disabled.
- [ ] Press ⌘K from inside a text input (e.g. project name field in Projects modal); palette still opens.
- [ ] Press Esc inside palette; closes, focus returns to previously focused element.
- [ ] `pnpm --filter @wavr/schema test` 96 passing (unchanged).
- [ ] `pnpm --filter editor test` passes, includes a new `commands.test.ts` that smoke-checks the registry: every command has a non-empty `id`, `label`, `group`, and callable `run`; ids are unique; at least one command exists in every group; preset count equals `Object.keys(allPresets).length`.
- [ ] `pnpm --filter editor build` clean.
- [ ] No new `pnpm --filter editor lint` errors beyond the pre-existing baseline in `Onboarding.tsx`, `ProjectsModal.tsx`, `ColorInput.tsx`.

---

## 8. Out of scope

- Custom ranking tuning beyond cmdk defaults.
- Per-command keyboard shortcuts beyond the existing hotkey set.
- "Recent commands" history (ships as a second-pass polish if users ask).
- Macros / multi-step commands.
- Command categories as deep-linkable URL fragments.

---

## 9. Implementation order

1. `pnpm --filter editor add cmdk`.
2. `apps/editor/lib/commands.ts` — define `Command` type, `CommandGroup` enum, and `getCommands(store, ui)` factory. All ~77 commands hand-listed.
3. `apps/editor/lib/commands.test.ts` — unit test: every command has required fields, no duplicate ids, preset count matches `all.ts`, effect count is 20.
4. `apps/editor/components/CommandPalette.tsx` — cmdk wrapper, dark styling matching the editor.
5. `apps/editor/app/editor/page.tsx` — add `paletteOpen` state, ⌘K binding at the top of `handleKeyDown` (before the INPUT short-circuit), mount `<CommandPalette>` alongside other modals.
6. Verify: build + tests + manual walk through the acceptance list.

---

## 10. Open questions

- **Keyboard hint display for ⌘K in ShortcutsModal** — add a new row? Yes, almost certainly; a `/help` or `?` palette entry would orient new users. One line in the ShortcutsModal list, one line in the palette registry.
- **Should "Open command palette" appear in the palette itself?** Yes — standard convention (VS Code does this). No-op when invoked from within the palette since closing the palette already releases focus.
- **Grouping order in the palette** — default to the order in the `CommandGroup` union above (Playback first, Help last). Matches how users scan top-down when browsing.
