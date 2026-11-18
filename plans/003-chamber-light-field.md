# Plan 003: Wavr has a Chamber look: a room of light, seen in depth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a104287..HEAD -- packages/core/src/shaders packages/core/src/engine.ts packages/core/src/layers.ts packages/core/src/presets packages/schema/src/enums.ts packages/react/src packages/preview/src/presets.ts packages/create-wavr/src/args.ts apps/editor/lib apps/editor/public/presets skills/wavr CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive: a new gradient type; no existing type's code changes)
- **Depends on**: none
- **Category**: direction (new feature)
- **Planned at**: commit `a104287`, 2026-11-15

## Why this matters

The owner wants Wavr to feel like a James Turrell exhibition and asked for it
to "look 3D". Every look Wavr has today is flat: light on a wall, seen
head-on. Turrell's rooms read as deep because of four cues, none of which needs
a 3D engine: walls that converge to a far wall (perspective), light from an
opening that falls on those walls and fades toward you, a floor that mirrors
the opening, and near surfaces that slide past far ones as you move your head.

This plan adds a light field, **`chamber`**, that has all four: you stand at
the mouth of a room whose far wall holds an opening full of light. It is one
fragment-shader function in closed form (no raymarch, no blur pass, no new
uniform), costs the same as `cove`, and follows the canvas's shape. The shader
is already written and tuned (Step 1, to be pasted as is); the rest is the
wiring every gradient type needs, which the repo did last for `cove`.

## What the look is (so you can judge a render)

Two reference renders of the finished shader are in `plans/assets/`:

- `plans/assets/003-chamber-looks.jpg` — top row: the `chamber` preset
  settings, the `skyChamber` settings, and `chamber` again 27 s later (the far
  wall has shifted against the near walls: that is the eye drifting). Bottom
  row: the same room on a 2.4:1 canvas and on a 1:2 canvas, then with the
  pointer resting on it (the pointer lens bends the opening's edge; that is
  expected, see Maintenance notes).
- `plans/assets/003-chamber-dials.jpg` — four columns, top then bottom:
  softness 0 and 1, distortion 0 and 1, complexity 1 and 8, scale 0.6 and 1.6.

What you should see in every render: a far wall smaller than the frame and
centred (give or take the drift); four trapezoids (two side walls, floor,
ceiling) running from it to the frame's edges; the trapezoids brightest beside
the far wall and dark at the frame's edge; the opening pale at its rim and
saturated at its core; a soft pool of the opening's colour on the floor in
front of it.

How it works, in short. The eye sits `CHAMBER_FOCAL` behind the frame; the
room's mouth is the frame. A ray from the eye through the pixel meets a side
wall, the floor or ceiling, or the far wall, whichever is nearest (three
divisions). What a wall point receives from the opening is Lambert's formula
for a glowing rectangle, which is exact and has no clipping case here. The
eye's position drifts on a slow Lissajous curve, which is the parallax.

**What was and wasn't verified during planning.** The shader was rendered by
the repo's own snapshot tool (`pnpm snapshots`, the real engine on headless
Chromium / SwiftShader) in a scratch copy of the repo, spliced into `cove`'s
slot (id 29), at several shapes, times and settings; those are the reference
renders. Benchmarked there at 960×960 it took 639 ms a frame against `cove`'s
691 and `aperture`'s 711 (SwiftShader on a CPU: relative numbers only). It was
**not** rendered under id 30, with the presets' own globals (`toneMapMode: 0`,
Display P3), through the code exports, in HDR or on a real GPU. Steps 6 and 7
do the first three.

## Current state

`cove` was added in three commits that are in this repo's history and are the
exact pattern for this plan. Read them before starting:

```bash
git show 535fe3f   # the shader and its mouse style
git show 3fdc3cc   # registering the type, presets, thumbnails, Look tile, tests
git show 8409970   # docs
```

Where a gradient type is wired today (excerpts from commit `a104287`):

- `packages/schema/src/enums.ts` — the canonical list:

  ```ts
  export const GRADIENT_TYPES = [
    "image",
    "liquidChrome", "iridescentFoil", "horizonGlow", "lightLeak", "inkSmoke", "plasmaOrb",
    "flow", "pulse",
    "aperture", "cove", "halo", "corona", "lightWall",
  ] as const;
  ```

  Types are stored by name, never by position, so order is free.

- `packages/core/src/engine.ts` — `GRADIENT_TYPE_IDS` ends:

  ```ts
    flow: 27,
    pulse: 28,
    cove: 29,
  };
  ```

  Ids are compiled into code exports and embeds: existing ids never change.
  The new one is **30**.

- `packages/core/src/shaders/gradients.glsl` — every gradient function sits in
  an `#if WAVR_GRADIENT == <id>` … `#endif` block. The "Light fields" section's
  intro comment begins:

  ```glsl
  // Coloured light in a space, after light installations: an opening of light in
  // a wall, a frame lit from its edges, a luminous ring in the dark, a backlit
  // wall. These add light rather
  ```

  The last light field is `coveGradient`; its block ends:

  ```glsl
    vec3 light = tint * 2.9 * body + pools * 0.8 * wander + srgbToLinear(u_colors[last]) * 1.4 * lip;
    return lightToDisplay(srgbToLinear(u_colors[0]) + (1.0 - exp(-light)) * framePeak());
  }
  #endif
  ```

  followed by a blank line and the banner
  `// Image Gradient (type 8) — samples uploaded texture`. The dispatcher
  `computeGradient()` ends:

  ```glsl
  #elif WAVR_GRADIENT == 29
    return coveGradient(uv, time);
  #else
  #error Unknown WAVR_GRADIENT
  #endif
  ```

- `packages/core/src/shaders/mouse.glsl` — one pointer style per id; the table
  ends:

  ```glsl
  #elif WAVR_GRADIENT == 29
  #define WAVR_MOUSE_WARP mouseWarpLens
  #else
  #error No mouse warp style for this WAVR_GRADIENT
  #endif
  ```

- `packages/core/src/layers.ts` — `defaultSoftnessForGradientType` has
  `case "cove":` in the group that returns `0.5`; `LIGHT_FIELD_PALETTES` and
  `LIGHT_FIELD_PALETTE_ROLES` have entries for `aperture`, `cove`, `lightWall`:

  ```ts
  cove: [[0.08, 0.1, 0.32], [0.24, 0.3, 1], [0.5, 0.3, 1], [0.4, 0.42, 1], [1, 0.86, 0.95]],
  ```
  ```ts
  cove: "First colour is the dark core and the last the pale rim; the ones between are the lights round the frame.",
  ```

- `packages/core/src/presets/light-fields.ts` — the presets. `cove` reads:

  ```ts
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
  ```

- Every list a preset must be in (each has `cove` and `emberCove` today; add
  the new ones right after `emberCove`): `packages/core/src/presets/catalog.ts`
  (`PRESET_CATALOG`), `packages/core/src/presets/index.ts` (the re-export),
  `packages/react/src/presets.ts` (import `as coreX` and re-export),
  `packages/create-wavr/src/args.ts` (`PRESETS`),
  `packages/preview/src/presets.ts` (`PRESET_OPTIONS`; flagship presets only:
  it has `cove`, not `emberCove`).

- `packages/react/src/types.ts` — the published union, kept standalone:

  ```ts
    | "aperture" | "cove" | "halo" | "corona" | "lightWall";
  ```

- `apps/editor/lib/gradient-types.ts` — `GRADIENT_OPTIONS`, the Look grid;
  `cove`'s entry:

  ```ts
  {
    value: "cove",
    label: "Cove",
    description: `Light pouring in from every edge of the frame round a dark core. ${LIGHT_FIELD_PALETTE_ROLES.cove}`,
  },
  ```

- Tests that pin these lists: `apps/editor/lib/gradient-types.test.ts` (the
  Look grid order `"aperture", "cove", "halo", "corona", "lightWall", …`, the
  `slice(5, 13)` of light modes, the role descriptions, the id table ending
  `cove: 29`), `apps/editor/lib/hdr-headroom.test.ts` (headroom per light-field
  preset, has `cove: 1.5, emberCove: 1.5,`), `apps/editor/lib/random-look.test.ts`
  (the sorted list of types Randomize picks from).

- `apps/editor/public/presets/` — one `<id>.webp` per preset plus
  `thumbnails.json`, generated by `pnpm thumbnails`.

- Docs: `CLAUDE.md` ("Adding a Gradient Mode" lists the light fields and which
  read their stops by role) and five copies of the agent skill's config
  reference (`skills/wavr/references/config.md`,
  `packages/create-wavr/skill/references/config.md`,
  `.claude/skills/wavr/references/config.md`,
  `.codex/skills/wavr/references/config.md`,
  `.cursor/skills/wavr/references/config.md`), which `8409970` edited
  identically.

Rules from `CLAUDE.md` that apply (quoted):

- "Gradient bodies must not read `u_mouse*`": the pointer reaches a gradient
  only through `mouseWarp()` in `mouse.glsl`. A test enforces it.
- "At `u_hdrPeak` 1 every shader path must stay today's arithmetic." This plan
  adds a block and changes no existing line, so existing types cannot move.
- The light fields' presets "set `toneMapMode: 0` … `colorProfile:
  "display-p3"`, and an `hdrHeadroom` by how much of the frame is light (2 stops
  for a small light in a dark room, 1.5 for an opening in a wall …, 1 when the
  whole frame is light)".
- Sentence case for every label and name.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | all pass |
| Build | `pnpm build` | exit 0 |
| Render stills | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots <dir> [options]` | one line per image, exit 0 |
| Compare two runs | `pnpm snapshots:diff <dirA> <dirB>` | per-image difference |
| Thumbnails | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm thumbnails` | writes `apps/editor/public/presets/*.webp` and `thumbnails.json` |
| Export parity | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity <dir> --only chamber` | mean difference printed, exit 0 |
| Parity harness | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` | all pass |

Known from earlier runs in this repo: drop `CHROMIUM_PATH=…` where Playwright's
own browser is installed; `pnpm test:parity` empties `test-results/`, so run it
last and keep snapshot output elsewhere; `pnpm lint`, `test` and `build` go
through Turborepo and may print `cache hit`.

## Scope

**In scope** (the only files you should modify or create):

- `packages/schema/src/enums.ts`
- `packages/core/src/engine.ts` (one line in `GRADIENT_TYPE_IDS`)
- `packages/core/src/shaders/gradients.glsl`
- `packages/core/src/shaders/mouse.glsl`
- `packages/core/src/layers.ts`
- `packages/core/src/presets/light-fields.ts`, `catalog.ts`, `index.ts`
- `packages/react/src/types.ts`, `packages/react/src/presets.ts`
- `packages/preview/src/presets.ts`
- `packages/create-wavr/src/args.ts`
- `apps/editor/lib/gradient-types.ts`
- `apps/editor/lib/gradient-types.test.ts`, `hdr-headroom.test.ts`, `random-look.test.ts`
- `apps/editor/public/presets/chamber.webp`, `skyChamber.webp` (generated),
  `thumbnails.json` (generated)
- the five `config.md` copies listed above, and `CLAUDE.md`
- `plans/README.md` (your status row)

**Out of scope** (do NOT touch):

- Any other gradient's shader code, `common.glsl`, `layer.glsl`, `post.glsl`.
  If the shader in Step 1 seems to need a helper that is not there, STOP.
- `packages/core/src/engine.ts` beyond the id line: no new uniform, no entry in
  `FULL_RESOLUTION_GRADIENTS` (the shader does not read `gl_FragCoord`).
- `apps/editor/lib/portable-shader.ts` / `portable-runtime.ts`: code exports
  cut the gradient out of the engine's GLSL by themselves.
- `apps/editor/lib/initial-scene.ts`, the landing page, and anything under
  `components/litt` or `lib/litt` (vendored).
- A pointer-driven camera (see Maintenance notes): not in this plan.

## Git workflow

- Work on the branch you were given; if none, `advisor/003-chamber-light-field`.
- Three commits, as `cove` had, in the repo's style (sentence case, imperative,
  no prefix): `Add the chamber shader`, `Wire chamber in as a light field, with
  presets`, `Document chamber`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-before
```

**Verify**: lint and tests exit 0; the snapshot run prints a line per image and
exits 0. Keep `/tmp/chamber-before` for Step 6. If lint or tests fail before
you changed anything, STOP.

### Step 1: Add the shader

In `packages/core/src/shaders/gradients.glsl`:

1. In the "Light fields" intro comment, add the room to the list: change
   `a frame lit from its edges, a luminous ring in the dark, a backlit` + newline
   + `// wall. These add light rather` so the sentence reads "… a frame lit from
   its edges, a room seen from its mouth, a luminous ring in the dark, a backlit
   wall." Re-wrap the comment at the file's width; change no code.

2. After the `#endif` that closes `coveGradient` and before the blank line and
   the Image banner, paste this block exactly:

```glsl

// Chamber: a room, seen from its mouth. The frame is the mouth; the side
// walls, floor and ceiling run back from it to a far wall with an opening
// full of light. The first stop is the room; the others are the light in the
// opening, from its deep core (stop 1) out to its pale rim (the last stop), as
// in aperture. The opening lights the room: each surface takes what it
// receives from that rectangle of light (exactly: Lambert's formula), so the
// walls glow beside the far wall and fall to dark toward the eye, and the
// polished floor mirrors the opening. The eye drifts a little, slowly, so near
// walls slide past the far one: the room has depth. Scale is the far wall's
// size on screen (smaller is a deeper room), complexity the opening's size
// (a window at 1, the whole far wall at 8), softness coves the room's corners
// and lengthens the passage from rim to core, and distortion is the haze: the
// opening's light hanging in the air in front of it.
#if WAVR_GRADIENT == 30
// One edge of Lambert's formula: what a point with normal `n` receives from
// the edge of a glowing polygon that runs from direction `a` to direction `b`
// (unit vectors from the point to the edge's two ends).
float chamberEdge(vec3 a, vec3 b, vec3 n) {
  vec3 x = cross(a, b);
  float s = length(x);
  return atan(s, dot(a, b)) * dot(x, n) / max(s, 1e-6);
}

// The irradiance (0..1) at `pos`, on a surface with normal `n`, from a
// uniformly glowing rectangle spanning -halfSize..halfSize on the plane
// z = `z`: Lambert's formula, exact. The rectangle lies inside the room's
// section, so it never dips under a wall's horizon and needs no clipping.
float chamberIrradiance(vec3 pos, vec3 n, vec2 halfSize, float z) {
  vec3 v0 = normalize(vec3(-halfSize.x, -halfSize.y, z) - pos);
  vec3 v1 = normalize(vec3(halfSize.x, -halfSize.y, z) - pos);
  vec3 v2 = normalize(vec3(halfSize.x, halfSize.y, z) - pos);
  vec3 v3 = normalize(vec3(-halfSize.x, halfSize.y, z) - pos);
  float e = chamberEdge(v0, v1, n) + chamberEdge(v1, v2, n) + chamberEdge(v2, v3, n) + chamberEdge(v3, v0, n);
  return abs(e) / 6.2831853;
}
#endif

#if WAVR_GRADIENT == 30
vec3 chamberGradient(vec2 uv, float time) {
  float px = 1.0 / u_resolution.y;
  vec2 p = centeredUV(uv);
  float soft = clamp(u_softness, 0.0, 1.0);
  float haze = clamp(u_distortion, 0.0, 1.0);
  int last = max(u_colorCount - 1, 0);
  int first = min(1, last);

  // The room. Its mouth is the frame itself, CHAMBER_FOCAL in front of the
  // eye; its far wall has the same shape and shows at `far` of the frame's
  // size. One unit is the canvas height.
  const float CHAMBER_FOCAL = 1.25;
  vec2 room = vec2(0.5 * u_resolution.x / u_resolution.y, 0.5);
  float far = clamp(0.4 * u_scale, 0.12, 0.85);
  float zFar = CHAMBER_FOCAL / far;

  // The eye drifts a little, slowly, so the near walls slide past the far one.
  vec2 eye = vec2(0.07 * sin(time * 0.11), 0.035 * sin(time * 0.083 + 1.3));
  vec3 dir = vec3(p - eye, CHAMBER_FOCAL);

  // Where the ray from the eye meets the side walls (x), the floor or ceiling
  // (y) and the far wall (z); the nearest is what we see.
  vec2 side = mix(vec2(-1.0), vec2(1.0), step(0.0, dir.xy));
  vec3 ts = vec3((side * room - eye) / (side * max(abs(dir.xy), 1e-6)), zFar / CHAMBER_FOCAL);
  float t = min(min(ts.x, ts.y), ts.z);
  vec3 pos = vec3(eye, 0.0) + dir * t;
  float along = clamp((pos.z - CHAMBER_FOCAL) / (zFar - CHAMBER_FOCAL), 0.0, 1.0);

  // Its normal. Softness coves the corners: near a junction the normals of the
  // two surfaces blend, so the edge between them dissolves.
  vec3 wts = exp(-(ts - t) / (mix(0.004, 0.22, soft * soft) * ts.z));
  vec3 n = normalize(vec3(-side * wts.xy, -wts.z));
  wts /= wts.x + wts.y + wts.z;

  // The opening in the far wall: a knife edge, anti-aliased over about a
  // pixel, softened by haze.
  float size = mix(0.34, 1.0, clamp((u_complexity - 1.0) / 7.0, 0.0, 1.0));
  vec2 halfOpen = room * size;
  float minHalf = min(halfOpen.x, halfOpen.y);
  vec2 q = eye + dir.xy * ts.z;
  float d = sdRoundedBox(q, halfOpen, 0.0);
  float open = 0.5 - 0.5 * erfApprox(d * far / (1.41421 * (0.6 * px + 0.01 * haze)));

  // Its light, as in aperture: pale at the rim (the last stop), deepening to
  // the core (stop 1) with the distance from the edges.
  float breathe = 0.6 * sin(time * 0.21) + 0.4 * sin(time * 0.13 + 1.7);
  vec2 inset = halfOpen - abs(q);
  float lambda = mix(0.1, 0.5, soft) * minHalf * (1.0 + 0.2 * breathe);
  float into = min(inset.x, inset.y) - lambda * log(1.0 + exp(-abs(inset.x - inset.y) / lambda));
  vec3 light = lightStops(mix(float(last), float(first), 1.0 - exp(-max(into, 0.0) / lambda)), first, last);
  light *= 1.0 + 0.07 * sin(time * 0.29 + 0.8);
  // The colour the opening sends into the room.
  vec3 mean = lightStops(mix(float(last), float(first), 0.6), first, last);

  // What the room's surfaces receive from the opening, exactly, and from each
  // other, roughly: more toward the far end, and on the far wall most beside
  // the opening.
  float bounce = 0.16 * size * (0.15 + 0.85 * along * along)
               * mix(1.0, 1.6 * exp(-max(d, 0.0) / (0.9 * minHalf)), wts.z);
  vec3 spill = mean * (2.6 * chamberIrradiance(pos, n, halfOpen, zFar) + bounce);

  // The floor is polished: it mirrors the opening, blurred with the distance
  // the light travels and stronger at a grazing angle.
  float tr = (zFar - pos.z) / dir.z;
  vec2 hit = vec2(pos.x + dir.x * tr, pos.y - dir.y * tr);
  float mirror = blurredBox(hit, halfOpen, vec2((0.3 + 0.9 * tr / ts.z) * minHalf));
  float fresnel = 0.05 + 0.95 * pow(1.0 - abs(dir.y) / length(dir), 5.0);
  spill += mean * (0.9 * mirror * fresnel * wts.y * step(dir.y, 0.0));

  // The room takes the light up as film does; it is darker toward the eye.
  vec3 wall = srgbToLinear(u_colors[0]) * (0.5 + 0.5 * along);
  vec3 col = lightToDisplay(mix(wall + (1.0 - exp(-spill)), light * framePeak(), open));

  // Haze: the opening's light hangs in the air in front of it (as in
  // aperture, the exact blur of the opening as it shows on screen).
  vec2 shown = halfOpen * far;
  vec2 spread = (0.9 * shown + 0.08) * mix(0.35, 1.0, haze);
  float glow = blurredBox(p - eye * (1.0 - far), shown, spread) / blurredBox(vec2(0.0), shown, spread);
  return mix(col, lightToDisplay(mean * framePeak()), haze * mix(0.7 * min(glow, 1.0), 0.25, open));
}
#endif
```

   The helpers it calls (`centeredUV`, `sdRoundedBox`, `erfApprox`,
   `blurredBox`, `lightStops`, `lightToDisplay`, `srgbToLinear`, `framePeak`)
   are all in `common.glsl` today.

3. In `computeGradient()`, add before `#else` / `#error Unknown WAVR_GRADIENT`:

```glsl
#elif WAVR_GRADIENT == 30
  return chamberGradient(uv, time);
```

In `packages/core/src/shaders/mouse.glsl`, add before `#else` /
`#error No mouse warp style for this WAVR_GRADIENT`:

```glsl
#elif WAVR_GRADIENT == 30
#define WAVR_MOUSE_WARP mouseWarpLens
```

**Verify**: `grep -c "WAVR_GRADIENT == 30" packages/core/src/shaders/gradients.glsl`
→ `3`; `grep -c "WAVR_GRADIENT == 30" packages/core/src/shaders/mouse.glsl` → `1`.
(Nothing compiles it yet; that is Step 2.)

### Step 2: Register the type

- `packages/schema/src/enums.ts`: `"aperture", "cove", "chamber", "halo", "corona", "lightWall",`
- `packages/core/src/engine.ts`: add `chamber: 30,` after `cove: 29,`.
- `packages/react/src/types.ts`: `| "aperture" | "cove" | "chamber" | "halo" | "corona" | "lightWall";`
- `packages/core/src/layers.ts`:
  - add `case "chamber":` under `case "cove":` in
    `defaultSoftnessForGradientType` (returns `0.5`);
  - in `LIGHT_FIELD_PALETTES`, after `cove`:
    `chamber: [[0.082, 0.071, 0.169], [0.91, 0.227, 0.471], [1, 0.435, 0.569], [1, 0.839, 0.812]],`
  - in `LIGHT_FIELD_PALETTE_ROLES`, after `cove`:
    `chamber: "First colour is the room; the rest are the light in the opening, from its core to its rim.",`

**Verify**: `pnpm lint` → exit 0 except for errors that name
`gradient-types.ts` (the missing Look tile, fixed in Step 5). If it reports
anything else, fix that before going on. Then:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-first --only chamber --size 432 --aspect 1.78 --palette "#15122b,#e83a78,#ff6f91,#ffd6cf" --layer softness=0.5,distortion=0.3,complexity=5,scale=1
```

→ one line `type-chamber … lit 100.0%  mean 0.2…`, exit 0. Open
`/tmp/chamber-first/type-chamber.png` and compare it with the first image of
`plans/assets/003-chamber-looks.jpg`: the same room (the reference is 4:3 and
half a second apart in time, so proportions differ slightly). A GLSL compile
error here prints `ERROR: <file>:<line>`; if the line is inside the pasted
block, re-check the paste against this plan character for character before
anything else.

### Step 3: Add the presets, in every list

In `packages/core/src/presets/light-fields.ts`, after `emberCove`:

```ts
// A room of rose light: an opening in the far wall, pale at its rim, lights
// the walls beside it and lies mirrored on the floor.
export const chamber: GradientConfig = {
  layers: [{
    type: "chamber",
    colors: LIGHT_FIELD_PALETTES.chamber,
    speed: 0.5,
    complexity: 5,
    scale: 1,
    distortion: 0.3,
    softness: 0.5,
  }],
  grain: 0,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1.5,
  realBloomEnabled: false,
};

// The far wall is all sky: a field of blue light at the end of a coved room.
export const skyChamber: GradientConfig = {
  layers: [{
    type: "chamber",
    colors: [[0.027, 0.039, 0.122], [0.145, 0.314, 1], [0.353, 0.549, 1], [0.851, 0.929, 1]],
    speed: 0.5,
    complexity: 8,
    scale: 1.1,
    distortion: 0.5,
    softness: 0.7,
  }],
  grain: 0,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1,
  realBloomEnabled: false,
};
```

Then add both, right after `emberCove`, in: `catalog.ts`
(`{ id: "chamber", name: "Chamber", category: "lightFields", config: lightFields.chamber },`
and `{ id: "skyChamber", name: "Sky chamber", … }`), `presets/index.ts`,
`packages/react/src/presets.ts` (both the `as coreChamber` / `as coreSkyChamber`
imports and the `export const` lines), `packages/create-wavr/src/args.ts`. In
`packages/preview/src/presets.ts` add only `{ id: "chamber", label: "Chamber" },`
after `cove`.

**Verify**: `grep -rn "skyChamber" packages --include=*.ts -l | sort` lists
exactly `packages/core/src/presets/catalog.ts`, `…/index.ts`,
`…/light-fields.ts`, `packages/create-wavr/src/args.ts`,
`packages/react/src/presets.ts`.

### Step 4: Render the thumbnails

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm thumbnails
```

**Verify**: `git status --short apps/editor/public/presets` shows two new
files, `chamber.webp` and `skyChamber.webp`, and `thumbnails.json` modified
with exactly two added lines. If any existing `.webp` changed, STOP: something
other than the new type moved.

### Step 5: Add the Look tile and extend the tests

- `apps/editor/lib/gradient-types.ts`, after the `cove` entry:

  ```ts
  {
    value: "chamber",
    label: "Chamber",
    description: `A room seen from its mouth, lit by an opening in its far wall. ${LIGHT_FIELD_PALETTE_ROLES.chamber}`,
  },
  ```

- `apps/editor/lib/gradient-types.test.ts`: the Look grid order becomes
  `"aperture", "cove", "chamber", "halo", "corona", "lightWall",`; the light
  modes' slice becomes `slice(6, 14)`; add
  `expect(description("chamber")).toContain(LIGHT_FIELD_PALETTE_ROLES.chamber);`
  after the `cove` line; add `chamber: 30,` after `cove: 29,` in the id table.
- `apps/editor/lib/hdr-headroom.test.ts`: add `chamber: 1.5, skyChamber: 1,`
  after the `cove` line.
- `apps/editor/lib/random-look.test.ts`: insert `"chamber"` in the sorted list
  between `"aperture"` and `"corona"`.

**Verify**: `pnpm lint && pnpm test` → exit 0. If a test you did not edit
fails naming `chamber` (another pinned list), extend that list the way `cove`
is in it and note it in your report.

### Step 6: Prove the look and that nothing else moved

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-after
pnpm snapshots:diff /tmp/chamber-before /tmp/chamber-after
```

**Verify**: every image that exists in both runs differs by 0 (max 0/255); the
only new image is `type-chamber.png`.

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-presets --presets --only preset-chamber,preset-skyChamber --size 288 --aspect 1.3334
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-t1 --only chamber --size 288 --aspect 1.3334 --time 1
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-t28 --only chamber --size 288 --aspect 1.3334 --time 28
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-wide --only chamber --size 288 --aspect 2.4
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/chamber-tall --only chamber --size 288 --aspect 0.5
```

**Verify** (look at the PNGs; all must hold):

- `preset-chamber.png` and `preset-skyChamber.png` match the first two images
  of `plans/assets/003-chamber-looks.jpg` in layout and colour (the presets use
  no tone map and Display P3, so they may be a little more saturated; a
  different layout is a failure). Each line prints `lit 100.0%`.
- Between `chamber-t1` and `chamber-t28` the far wall has moved a few pixels
  against the frame (`pnpm snapshots:diff /tmp/chamber-t1 /tmp/chamber-t28`
  reports a non-zero difference).
- The wide and tall renders show the same room stretched to the canvas, as in
  the reference's bottom row; nothing is clipped or mirrored.

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity /tmp/chamber-export --only chamber
```

**Verify**: mean difference below 1/255 (cove's was 0.02/255). A compile error
in the exported shader means the export's cutter missed a helper: STOP and
report the error text; do not edit `portable-shader.ts`.

### Step 7: Document it

- `CLAUDE.md`, section "Adding a Gradient Mode", step 2: in the list
  `The light fields ("Light fields": aperture, cove, halo, corona, lightWall)`
  add `chamber` after `cove`; in `aperture, cove and light wall read their stops
  by role` add chamber (`aperture, cove, chamber and light wall`); in the
  headroom guidance, after "1.5 for an opening in a wall or a frame lit from its
  edges" nothing changes (chamber is an opening in a wall).
- The five `config.md` copies: run `git show 8409970 -- skills/wavr/references/config.md`
  to see what was added for `cove`, and add the same three things for
  `chamber`, identically in all five files: the type in the list of light
  fields, a short paragraph (what it is; stop roles: "the first colour is the
  room, the rest are the light in the opening from its core to its rim"; scale
  = far wall's size, complexity = opening's size, softness = coved corners and
  the rim-to-core passage, distortion = haze), and the two preset ids
  `chamber`, `skyChamber` in the preset list.

**Verify**: `for f in skills/wavr/references/config.md packages/create-wavr/skill/references/config.md .claude/skills/wavr/references/config.md .codex/skills/wavr/references/config.md .cursor/skills/wavr/references/config.md; do grep -c "skyChamber" $f; done`
prints the same non-zero number five times, and
`diff skills/wavr/references/config.md .claude/skills/wavr/references/config.md`
prints what it printed before your edit (run it on a clean checkout first to
know; today the copies may already differ in unrelated lines).

### Step 8: Final gate

```bash
pnpm lint && pnpm test && pnpm build
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity
```

**Verify**: all exit 0. The parity harness compiles every gradient type before
its first test, so it fails with the GLSL log if `chamber` does not compile.

## Test plan

No new test file. The existing suites cover a new type once the lists are
extended (Step 5): `gradient-types.test.ts` fails if `chamber` lacks an editor
option, a shader id, a guard, a dispatch branch or a palette, or if any
gradient reads `u_mouse*`; `engine-shader-sources.test.ts` checks one gradient
function per layer program; `engine-mouse-shader.test.ts` checks the mouse
style line; `presets.test.ts` fails if a preset's thumbnail is missing or
stale; `hdr-headroom.test.ts` pins the headroom. The render itself is checked
by eye in Step 6 against the reference images.

## Done criteria

ALL must hold:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` exit 0
- [ ] `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` exits 0
- [ ] `pnpm snapshots:diff /tmp/chamber-before /tmp/chamber-after` shows 0
      difference for every pre-existing image
- [ ] `apps/editor/public/presets/chamber.webp` and `skyChamber.webp` exist; no
      other `.webp` changed
- [ ] The shader block in `gradients.glsl` is the plan's, unedited (if you had
      to change it, say exactly what and why in your report)
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts.
- Step 0's baseline fails before you changed anything.
- The shader fails to compile under id 30 and the cause is not a paste error.
- Any pre-existing snapshot or thumbnail changes.
- The render does not show a room (for example a flat far wall filling the
  frame, or black side walls): do not retune constants; report with the PNG.
- `export-parity` fails to compile or differs by more than 1/255 on average.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Not yet seen on a real GPU, in HDR, or with bloom.** In HDR the opening is
  multiplied by `framePeak()` and the room's walls are not (the house rule: the
  light gets brighter, the room stays). Whether the lit walls then look too dim
  beside the opening needs an HDR screen; if so, the fix is a share of
  `framePeak()` on `spill`, guarded with `u_hdrPeak > 1.0`.
- **The pointer.** `chamber` uses the lens warp, which bends the opening's
  knife edge (bottom-right image of the looks sheet). The response this look
  really wants is the pointer moving the *eye* (`eye` in the shader), so the
  room answers like a window you look through. That needs the pointer inside
  the gradient, which the house rule and two tests forbid
  (`gradient-types.test.ts` "no gradient function reads the mouse",
  `engine-mouse-shader.test.ts`). The clean design: a `vec2 mouseEye()` helper
  in `mouse.glsl` (smoothed pointer offset × presence × react), an identity
  warp style for this type, the rule reworded to "the pointer reaches gradients
  only through `mouse.glsl`", and `portable-shader.ts` taught to carry the
  helper. Deliberately left out of this plan; decide with the owner.
- **Banding.** The walls are long, dark, smooth ramps: the worst case for 8
  bits. The engine's targets are half-float and the presets rely on the
  editor's anti-banding. If bands show on a real screen, give the presets
  `grain: 0.02` before touching the shader.
- **The gallery (plan 004)** lists `chamber` and `skyChamber` as rooms.
- Deferred: a second depth look after Turrell's corner projections (a cube of
  light that seems to float in a room's corner). Worth doing only once this
  one has been seen on real screens.
