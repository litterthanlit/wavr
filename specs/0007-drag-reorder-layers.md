# Spec 0007 — Drag-to-reorder layers

> **Status:** Draft
> **Blocks:** Step 1 completion in HANDOFF.md
> **Scope:** Layers only. Effect-stack drag-reorder is **out of scope** — see §8.
> **Effort estimate:** half-day.

---

## 1. The question the review asked — answered upfront

> "Does drag change the rendering order (schema change, effects become an ordered array) or just the UI presentation order (no schema change)?"

**For layers: it changes the rendering order, and that's free.** `GradientConfig.layers` is already `z.array(LayerConfig).min(1).max(4)`. The order IS the data. The engine already composites layers in array order. The store already exposes `moveLayer(from, to)`. Drag-reorder is a UI layer that calls the existing action.

**Zero schema changes. Zero engine changes. Zero migration burden.**

No new bounds tests, no goldens to regenerate, no URL-codec impact (the existing codec already round-trips `layers` in order).

For effects: the answer is the opposite. See §8.

---

## 2. What this delivers

HANDOFF.md Step 1: *"Drag-to-reorder layers and effect stack (`@dnd-kit/core`)."*

This PR covers the **layers** half. Drag a layer row in the LayerPanel to reorder; the active gradient render updates instantly; the URL hash reflects the new order within the 200 ms debounce; undo/redo steps back through reorders atomically.

Effect-stack reorder is punted to a future spec (0008 probably) because it's a different-shaped problem.

---

## 3. Architecture

### 3.1 Files

```
apps/editor/
├── components/
│   ├── LayerPanel.tsx            ← modified: wrap rows in DnD, handle reorder
│   └── LayerRow.tsx              ← new if currently inlined; sortable item
└── package.json                  ← adds @dnd-kit/core + @dnd-kit/sortable
```

### 3.2 Library — `@dnd-kit/core` + `@dnd-kit/sortable`

Industry standard. Small (~10 KB gzipped combined). Accessible out of the box (keyboard reordering via arrow keys + space). Used by Linear's sub-issue list, Notion's block DnD, countless others.

`@dnd-kit/sortable` is the vertical-list preset on top of core. We use it; don't hand-roll.

Install: `pnpm --filter editor add @dnd-kit/core @dnd-kit/sortable`.

### 3.3 Store integration

`moveLayer(from: number, to: number)` already exists on the store. Action pushes history (so undo/redo work automatically per spec 0003's taxonomy) and calls `deriveActiveLayerFields` to keep the derived active-layer state aligned after the index shift.

Drag-end handler computes `from` (dragged item's original index) and `to` (drop target's index) and calls `moveLayer(from, to)`. Nothing else.

### 3.4 Drag affordance

Reuse the existing drag-handle icon pattern (or a new 6-dot grabber icon) on the left of each layer row. Only the handle starts a drag — clicking anywhere else on the row still selects the layer. This prevents "tried to click to select, got dragged" accidents.

Visual during drag:
- Dragged row: 50% opacity + slight translate offset (dnd-kit default).
- Drop target gap: a 2px accent line between rows (tailwind `border-accent`).
- Active row indicator preserves its highlight — user's selection follows them through the reorder.

---

## 4. Accessibility

`@dnd-kit/sortable` ships with a `KeyboardSensor` that handles:
- Tab to the drag handle.
- Space / Enter to pick up the item (enters "keyboard drag" mode).
- Arrow Up / Down to move.
- Space / Enter to drop.
- Esc to cancel.

We configure screen-reader announcements (`screenReaderInstructions`) with the default dnd-kit strings — they're already well-tuned. VoiceOver says "Picked up layer 2. Current position 2 of 4. Use arrow keys to move."

### 4.1 Reduced-motion

Respect `prefers-reduced-motion`: dnd-kit's `defaultAnimateLayoutChanges` is opt-in. We pass a reduced-motion check into `useSortable` to disable the layout transition. One extra line.

---

## 5. Interaction details

### 5.1 Single-layer case

When `layers.length === 1`, no drag is possible (nothing to reorder). Hide the drag handle on the lone row; `useSortable` is still mounted but `isDragging` is always false.

### 5.2 Active layer bookkeeping

After `moveLayer(from, to)`:
- If the moved layer was the active one → `activeLayerIndex` becomes `to`.
- If the moved layer was above the previous active and crossed over → `activeLayerIndex` shifts by ±1.
- Store's existing `moveLayer` already handles this (see `store.ts` ~line 616). Don't reimplement.

### 5.3 Undo/redo

**Confirmed:** layer drag triggers an undo history commit. `moveLayer` in `apps/editor/lib/store.ts` (line 615) calls `markPushPoint()` + `flushPending()` + `pushHistory(takeSnapshot(current))` before mutating state. That matches every other discrete store action. ⌘Z after a drag restores the previous layer order and `activeLayerIndex`; ⌘⇧Z replays the reorder. Zero new wiring — drag-end just calls the existing action.

### 5.4 URL sync

The URL subscriber in `url-sync.ts` sees `layers` change, encodes, writes a new history entry. Since `moveLayer` is a discrete action, it calls `markPushPoint()` (per spec 0003 §3.3), so each reorder gets its own `pushState` — back-button walks through reorders one by one.

No changes to url-sync. No changes to migrate. No changes to the encoded format.

---

## 6. Acceptance criteria

- [ ] With 3 layers, grab the handle on layer 2, drag above layer 1, release. Layers now read 2, 1, 3. Render reflects the new composition order immediately.
- [ ] `window.location.hash` updates within 300 ms of the drop.
- [ ] ⌘Z returns to 1, 2, 3 order. ⌘⇧Z restores the reordered state.
- [ ] Browser back button after a reorder steps back to the pre-reorder order.
- [ ] Tab to a drag handle, press Space, press ArrowDown, press Space. Layer moves down one position. Screen reader announces each step.
- [ ] Single-layer state has no visible drag handle.
- [ ] Layer selection survives a reorder: if layer 2 was active and you drag it to position 3, the "active" highlight follows to the new position 3.
- [ ] `prefers-reduced-motion: reduce` disables the drop animation; the reorder still happens, just without the slide.
- [ ] `pnpm --filter editor lint` no new errors.
- [ ] `pnpm --filter editor test` green. Add a `LayerPanel.test.ts` that asserts a programmatic drag-end handler calling `store.moveLayer(from, to)` produces the expected `state.layers` ordering.
- [ ] `pnpm --filter editor build` clean.

---

## 7. Out of scope (in this PR)

- **Effect-stack drag-reorder.** Different problem, separate spec. See §8.
- Keyboard shortcuts beyond dnd-kit defaults (no `⌘↑`/`⌘↓` for "move active layer up/down"). Palette commands could expose those later.
- Drag-and-drop between layers panel and other surfaces (dragging a layer into an export, a preset, etc). None of those surfaces exist yet.
- Virtualization of the layer list. `MAX_LAYERS = 4`. Not a thing.
- Multi-select + bulk reorder. Same reason.

---

## 8. Effect-stack drag-reorder — **out of scope, flagged as its own spec**

### 8.1 Why it's different

Effects live on `GradientConfig` as named optional object groups (`noise?: NoiseEffect`, `bloom?: BloomEffect`, etc.). Object keys have no stable order. The engine applies effects in a hardcoded order via a long `if` chain in `fragment.glsl` (lines 1258–1601, confirmed in code review).

Reordering effects changes what pixel you get — `bloom → chromatic aberration` looks different from `chromatic aberration → bloom`. If the UI gives users a drag-to-reorder handle on effects, we must either:

1. **Ship UI-only ordering** — the panel lets users sort the presentation order but the render is still engine-fixed. Matches nothing Photoshop/After Effects users expect. **Not recommended.**
2. **Make effects an ordered array** — schema refactor, engine refactor, V1/V2 URL migration, regenerate every preset. **Real work, real scope.**

### 8.2 What the future spec must answer

The next ticket/spec owner should resolve:

- Schema shape. Options: `effects: EffectConfig[]` (each `EffectConfig` is a discriminated union on `type`) vs. keeping named groups but adding an `effectOrder: (keyof effects)[]` side-field.
- Engine refactor. The `if` chain becomes a loop over a runtime-populated list. Performance: 20+ branches per frame is already what we do today, no regression expected.
- Migration. Every V1 URL + every preset in `packages/core/src/presets/*.ts` needs a canonical order injected. `migrate()` in `@wavr/schema` gains an order-injection rule.
- Parity goldens. Every rendered fixture with effects enabled needs regeneration. `parity-generate` workflow dispatch.

### 8.3 Estimated effort

One to two weeks. Real migration PR, not a drag-in-one-file change. Gets its own spec.

### 8.4 What we ship in the meantime

The EffectsPanel groups effects into logical sections (Texture / Light / Distortion / ...). That grouping is already done via `<Section>` headers in `EffectsPanel.tsx`. Users can collapse sections they don't use. Until per-effect drag lands, this serves as the "organization" affordance. It's not equivalent to reorder, but it's the nearest thing available without the refactor.

---

## 9. Implementation order

1. `pnpm --filter editor add @dnd-kit/core @dnd-kit/sortable`.
2. Refactor `LayerPanel.tsx` rows into a `<SortableLayerRow>` component if not already one.
3. Wrap the list in `<DndContext>` + `<SortableContext>`.
4. Wire `onDragEnd` → `store.moveLayer(oldIndex, newIndex)`.
5. Add drag handle + reduced-motion gating + screen-reader strings.
6. Unit test: `LayerPanel.test.ts` verifies the moveLayer call is made with correct indices on a mock drag-end event.
7. Verify: lint + build + tests + manual acceptance walkthrough (§6).

---

## 10. Open questions

- **Drag handle styling** — 6-dot grabber (Notion) vs hamburger (Linear) vs full-row drag (riskier)? Default to 6-dot; cheap and unambiguous.
- **Does layer count change (add/remove) break an in-flight drag?** dnd-kit's default is to abort. Verify; no custom handling needed if so.
- **Should the layer panel show layer numbers that update live during drag, or only after drop?** Update live — matches the "wysiwyg reorder" feel Linear/Notion have.
