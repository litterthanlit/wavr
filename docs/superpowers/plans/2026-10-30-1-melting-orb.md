# Melting Orb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `plasmaOrb` look from a hard-edged glass marble into a soft round glow whose colours drift and melt into each other and into the dark.

**Architecture:** Only the orb's GLSL changes: its helper block and `plasmaOrbGradient` in `gradients.glsl`, both under `#if WAVR_GRADIENT == 22`. The type id, shader id, palette, presets and mouse style stay. A small probe script measures edge sharpness, so "no hard edge" is a number and not just a judgment by eye. The editor tile's copy changes, and the thumbnails are re-rendered.

**Tech Stack:** GLSL ES 3.0 (WebGL 2), TypeScript, Vitest, the Playwright parity tooling in `tests/parity`.

**Spec:** `docs/superpowers/specs/2026-10-30-melt-strip-litt-design.md` (section 1). Reference renders are `docs/superpowers/specs/assets/orb-sketch-a-1.png` and `-2.png`, from source `assets/orb-sketch.html`, variant `V==0`.

## Global Constraints

- Keep the type id `plasmaOrb` and shader id `22` (`GRADIENT_TYPE_IDS`). Code exports and embeds compile it in, and `gradient-types.test.ts` guards it.
- Follow the house rules at the top of `gradients.glsl`: a few broad, slow forms on `centeredUV` coordinates, palette through `pingPong()` or a sine and never `fract()`, only hot cores burn toward white, and pixel-scale detail sized from `u_resolution.y`.
- The orb's code must not read `u_mouse*`. The pointer stays `mouseWarp()` with the existing `WAVR_MOUSE_WARP` line for 22.
- Keep standard range bit-identical for every other type. Their snapshots must diff 0/255 against the base commit.
- Uniforms: only those already in `PROGRAM_UNIFORM_NAMES` (`u_scale`, `u_speed` through `time`, `u_complexity`, `u_distortion`, `u_softness`, `u_resolution`).
- No hard edge. There is no disc test, rim, fresnel, specular, glint or `smoothstep` edge of pixel width.

## Review Focus

1. **4K export:** a 4× PNG must be the same picture. Nothing in the new orb may be sized in pixels. Pin it with the probe at `--size 2048`, which must report a max step no larger than at 512.
2. **Wide and tall canvases:** the orb stays round and centred at aspect 2.4 and 0.5. Pin it with snapshots at `--aspect 2.4` and `--aspect 0.5`, looked at, plus the probe on both.
3. **Scale extremes:** at `scale=3` the glow must fade before the frame edge or be cut softly, never with a visible box. At `scale=0.3` it must still read as a glow, not a dot. Pin it with the probe and a look at `--layer scale=3` and `--layer scale=0.3`.
4. **Two-stop palettes:** a user palette of two colours must still melt, not band. Pin it with a snapshot at `--palette "#101030,#ff60a0"`, looked at.
5. **Code export:** the standalone player must match the engine. Pin it with `pnpm export-parity --only plasmaOrb`, mean below the value the other light types report.

---

### Task 1: Edge probe

**Files:**
- Create: `tests/parity/edge-probe.mjs`

**Interfaces:**
- Produces: `node tests/parity/edge-probe.mjs <png>...`. For each PNG it prints `<file> maxStep=<0..1> p99Step=<0..1>` on one line. That's the luminance step between neighbouring pixels after a 3×3 box blur (so grain does not count), measured in display values 0..1. With `--max <n>` it exits 1 if any file's `maxStep` exceeds `n`.

- [ ] **Step 1: Write the probe.** Decode with `pngjs` (already a root dependency, as in `snapshot-diff.mjs`). Use luminance `0.2126 R + 0.7152 G + 0.0722 B` on 0..1 values, take the max and the 99th percentile of the horizontal and vertical neighbour differences of the blurred image, and parse `--max`.
- [ ] **Step 2: Baseline the current orb.**
  Run: `pnpm snapshots test-results/orb-before --only plasmaOrb --presets && node tests/parity/edge-probe.mjs test-results/orb-before/type-plasmaOrb.png test-results/orb-before/preset-plasmaOrb.png test-results/orb-before/preset-lightLeak.png`
  Expected: the orb lines report a large `maxStep` from the crisp rim (above 0.1). Record all three numbers in the commit message. Light Leak's number is the softness target the orb should be near or below.
- [ ] **Step 3: Commit.**
```bash
git add tests/parity/edge-probe.mjs
git commit -m "Add an edge probe for measuring hard edges in snapshots"
```

### Task 2: The soft orb shader

**Files:**
- Modify: `packages/core/src/shaders/gradients.glsl:481-560` (the orb's comment, the helper block and `plasmaOrbGradient`)

**Interfaces:**
- Consumes: `edge-probe.mjs` from Task 1. From `common.glsl`: `centeredUV`, `pingPong`, `snoise`, `getGradientColor`.
- Produces: `vec3 plasmaOrbGradient(vec2 uv, float time)`. The signature, guard and `computeGradient` branch are unchanged.

- [ ] **Step 1: Rewrite the orb.** Replace `plasmaOrbRot` and `plasmaOrbField` with one helper block holding the blob field, and rewrite `plasmaOrbGradient`. Port sketch A into engine terms:
  - **Body.** Centred, round on `centeredUV`. Brightness is `exp(-k (r / R)²)` with `R = 0.33 * u_scale`. Softness sets `k` between about 2.0 at softness 0 (a firmer, still blurred edge) and about 0.8 at softness 1 (a wide fade). Add a slow breathe of ±1–2 % in R.
  - **Colour.** 7 drifting gaussian blobs (constant loop bound). Each blob carries a palette position `t_i` spread over 0.35–1.0. The colour is `getGradientColor(pingPong(Σ wᵢ tᵢ / Σ wᵢ))`, so blobs melt along the palette instead of stacking. Blob centres drift on slow sines (periods ≥ 40 s at speed 1) within about 0.8 R, offset by `u_distortion` through one low-frequency `snoise` warp. Blob width is about 0.6–0.9 R. `u_complexity` (1–10) moves the blob width from wide (few visible lobes) to narrower (more), never below 0.4 R.
  - **Light.** The core may burn toward the last stop, but only the centre does. The room outside is `getGradientColor(0.0) * 0.06`, plus the body's tail, so the glow's edge fades into the room with no seam.
  - **The comment above the `#if`.** Describe the new orb in the file's voice, one paragraph, ending with "no rim and no highlight: the edge is a falloff".
- [ ] **Step 2: Run the shader tests.**
  Run: `pnpm --filter editor test -- engine-shader-sources gradient-types`
  Expected: PASS (one gradient function per program, guard and dispatch intact, shader id 22 unchanged).
- [ ] **Step 3: Snapshot and probe.**
  Run: `pnpm snapshots test-results/orb-after --only plasmaOrb --presets && node tests/parity/edge-probe.mjs --max 0.02 test-results/orb-after/type-plasmaOrb.png test-results/orb-after/preset-plasmaOrb.png test-results/orb-after/preset-limeOrb.png`
  Expected: exit 0, with each `maxStep` ≤ 0.02 and at or below Light Leak's baseline from Task 1.
- [ ] **Step 4: Review Focus checks.** Run snapshots plus the probe for `--size 2048`, `--aspect 2.4`, `--aspect 0.5`, `--layer scale=3`, `--layer scale=0.3` and `--palette "#101030,#ff60a0"`. Each probe must pass `--max 0.02`. Open every PNG next to `docs/superpowers/specs/assets/orb-sketch-a-1.png` and confirm: round, centred, colours melting, no box, no band, no rim.
- [ ] **Step 5: Others unchanged.**
  Run: `git stash && pnpm snapshots test-results/base && git stash pop && pnpm snapshots test-results/head && pnpm snapshots:diff test-results/base test-results/head`
  Expected: every image except `type-plasmaOrb` and the orb fixture (`fixture-animated-orb`) diffs 0/255.
- [ ] **Step 6: Export parity.**
  Run: `pnpm export-parity --only plasmaOrb`
  Expected: the mean difference is at or below what `pnpm export-parity --only lightLeak` reports.
- [ ] **Step 7: Commit.**
```bash
git add packages/core/src/shaders/gradients.glsl
git commit -m "Melt the orb: a soft round glow with drifting colour, no rim"
```

### Task 3: Tile copy and thumbnails

**Files:**
- Modify: `apps/editor/lib/gradient-types.ts:61-63` (label and description)
- Modify: `packages/core/src/presets/catalog.ts:37` and `packages/preview/src/presets.ts:14` (display name)
- Modify: `apps/editor/public/presets/plasmaOrb.webp`, `limeOrb.webp`, `thumbnails.json` (generated)

**Interfaces:**
- Consumes: the shader from Task 2.

- [ ] **Step 1: Copy.** Set the label to `"Orb"` in all three places. Set the description to `"A soft round glow whose colours drift and melt into the dark. Colours run from the dark to the brightest light."` The preset id `plasmaOrb` stays.
- [ ] **Step 2: Re-render thumbnails.**
  Run: `pnpm thumbnails`
  Expected: only `plasmaOrb.webp`, `limeOrb.webp` and their hashes in `thumbnails.json` change (`git status`).
- [ ] **Step 3: Full checks.**
  Run: `pnpm lint && pnpm test`
  Expected: PASS, including `presets.test.ts` (thumbnail hashes) and `gradient-types.test.ts`.
- [ ] **Step 4: Look in the editor.** Run `pnpm dev`, open `/editor`, pick the Orb tile, and drag Softness, Scale, Complexity and Distortion through their ranges. Move the pointer over it. Confirm it never shows an edge and the colours keep moving.
- [ ] **Step 5: Commit.**
```bash
git add apps/editor/lib/gradient-types.ts packages/core/src/presets/catalog.ts packages/preview/src/presets.ts apps/editor/public/presets
git commit -m "Rename the orb tile and re-render its thumbnails"
```
