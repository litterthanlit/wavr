# Spec 0004 — Deband pass (blue-noise anti-banding)

> **Status:** Draft
> **Blocks:** Step 1 completion in HANDOFF.md (the dithering deliverable)
> **Depends on:** `@wavr/schema` (root schema gets one new optional group)

---

## 1. What this delivers

Dark or shallow gradients show visible banding on 8-bit displays. The fix is to add ~0.5 LSB of high-frequency noise per channel **after** tone mapping and **before** the final framebuffer write. The eye averages the noise; banding disappears.

HANDOFF.md calls this "the single highest-ROI visual quality win in the whole plan." It ships **on by default** — users don't toggle it, they get it.

Concrete UX promise:
- Load the `midnight` preset (or any deep-color gradient). No banding visible.
- Configs created without thinking about it get it for free.
- Users who specifically want pixel-perfect posterized output can turn it off via a single toggle.

---

## 2. Not to be confused with the existing `dither` effect

`packages/core/src/shaders/fragment.glsl` (lines 1544-1572) has a `u_ditherEnabled` Bayer 4×4 posterize — it quantizes colors to 4 levels for a retro look. That's a **style** effect and stays as-is.

This spec adds a **quality** effect with a different name (`deband`) and a different shader location (after tone map, before fragColor write).

Both can be enabled simultaneously without conflict: posterize first (it quantizes down), then deband adds sub-pixel noise on the reduced palette. Order of operations is documented in §4.

---

## 3. Algorithm — Interleaved Gradient Noise (Jiménez)

Rather than ship a blue-noise texture asset (64×64 or 128×128 PNG, ~4 KB bundled), use **Interleaved Gradient Noise** (IGN) — a 3-line shader function that produces perceptually-equivalent results at 8-bit output. Same technique Unity and Frostbite use for their built-in debanders.

```glsl
// Interleaved Gradient Noise — Jorge Jiménez, Call of Duty AW presentation.
// Output is a pseudo-random float in [0, 1), high-frequency, low-discrepancy.
float interleavedGradientNoise(vec2 p) {
  return fract(52.9829189 * fract(0.06711056 * p.x + 0.00583715 * p.y));
}
```

At the end of the fragment shader, after tone mapping:

```glsl
// Deband: add ±0.5 LSB of noise per channel to smooth 8-bit banding.
// The subtract-0.5 centers the noise distribution around zero.
// Divide-by-255 targets exactly one LSB of output range.
if (u_debandEnabled) {
  float n = interleavedGradientNoise(gl_FragCoord.xy) - 0.5;
  color += vec3(n) * (u_debandStrength / 255.0);
}
```

Four lines of shader code + one function. Zero textures to bundle. Zero uniforms beyond the two flag/strength values.

**Why IGN, not true blue noise:** IGN produces visually similar results to blue noise at 8-bit precision and is what Unity/Frostbite ship as their stock debander. At 10-bit HDR output the spectral difference becomes perceptible and a real blue-noise LUT is warranted — that's a future spec if we add HDR output.

**Why not just `hash(gl_FragCoord.xy)`:** white noise (hash-based) has a flat spectrum including low frequencies that are *visible* as static. IGN's diagonal gradient structure spreads error across high frequencies only, so it perceptually vanishes against the gradient signal.

---

## 4. Pipeline placement

Insert the deband block into `fragment.glsl` at the **very end of `main()`** — immediately before `fragColor = vec4(..., layerAlpha)` assignments at lines 1622 and 1624.

Order of operations in the new pipeline:
1. Base gradient computation
2. Noise overlay, bloom, curl, kaleidoscope, reaction-diffusion, pixel-sort, feedback (existing effects)
3. Grain
4. Tone mapping
5. Pixel-sort post-tone
6. **Existing `dither` posterize effect** (if enabled — style effect)
7. ASCII, 3D projection, shape mask (existing)
8. **Deband** (new — quality effect)
9. `fragColor = vec4(layerColor, layerAlpha)` — final output

Step 8 runs even when step 6 runs. Posterize quantizes to 4 levels; deband then dithers the boundaries between those 4 levels so they don't show hard banding at the 4-level transitions either. Net effect on a posterized output is subtle softening of the palette boundaries — visible only under close inspection.

---

## 5. Schema change

Add a new optional effect group to `GradientConfig`:

```ts
// packages/schema/src/effects/deband.ts
import { z } from "zod";
import { d } from "../descriptions.gen";

export const DebandEffect = d(
  "DebandEffect",
  z.object({
    enabled: d("DebandEffect.enabled", z.boolean()),
    strength: d("DebandEffect.strength", z.number().min(0).max(2)).default(1),
  }).strict(),
);
export type DebandEffect = z.infer<typeof DebandEffect>;
```

- `enabled` default is `true` at the **runtime default** layer (spec §5.2 below). The schema itself doesn't default enabled — it's required when the object is present.
- `strength: 1` is the baseline (exactly 1 LSB of noise); values above 1 over-dither (visible grain); values below 1 under-dither (partial banding still visible).

### 5.1 Wiring into the root

```ts
// packages/schema/src/schema.ts — add to the existing groups list
deband: DebandEffect.optional(),
```

And the description registry:

```ts
// packages/schema/src/descriptions.gen.ts
"DebandEffect": "Blue-noise anti-banding pass applied before final output...",
"DebandEffect.enabled": "Whether the deband pass runs.",
"DebandEffect.strength": "Dither amplitude, in output LSBs. 1 = baseline anti-banding.",
```

### 5.2 Default-on behavior

Default-on is implemented **in the engine**, not the schema or migration layer:

```ts
// packages/core/src/config.ts::resolveConfig
debandEnabled: config.deband?.enabled ?? true,   // ← on when absent
debandStrength: config.deband?.strength ?? 1,
```

`config.deband === undefined` means "user hasn't opted out" → engine runs the pass. When the user explicitly toggles it off, `storeToConfig` emits `deband: { enabled: false, strength: 1 }` and the engine's `?? true` fallback respects it.

This avoids touching `migrate.ts` or adding forced injection in `DEFAULT_CONFIG`. Legacy V1 URLs load with `config.deband === undefined` → deband runs by default — correct.

Optional polish: `DEFAULT_CONFIG` in `defaults.ts` *may* include `deband: { enabled: true, strength: 1 }` for documentation value, but it's not required for the default-on behavior to work.

### 5.3 URL-encoding note

`encodeUrl` strip-defaults logic in `packages/schema/src/url.ts` currently emits every effect group verbatim when present (§4 of spec 0001 doesn't strip groups, only globals). `deband: { enabled: true, strength: 1 }` is ~35 bytes in JSON. At ~27 bytes after LZ-string compression on a typical payload. Under budget, no issue.

If we wanted to squeeze more we'd add a per-group "strip if equals default" to the encoder. Not needed for this spec.

---

## 6. Engine wiring

The GL engine (`packages/core/src/engine.ts`) already uses a uniform-per-effect pattern. Add:

- Two new uniforms: `u_debandEnabled: bool`, `u_debandStrength: float`.
- Cache uniform locations at program link.
- Per-frame: read `u_debandEnabled` + `u_debandStrength` from `EngineState` (extended).

`EngineState` in `packages/core/src/engine.ts` gets two new fields: `debandEnabled: boolean`, `debandStrength: number`.

`packages/core/src/config.ts::resolveConfig` bridges schema → engine state:

```ts
debandEnabled: config.deband?.enabled ?? true, // default-on fallback
debandStrength: config.deband?.strength ?? 1,
```

`stateToConfig` inverse always emits the group (matches the pattern spec 0003 uses for every other effect in `storeToConfig`). Consistency is more valuable than the ~30 bytes of URL savings from conditional emission.

---

## 7. Editor-store wiring

`apps/editor/lib/store.ts` adds two new fields to `GradientState`:
- `debandEnabled: boolean` (default `true`)
- `debandStrength: number` (default `1.0`)

`apps/editor/lib/url-sync.ts` adapters extended:

```ts
// storeToConfig
deband: { enabled: state.debandEnabled, strength: state.debandStrength },

// configToStorePatch
if (config.deband) {
  patch.debandEnabled = config.deband.enabled;
  patch.debandStrength = config.deband.strength;
}
```

Round-trip test in `url-sync.test.ts` extended to cover deband.

---

## 8. UI control

`apps/editor/components/EffectsPanel.tsx` — add a single row for deband. Layout matches the existing effect rows (enable toggle + strength slider). Place it at the **top** of the effects panel, under a subhead "Output quality" (new section).

Rationale: it's different in character from the other effects (on-by-default, not a creative tool) — grouping it under a separate subhead signals "leave this alone unless you know why."

Strings:
- Section heading: `Output quality`
- Toggle label: `Anti-banding`
- Tooltip: `Adds sub-pixel noise to hide 8-bit color banding. Leave on unless you're exporting a posterized look.`
- Slider label: `Strength`
- Slider range: 0–2, step 0.1.

---

## 9. Acceptance criteria

- [ ] Open the `midnight` preset; visible banding in the dark regions is gone. Compare against HEAD~ (before this PR) to confirm the fix.
- [ ] Disable the deband toggle; banding returns. Re-enable; gone.
- [ ] Default new configs ship with `deband: { enabled: true, strength: 1 }` — inspect `DEFAULT_CONFIG` and a freshly-loaded editor state.
- [ ] Open a pre-0004 URL (bookmark from main); loads correctly, renders with deband on (via the migrate default-injection). Saving again emits a URL that carries `deband` now.
- [ ] `pnpm --filter @wavr/schema test` green (96 + new deband tests).
- [ ] `pnpm --filter @wavr/schema lint`, `pnpm --filter editor lint`, `pnpm --filter editor build` all green.
- [ ] Walker-invariant tests in `@wavr/schema` still pass (new field has `.describe()`, bounded, strict object).
- [ ] Editor UI: the new "Output quality" section appears at the top of the Effects panel with one toggle + one slider.

---

## 10. Out of scope

- A true blue-noise TEXTURE LUT. IGN is sufficient at 8-bit; revisit for 10-bit HDR.
- Per-layer deband (deband is global, runs once at final output).
- Spatiotemporal deband (animated per frame). IGN has enough variation spatially that the eye doesn't see pattern at 60 Hz.
- Changing the existing `dither` posterize effect. That's a style effect, untouched.
- Renderer-parity goldens regeneration. Enabling deband by default changes every golden. The parity harness's `workflow_dispatch` action handles this — just dispatch it after the PR lands. Call it out in the PR description.

---

## 11. Implementation order

1. **Schema package** (small, quick, blocks others).
   - `packages/schema/src/effects/deband.ts` — new file.
   - Update `src/effects/index.ts` barrel export.
   - Update `src/schema.ts` root to include `deband`.
   - Update `src/descriptions.gen.ts` with three new keys.
   - Update `src/defaults.ts` with `deband: { enabled: true, strength: 1 }`.
   - Update `src/migrate.ts` — both V1 paths inject the deband default.
   - Update tsup entry list (if adding a subpath export; not needed — barrel is fine).
   - Tests: walker picks up the new group (no test code change needed — the invariants auto-apply). Add one new test case in `schema.test.ts` asserting `parse(full)` includes deband.
2. **Core engine.**
   - Two new uniforms in engine.ts program setup + cached locations.
   - Add `debandEnabled: boolean`, `debandStrength: number` to `EngineState`.
   - Per-frame uniform upload.
   - `config.ts::resolveConfig`: map `config.deband?.enabled ?? true` etc.
   - `config.ts::stateToConfig`: emit `deband` group when present.
3. **Shader.**
   - Add `u_debandEnabled`, `u_debandStrength` uniform declarations at the top of `fragment.glsl`.
   - Add the `interleavedGradientNoise` function with the existing helper functions (near the `hash()` function).
   - Insert the deband block at the end of `main()`, directly before `fragColor =` assignments at lines 1622 and 1624.
4. **Editor store.**
   - Two new fields on `GradientState` with defaults.
   - Extend `url-sync.ts` adapters.
   - Extend the round-trip unit test in `url-sync.test.ts`.
5. **Editor UI.**
   - New "Output quality" section at top of `EffectsPanel.tsx`.
   - One `Toggle` + one `Slider`.
   - Existing `setDiscrete` for toggle, `set` / `commitSet` for slider — follows the existing effect-row pattern exactly.
6. **Verify.**
   - `pnpm --filter @wavr/schema test` — expect 96+ pass.
   - `pnpm --filter editor test` — expect 4+ pass.
   - `pnpm --filter editor build` — compile clean.
   - Boot the editor, load `midnight`, visually confirm debanding.
   - Toggle off, confirm banding returns. Toggle on, confirm gone.

---

## 12. Open questions

- **Does `strength` need to go above 1?** Unity's implementation caps at 1. Frostbite goes to 2 for darker content. Default range 0–2 gives headroom; if nobody uses above 1 in practice we can tighten in a future spec.
- **Should deband be a root-level boolean instead of a group?** Argument for group: consistency with every other effect (noise, bloom, blur, etc.). Argument for flat: saves one object of JSON. Sticking with group — consistency wins.
- **`descriptions.gen.ts` — should the new entry mention it's on by default?** Yes, in the enabled description. One line.
