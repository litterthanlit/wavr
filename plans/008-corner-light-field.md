# Plan 008: Wavr has a Corner look: a block of light floating in the corner of a dark room

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: plans 003 and 006 must have landed:
> `grep -c "chamber: 30" packages/core/src/engine.ts` → `1`,
> `grep -c "^vec2 mouseEye()" packages/core/src/shaders/mouse.glsl` → `1`,
> `grep -c "WAVR_GRADIENT == 31" packages/core/src/shaders/gradients.glsl` → `0`.
> Then compare the "Current state" excerpts against the live code; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive: a new gradient type; no existing type's code changes)
- **Depends on**: plans/003-chamber-light-field.md and plans/006-chamber-pointer-eye.md (both must be DONE)
- **Category**: direction (new feature)
- **Planned at**: commit `8528df7`, 2026-11-18 (on top of plans 003 and 006 as those plans make their changes)

## Why this matters

Chamber (plan 003) gave Wavr a room you look *into*. The other famous way
light makes depth, and the piece that made James Turrell's name, runs the
opposite way: light projected into the corner of a dark room, shaped so that
it reads as a solid glowing block floating in front of the corner. Nothing is
there but light on two walls. Walk a step and the block bends, because it was
never a block.

This plan adds that as a light field, **`corner`**. It is the second depth
look, and the one that most rewards the pointer-as-head from plan 006: move
the pointer and the illusion gives itself away, exactly as the real thing does
when you move. Like Chamber it is one closed-form fragment function with no
raymarch, no blur pass and no new uniform, and it costs the same as Cove.

## What the look is (so you can judge a render)

Reference renders of the finished shader are in `plans/assets/`:

- `plans/assets/008-corner-looks.jpg` — top row: the `corner` preset's
  settings; the `emberCorner` settings; `corner` with the pointer at the far
  left, then at the far right (the block shears and its near edge slides off
  the room's corner: the illusion breaking). Bottom row: the same room on a
  2.4:1 canvas and a 1:2 canvas.
- `plans/assets/008-corner-dials.jpg` — four columns, top then bottom:
  softness 0 and 1, distortion 0 and 1, complexity 1 and 8, scale 0.6 and 1.5.

What you should see in every pointer-less render: a dark room whose two walls
meet in a vertical line at the centre, with floor and ceiling; over that line
a six-sided patch of light, taller at the centre than at its sides, split by
the line into a bright pale face and a deeper, slightly dimmer face; the
patch's upper and lower edges slope *against* the room's own lines (the
ceiling line falls toward the corner, the patch's top edge rises toward it);
and the walls, floor and ceiling near the patch glowing with its colour.

How it works, in short. Two walls at right angles meet straight ahead; a ray
from the eye meets the left wall, the right wall, or the floor or ceiling,
whichever is nearest (three divisions). A projector stands where the eye
*starts*; the patch is a hexagon on the projector's image plane, so from that
one spot it lines up with the corner and looks like a block. The eye then
drifts and follows the pointer while the projector stays put, which is the
parallax. What each surface receives from the two lit faces is Lambert's
formula for a glowing four-sided patch, exact, as in Chamber.

**What was and wasn't verified during planning.** In a scratch copy with plans
003 and 006 applied, the shader was wired in under id 31 and rendered by the
repo's snapshot tool (the real engine, headless Chromium / SwiftShader): those
are the reference renders. Measured there:

- cost at 960×960: 540 ms a frame, against Cove's 537 and Chamber's 551
  (SwiftShader on a CPU: relative numbers only);
- the exported standalone player matches the engine to 0.02/255, with and
  without `--mouse 0.9,0.7`;
- the editor's unit tests pass with the eye test widened as in Step 5, apart
  from the pinned lists this plan's Steps 3–5 extend (which the scratch copy
  did not wire).

**Not** verified: the presets' own globals (no tone map, Display P3), bloom,
HDR, a real GPU, and how it feels in motion (stills only).

## Current state

`corner` is wired exactly as `chamber` was. Find that work in the history and
read it first:

```bash
git log --oneline -- packages/core/src/presets/light-fields.ts | head -5
```

and `git show` the commits that added `chamber` (the shader, the wiring with
presets, the docs). After plans 003 and 006, the places are:

- `packages/schema/src/enums.ts`: `"aperture", "cove", "chamber", "halo", "corona", "lightWall",`
- `packages/core/src/engine.ts`, `GRADIENT_TYPE_IDS`, ends `chamber: 30,`. Ids
  are compiled into exports and embeds and never change. The new one is **31**.
- `packages/core/src/shaders/gradients.glsl`: `chamberGradient`'s block is the
  last light field; it ends with `#endif`, then a blank line and the banner
  `// Image Gradient (type 8) — samples uploaded texture`. The dispatcher ends:

  ```glsl
  #elif WAVR_GRADIENT == 30
    return chamberGradient(uv, time);
  #else
  #error Unknown WAVR_GRADIENT
  ```

  The "Light fields" intro comment lists "… a frame lit from its edges, a room
  seen from its mouth, a luminous ring in the dark, a backlit wall."
- `packages/core/src/shaders/mouse.glsl` (after plan 006): `mouseWarpNone`,
  `mouseEye()`, and the table ending

  ```glsl
  #elif WAVR_GRADIENT == 30
  #define WAVR_MOUSE_WARP mouseWarpNone
  #else
  #error No mouse warp style for this WAVR_GRADIENT
  ```

- `packages/core/src/layers.ts`: `case "chamber":` in
  `defaultSoftnessForGradientType` (returns `0.5`); `chamber` entries in
  `LIGHT_FIELD_PALETTES` and `LIGHT_FIELD_PALETTE_ROLES`.
- `packages/core/src/presets/light-fields.ts`: `chamber` and `skyChamber`,
  each `grain: 0, toneMapMode: 0, colorProfile: "display-p3", hdrHeadroom: …,
  realBloomEnabled: false`. Both are in `catalog.ts`, `presets/index.ts`,
  `packages/react/src/presets.ts`, `packages/create-wavr/src/args.ts`;
  `chamber` alone is in `packages/preview/src/presets.ts`.
- `packages/react/src/types.ts`: `| "aperture" | "cove" | "chamber" | "halo" | "corona" | "lightWall";`
- `apps/editor/lib/gradient-types.ts`: a `chamber` entry in `GRADIENT_OPTIONS`.
- Tests that pin lists: `apps/editor/lib/gradient-types.test.ts` (Look grid
  order `"aperture", "cove", "chamber", "halo", …`, `slice(6, 14)`, role
  descriptions, id table ending `chamber: 30`), `hdr-headroom.test.ts`
  (`chamber: 1.5, skyChamber: 1,`), `random-look.test.ts` (sorted types).
- `apps/editor/lib/engine-mouse-shader.test.ts` (after plan 006) has the test
  `"the pointer as an eye is gated the same way, and only chamber looks through it"`,
  which asserts exactly one `mouseWarpNone` table line and exactly one
  `mouseEye(` call in `gradients.glsl`. Plan 006's notes say to widen it on
  purpose for the next space; Step 5 does.
- `apps/editor/lib/gallery.ts` (only if plan 004 has landed):
  `GALLERY_ROOM_IDS` lists preset ids; ids the catalogue lacks are skipped.
- Docs: `CLAUDE.md` and the five `config.md` copies
  (`skills/wavr/references/`, `packages/create-wavr/skill/references/`,
  `.claude/skills/wavr/references/`, `.codex/skills/wavr/references/`,
  `.cursor/skills/wavr/references/`).

Rules from `CLAUDE.md` that apply: gradient bodies must not read `u_mouse*`
(the eye comes from `mouseEye()`); a type that reads `gl_FragCoord` must be in
`FULL_RESOLUTION_GRADIENTS` (this one does not); light-field presets set
`toneMapMode: 0`, `colorProfile: "display-p3"` and an `hdrHeadroom` of "2 stops
for a small light in a dark room"; sentence case for labels.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | all pass |
| Build | `pnpm build` | exit 0 |
| Render stills | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots <dir> [options]` | one line per image |
| Compare two runs | `pnpm snapshots:diff <dirA> <dirB>` | per-image difference |
| Thumbnails | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm thumbnails` | writes `apps/editor/public/presets/*.webp`, `thumbnails.json` |
| Export parity | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity <dir> --only corner [--mouse x,y]` | mean difference printed |
| Parity harness | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` | all pass |

Drop `CHROMIUM_PATH=…` where Playwright's own browser is installed.
`pnpm test:parity` empties `test-results/`; keep snapshot output elsewhere.

## Scope

**In scope** (the only files you should modify or create):

- `packages/schema/src/enums.ts`
- `packages/core/src/engine.ts` (one line in `GRADIENT_TYPE_IDS`)
- `packages/core/src/shaders/gradients.glsl`, `packages/core/src/shaders/mouse.glsl`
- `packages/core/src/layers.ts`
- `packages/core/src/presets/light-fields.ts`, `catalog.ts`, `index.ts`
- `packages/react/src/types.ts`, `packages/react/src/presets.ts`
- `packages/preview/src/presets.ts`, `packages/create-wavr/src/args.ts`
- `apps/editor/lib/gradient-types.ts`
- `apps/editor/lib/gradient-types.test.ts`, `hdr-headroom.test.ts`,
  `random-look.test.ts`, `engine-mouse-shader.test.ts`
- `apps/editor/lib/gallery.ts` (one id, only if the file exists)
- `apps/editor/public/presets/corner.webp`, `emberCorner.webp` (generated), `thumbnails.json` (generated)
- the five `config.md` copies and `CLAUDE.md`
- `plans/README.md` (your status row)

**Out of scope** (do NOT touch): any other gradient's code, `common.glsl`,
`layer.glsl`, `post.glsl`, `engine.ts` beyond the id line,
`portable-shader.ts` / `portable-runtime.ts` (exports cut the gradient and
`mouseEye()` out by themselves), vendored litt files.

## Git workflow

- Work on the branch you were given; if none, `advisor/008-corner-light-field`.
- Three commits in the repo's style (sentence case, imperative, no prefix):
  `Add the corner shader`, `Wire corner in as a light field, with presets`,
  `Document corner`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-before
```

**Verify**: lint and tests exit 0; snapshots exit 0. Keep `/tmp/corner-before`.

### Step 1: Add the shader

In `packages/core/src/shaders/gradients.glsl`:

1. In the "Light fields" intro comment, add the corner to the list, after "a
   room seen from its mouth,": "a block of light in a room's corner,". Re-wrap
   the comment; change no code.
2. After the `#endif` that closes `chamberGradient` and before the blank line
   and the Image banner, paste the whole of `plans/assets/008-corner.glsl.txt`
   exactly (it begins with a blank line and the comment `// Corner: a block of
   light in the corner of a dark room.` and ends with `#endif`).
3. In `computeGradient()`, before `#else` / `#error Unknown WAVR_GRADIENT`:

   ```glsl
   #elif WAVR_GRADIENT == 31
     return cornerGradient(uv, time);
   ```

In `packages/core/src/shaders/mouse.glsl`, before `#else` / `#error No mouse
warp style for this WAVR_GRADIENT`:

```glsl
#elif WAVR_GRADIENT == 31
#define WAVR_MOUSE_WARP mouseWarpNone
```

and in that file's opening comment, where plan 006 wrote "One gradient is a
space rather than a picture (chamber)", make it "Two gradients are spaces
rather than pictures (chamber, corner): they are not warped (mouseWarpNone)
and ask mouseEye(), below, where the viewer's head is."

**Verify**: `grep -c "WAVR_GRADIENT == 31" packages/core/src/shaders/gradients.glsl`
→ `3`; `grep -c "u_mouse" packages/core/src/shaders/gradients.glsl` → `0`.

### Step 2: Register the type

- `packages/schema/src/enums.ts`: `"aperture", "cove", "chamber", "corner", "halo", "corona", "lightWall",`
- `packages/core/src/engine.ts`: `corner: 31,` after `chamber: 30,`.
- `packages/react/src/types.ts`: add `| "corner"` after `"chamber"`.
- `packages/core/src/layers.ts`:
  - `case "corner":` under `case "chamber":` in
    `defaultSoftnessForGradientType`. Note this group returns `0.5`; the look's
    presets set their own softness (0.3 and 0.45), which is what a preset or
    the Look tile brings.
  - `LIGHT_FIELD_PALETTES`, after `chamber`:
    `corner: [[0.027, 0.031, 0.059], [0.302, 0.42, 1], [0.659, 0.749, 1], [0.961, 0.969, 1]],`
  - `LIGHT_FIELD_PALETTE_ROLES`, after `chamber`:
    `corner: "First colour is the room; the rest are the light of the block, from its outer edges to its near edge.",`

**Verify**: `pnpm lint` → exit 0 except for errors naming `gradient-types.ts`
(the missing Look tile, Step 5). Then:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-first --only corner --size 288 --aspect 1.3334 --palette "#07080f,#4d6bff,#a8bfff,#f5f7ff" --layer softness=0.3,distortion=0.15,complexity=4,scale=1
```

→ one line `type-corner … lit 100.0%  mean 0.2…`. Open the PNG and compare
with the first image of `plans/assets/008-corner-looks.jpg`: the same room and
block (half a second apart in time). A GLSL error prints `ERROR: <file>:<line>`;
if the line is inside the pasted block, re-check the paste against the asset
byte for byte (`diff`) before anything else.

### Step 3: Add the presets, in every list

In `packages/core/src/presets/light-fields.ts`, after `skyChamber`:

```ts
// A block of cold light floating in the corner of a dark room: light on two
// walls, shaped to read as a solid. Move, and it gives itself away.
export const corner: GradientConfig = {
  layers: [{
    type: "corner",
    colors: LIGHT_FIELD_PALETTES.corner,
    speed: 0.5,
    complexity: 4,
    scale: 1,
    distortion: 0.15,
    softness: 0.3,
  }],
  grain: 0,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 2,
  realBloomEnabled: false,
};

// The same corner at dusk: a tall ember block in a hazy room.
export const emberCorner: GradientConfig = {
  layers: [{
    type: "corner",
    colors: [[0.051, 0.027, 0.024], [1, 0.353, 0.165], [1, 0.604, 0.361], [1, 0.941, 0.871]],
    speed: 0.5,
    complexity: 2.5,
    scale: 1.15,
    distortion: 0.4,
    softness: 0.45,
  }],
  grain: 0,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 2,
  realBloomEnabled: false,
};
```

Add both, right after `skyChamber`, in `catalog.ts` (names "Corner" and
"Ember corner", category `lightFields`), `presets/index.ts`,
`packages/react/src/presets.ts` (the `as coreCorner` / `as coreEmberCorner`
imports and the `export const` lines) and `packages/create-wavr/src/args.ts`.
In `packages/preview/src/presets.ts` add only
`{ id: "corner", label: "Corner" },` after `chamber`.

**Verify**: `grep -rn "emberCorner" packages --include=*.ts -l | sort` lists
exactly `catalog.ts`, `index.ts` and `light-fields.ts` under
`packages/core/src/presets/`, `packages/create-wavr/src/args.ts` and
`packages/react/src/presets.ts`.

### Step 4: Render the thumbnails

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm thumbnails
```

**Verify**: `git status --short apps/editor/public/presets` shows two new
files, `corner.webp` and `emberCorner.webp`, and `thumbnails.json` with
exactly two added lines. If any existing `.webp` changed, STOP.

### Step 5: Add the Look tile and extend the tests

- `apps/editor/lib/gradient-types.ts`, after the `chamber` entry:

  ```ts
  {
    value: "corner",
    label: "Corner",
    description: `A block of light floating in the corner of a dark room. ${LIGHT_FIELD_PALETTE_ROLES.corner}`,
  },
  ```

- `apps/editor/lib/gradient-types.test.ts`: the Look grid order becomes
  `"aperture", "cove", "chamber", "corner", "halo", "corona", "lightWall",`;
  the light modes' slice becomes `slice(7, 15)`; add
  `expect(description("corner")).toContain(LIGHT_FIELD_PALETTE_ROLES.corner);`
  after the `chamber` line; add `corner: 31,` after `chamber: 30,`.
- `apps/editor/lib/hdr-headroom.test.ts`: add `corner: 2, emberCorner: 2,`
  after the `chamber` line.
- `apps/editor/lib/random-look.test.ts`: insert `"corner"` in the sorted list
  between `"chamber"` and `"corona"`.
- `apps/editor/lib/engine-mouse-shader.test.ts`: rename the test to
  `"the pointer as an eye is gated the same way, and only the rooms look through it"`
  and replace its last six lines (from `// A gradient that moves its eye is
  not also bent` to the `chamber.slice(…)` expectation) with:

  ```ts
      // A gradient that moves its eye is not also bent, and no other gradient has an eye.
      const rooms = ["chamber", "corner"] as const;
      const gradients = stripComments(read("gradients.glsl"));
      for (const room of rooms) {
        expect(mouse, room).toMatch(new RegExp(`WAVR_GRADIENT == ${GRADIENT_TYPE_IDS[room]}\\n#define WAVR_MOUSE_WARP mouseWarpNone`));
        const body = gradients.slice(gradients.indexOf(`vec3 ${room}Gradient(`));
        expect(body.slice(0, body.indexOf("#endif")), room).toContain("mouseEye()");
      }
      expect(mouse.match(/define WAVR_MOUSE_WARP mouseWarpNone\b/g)).toHaveLength(rooms.length);
      expect(gradients.match(/\bmouseEye\(/g)).toHaveLength(rooms.length);
  ```

- `apps/editor/lib/gallery.ts`, **only if it exists**: in `GALLERY_ROOM_IDS`
  add `"corner"` after `"halo"` (a dark room between two brighter ones).

**Verify**: `pnpm lint && pnpm test` → exit 0. If `gallery.test.ts`'s "only
holds rooms a passage can blend" fails for `corner`, remove the id from
`GALLERY_ROOM_IDS` again and say which key differed in your report. If another
test you did not edit fails naming `corner` (a pinned list), extend that list
the way `chamber` is in it and note it.

### Step 6: Prove the look and that nothing else moved

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-after
pnpm snapshots:diff /tmp/corner-before /tmp/corner-after
```

**Verify**: every image in both runs differs by 0; the only new image is
`type-corner.png`.

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-presets --presets --only preset-corner,preset-emberCorner --size 288 --aspect 1.3334
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-none --only corner --size 288 --aspect 1.3334
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-centre --only corner --size 288 --aspect 1.3334 --mouse 0.5,0.5 --state mouseReact=1
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-left --only corner --size 288 --aspect 1.3334 --mouse 0.05,0.5 --state mouseReact=1
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-wide --only corner --size 288 --aspect 2.4
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/corner-tall --only corner --size 288 --aspect 0.5
pnpm snapshots:diff /tmp/corner-none /tmp/corner-centre
pnpm snapshots:diff /tmp/corner-none /tmp/corner-left
```

**Verify** (look at the PNGs; all must hold):

- `preset-corner.png` and `preset-emberCorner.png` match the first two images
  of `plans/assets/008-corner-looks.jpg` in layout and colour (the presets use
  no tone map and Display P3, so a little more saturated is expected; a
  different layout is a failure).
- none vs centre: 0/255. none vs left: a clear difference, and in the left
  render the block's near edge no longer sits on the room's corner line, as in
  the third reference image.
- wide and tall show the same room and block, as in the reference's bottom row.

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity /tmp/corner-export --only corner
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity /tmp/corner-export-mouse --only corner --mouse 0.9,0.7
```

**Verify**: both print a mean difference below 1/255 for `corner` (planning
measured 0.02).

### Step 7: Document it

- `CLAUDE.md`, "Adding a Gradient Mode", step 2: add `corner` after `chamber`
  in the list of light fields and in the list of those that read their stops
  by role. In the Pointer bullet (after plan 006: "a gradient that is a space
  (chamber, whose style is `mouseWarpNone`)"), make it "(chamber and corner,
  whose style is `mouseWarpNone`)". If plan 004's Gallery bullet exists,
  nothing changes there.
- The five `config.md` copies, identically: what plan 003 added for
  `chamber`, add for `corner`: the type in the light-field list; a short
  paragraph (a block of light projected into a dark room's corner, which
  reads as a floating solid; "the first colour is the room, the rest are the
  light of the block from its outer edges to its near edge"; scale = the
  block's size, complexity = its proportions from a tall pillar to a wide
  slab, softness = the projector's focus and the room's coved corners,
  distortion = haze; the pointer moves the viewer's eye); and the preset ids
  `corner`, `emberCorner`.

**Verify**: `for f in skills/wavr/references/config.md packages/create-wavr/skill/references/config.md .claude/skills/wavr/references/config.md .codex/skills/wavr/references/config.md .cursor/skills/wavr/references/config.md; do grep -c "emberCorner" $f; done`
prints the same non-zero number five times.

### Step 8: Final gate

```bash
pnpm lint && pnpm test && pnpm build
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity
```

**Verify**: all exit 0.

## Test plan

No new test file. Extended lists (Step 5) bring `corner` under the existing
suites: `gradient-types.test.ts` (editor option, shader id, guard, dispatch
branch, palette, and no `u_mouse*` in gradients), `engine-shader-sources.test.ts`
(one gradient function per layer program), `engine-mouse-shader.test.ts` (the
widened eye test: both rooms use `mouseWarpNone` and call `mouseEye()`, and
nothing else does), `presets.test.ts` (thumbnails), `hdr-headroom.test.ts`,
and `gallery.test.ts` (blendable room) if the gallery exists. The render is
checked by eye in Step 6 against the reference images.

## Done criteria

ALL must hold:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` exit 0; `pnpm test:parity` exits 0
- [ ] `pnpm snapshots:diff /tmp/corner-before /tmp/corner-after` shows 0 for
      every pre-existing image
- [ ] The shader block in `gradients.glsl` is the asset's, unedited:
      `grep -c "" plans/assets/008-corner.glsl.txt` → `125`, and every one of
      its lines is in `gradients.glsl` in order (if you had to change it, say
      exactly what and why in your report)
- [ ] `corner.webp` and `emberCorner.webp` exist; no other `.webp` changed
- [ ] Export parity for `corner` is below 1/255 with and without `--mouse`
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003 or 006 has not landed, or the excerpts do not match.
- The shader fails to compile under id 31 and the cause is not a paste error.
- Any pre-existing snapshot or thumbnail changes.
- The render does not show a block over a corner (for example a flat hexagon
  on a flat wall, or no line where the walls meet): do not retune constants;
  report with the PNG.
- With the pointer absent or at the centre the render differs from the
  pointer-less one.
- Export parity fails to compile or exceeds 1/255.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Why the right face is dimmer.** A solid block lit from one side has one
  face in half shadow; without that difference the patch reads as a flat
  hexagon. The difference is fixed (`0.72`, and a deeper colour) and always on
  the right. A control for which side, or how much, is an easy addition if
  asked for; it was left out to keep the look to four dials.
- **The dark line where the walls meet** above and below the block is the
  blended normal facing neither lit face. It is what tells the eye there is a
  corner, so it is kept; softness widens and softens it (the coving).
- **Wide canvases.** The room's depth grows with the canvas's width (the walls
  always reach the frame's edges), so on a very wide canvas the block is small
  in a long room. Scale compensates.
- **Not yet seen** on a real GPU, in HDR (2 stops on a small bright patch in a
  dark room is the case HDR is best at, and the one most likely to want its
  spill onto the walls scaled too: the same note as Chamber's), or in motion.
- **Shared helper.** `cornerEdge` is `chamberEdge` again, because each
  gradient's helpers live inside its own `#if` guard so a layer program holds
  only its gradient. If a third look needs Lambert's formula, move one copy to
  `common.glsl`'s "Light" section instead of adding a third.
- **A top face.** With the projector above eye level the block would show
  three faces. It reads as more of a cube and less of a Turrell; not done.
