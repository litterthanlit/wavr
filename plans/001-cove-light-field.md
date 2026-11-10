# Plan 001: Wavr has a Cove look: a frame lit from its edges round a dark core

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat e7b88af..HEAD -- packages/core/src/shaders packages/core/src/engine.ts packages/core/src/layers.ts packages/core/src/presets packages/schema/src/enums.ts packages/react/src packages/preview/src/presets.ts packages/create-wavr/src/args.ts apps/editor/lib apps/editor/public/presets skills/wavr CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive: a new gradient type; no existing type's code changes)
- **Depends on**: none
- **Category**: direction (new feature)
- **Planned at**: commit `e7b88af`, 2026-11-10

## Why this matters

The owner wants Wavr to make the look of a reference clip: a rounded card that
glows from its edges (pale rose-white at the rim, through periwinkle, cobalt and
violet, to a dark navy core), perfectly smooth, drifting slowly, and holding
its look while the card changes shape from a wide button to a square to a tall
card. They described it as "smooth, James Turrell-esque".

Wavr's closest look today is `aperture`, an opening of light in a wall. It
can't make this picture: the opening has fixed proportions set by a slider (it
does not follow the canvas), its colour depends only on depth (no pools of
different colours round the frame), and it sits in a wall. This plan adds a new
light field, **`cove`**, whose frame of light *is* the canvas, whatever its
shape. The shader is already written and tuned (it is in Step 1, to be pasted
as is); the rest of the plan is the wiring every gradient type needs.

## What the look is (so you can judge a render)

Three reference renders of the finished shader are in `plans/assets/`:

- `plans/assets/001-cove-shapes.jpg` — the same settings on a wide, a square
  and a tall canvas. Dark core, coloured band, pale rim, on every shape.
- `plans/assets/001-cove-presets.jpg` — the two presets this plan adds
  (`cove` left, `emberCove` right) at the thumbnail's 4:3.
- `plans/assets/001-cove-dials.jpg` — a 4×5 grid of variations, row by row:
  softness 0.25, 0.75, 0, 1 / distortion 0, 1, complexity 1, 8 / scale 0.8,
  1.3, a 1-stop palette, a 2-stop palette / a 3-stop palette, an 8-stop
  palette, a pale "daylight" palette, an ember palette / a mint palette, then
  the pointer at the centre, at a corner and at the left edge.

How it was derived, in short. The reference was measured frame by frame: its
light falls off from every edge exponentially, to 1/e about every tenth of the
card's shorter side; corners are about 1.4 times as bright as the middle of an
edge; brightness saturates toward the rim the way film does (`1 - exp(-light)`),
not by clipping; and its colour comes from a few large soft pools that sit
along the edges and drift. The shader reproduces those four facts; its
brightness along a line from an edge to the core is within about 10% of the
reference's.

**What was and wasn't verified during planning.** The shader was compiled and
rendered in headless Chromium (ANGLE/SwiftShader) inside the repo's real layer
program: `hsl.glsl`, `blend-modes.glsl`, `common.glsl`, `mouse.glsl`,
`gradients.glsl` and `layer.glsl`, assembled the way
`packages/core/src/shader-sources.ts` does, with the block below inserted. It
was **not** run through the engine's post pass, the test suite, the code
exports or on a real GPU (the planner could not install dependencies). Steps 6
and 7 do that.

## Current state

How a gradient type is wired today. Excerpts are from commit `e7b88af`.

- `packages/schema/src/enums.ts` — the canonical type list (lines 8–13):

  ```ts
  export const GRADIENT_TYPES = [
    "image",
    "liquidChrome", "iridescentFoil", "horizonGlow", "lightLeak", "inkSmoke", "plasmaOrb",
    "flow", "pulse",
    "aperture", "halo", "corona", "lightWall",
  ] as const;
  ```

  Types are stored by name (URLs, projects), never by position, so order here
  is free.

- `packages/core/src/engine.ts` — shader ids (lines 127–141). The last entry
  is `pulse: 28,`. Ids are compiled into code exports and embeds, so existing
  ids never change; the new one is **29**.

- `packages/core/src/shaders/gradients.glsl` — every gradient function, each
  inside `#if WAVR_GRADIENT == <id>` … `#endif`. The "Light fields" section
  starts at line 628. Its intro comment (lines 631–632) reads:

  ```glsl
  // Coloured light in a space, after light installations: an opening of light in
  // a wall, a luminous ring in the dark, a backlit wall. These add light rather
  ```

  The last light field, `lightWallGradient`, ends with `#endif` at line 989,
  followed by a blank line and this banner (lines 991–993):

  ```glsl
  // ============================================================
  // Image Gradient (type 8) — samples uploaded texture
  // ============================================================
  ```

  The dispatcher ends (lines 1034–1041):

  ```glsl
  #elif WAVR_GRADIENT == 27
    return flowGradient(uv, time);
  #elif WAVR_GRADIENT == 28
    return pulseGradient(uv, time);
  #else
  #error Unknown WAVR_GRADIENT
  #endif
  }
  ```

- `packages/core/src/shaders/mouse.glsl` — one pointer style per id. The table
  ends (lines 133–139):

  ```glsl
  #elif WAVR_GRADIENT == 27
  #define WAVR_MOUSE_WARP mouseWarpSwirl
  #elif WAVR_GRADIENT == 28
  #define WAVR_MOUSE_WARP mouseWarpLens
  #else
  #error No mouse warp style for this WAVR_GRADIENT
  #endif
  ```

- `packages/core/src/layers.ts` — `defaultSoftnessForGradientType` (lines
  14–32), `LIGHT_FIELD_PALETTES` (lines 60–63) and
  `LIGHT_FIELD_PALETTE_ROLES` (lines 68–71):

  ```ts
  export const LIGHT_FIELD_PALETTES = {
    aperture: [[0.253, 0.261, 0.41], [0.392, 0.506, 1], [0.625, 0.509, 0.998], [0.827, 0.568, 0.998], [0.864, 0.732, 1]],
    lightWall: [[0.55, 0.36, 0.85], [0.86, 0.24, 0.58], [0.82, 0.72, 1], [0.96, 0.34, 0.44], [0.93, 0.48, 0.86]],
  } satisfies Partial<Record<GradientType, [number, number, number][]>>;
  ```

  ```ts
  export const LIGHT_FIELD_PALETTE_ROLES: Record<LightFieldType, string> = {
    aperture: "First colour is the wall; the rest are the light in the opening, from its core to its rim.",
    lightWall: "First colour is the glass's own glow; the rest are the lights behind it.",
  };
  ```

- `packages/react/src/types.ts` — the published union (lines 15–18):

  ```ts
  export type GradientType =
    | "image" | "liquidChrome" | "iridescentFoil"
    | "horizonGlow" | "lightLeak" | "inkSmoke" | "plasmaOrb" | "flow" | "pulse"
    | "aperture" | "halo" | "corona" | "lightWall";
  ```

- `apps/editor/lib/gradient-types.ts` — `GRADIENT_OPTIONS`, the Look grid.
  It begins (lines 19–29):

  ```ts
  export const GRADIENT_OPTIONS: GradientOption[] = [
    {
      value: "aperture",
      label: "Aperture",
      description: `An opening of light in a wall. ${LIGHT_FIELD_PALETTE_ROLES.aperture}`,
    },
    {
      value: "halo",
      label: "Halo",
      description: "A ring of light in a dark room. Colours run from the room to the hottest light.",
    },
  ```

- `packages/core/src/presets/light-fields.ts` — the light-field presets.
  `ganzfeld` is at lines 70–86 and `halo` follows at line 88. The file's
  header comment ends (lines 11–13):

  ```ts
  // carries: a screen holds a small bright area far brighter than a full one, so
  // a loop of light in a dark room gets two stops, an opening in a wall one and
  // a half, and a room or wall of light, the whole frame, one.
  ```

- Preset lists that must all name a new preset (a test compares them):
  `packages/core/src/presets/index.ts`, `packages/core/src/presets/catalog.ts`,
  `packages/react/src/presets.ts`, `packages/preview/src/presets.ts`,
  `packages/create-wavr/src/args.ts`.

- `apps/editor/lib/preset-patch.ts` says: "Effects the config doesn't mention
  are left as the user has them, so a preset that should switch an effect off
  says so explicitly (e.g. `grain: 0`)." That is why the presets below state
  `grain: 0` and `realBloomEnabled: false`.

- Tests that hold hard-coded lists you must extend:
  `apps/editor/lib/gradient-types.test.ts` (lines 57–64, 66–71, 128–144),
  `apps/editor/lib/random-look.test.ts` (line 85),
  `apps/editor/lib/hdr-headroom.test.ts` (lines 17–21).

- Docs that list the types and presets: `CLAUDE.md` ("Adding a Gradient
  Mode", step 2) and `skills/wavr/references/config.md`, which has four
  byte-identical copies: `.claude/skills/wavr/references/config.md`,
  `.codex/skills/wavr/references/config.md`,
  `.cursor/skills/wavr/references/config.md`,
  `packages/create-wavr/skill/references/config.md`.

**The exemplar to follow.** Commit `de45d9c` ("Add Corona, a light field of
streamers round a dark eye") added a light field the same way, touching the
same files. Read it before you start: `git show de45d9c --stat` and
`git show de45d9c -- packages/core/src/layers.ts apps/editor/lib packages/react/src packages/core/src/presets`.

**Conventions that apply** (from `CLAUDE.md` and the top of `gradients.glsl`):

- The guard line `#if WAVR_GRADIENT == <id>` is directly followed by
  `vec3 <type>Gradient(vec2 uv, float time) {`; comments go above the `#if`;
  helpers go in their own guarded block before it. Tests check this by regex.
- Every function starts in column 0 and ends with `}` in column 0 (the code
  exports cut functions out by name).
- A gradient function never reads `u_mouse*` (the pointer reaches it only
  through `mouseWarp()`), and reads no uniform other than `u_resolution`,
  `u_colors`, `u_colorCount`, `u_scale`, `u_complexity`, `u_distortion`,
  `u_softness`, `u_fill`, `u_focus` (the exports provide no others).
- Light fields work in linear light: `srgbToLinear()` the stops, multiply
  their light (not their room) by `framePeak()`, return through
  `lightToDisplay()`.
- Labels and names are sentence case ("Light wall", "Ember cove").
- TypeScript strict, no `any`. Comments in the surrounding files are plain
  descriptive prose in British spelling ("colour"); match that.

## Commands you will need

Read from `package.json` and `.github/workflows/ci.yml`. They were **not
executed during planning**; if one behaves differently from the table, that is
a STOP condition, not something to work around.

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| All unit tests | `pnpm test` | exit 0 |
| Some editor tests | `pnpm --filter editor exec vitest run lib/<file>.test.ts` | all pass |
| Build | `pnpm build` | exit 0 |
| Render stills | `pnpm snapshots <outDir> [--only a,b] [--presets]` | exit 0, PNGs in `<outDir>` |
| Compare two runs | `pnpm snapshots:diff <dirA> <dirB> --fail-above 0` | exit 0 |
| Preset thumbnails | `pnpm thumbnails --only cove,emberCove` | exit 0, two `.webp` written |
| Export vs engine | `pnpm export-parity <outDir> --only cove --max-mean 2` | exit 0 |
| Parity harness | `pnpm test:parity` | all pass |

The last five drive headless Chromium. They use `/opt/pw-browsers/chromium` if
it exists, else Playwright's own; set `CHROMIUM_PATH` to point at another. If
no Chromium can be found, STOP and report (do not skip those steps).
`test-results/` is git-ignored: put all output there.

## Scope

**In scope** (the only files you should modify or create):

- `packages/core/src/shaders/gradients.glsl`
- `packages/core/src/shaders/mouse.glsl`
- `packages/schema/src/enums.ts`
- `packages/core/src/engine.ts` (one line in `GRADIENT_TYPE_IDS`)
- `packages/core/src/layers.ts`
- `packages/react/src/types.ts`
- `packages/core/src/presets/light-fields.ts`
- `packages/core/src/presets/index.ts`
- `packages/core/src/presets/catalog.ts`
- `packages/react/src/presets.ts`
- `packages/preview/src/presets.ts`
- `packages/create-wavr/src/args.ts`
- `apps/editor/lib/gradient-types.ts`
- `apps/editor/lib/gradient-types.test.ts`
- `apps/editor/lib/random-look.test.ts`
- `apps/editor/lib/hdr-headroom.test.ts`
- `apps/editor/public/presets/cove.webp`, `emberCove.webp` (generated)
- `apps/editor/public/presets/thumbnails.json` (generated)
- `CLAUDE.md`
- `skills/wavr/references/config.md` and its four copies (listed above)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- Any other gradient function, `common.glsl`, `layer.glsl`, `post.glsl`: every
  existing type must render bit-identically (Step 6 checks it).
- `apps/editor/components/GradientPanel.tsx`: Cove needs no control of its
  own. It does not read `fill` or `focus`.
- `apps/editor/lib/portable-shader.ts`, `portable-runtime.ts`: code exports
  cut the gradient out of the engine's GLSL by themselves. If an export of
  `cove` fails, the shader text is wrong, not the exporter.
- `packages/schema/src/*` other than `enums.ts`: no new config field, no
  migration.
- `packages/core/src/engine.ts` beyond the one id line. In particular do not
  add `cove` to `FULL_RESOLUTION_GRADIENTS` (it does not read `gl_FragCoord`).
- The shader's constants. They were tuned against the reference; a different
  look is a follow-up, not part of this plan.
- Resizing behaviour: `plans/002-redraw-on-resize.md` covers it.

## Git workflow

- Branch: the repo's branches are named `claude/<slug>`. Use the branch the
  operator gave you; otherwise `claude/cove-light-field`.
- Commit style: a short sentence-case imperative subject, no prefix, e.g.
  (from `git log`) "Add flow and pulse shaders", "Wire flow and pulse in as
  light modes, with presets", "Document flow and pulse". Three commits in that
  shape fit this plan: after Step 1, after Step 5, after Step 7.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
```

```bash
pnpm lint
```

```bash
pnpm test
```

```bash
pnpm snapshots test-results/cove-base
```

**Verify**: all four exit 0, and `ls test-results/cove-base/type-*.png | wc -l`
prints `13`. If lint or tests fail before you have changed anything, STOP.

### Step 1: Add the shader

**1a.** In `packages/core/src/shaders/gradients.glsl`, change the "Light
fields" intro (lines 631–632) so it names the new field. Replace

```glsl
// Coloured light in a space, after light installations: an opening of light in
// a wall, a luminous ring in the dark, a backlit wall. These add light rather
```

with

```glsl
// Coloured light in a space, after light installations: an opening of light in
// a wall, a frame lit from its edges, a luminous ring in the dark, a backlit
// wall. These add light rather
```

**1b.** In the same file, insert the block below between the `#endif` that
closes `lightWallGradient` (line 989) and the `Image Gradient (type 8)` banner
(line 991), with one blank line before and after it. Paste it exactly: do not
reflow comments, rename anything or "simplify" expressions.

```glsl
// Cove: light pouring into the frame from behind its edges, as cove lighting
// washes a room, round a dark core. The first stop is the dark the light falls
// into and the last the rim, the pale light right at the edge; the stops
// between are the coloured lights: soft pools that drift round the frame just
// inside its edges, passing each other, and tint the edge light where they
// are. Light comes in from all four edges and falls off exponentially, with no
// crease along the diagonals, and it exposes the frame as light does film, so
// it pales toward the rim instead of clipping. The frame is the canvas itself,
// whatever its shape: every length is a share of its shorter side, so a wide
// banner, a square and a tall card are the same room. Softness is the reach
// of the edge light, from a thin rim to light that fills the frame, and the
// size of the pools. Distortion lets the light wander: the pools shine into
// the frame, the edge light reaches further in some places than others and
// the rim is paler along some stretches, so the core drifts and changes
// shape; at 0 the frame is evenly lit. Complexity adds pools. Scale sizes the
// frame of light against the canvas: above 1 its edges lie outside and only
// their glow reaches in; below 1 it sits inside a margin of the rim's light.
#if WAVR_GRADIENT == 29
// The light an edge sends to a point `inset` inside it (negative outside),
// falling to 1/e every `reach`. Outside the frame it levels off at 1 without a
// corner (a softplus of the inset), so nothing shows where the frame ends.
float coveEdge(float inset, float reach) {
  float k = 0.25 * reach;
  float depth = max(inset, 0.0) + k * log(1.0 + exp(-abs(inset) / k));
  return exp(-depth / reach);
}

// The light of all four edges at `p`: their root sum of squares, which is the
// one edge's light beside an edge, 1.4 of it in a corner (two edges light it,
// but each from the side), and smooth everywhere between.
float coveLight(vec2 p, vec2 halfSize, float reach) {
  vec4 e = vec4(coveEdge(halfSize.x + p.x, reach), coveEdge(halfSize.x - p.x, reach),
                coveEdge(halfSize.y + p.y, reach), coveEdge(halfSize.y - p.y, reach));
  return sqrt(dot(e, e));
}
#endif

#if WAVR_GRADIENT == 29
vec3 coveGradient(vec2 uv, float time) {
  vec2 p = centeredUV(uv);
  vec2 halfSize = vec2(0.5 * u_resolution.x / u_resolution.y, 0.5) * u_scale;
  // One unit is the frame's shorter half side.
  float unit = max(min(halfSize.x, halfSize.y), 1e-3);
  float soft = clamp(u_softness, 0.0, 1.0);
  float wander = clamp(u_distortion, 0.0, 1.0);
  int last = max(u_colorCount - 1, 0);
  int first = min(1, last);
  int lights = max(last - first, 1);

  // The pools: each circles the frame at its own pace, alternate ones the
  // other way, on an ellipse along the edges.
  int n = clamp(int(u_complexity) + 2, 3, 10);
  vec3 pools = vec3(0.0);
  vec3 tint = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 10; i++) {
    if (i >= n) break;
    float fi = float(i);
    vec2 h = hash22(vec2(fi, 4.3));
    float dir = mod(fi, 2.0) < 1.0 ? 1.0 : -0.8;
    float a = 6.28318 * (fi + 0.5 * h.x) / float(n)
            + dir * time * (0.05 + 0.04 * h.y) + 0.4 * sin(time * 0.07 + fi * 1.9);
    vec2 c = halfSize * (0.86 + 0.2 * h.y) * vec2(cos(a), sin(a));
    vec2 d = (p - c) / (unit * mix(0.36, 0.66, soft) * (0.8 + 0.4 * h.x));
    float g = exp(-dot(d, d));
    vec3 col = srgbToLinear(u_colors[min(first + i % lights, last)]);
    pools += col * g;
    // The edge light takes the colour of the pools near it (and of all of
    // them, a little, so it never runs out of colour between two).
    tint += col * (g + 0.05);
    total += g + 0.05;
  }
  tint /= total;

  // The edge light. Its reach breathes, and wanders with a slow, broad field;
  // a second field makes it brighter along some stretches of the frame than
  // others, the pale light at the rim most of all.
  vec2 q = p / unit;
  float n1 = snoise(q * 0.3 + vec2(time * 0.06, -time * 0.05));
  float n2 = snoise(q * 0.3 + vec2(5.2 - time * 0.055, 1.3 + time * 0.06));
  float reach = unit * mix(0.08, 0.42, soft)
              * (1.0 + 0.06 * sin(time * 0.21))
              * (1.0 + 0.45 * wander * n1);
  float body = coveLight(p, halfSize, reach) * exp(0.35 * wander * n2);
  float lip = coveLight(p, halfSize, 0.38 * reach) * exp(0.9 * wander * n2);

  // Exposure: light adds without limit and the frame takes it up as film does.
  vec3 light = tint * 2.9 * body + pools * 0.8 * wander + srgbToLinear(u_colors[last]) * 1.4 * lip;
  return lightToDisplay(srgbToLinear(u_colors[0]) + (1.0 - exp(-light)) * framePeak());
}
#endif
```

**1c.** In the dispatcher at the bottom of the same file, add a branch after
the `pulse` one:

```glsl
#elif WAVR_GRADIENT == 28
  return pulseGradient(uv, time);
#elif WAVR_GRADIENT == 29
  return coveGradient(uv, time);
#else
```

**1d.** In `packages/core/src/shaders/mouse.glsl`, add Cove's pointer style
(the same soft lens `aperture` uses) after the entry for 28:

```glsl
#elif WAVR_GRADIENT == 28
#define WAVR_MOUSE_WARP mouseWarpLens
#elif WAVR_GRADIENT == 29
#define WAVR_MOUSE_WARP mouseWarpLens
#else
```

**Verify**:

```bash
grep -c "WAVR_GRADIENT == 29" packages/core/src/shaders/gradients.glsl packages/core/src/shaders/mouse.glsl
```

→ `gradients.glsl:3` and `mouse.glsl:1`.

```bash
grep -n -A1 "^#if WAVR_GRADIENT == 29" packages/core/src/shaders/gradients.glsl | grep -c "vec3 coveGradient(vec2 uv, float time) {"
```

→ `1`.

Do not run the test suite yet: until Step 5 several tests fail by design (they
compare lists you have not extended yet).

### Step 2: Register the type

**2a.** `packages/schema/src/enums.ts`: add `"cove"` after `"aperture"`:

```ts
  "aperture", "cove", "halo", "corona", "lightWall",
```

**2b.** `packages/core/src/engine.ts`, `GRADIENT_TYPE_IDS`: add after
`pulse: 28,`:

```ts
  cove: 29,
```

**2c.** `packages/core/src/layers.ts`:

- In `defaultSoftnessForGradientType`, add `case "cove":` to the group that
  returns `0.5` (next to `case "pulse":`).
- Add Cove's palette to `LIGHT_FIELD_PALETTES`, after `aperture`:

  ```ts
    cove: [[0.08, 0.1, 0.32], [0.24, 0.3, 1], [0.5, 0.3, 1], [0.4, 0.42, 1], [1, 0.86, 0.95]],
  ```

- Add its roles to `LIGHT_FIELD_PALETTE_ROLES`, after `aperture`:

  ```ts
    cove: "First colour is the dark core and the last the pale rim; the ones between are the lights round the frame.",
  ```

**2d.** `packages/react/src/types.ts`: add `"cove"` to the union's last line:

```ts
  | "aperture" | "cove" | "halo" | "corona" | "lightWall";
```

**Verify**: `pnpm lint` → exit 0. (A type error here names the list you
missed.)

### Step 3: Add the presets, in every list

**3a.** `packages/core/src/presets/light-fields.ts`: insert between `ganzfeld`
and `halo`:

```ts
// Light pouring in from every edge of the frame round a navy core: pools of
// cobalt, violet and periwinkle drifting under a pale rose rim. No grain and
// no bloom: the smoothness is the look.
export const cove: GradientConfig = {
  layers: [{
    type: "cove",
    colors: LIGHT_FIELD_PALETTES.cove,
    speed: 0.5,
    complexity: 3,
    scale: 1,
    distortion: 0.5,
    softness: 0.5,
  }],
  grain: 0,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: false,
};

// The cove at dusk: ember, amber and rose light round a dark core.
export const emberCove: GradientConfig = {
  layers: [{
    type: "cove",
    colors: [[0.06, 0.02, 0.03], [0.95, 0.25, 0.12], [1, 0.5, 0.15], [0.85, 0.15, 0.35], [1, 0.92, 0.8]],
    speed: 0.4,
    complexity: 4,
    scale: 1,
    distortion: 0.6,
    softness: 0.6,
  }],
  grain: 0,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: false,
};
```

In the same file's header comment, change "an opening in a wall one and a
half" to "an opening in a wall or a frame lit from its edges one and a half"
(reflow the comment to the file's line width).

**3b.** `packages/core/src/presets/index.ts`: add `cove, emberCove` after
`ganzfeld` in the first export list.

**3c.** `packages/core/src/presets/catalog.ts`: add after the `ganzfeld`
entry:

```ts
  { id: "cove", name: "Cove", category: "lightFields", config: lightFields.cove },
  { id: "emberCove", name: "Ember cove", category: "lightFields", config: lightFields.emberCove },
```

**3d.** `packages/react/src/presets.ts`: add `cove as coreCove,` and
`emberCove as coreEmberCove,` to the import (after `ganzfeld as coreGanzfeld,`)
and, after `export const ganzfeld …`:

```ts
export const cove = coreCove as GradientConfig;
export const emberCove = coreEmberCove as GradientConfig;
```

**3e.** `packages/preview/src/presets.ts`, `PRESET_OPTIONS`: add after the
`ganzfeld` entry:

```ts
  { id: "cove", label: "Cove" },
```

**3f.** `packages/create-wavr/src/args.ts`, `PRESETS`: add `"cove",` and
`"emberCove",` after `"ganzfeld",` (this list must be in the catalogue's
order).

**Verify**: `pnpm lint` → exit 0.

### Step 4: Render the thumbnails

```bash
pnpm thumbnails --only cove,emberCove
```

**Verify**: exit 0; the output lists `cove` and `emberCove`;
`ls apps/editor/public/presets/cove.webp apps/editor/public/presets/emberCove.webp`
finds both; and

```bash
node -e 'const k=Object.keys(require("./apps/editor/public/presets/thumbnails.json"));console.log(k.slice(3,6).join(","),k.length)'
```

→ `ganzfeld,cove,emberCove 26`.

Open `apps/editor/public/presets/cove.webp` and compare it with the left half
of `plans/assets/001-cove-presets.jpg`: a dark navy core, a blue and violet
band, a pale rim on all four sides. It will not match pixel for pixel (the
thumbnail is a P3 frame converted to sRGB). If it is black, a flat colour, or
has hard edges or stripes, STOP.

### Step 5: Add the Look tile and extend the tests

**5a.** `apps/editor/lib/gradient-types.ts`, `GRADIENT_OPTIONS`: insert after
the `aperture` entry:

```ts
  {
    value: "cove",
    label: "Cove",
    description: `Light pouring in from every edge of the frame round a dark core. ${LIGHT_FIELD_PALETTE_ROLES.cove}`,
  },
```

**5b.** `apps/editor/lib/gradient-types.test.ts`:

- In "the Look grid shows the light fields, …" change the first row of the
  expected array to `"aperture", "cove", "halo", "corona", "lightWall",` and
  the slice on the next statement from `slice(4, 12)` to `slice(5, 13)`.
- In "each look says what it is, …" add
  `expect(description("cove")).toContain(LIGHT_FIELD_PALETTE_ROLES.cove);`
  after the `aperture` line.
- In "keeps each type's shader id, …" add `cove: 29,` after `pulse: 28,`.

**5c.** `apps/editor/lib/random-look.test.ts` (line 85): add `"cove"` to the
sorted list, between `"corona"` and `"flow"`.

**5d.** `apps/editor/lib/hdr-headroom.test.ts` (lines 17–21): add
`cove: 1.5, emberCove: 1.5,` to the expected object.

**Verify**:

```bash
pnpm lint
```

```bash
pnpm test
```

→ both exit 0. `pnpm test` now covers Cove in tests that loop over every
type: `portable-shader.test.ts` (its export declares every name it uses, and
is the engine's code line for line), `engine-shader-sources.test.ts` (one
gradient function per program) and `presets.test.ts` (thumbnail hashes).
If `portable-shader.test.ts` fails for `cove`, the pasted shader differs from
Step 1: re-paste it; do not edit `portable-shader.ts`.

### Step 6: Prove the look and that nothing else moved

**6a. Existing types are untouched.**

```bash
pnpm snapshots test-results/cove-after
```

```bash
pnpm snapshots:diff test-results/cove-base test-results/cove-after --fail-above 0
```

**Verify**: exit 0; the output lists `only in B: type-cove` and every other
image with a largest difference of 0.

**6b. The presets render the look.**

```bash
pnpm snapshots test-results/cove-presets --presets --only preset-cove,preset-emberCove
```

Then check both stills (512×512, 1 s in) with this script. It measures linear
luminance along the line from the middle of the top edge to the centre.

```bash
for id in cove emberCove; do node --input-type=module - "test-results/cove-presets/preset-$id.png" <<'EOF'
import fs from "node:fs";
import { PNG } from "pngjs";
const png = PNG.sync.read(fs.readFileSync(process.argv[2]));
const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
const luma = (u, v) => {
  const i = (Math.round(v * (png.height - 1)) * png.width + Math.round(u * (png.width - 1))) * 4;
  return 0.2126 * lin(png.data[i]) + 0.7152 * lin(png.data[i + 1]) + 0.0722 * lin(png.data[i + 2]);
};
const depths = [0.02, 0.06, 0.12, 0.2, 0.3, 0.5];
const line = depths.map((d) => luma(0.5, d));
const edges = [luma(0.5, 0.02), luma(0.5, 0.98), luma(0.02, 0.5), luma(0.98, 0.5)];
const checks = {
  "rim is bright": line[0] > 0.45,
  "core is dark": line[5] < 0.15,
  "light falls steadily from rim to core": line.every((y, i) => i === 0 || y < line[i - 1] + 0.005),
  "all four edges are lit": edges.every((y) => y > 0.3),
};
console.log(process.argv[2], line.map((y) => y.toFixed(3)).join(" "));
for (const [name, ok] of Object.entries(checks)) console.log(ok ? "ok  " : "FAIL", name);
if (!Object.values(checks).every(Boolean)) process.exit(1);
EOF
done
```

**Verify**: exit 0 and four `ok` lines for each preset. For reference, the
planner's prototype measured, at those six depths, about
`0.64 0.49 0.30 0.17 0.09 0.04` for `cove` and `0.75 0.63 0.47 0.32 0.19 0.07`
for `emberCove`. Yours should be within about 0.1 of those.

**6c. It is the same room on any shape.**

```bash
pnpm snapshots test-results/cove-wide --presets --only preset-cove --aspect 1.87
```

```bash
pnpm snapshots test-results/cove-tall --presets --only preset-cove --aspect 0.72
```

**Verify**: both exit 0. Look at the two `preset-cove.png` files next to
`plans/assets/001-cove-shapes.jpg`: a dark core, a coloured band and a pale
rim on all four sides in both; the rim about as thick, relative to the shorter
side, as in the square still. A stretched or lopsided frame of light is a STOP.

**6d. The code export matches the engine.**

```bash
pnpm export-parity test-results/cove-export --only cove --max-mean 2
```

**Verify**: exit 0 (the Corona commit reported 0.05/255 for its type; expect
the same order).

**6e. It compiles on the parity harness.**

```bash
pnpm test:parity
```

**Verify**: all pass. A GLSL error here prints `ERROR: 6:<line>` (file 6 is
`gradients.glsl`).

### Step 7: Document it

**7a.** `CLAUDE.md`, section "Adding a Gradient Mode", step 2. Three small
edits inside that paragraph:

- `The light fields ("Light fields": aperture, halo, corona, lightWall) add light`
  → `The light fields ("Light fields": aperture, cove, halo, corona, lightWall) add light`
- `aperture and light wall read their stops by role`
  → `aperture, cove and light wall read their stops by role`
- `1.5 for an opening in a wall, 1 when the whole frame is light`
  → `1.5 for an opening in a wall or a frame lit from its edges, 1 when the whole frame is light`

**7b.** `skills/wavr/references/config.md`:

- In the "Light fields" paragraph, insert after the `aperture` description
  (which ends `…distortion the haze that spills it into the room), `) and
  before `` `halo` ``:

  ```text
  `cove` (light pouring in from every edge of the frame round a dark core, the look of a softly glowing card or button: first colour the dark core, the last the pale rim, the ones between the coloured lights that drift round the frame; its frame is the canvas, so it fits a banner, a square or a tall card alike; softness is how far the light reaches in, distortion how much it wanders, complexity the number of pools of colour, scale the size of the frame of light against the canvas),
  ```

- In "Presets", change the light-fields line to:

  ```text
  Light fields: `aperture` `cobaltAperture` `duskAperture` `ganzfeld` `cove` `emberCove` `halo` `iceHalo` `corona` `iceVeil` `lightWall` `lagoonWall`
  ```

- Add this section after "Presets" and before "Overlay-editable fields":

  ````markdown
  ## A card or button of light

  `cove` is made for a container, not only a full-bleed hero. Give the container `position: relative`, `overflow: hidden` and its border radius, render the gradient first and the content over it:

  ```tsx
  <div className="relative overflow-hidden rounded-3xl">
    <WavrGradient config={cove} className="absolute inset-0" />
    <div className="relative p-8 text-white">Autonomous demos</div>
  </div>
  ```

  On a light page, make the palette's last colour (the rim) close to the page colour and the card melts into it. Radii up to about a quarter of the shorter side need nothing more; for a pill, raise `softness` so the rim stays even round the ends.
  ````

**7c.** Copy the file over its four copies:

```bash
for f in .claude/skills/wavr/references/config.md .codex/skills/wavr/references/config.md .cursor/skills/wavr/references/config.md packages/create-wavr/skill/references/config.md; do cp skills/wavr/references/config.md "$f"; done
```

**Verify**:

```bash
for f in .claude/skills/wavr/references/config.md .codex/skills/wavr/references/config.md .cursor/skills/wavr/references/config.md packages/create-wavr/skill/references/config.md; do cmp skills/wavr/references/config.md "$f" && echo same; done
```

→ `same` four times. `grep -c "cove" CLAUDE.md` → at least `3`.

### Step 8: Final gate

```bash
pnpm lint
```

```bash
pnpm test
```

```bash
pnpm build
```

**Verify**: all exit 0.

## Test plan

No new test file. The repo's tests already loop over every gradient type and
every preset, so registering Cove puts it under them:

- `apps/editor/lib/gradient-types.test.ts` — editor option, shader id, guard,
  dispatch branch, flagship thumbnail, palette roles (extended in Step 5).
- `apps/editor/lib/portable-shader.test.ts` — the export of `cove` declares
  every name it uses and is the engine's gradient line for line; its pointer
  style matches `mouse.glsl`.
- `apps/editor/lib/engine-shader-sources.test.ts` — the `cove` layer program
  holds exactly one gradient function, called once.
- `apps/editor/lib/presets.test.ts` — both presets are exported, listed for
  `create-wavr`, and have thumbnails rendered from their current config.
- `apps/editor/lib/random-look.test.ts`, `hdr-headroom.test.ts` — lists
  extended in Step 5.
- `packages/react` — `types.check.ts` (part of `pnpm lint`) fails if the
  published union drifts.
- Rendered output: Step 6 (snapshot diff, luminance script, export parity,
  parity harness).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:parity` passes
- [ ] `pnpm snapshots:diff test-results/cove-base test-results/cove-after --fail-above 0` exits 0 and reports only `type-cove` as new
- [ ] The Step 6b script exits 0 for `preset-cove.png` and `preset-emberCove.png`
- [ ] `pnpm export-parity test-results/cove-export --only cove --max-mean 2` exits 0
- [ ] `apps/editor/public/presets/cove.webp` and `emberCove.webp` exist and `thumbnails.json` has 26 keys
- [ ] The five `config.md` copies are byte-identical
- [ ] `git status --short` shows no modified file outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm lint` or `pnpm test` fails at Step 0, before any change.
- The code at the locations in "Current state" doesn't match the excerpts.
- The shader fails to compile (`ERROR: 6:<line>` from the parity harness or a
  thrown link error) after you have re-pasted it once. Report the log; do not
  rewrite the shader.
- Step 6a shows any existing image changed. You have edited something outside
  the new guarded block.
- The Step 6b script fails, or a still is black, flat, striped or has a hard
  edge. Attach the PNG and the script's output.
- Step 6d's mean difference is above 2.
- A step seems to need a file outside the in-scope list (for example a schema
  migration, `GradientPanel.tsx`, or `portable-shader.ts`).
- No Chromium is available for the snapshot, thumbnail or parity commands.

## Maintenance notes

- **Look at it on a real GPU.** Everything here ran on SwiftShader. The Vercel
  preview of the PR is the place: open `/editor`, pick the Cove tile, resize
  the window to wide and tall, move the pointer over the rim. `CLAUDE.md`
  asks for this for any change to rendered output.
- **Bloom and HDR are untested with Cove.** The presets switch the cinematic
  bloom off because the tuned look has none and the planner's harness had no
  post pass. If bloom flatters it on a real screen, change
  `realBloomEnabled` in the two presets and run `pnpm thumbnails`. The 1.5
  stops of HDR headroom follow the house rule but were not seen on an HDR
  display.
- **The constants that shape the look**, all in `coveGradient`: the reach
  range `mix(0.08, 0.42, soft)` (share of the shorter half side), the edge
  light's gain `2.9`, the rim's gain `1.4` and its reach `0.38`, the pools'
  gain `0.8 * wander`, size `mix(0.36, 0.66, soft)` and orbit `0.86 + 0.2 * h.y`.
  Change one at a time and compare stills with `pnpm snapshots:diff`.
- **Pills.** The frame of light is a rectangle. A host radius up to about a
  quarter of the shorter side clips only the palest corner light and looks
  right. A full pill dims the rim at 45° round each end (by up to half at the
  default softness, about 15% at softness 1). The clean fix is a corner
  radius for the frame; the natural home for it is the layer's `focus` field
  (0–1, already plumbed through schema, engine, exports and URL, read only by
  Corona today), shown as a "Corners" slider for Cove as the Corona section
  is in `GradientPanel.tsx`. Deferred: it needs a rounded-corner term in
  `coveLight` that stays crease-free at radius 0, which deserves its own
  tuning pass.
- **The colour profile.** The palette was tuned as sRGB numbers and the
  presets declare Display P3, as every light-field preset does, so on a
  wide-gamut screen it is more saturated than the reference clip. If that is
  too much, lower the lights' blue-violet saturation in
  `LIGHT_FIELD_PALETTES.cove` rather than changing the profile.
- **Reviewers**: check that the diff of `gradients.glsl` is purely additive
  (one comment line changed, one block and one dispatch branch added), and
  that no existing shader id changed.
