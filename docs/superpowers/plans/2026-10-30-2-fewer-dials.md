# Fewer Dials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the editor down to the Gradient tab plus three effects, so it stops feeling overwhelming, while every existing scene renders exactly as before.

**Architecture:** The sidebar shows three tabs (Gradient, Effects, Presets). 3D and Shader become "tool tabs" opened from the command palette, shown as a temporary fourth tab. The Effects panel is three switches: Bloom, Grain and Pointer. Grain and Pointer each show one slider while on. Every hidden effect a scene uses shows up under "Also in this scene" through the existing `SCENE_EXTRAS` table, extended to cover values as well as flags. The Mask section keeps its mode and shape, and the fine controls move behind a "More" disclosure.

**Tech Stack:** Next.js 16, React, Zustand (`lib/store.ts`), Tailwind, Vitest (node env, `apps/editor/lib/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-30-melt-strip-litt-design.md` (section 2).

## Global Constraints

- No schema, engine or URL format change. A hidden control never changes a scene: loading any share link, preset or project must give the same store values and the same frame as before.
- Setters: sliders use `set` while dragging and `commitSet` on release. Switches and selects use `setDiscrete`, one undo step each.
- Panel sections stay always open (`Section`). The new disclosure lives inside a section and is not a section.
- Never part of "Also in this scene": `colorProfile`, `hdrHeadroom`, `toneMapMode`, `debandEnabled`/`debandStrength` and `vignette`. Presets set these, so they belong to a look. Picking a look or preset still sets them.
- Grain switch on means `grain` is `0.03` (`INITIAL_EFFECTS.grain`). Pointer switch on means `mouseReact` is `0.5` (store default). Off writes `0`.
- Text colours meet WCAG AA. The only accent is `--color-accent`.
- `/editor` is prerendered, so the disclosure's open state is plain `useState(false)`, not storage.

## Review Focus

1. **A preset with grain 0.6 (Light Leak):** the Grain switch shows on with the slider at 0.6. Off then on writes 0.03, and undo returns 0.6. Pin it in `effect-switches.test.ts`.
2. **A share link with brightness 1.3 and a mouse trail:** the Effects tab lists "Brightness" and "Mouse Trail" under "Also in this scene", and each switch writes the default. Pin it in `scene-extras.test.ts`.
3. **Every shipped preset loads with no extras listed** (vignette and tone map are look fields). Pin it in `scene-extras.test.ts` by looping over `PRESET_CATALOG`.
4. **Keyboard 4 and 5 do nothing now,** and 1–3 still switch tabs while focus is outside inputs. Pin it in `commands.test.ts` (tab commands are exactly three, with shortcuts 1–3).
5. **A Custom GLSL scene opened from a link:** the Shader tool tab is reachable from the palette, and the shader keeps rendering while the sidebar is on another tab. Pin it by hand in Task 4, step 4.

---

### Task 1: Effect switches and extended scene extras

**Files:**
- Create: `apps/editor/lib/effect-switches.ts`
- Create: `apps/editor/lib/effect-switches.test.ts`
- Modify: `apps/editor/lib/scene-extras.ts`
- Modify: `apps/editor/lib/scene-extras.test.ts`

**Interfaces:**
- Produces:
  - `type EffectSwitchKey = "grain" | "mouseReact"`
  - `const EFFECT_SWITCHES: Record<EffectSwitchKey, { label: string; onValue: number }>`, with `grain: { label: "Grain", onValue: 0.03 }` and `mouseReact: { label: "Pointer", onValue: 0.5 }`
  - `function isSwitchOn(value: number): boolean` (value > 0)
  - `function switchPatch(key: EffectSwitchKey, on: boolean): Partial<GradientState>`
  - A `value(label, key, rest)` helper in `scene-extras.ts`, next to `flag`. It returns `{ label, isOn: s => s[key] !== rest, off: { [key]: rest } }`.

- [ ] **Step 1: Write the failing tests.**
  - `effect-switches.test.ts`:
    - `switchPatch("grain", true)` equals `{ grain: 0.03 }`.
    - `switchPatch("grain", false)` equals `{ grain: 0 }`.
    - `switchPatch("mouseReact", true)` equals `{ mouseReact: 0.5 }`.
    - `isSwitchOn(0.6)` is true and `isSwitchOn(0)` is false.
    - Apply `switchPatch("grain", false)` then `switchPatch("grain", true)` through `setDiscrete` to a store loaded with `lightLeak`, then call `undo()` twice. Expect `grain` back at 0.6.
  - `scene-extras.test.ts`:
    - A state with `brightness: 1.3, trailEnabled: true` lists `["Brightness", "Mouse Trail"]` (with `Mouse Trail` after `Brightness` in table order).
    - For every `PRESET_CATALOG` entry, `sceneExtrasOn` of the store after `loadPreset(entry.config)` is `[]`.
    - Keep the existing invert test passing.
- [ ] **Step 2: Run them.** Run `pnpm --filter editor test -- effect-switches scene-extras`. Expected: FAIL (module missing, labels missing).
- [ ] **Step 3: Implement.** Write `effect-switches.ts` as specified. Append to `SCENE_EXTRAS`, after the existing entries:
  - `value("Brightness", "brightness", 1)`
  - `value("Saturation", "saturation", 1)`
  - `value("Hue Shift", "hueShift", 0)`
  - `value("Chromatic Aberration", "chromaticAberration", 0)`
  - `flag("Blur", "blurEnabled")`
  - `flag("Click Ripple", "rippleEnabled")`
  - `flag("Mouse Trail", "trailEnabled")`
- [ ] **Step 4: Run them.** Run `pnpm --filter editor test -- effect-switches scene-extras`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add apps/editor/lib/effect-switches.ts apps/editor/lib/effect-switches.test.ts apps/editor/lib/scene-extras.ts apps/editor/lib/scene-extras.test.ts
git commit -m "List hidden colour, lens and pointer effects as scene extras"
```

### Task 2: Three-switch Effects panel

**Files:**
- Modify: `apps/editor/components/EffectsPanel.tsx`
- Modify: `apps/editor/lib/commands.ts`, `apps/editor/lib/commands.test.ts`
- Modify: `apps/editor/components/Onboarding.tsx:17`

**Interfaces:**
- Consumes: `EFFECT_SWITCHES`, `isSwitchOn` and `switchPatch` from Task 1.
- Produces: `PERFORMANCE_COMMANDS`, three `Command`s in group `"View"` with ids `view.performance.auto|quality|battery` and labels `Performance: Auto|Quality|Battery`. Each runs `setDiscrete({ performanceMode })` and is `disabled` when already current.

- [ ] **Step 1: Write the failing test.** In `commands.test.ts`, `getCommands(ui)` contains the three performance ids, and running `view.performance.battery` sets `performanceMode` to `"battery"`.
- [ ] **Step 2: Run it.** Run `pnpm --filter editor test -- commands`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add the performance commands.
  - Rewrite `EffectsPanel` as one section titled "Effects":
    - Bloom `Toggle` (`realBloomEnabled`, `setDiscrete`).
    - Grain `Toggle` (`isSwitchOn(grain)`, `setDiscrete(switchPatch("grain", on))`), and while on its existing Amount slider (0–1, step .01).
    - Pointer `Toggle` (`mouseReact`), and while on a Strength slider bound to `mouseReact`.
    - The HDR caption stays under Bloom when the scene has headroom.
    - Then the unchanged "Also in this scene" section.
  - Remove the Tone Mapping, Color, Lens, Click Ripple, Mouse Trail and Output controls.
  - Rewrite the Onboarding Effects line as: "Effects: bloom, grain and the pointer."
- [ ] **Step 4: Run tests and lint.** Run `pnpm --filter editor test && pnpm --filter editor lint`. Expected: PASS.
- [ ] **Step 5: Commit.**
```bash
git add apps/editor/components/EffectsPanel.tsx apps/editor/lib/commands.ts apps/editor/lib/commands.test.ts apps/editor/components/Onboarding.tsx
git commit -m "Cut the Effects tab to bloom, grain and pointer"
```

### Task 3: Mask behind "More"

**Files:**
- Create: `apps/editor/components/ui/Disclosure.tsx`
- Modify: `apps/editor/components/GradientPanel.tsx:148-188,327-367`

**Interfaces:**
- Produces: `Disclosure({ label: string; children: ReactNode })`. It's a `<button aria-expanded aria-controls>` with a rotating chevron, as in `PresetsPanel.tsx:65-75`, closed by default, with the children rendered only while open.

- [ ] **Step 1: Implement.**
  - The Mask section keeps the `Segmented` mode control (None, Shape, Text).
  - In Shape mode the shape `Select` stays visible. Position X/Y, Scale X/Y, Rotation, Feather, Invert, Corner Radius, Sides, Inner Radius and Noise Edge go inside `<Disclosure label="More">`.
  - In Text mode the text input stays visible. Size, Weight, Spacing and Align go inside the disclosure.
- [ ] **Step 2: Check by hand.** Run `pnpm dev`, open `/editor`, and set Mask to Shape. Only the shape picker and "More" show. "More" opens with the keyboard (Tab, Enter) and screen readers announce it as expanded. A slider drag inside is one undo step. Do the same for Text.
- [ ] **Step 3: Lint.** Run `pnpm --filter editor lint`. Expected: PASS.
- [ ] **Step 4: Commit.**
```bash
git add apps/editor/components/ui/Disclosure.tsx apps/editor/components/GradientPanel.tsx
git commit -m "Fold the mask's fine controls behind More"
```

### Task 4: Three tabs, plus 3D and Shader as tool tabs

**Files:**
- Modify: `apps/editor/lib/types.ts:1-9`
- Modify: `apps/editor/components/Sidebar.tsx`, `components/MobileDrawerBody.tsx:7,31-34`, `components/ShortcutsModal.tsx:18`
- Modify: `apps/editor/app/editor/page.tsx:44,127-129`
- Modify: `apps/editor/lib/commands.ts:121-130`, `apps/editor/lib/commands.test.ts:52-61`
- Modify: `CLAUDE.md` (Sidebar and Effects notes)

**Interfaces:**
- Produces:
  - `SIDEBAR_TABS = [gradient, effects, presets] as const`
  - `TOOL_TABS = [{ id: "scene", label: "3D" }, { id: "code", label: "Shader" }] as const`
  - `type SidebarTab = (typeof SIDEBAR_TABS | typeof TOOL_TABS)[number]["id"]`
  - `function isToolTab(tab: SidebarTab): boolean`

- [ ] **Step 1: Write the failing test.** In `commands.test.ts`, replace the 1–5 assertion:
  - The `view.tab.*` commands are exactly Gradient, Effects and Presets, with shortcuts "1", "2" and "3".
  - Commands `view.open.scene` ("Open 3D") and `view.open.code` ("Open Shader") exist with no shortcut, and run `ui.setTab("scene")` / `ui.setTab("code")`.
- [ ] **Step 2: Run it.** Run `pnpm --filter editor test -- commands`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Split the tab lists and add the open commands.
  - The key handler only matches `SIDEBAR_TABS`.
  - `Sidebar` renders the three tabs. When `activeTab` is a tool tab, it adds a fourth tab with that label and a close button (`aria-label="Close 3D"`) that sets `"gradient"`.
  - `PRELOAD` keeps the tool panels' preloaders on the palette commands' hover.
  - `MobileDrawerBody` shows only `SIDEBAR_TABS`.
  - `ShortcutsModal` reads "1 – 3".
  - Update CLAUDE.md: "3 tabs (Gradient, Effects, Presets), keys 1–3; 3D and Shader open from the command palette as a tool tab". The Effects tab is "Bloom, Grain, Pointer", plus extras.
- [ ] **Step 4: Run all checks and look.**
  - Run `pnpm lint && pnpm test && pnpm build`. Expected: PASS.
  - Then `pnpm dev`:
    - Keys 1–3 switch tabs, and 4 does nothing.
    - The palette's "Open Shader" shows a Shader tab, and closing it returns to Gradient.
    - Open a share link whose scene uses Custom GLSL and confirm it still renders.
    - Load every preset and confirm none lists an extra.
- [ ] **Step 5: Commit.**
```bash
git add apps/editor CLAUDE.md
git commit -m "Show three sidebar tabs; open 3D and Shader from the palette"
```
