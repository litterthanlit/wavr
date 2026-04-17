# Ticket 0001 — Export `getNumericBounds(path)` from `@wavr/schema`

> **Status:** Open
> **Priority:** **Blocks Step 2** (npm publish of `@wavr/gradient` + `@wavr/gradient-react`)
> **Filed by:** review of spec 0006 (keyboard-scrub)
> **Effort estimate:** half-day for the schema export + refactor sweep

---

## Problem

Every `<Slider>` call site today carries its own hard-coded `min` / `max` / `step`. Example from `apps/editor/components/GradientPanel.tsx:500`:

```tsx
<Slider
  label="Brightness"
  value={store.brightness}
  min={0.1}
  max={2}
  step={0.01}
  onChange={(v) => store.set({ brightness: v })}
  onCommit={() => store.commitSet()}
/>
```

Those bounds `0.1 / 2 / 0.01` duplicate what's already declared in `packages/schema/src/schema.ts`:

```ts
brightness: d("GradientConfig.brightness", z.number().min(0.1).max(2)).default(1),
```

There's no runtime or build-time link between the two. If someone widens the schema's brightness range to `0–3` and forgets to update the slider call, the slider silently caps the user at 2 even though the schema accepts more.

Affects **every slider** across EffectsPanel, GradientPanel, Timeline, and layer params — roughly 60+ call sites. Risk grows every time the schema changes.

---

## Proposed API

Add to `packages/schema/src/bounds.ts`:

```ts
/**
 * Lookup numeric bounds for any field on GradientConfig by dotted path.
 *
 * Walks the Zod schema once at module load and builds a lookup table of
 * numeric min/max/step triples. Returns `null` for paths that aren't
 * numeric (booleans, enums, layers[]) or don't exist.
 *
 * Paths use the same flat-dotted convention as descriptions.gen.ts keys:
 *   "GradientConfig.brightness"       → { min: 0.1, max: 2, step: 0.01 }
 *   "NoiseEffect.intensity"           → { min: 0, max: 1, step: 0.01 }
 *   "LayerConfig.complexity"          → { min: 1, max: 8, step: 1 }  // integer
 *   "GradientConfig.oklabEnabled"     → null (boolean)
 *   "GradientConfig.foo"              → null (unknown)
 */
export interface NumericBounds {
  min: number;
  max: number;
  step: number;
}

export function getNumericBounds(path: string): NumericBounds | null;
```

### Step inference rules (not free parameters — derived from the schema)

- `z.number().int()` → `step: 1`.
- `z.number()` with `min` and `max` finite → `step: 0.01` (2-decimal default for continuous params). Override with `.describe("step:0.1")` or a side table if a specific field needs a coarser step.
- No lower or upper bound → return `null`. Unbounded numerics shouldn't be Slider-backed anyway.

### Side table for step overrides

One line per override in `bounds.ts`:

```ts
const STEP_OVERRIDES: Record<string, number> = {
  "GradientConfig.hueShift": 1,          // degrees, integer
  "KaleidoscopeEffect.rotation": 1,      // degrees
  "Shape3DEffect.rotationSpeed": 0.05,   // coarser feel in practice
};
```

Keep the overrides small and boring. If this table grows beyond ~15 entries, the rule is probably wrong — revisit.

---

## Refactor pass (scope of the ticket)

1. Add `packages/schema/src/bounds.ts` with `getNumericBounds()` + walker.
2. Re-export from `packages/schema/src/index.ts`.
3. Unit tests in `packages/schema/test/bounds.test.ts`:
   - Every `GradientConfig` numeric field returns a non-null bounds record.
   - `min < max` for every returned record.
   - Integer fields return `step: 1`.
   - Known fields match spot-check values (brightness → `{0.1, 2, 0.01}`).
   - Booleans/enums return `null`.
4. **Refactor every `<Slider>` call site** in `apps/editor` to pull bounds from the schema. Reading with a small hook:

    ```tsx
    const bounds = useMemo(() => getNumericBounds("GradientConfig.brightness") ?? { min: 0, max: 1, step: 0.01 }, []);
    <Slider label="Brightness" {...bounds} value={store.brightness} ... />
    ```

    Or a convenience component `<SchemaSlider path="GradientConfig.brightness" ... />` that wraps Slider + the lookup.
5. Delete hand-coded bounds at each call site.
6. Grep assertion in CI: `grep -rE "<Slider[^>]*min=\{[0-9]" apps/editor/` should return zero hits (no literal min= on Slider).

---

## Why this blocks Step 2

Step 2 of HANDOFF.md ships the public npm packages `@wavr/gradient` and `@wavr/gradient-react`. Once those are on npm, external consumers will:

- Read `GradientConfig` fields via our typed API.
- Build their own UIs on top (control panels, presets, CMS plugins, LLM-driven prompt → config loops).

If those consumers also hand-code bounds, the drift problem multiplies: **every downstream consumer** becomes a place the bounds can get out of sync.

Exporting `getNumericBounds()` with the schema means downstream consumers read bounds from the same source that validates the values. Single source of truth, cross the npm boundary once.

Ship this **before** the npm publish. Adding it post-publish is fine API-wise (pure addition), but every consumer built during the gap has to re-fix their code to adopt it. Pay the cost once, up front.

---

## Not in this ticket

- Per-slider custom formatters (e.g. "50%" vs "0.5"). Orthogonal concern; lives in Slider or a display layer.
- Unit labels ("px", "°", "×"). Same — display concern.
- Automatic type inference of `SchemaSlider` path autocomplete from the description keys. Nice to have, not a blocker.
- Runtime bounds enforcement at the component layer. `GradientConfig.parse` at the schema boundary handles that; sliders already clamp via `clampToStep`.

---

## Acceptance

- `getNumericBounds` exported from `@wavr/schema` with tests.
- Zero literal numeric-bound props on any `<Slider>` in `apps/editor`.
- CI grep guard added.
- Step 2 work does not begin until this is landed.
