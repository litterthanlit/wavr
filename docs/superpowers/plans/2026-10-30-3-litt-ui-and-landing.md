# litt.md UI and Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the editor with litt.md's tokens and components, and replace the landing page with a simple one built to litt's rules.

**Architecture:**
- litt's components install from its shadcn registry into `components/litt/` and `lib/litt/`, as its `workflows/build.md` prescribes.
- Wavr's own `components/ui/*` default exports become thin adapters over them. They keep Wavr's props and behaviour contracts, so the roughly 90 call sites don't change.
- Old `--color-*` names first alias litt tokens. A codemod then moves every class to litt names and the aliases are deleted, leaving one palette.
- The landing is rewritten. It has a live gradient hero, and its look links use a new `/editor?preset=<id>` entry.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Radix and `motion` (brought in by the litt registry), `geist` fonts, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-melt-strip-litt-design.md` (section 3). litt's sources are at `/home/user/litterthanlit/litt.md`, with rules in `skills/litt-md/taste/profile.md` (R1–R9), `system/foundations.md`, `system/material.md`, `system/components.md` and `workflows/build.md`.

## Global Constraints

- Follow litt R1–R9:
  - One light from the top.
  - Four depth steps, and no shadows on in-flow cards.
  - Motion has three tiers, and a view gets one expressive moment.
  - Sentence case.
  - One accent fill per view, on the primary action. Switches fill with `--fg`.
  - Colour only carries data.
  - Weights are 400/500/600 by role, and no text is above 18px.
  - 8px grid, 1px hairlines, radii of 4, 8 or pill, and controls of 32, 44 or 56. Tools may use `sm` (32).
- The accent is litt's cobalt `--accent` (#0957fd), exposed as `--color-accent`. It's the only accent.
- Both themes stay first-class on the existing `data-theme` attribute (`lib/useTheme.ts`). Text meets WCAG AA in both.
- Keep the contracts:
  - Slider is a WAI-ARIA slider with arrows, Page Up/Down and Home/End. A held key is one undo step. `format` units are unchanged.
  - Sliders call `set` while dragging and `commitSet` on release. Switches and selects use `setDiscrete`.
  - The GradientBar stays Wavr's own, restyled with tokens.
- Initial bundle rule (CLAUDE.md "Lazy UI"): dialogs and the command menu stay `next/dynamic` imports in `components/lazy.tsx`. `motion` must not grow the initial `/editor` chunk by more than the Slider and Switch adapters need. Check `next build` output.
- Hydration: no `localStorage` or `window` reads in a first render (the `?preset=` entry reads after hydration).
- The landing avoids litt's generic-AI tells:
  - decorative gradients other than the product itself
  - everything centred
  - three feature cards
  - `→` on links
  - uppercase mono eyebrows
  - an accent word in the headline
  - `transition-all`
  - scroll reveals and parallax

## Review Focus

1. **Holding an arrow key on a slider for two seconds** gives one undo step, not dozens (litt's Slider commits on every key move). Pin it with `commit-gate.test.ts` (Task 2).
2. **The OS in light mode, the app forced dark, and the reverse:** every surface and text colour follows. Pin it by hand in Task 1, step 5 and Task 5, step 4, in four combinations.
3. **`/editor?preset=unknown`** opens the normal initial scene, with no throw and no blank canvas. `?preset=` plus a `#s2.` hash lets the hash win. Pin it with `preset-entry.test.ts` (Task 6).
4. **The landing on a phone at 360px:** no horizontal scroll, the hero gradient fills its column, and a reduced-motion user sees a still frame. Pin it by hand in Task 7, step 4.
5. **A WebGL-less browser on the landing:** the hero shows the preset's thumbnail image, not an empty box. Pin it in Task 7, step 4.

---

### Task 1: Tokens, fonts and accent

**Files:**
- Modify: `apps/editor/app/globals.css`, `apps/editor/app/layout.tsx`, `apps/editor/package.json`
- Create: the registry's token and theme files, wherever `npx shadcn add` puts them (see `workflows/build.md:195-224`)

**Interfaces:**
- Produces:
  - litt token classes, available to every later task (`bg-litt-canvas`, `text-litt-fg-muted`, `rounded-litt-control` and so on, as the registry prefixes them).
  - The old Wavr names (`--color-root … --color-slider-track`, `tick-*`, `pill-*`) defined as aliases of litt tokens in one block marked `/* aliases: removed in Task 5 */`.

- [ ] **Step 1: Baseline.** Run `node /home/user/litterthanlit/litt.md/skills/litt-md/scripts/litt-check.mjs apps/editor/app apps/editor/components` and record the score in the commit message.
- [ ] **Step 2: Install.**
  - Run `npx shadcn@latest add https://littmd.vercel.app/r/<base>.json`, where `<base>` is the tokens/theme item named in `build.md`. `components.json` already exists.
  - If the registry is unreachable, copy `skills/litt-md/assets/tokens.css` and `tailwind.css` from the clone and apply the same `litt-` prefixing `gen-registry.mjs` does. Note which path you took in the commit.
  - Add `geist`, and load `GeistSans` and `GeistMono` in `layout.tsx`.
  - Set the theme-color meta from `--canvas`.
- [ ] **Step 3: Alias.** Point each old `--color-*` value at the nearest litt token:
  - root → canvas, base → surface-1, surface → surface-2, elevated → surface-3
  - border → line, border-active → line-strong
  - text-primary → fg, text-secondary → fg-muted, text-tertiary → fg-subtle
  - accent → accent, slider-track → slot
  - ticks → data-*, pill-* → block
  - Delete Wavr's two hand-written theme blocks.
- [ ] **Step 4: Build.** Run `pnpm --filter editor lint && pnpm --filter editor build`. Expected: PASS.
- [ ] **Step 5: Look.** Run `pnpm dev` and open `/editor` in light, dark and system theme under both OS settings. Every surface reads as litt stone, with no leftover indigo. Check the contrast of muted and subtle text on every surface.
- [ ] **Step 6: Commit.** Message: "Adopt litt tokens, Geist and the cobalt accent".

### Task 2: Slider on litt, with one undo step per held key

**Files:**
- Create: `apps/editor/lib/commit-gate.ts`, `apps/editor/lib/commit-gate.test.ts`
- Install: litt `slider` (`npx shadcn@latest add https://littmd.vercel.app/r/slider.json`)
- Modify: `apps/editor/components/ui/Slider.tsx` (it becomes an adapter, with the same default export and props)

**Interfaces:**
- Produces: `createCommitGate(commit: (v: number) => void): { keyDown(): void; keyUp(v: number): void; valueCommit(v: number): void; pointerUp(v: number): void }`.
  - While a key is held, `valueCommit` is swallowed.
  - `keyUp` commits once with the last value.
  - `pointerUp` and a `valueCommit` with no key held commit straight away.

- [ ] **Step 1: Write the failing test.** `commit-gate.test.ts`:
  - `keyDown`, then ten `valueCommit`s, then `keyUp(0.7)` calls `commit` once, with 0.7.
  - A `valueCommit(0.3)` with no key held commits once, with 0.3.
- [ ] **Step 2: Run it.** Run `pnpm --filter editor test -- commit-gate`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Write `createCommitGate`.
  - The `Slider` adapter renders litt's `Slider` with `label`, `min/max/step`, `value`, `onValueChange={onChange}`, `formatValue` from the `format` (`lib/units.ts`), and `onValueCommit` through the gate. It wires `onKeyDown` and `onKeyUp` on a wrapper.
  - Use `size` sm per litt's "compact tools".
- [ ] **Step 4: Run tests and look.** Run `pnpm --filter editor test`. Then in `pnpm dev`:
  - Hold → on Speed for two seconds, and confirm one Undo reverts it.
  - Check Page Up/Down and Home/End.
  - Confirm a screen reader reads the formatted value.
- [ ] **Step 5: Commit.** Message: "Build the editor slider on litt's, one undo step per held key".

### Task 3: Switch, Select, Segmented, Section, Toast and ColorInput on litt

**Files:**
- Install: litt `switch`, `select`, `segmented`, `toast`, `button`
- Modify: `apps/editor/components/ui/Toggle.tsx`, `Select.tsx`, `Segmented.tsx`, `Section.tsx`, `Toast.tsx`, `ColorInput.tsx`, `GradientBar.tsx` (tokens only)

**Interfaces:**
- Consumes: Task 1 tokens.
- Produces: the same default exports and props as today (`Toggle({label, checked, onChange})` and so on), now rendering litt's.
  - `Toggle` uses `tone="neutral"` (R6).
  - `Select` maps `group` options as litt's groups.
  - `Toast` keeps `{message, visible, onDismiss, duration}` and calls litt `toast()`, with `<Toaster>` mounted once in `app/editor/page.tsx`.

- [ ] **Step 1: Implement the adapters.** `Section` keeps `{title, aside, children}` and is always open. Its title uses litt's label style, sentence case and a hairline divider.
- [ ] **Step 2: Lint and build.** Run `pnpm --filter editor lint && pnpm --filter editor build`. Expected: PASS.
- [ ] **Step 3: Look.**
  - In `pnpm dev`, every toggle in Gradient, Effects and Presets flips with one undo step.
  - The mask mode `Segmented` still works.
  - Saving a project still shows a toast.
  - Both themes look right.
- [ ] **Step 4: Commit.** Message: "Put the editor's controls on litt components".

### Task 4: Tabs, dialogs and the command menu on litt

**Files:**
- Install: litt `tabs`, `dialog`, `command-menu`, `tooltip`, `kbd`
- Modify: `apps/editor/components/Sidebar.tsx` (litt `Tabs`, underline variant), `ExportModal.tsx`, `ProjectsModal.tsx`, `ShortcutsModal.tsx` (litt `Dialog` / `DialogContent title=…`), `CommandPalette.tsx` (litt `CommandMenu`), `TopBar.tsx` (litt `Button`, `Tooltip`)
- Modify: `apps/editor/package.json` (drop `cmdk` once unused)

**Interfaces:**
- Consumes: `getCommands(ui)` and `COMMAND_GROUP_ORDER` from `lib/commands.ts`, unchanged.
- Produces: `CommandPalette` maps commands to `groups: {id, heading, items: {id, label, shortcut, disabled}}[]` in `COMMAND_GROUP_ORDER`. `onSelect` runs the command. Command `keywords` go in each item's search text (if litt's menu has no keyword field, append them to `textValue`).

- [ ] **Step 1: Implement.**
  - The modals stay lazy with `useEverOpened`.
  - The Sidebar keeps the tool-tab behaviour from the dials plan.
  - The TopBar's single primary action (Export) is the view's one accent fill. Everything else is secondary or ghost.
- [ ] **Step 2: Run tests and build.** Run `pnpm --filter editor test && pnpm --filter editor build`. Expected: PASS. Compare the `/editor` first-load JS against the Task 3 build (no more than +25 kB gzip).
- [ ] **Step 3: Look.**
  - Cmd/Ctrl-K opens the menu, search finds "Open shader", and Enter runs it.
  - Export, Projects and Shortcuts open and close with Esc, and focus returns to the trigger.
  - Tabs switch with keys 1–3 and the arrow keys.
- [ ] **Step 4: Commit.** Message: "Move tabs, dialogs and the command menu to litt".

### Task 5: One palette (codemod, then delete the aliases)

**Files:**
- Create: `apps/editor/scripts/litt-classes.mjs`
- Modify: every `apps/editor/**/*.tsx` the codemod touches, and `app/globals.css` (delete the alias block)

**Interfaces:**
- Produces: `node apps/editor/scripts/litt-classes.mjs [--check]`, which rewrites old token classes to litt ones by the Task 1 table (`bg-root`→`bg-litt-canvas`, `text-text-secondary`→`text-litt-fg-muted` and so on). It handles every Tailwind prefix (`bg-`, `text-`, `border-`, `ring-`, `fill-`, `stroke-`, `from-/to-`, with modifiers such as `hover:` and `/50`). With `--check` it exits 1 if any old name remains.

- [ ] **Step 1: Write and run the codemod.** Run `node apps/editor/scripts/litt-classes.mjs && node apps/editor/scripts/litt-classes.mjs --check`. Expected: exit 0.
- [ ] **Step 2: Delete the alias block.** Then run `pnpm --filter editor lint && pnpm --filter editor build`. Expected: PASS.
- [ ] **Step 3: Score.** Run `node /home/user/litterthanlit/litt.md/skills/litt-md/scripts/litt-check.mjs --min 90 apps/editor/app apps/editor/components`. Expected: exit 0. Fix findings in Wavr's own files until it passes. Installed litt files are skipped.
- [ ] **Step 4: Look.** Check both themes under both OS settings, the whole editor and every modal. Confirm there are no unstyled or transparent surfaces.
- [ ] **Step 5: Commit.** Message: "Move every class to litt tokens and drop the old palette".

### Task 6: Open the editor on a preset

**Files:**
- Create: `apps/editor/lib/preset-entry.ts`, `apps/editor/lib/preset-entry.test.ts`
- Modify: `apps/editor/app/editor/page.tsx` (call it after hydration, alongside `applyHashToStore`)

**Interfaces:**
- Produces: `presetFromSearch(search: string, hash: string): PresetId | null`. It returns the id when `?preset=` names an entry of `PRESET_CATALOG` and the hash is empty. Otherwise it returns `null`.
  - The page then calls `loadPreset(entry.config)` and `history.replaceState` to drop the query, so `url-sync` writes the hash as usual.
  - The catalogue loads with a dynamic import, so presets stay out of the initial bundle.

- [ ] **Step 1: Write the failing test.**
  - `presetFromSearch("?preset=lightLeak", "")` is `"lightLeak"`.
  - `presetFromSearch("?preset=nope", "")` is `null`.
  - `presetFromSearch("?preset=lightLeak", "#s2.abc")` is `null`.
- [ ] **Step 2: Run it.** Run `pnpm --filter editor test -- preset-entry`. Expected: FAIL.
- [ ] **Step 3: Implement it and wire it in.**
- [ ] **Step 4: Run tests and look.** Run `pnpm --filter editor test`. Then in `pnpm dev`:
  - `/editor?preset=plasmaOrb` opens the orb with the URL rewritten to a hash, and Back does not loop.
  - `/editor?preset=nope` opens the initial scene.
- [ ] **Step 5: Commit.** Message: "Open the editor on a preset from ?preset=".

### Task 7: The landing page

**Files:**
- Modify: `apps/editor/app/page.tsx` (full rewrite, still a client component)
- Create: `apps/editor/components/LandingHero.tsx` (the live gradient)

**Interfaces:**
- Consumes: `createGradient` and `attachPointer` from `@wavr/core`, the preset configs from the catalogue, `/presets/<id>.webp` thumbnails, and `?preset=` from Task 6.
- Produces: `LandingHero({ preset: PresetId })`.
  - It renders the preset live in a `<canvas>`, using `requestAnimationFrame` and a ref (no engine in state).
  - It shows the thumbnail `<img>` until the first frame, and keeps it if WebGL is unavailable.
  - It honours `prefers-reduced-motion` with a still frame, and pauses when off screen (`IntersectionObserver`).

- [ ] **Step 1: Build the page.** Use litt's 12-column grid, airy spacing (`py-section`) and Geist, with all text at or below 18px:
  - **Glass header:** "Wavr" in a 500 weight, one ghost GitHub link, one secondary "Open editor".
  - **Hero:**
    - Copy in columns 1–5: one 18px headline in sentence case and one muted line. Both are quiet and exact, with no feature list.
    - One `lg` primary button "Open editor" → `/editor`.
    - The `LandingHero` in columns 7–12 on `aperture`.
  - **Looks:** a row of four thumbnails (aperture, lightLeak, plasmaOrb, lightWall). Each is a link to `/editor?preset=<id>` with its name in sentence case below it, and no arrows.
  - **Footer:** one hairline above, plus the licence and GitHub link.
  - Delete `DitherCanvas`, the stats, the feature grid, the "Create → Effect → Export" strip and every mention of retired effects.
- [ ] **Step 2: Build and score.** Run `pnpm --filter editor build && node /home/user/litterthanlit/litt.md/skills/litt-md/scripts/litt-check.mjs --min 90 apps/editor/app apps/editor/components`. Expected: PASS.
- [ ] **Step 3: Self-critique.** Follow litt's `workflows/critique.md` on a screenshot of `/` in both themes at 1440 and 360 wide. Fix anything scored below pass.
- [ ] **Step 4: Review Focus checks.**
  - 360px: no horizontal scroll.
  - Reduced motion gives a still hero.
  - With WebGL disabled (`--disable-webgl` in Playwright) the thumbnail shows.
  - Each look link opens that preset.
  - Lighthouse accessibility is at least 95.
- [ ] **Step 5: Commit.** Message: "Rebuild the landing to litt's rules".
