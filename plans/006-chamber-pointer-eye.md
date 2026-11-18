# Plan 006: In Chamber, the pointer is your head

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: plan 003 must have landed:
> `grep -c "WAVR_GRADIENT == 30" packages/core/src/shaders/gradients.glsl` → `3`
> and `grep -c "vec2 eye = vec2(0.07" packages/core/src/shaders/gradients.glsl` → `1`.
> Then `git diff --stat a104287..HEAD -- packages/core/src/shaders/mouse.glsl apps/editor/lib/portable-shader.ts apps/editor/lib/engine-mouse-shader.test.ts apps/editor/lib/portable-shader.test.ts`
> should show only plan 003's two added lines in `mouse.glsl`. Compare the
> "Current state" excerpts against the live code; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW–MED (a new, documented way for the pointer to reach one gradient; every other gradient and every pointer-less frame is unchanged)
- **Depends on**: plans/003-chamber-light-field.md (must be DONE)
- **Category**: direction (new feature)
- **Planned at**: commit `a104287`, 2026-11-18 (on top of plan 003's changes as that plan makes them)

## Why this matters

Chamber (plan 003) is a room seen in depth, and its eye already drifts slowly
so near walls slide past the far one. But when you move the pointer over it,
it does what every Wavr look does: a small lens bends the picture under the
cursor, which on a knife-edged opening in a wall looks like a dent in the
image, not like anything in the room.

The response a room wants is the one a window gives: move your head and the
far wall shifts against the frame. This plan makes the pointer move Chamber's
eye. It is the strongest depth cue a flat screen has, and it is nearly free:
the shader already traces rays from an eye position; the pointer just adds to
it.

## What it is (so you can judge a render)

`plans/assets/006-chamber-eye.jpg` shows the default Chamber (the editor's
default palette, not a preset's) five times: pointer at the far left, pointer
absent, pointer at the far right, pointer at the top, and at the far right
with the default strength (0.5) instead of 1. The far wall and its opening
follow the pointer; the frame's edges do not move (the room's mouth is the
frame); the picture is redrawn from the new eye, so nothing is bent.

The design, and why it keeps the house rule:

- `CLAUDE.md` says "the pointer reaches gradients only through `mouseWarp()`
  (`mouse.glsl`) … gradient bodies must not read `u_mouse*`". That rule exists
  so pointer behaviour lives in one file, is gated in one way (absent pointer
  = no effect) and is carried into code exports by one mechanism.
- This plan keeps all three. It adds a second helper **in `mouse.glsl`**,
  `mouseEye()`, gated exactly like the warp, and Chamber calls it. Chamber
  still does not read `u_mouse*`. The rule becomes "the pointer reaches
  gradients only through `mouse.glsl`".
- A gradient that moves its eye must not also be bent, so Chamber's warp
  style becomes a new one that returns `uv` unchanged, `mouseWarpNone`.
- Code exports cut helpers out of the engine's GLSL by following calls, so an
  exported Chamber with the pointer on carries `mouseEye()` by itself. With
  the pointer off, the exporter swaps in a constant form, the way it already
  does for the HDR helpers, so no pointer code is left in.

**What was and wasn't verified during planning.** Done in a scratch copy at
`a104287` with plan 003's shader and type wiring applied (which also confirmed
that plan's shader compiles and renders under id 30):

- With the pointer absent, Chamber is bit-identical to before this plan
  (`pnpm snapshots:diff`: 0/255), and with the pointer at the centre too.
- The renders in the asset above are from the real engine.
- `engine-mouse-shader.test.ts` and `portable-shader.test.ts`, edited as in
  Step 3, pass with the export tests (140 tests in those files); `tsc` is
  clean.
- The exported standalone player matches the engine to 0.02/255 for Chamber,
  with no pointer, with `--mouse 0.9,0.7`, and at `mouseReact=1`.
- **Not** verified: how it feels to move (only stills were rendered), a real
  GPU, touch devices.

## Current state

After plan 003, at these places:

- `packages/core/src/shaders/mouse.glsl` — the style table is preceded by:

  ```glsl
  // Style per gradient (ids: GRADIENT_TYPE_IDS in engine.ts). A new gradient mode
  // needs a line here.
  #if defined(WAVR_CUSTOM)
  #define WAVR_MOUSE_WARP mouseWarpLens
  ```

  and ends with plan 003's line:

  ```glsl
  #elif WAVR_GRADIENT == 30
  #define WAVR_MOUSE_WARP mouseWarpLens
  #else
  #error No mouse warp style for this WAVR_GRADIENT
  ```

  The gate every style shares, in `mouseWarp()`:

  ```glsl
    if (u_mouseReact <= 0.0 || u_mousePresence <= 0.0) return uv;
  ```

  `u_mouseSmooth` is the smoothed pointer in uv (0..1, y up), `u_mousePresence`
  eases 0..1 as the pointer enters and leaves, `u_mouseReact` is the user's
  strength (0..1, default 0.5).

- `packages/core/src/shaders/gradients.glsl`, in `chamberGradient`:

  ```glsl
    // The eye drifts a little, slowly, so the near walls slide past the far one.
    vec2 eye = vec2(0.07 * sin(time * 0.11), 0.035 * sin(time * 0.083 + 1.3));
    vec3 dir = vec3(p - eye, CHAMBER_FOCAL);
  ```

  `room` (the mouth's half size, `vec2(0.5 * aspect, 0.5)`) is defined a few
  lines above it.

- `apps/editor/lib/engine-mouse-shader.test.ts` pins the styles:

  ```ts
      expect(styles.sort()).toEqual(["mouseWarpLens", "mouseWarpPush", "mouseWarpSwirl", "mouseWarpWave"]);
  ```
  ```ts
      expect(bodies.length).toBe(4);
      for (const [, style, body] of bodies) expect(body, style).toContain("f.amount");
    });
  ```

- `apps/editor/lib/gradient-types.test.ts` has "no gradient function reads the
  mouse": `expect(GRADIENTS_SHADER).not.toMatch(/u_mouse\w*|\w+Displace\b|rippleEffect/);`.
  This plan does not change it and must not break it.

- `apps/editor/lib/portable-shader.ts` replaces some engine helpers by name:

  ```ts
  /** The engine's HDR helpers (common.glsl, post.glsl) as they are in standard range, the only range an export presents. */
  const STANDARD_RANGE: Record<string, string> = {
  ```
  ```ts
    for (const definition of pool) {
      const standard = STANDARD_RANGE[definition.name];
      if (standard) definition.text = definition.code = standard;
    }
  ```

  (`pointer` is `s.mouseReact > 0`, defined at the top of
  `buildPortableShader`.)

- `apps/editor/lib/portable-shader.test.ts`, in `describe("the pointer", …)`,
  checks for every type:

  ```ts
          expect(source).toMatch(/uniform vec2 u_mouseVelocity;/);
          expect(source).toMatch(/uniform float u_mousePresence;/);
        });
      }
  ```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | all pass |
| Build | `pnpm build` | exit 0 |
| Render stills | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots <dir> --only chamber [--mouse x,y] [--state mouseReact=1]` | one line per image |
| Compare two runs | `pnpm snapshots:diff <dirA> <dirB>` | per-image difference |
| Export parity | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity <dir> --only chamber [--mouse x,y]` | mean difference printed |
| Parity harness | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` | all pass |

Drop `CHROMIUM_PATH=…` where Playwright's own browser is installed.
`pnpm test:parity` empties `test-results/`; keep snapshot output elsewhere.

## Scope

**In scope** (the only files you should modify):

- `packages/core/src/shaders/mouse.glsl`
- `packages/core/src/shaders/gradients.glsl` (the `eye` lines of `chamberGradient` and one comment)
- `apps/editor/lib/portable-shader.ts`
- `apps/editor/lib/engine-mouse-shader.test.ts`, `apps/editor/lib/portable-shader.test.ts`
- `CLAUDE.md`
- `plans/README.md` (your status row)

**Out of scope** (do NOT touch):

- Any other gradient, `layer.glsl`, `common.glsl`, `engine.ts`, `pointer.ts`,
  `attach-pointer.ts`: the pointer's smoothing, presence and uniforms are used
  as they are. No new uniform.
- `apps/editor/lib/portable-runtime.ts`: it already sets the pointer uniforms
  an export declares.
- `apps/editor/lib/gallery.ts`: the gallery keeps `mouseReact: 0` (see
  Maintenance notes).
- `tests/parity/mouse-probe.mjs`: it measures the bending styles; the new one
  bends nothing.

## Git workflow

- Work on the branch you were given; if none, `advisor/006-chamber-pointer-eye`.
- Commits in the repo's style (sentence case, imperative, no prefix), for
  example: `Let the pointer move Chamber's eye`, `Keep the eye out of exports
  without a pointer`, `Document the pointer's eye`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/eye-before
```

**Verify**: lint and tests exit 0; snapshots exit 0. Keep `/tmp/eye-before`.

### Step 1: Add the eye to `mouse.glsl`

Directly above the comment `// Style per gradient (ids: GRADIENT_TYPE_IDS in
engine.ts). A new gradient mode`, insert:

```glsl
// None: the picture is not bent. For a gradient that answers the pointer as an
// eye instead (mouseEye(), below).
vec2 mouseWarpNone(vec2 uv) {
  return uv;
}

// The pointer as the viewer's head, for a gradient that is a space seen from a
// point (chamber): where the pointer is across the frame, -1 (left, bottom) to
// 1 (right, top), scaled by react * presence, so it is zero while the pointer
// is away and eases in and out with it. The gradient moves its eye by this;
// the picture is drawn from there, not bent.
vec2 mouseEye() {
  if (u_mouseReact <= 0.0 || u_mousePresence <= 0.0) return vec2(0.0);
  return (u_mouseSmooth - 0.5) * (2.0 * clamp(u_mouseReact, 0.0, 1.0) * clamp(u_mousePresence, 0.0, 1.0));
}

```

In the table, change Chamber's style:

```glsl
#elif WAVR_GRADIENT == 30
#define WAVR_MOUSE_WARP mouseWarpNone
```

In the file's opening comment, the sentence "so the gradient functions know
nothing about the pointer" is no longer the whole truth. After the paragraph
that ends "The style comes from the gradient (WAVR_MOUSE_WARP, below).", add:

```glsl
// One gradient is a space rather than a picture (chamber): it is not warped
// (mouseWarpNone) and asks mouseEye(), below, where the viewer's head is.
// Either way a gradient never reads u_mouse* itself.
```

**Verify**: `grep -c "mouseWarpNone" packages/core/src/shaders/mouse.glsl` → `3`
(the opening comment, the function, Chamber's `#define`).

### Step 2: Move Chamber's eye

In `packages/core/src/shaders/gradients.glsl`, replace the two `eye` lines
quoted in "Current state" with:

```glsl
  // The eye drifts a little, slowly, so the near walls slide past the far one,
  // and follows the pointer as a head would (mouseEye(), mouse.glsl), up to
  // CHAMBER_LOOK of the way to the mouth's edge. It never leaves the mouth.
  const float CHAMBER_LOOK = 0.6;
  vec2 eye = vec2(0.07 * sin(time * 0.11), 0.035 * sin(time * 0.083 + 1.3))
           + mouseEye() * CHAMBER_LOOK * max(0.8 * room - vec2(0.07, 0.035), 0.0);
```

In Chamber's header comment (the block above its helpers that begins
`// Chamber: a room, seen from its mouth.`), after the sentence "The eye drifts
a little, slowly, so near walls slide past the far one: the room has depth."
add: "The pointer moves the eye too, as a head at a window."

**Verify**:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/eye-after
pnpm snapshots:diff /tmp/eye-before /tmp/eye-after
```

→ every image differs by 0 (max 0/255), `type-chamber` included: without a
pointer nothing moved. Then:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/eye-left --only chamber --size 288 --aspect 1.3334 --mouse 0.05,0.5 --state mouseReact=1
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/eye-right --only chamber --size 288 --aspect 1.3334 --mouse 0.95,0.5 --state mouseReact=1
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/eye-centre --only chamber --size 288 --aspect 1.3334 --mouse 0.5,0.5 --state mouseReact=1
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm snapshots /tmp/eye-none --only chamber --size 288 --aspect 1.3334
pnpm snapshots:diff /tmp/eye-none /tmp/eye-centre
pnpm snapshots:diff /tmp/eye-left /tmp/eye-right
```

→ none vs centre: 0/255. Left vs right: a large difference; open both PNGs
and compare with the first and third images of
`plans/assets/006-chamber-eye.jpg`: the far wall sits left of centre in one and
right of centre in the other, the opening's edges are straight, and the walls
reach the frame's corners in both.

### Step 3: Tests

`apps/editor/lib/engine-mouse-shader.test.ts`:

- the style list becomes
  `["mouseWarpLens", "mouseWarpNone", "mouseWarpPush", "mouseWarpSwirl", "mouseWarpWave"]`;
- replace

  ```ts
      expect(bodies.length).toBe(4);
      for (const [, style, body] of bodies) expect(body, style).toContain("f.amount");
    });
  ```

  with

  ```ts
      expect(bodies.length).toBe(5);
      // ...except the one that leaves the picture alone.
      for (const [, style, body] of bodies) {
        if (style === "mouseWarpNone") expect(body.trim()).toBe("return uv;");
        else expect(body, style).toContain("f.amount");
      }
    });

    it("the pointer as an eye is gated the same way, and only chamber looks through it", () => {
      const eye = /^vec2 mouseEye\(\) \{([\s\S]*?)\n\}/m.exec(mouse)?.[1] ?? "";
      expect(eye).toContain("if (u_mouseReact <= 0.0 || u_mousePresence <= 0.0) return vec2(0.0);");
      expect(eye).toContain("clamp(u_mouseReact, 0.0, 1.0) * clamp(u_mousePresence, 0.0, 1.0)");
      // A gradient that moves its eye is not also bent, and no other gradient has an eye.
      expect(mouse).toMatch(new RegExp(`WAVR_GRADIENT == ${GRADIENT_TYPE_IDS.chamber}\\n#define WAVR_MOUSE_WARP mouseWarpNone`));
      expect(mouse.match(/define WAVR_MOUSE_WARP mouseWarpNone\b/g)).toHaveLength(1);
      const gradients = stripComments(read("gradients.glsl"));
      expect(gradients.match(/\bmouseEye\(/g)).toHaveLength(1);
      const chamber = gradients.slice(gradients.indexOf("vec3 chamberGradient("));
      expect(chamber.slice(0, chamber.indexOf("#endif"))).toContain("mouseEye()");
    });
  ```

**Verify**: `pnpm --filter editor test -- engine-mouse-shader gradient-types`
→ all pass (the "no gradient function reads the mouse" test among them,
unedited).

### Step 4: Keep the eye out of exports that have no pointer

`apps/editor/lib/portable-shader.ts`:

- directly above `/** Order the constants appear in, with a comment per group. */` add:

  ```ts
  /** With the pointer off, a gradient that looks through the pointer's eye (mouse.glsl) looks straight ahead, and the pointer code stays out. */
  const POINTER_OFF: Record<string, string> = {
    mouseEye: "vec2 mouseEye() { return vec2(0.0); }",
  };

  ```

- change the replacement line to:

  ```ts
      const standard = STANDARD_RANGE[definition.name] ?? (pointer ? undefined : POINTER_OFF[definition.name]);
  ```

`apps/editor/lib/portable-shader.test.ts`, in `describe("the pointer", …)`:
replace the two lines quoted in "Current state" and the loop's end with:

```ts
        // A style that doesn't bend the picture has no use for the pointer's velocity.
        if (style !== "mouseWarpNone") expect(source).toMatch(/uniform vec2 u_mouseVelocity;/);
        expect(source).toMatch(/uniform float u_mousePresence;/);
      });
    }

    it("chamber looks through the pointer's eye, and straight ahead when the pointer is off", () => {
      const on = stripComments(shaderFor("chamber", { mouseReact: 0.5 }));
      expect(on).toContain("if (MOUSE_REACT <= 0.0 || u_mousePresence <= 0.0) return vec2(0.0);");
      const off = shaderFor("chamber", { mouseReact: 0 });
      expect(off).toContain("vec2 mouseEye() { return vec2(0.0); }");
      expect(off).not.toMatch(/u_mouse|MOUSE_REACT/);
    });
```

**Verify**: `pnpm lint && pnpm test` → exit 0. Then:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity /tmp/eye-export --only chamber
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm export-parity /tmp/eye-export-mouse --only chamber --mouse 0.9,0.7
```

→ both print a mean difference below 1/255 for `chamber` (planning measured
0.02).

### Step 5: Document it

In `CLAUDE.md`:

- "Rendering Architecture", the **Pointer** bullet begins "the pointer reaches
  gradients only through `mouseWarp()` (`mouse.glsl`), called once in layer
  main (not on a 3D surface uv); gradient bodies must not read `u_mouse*`."
  Change it to say: the pointer reaches gradients only through `mouse.glsl`:
  `mouseWarp()`, called once in layer main (not on a 3D surface uv), bends the
  picture, and `mouseEye()` gives a gradient that is a space (chamber, whose
  style is `mouseWarpNone`) the viewer's head position; gradient bodies must
  not read `u_mouse*`. Keep the rest of the bullet. Where it lists the styles
  "(push, lens, swirl, wave)", add "or none".
- "Adding a Gradient Mode", step 2, the last sentence ("Then add its
  `WAVR_MOUSE_WARP` line in `mouse.glsl` …"): add "A mode that is a space seen
  from a point takes `mouseWarpNone` and moves its eye by `mouseEye()`; code
  exports carry it, and replace it with a constant when the pointer is off
  (`POINTER_OFF` in `portable-shader.ts`)."

**Verify**: `grep -c "mouseEye" CLAUDE.md` → at least 2.

### Step 6: Final gate

```bash
pnpm lint && pnpm test && pnpm build
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity
```

**Verify**: all exit 0.

## Test plan

- `engine-mouse-shader.test.ts`: the style list has five entries; `mouseWarpNone`
  is exactly `return uv;`; `mouseEye()` has the shared gate and scales by react
  and presence; only Chamber's table line names `mouseWarpNone`; `mouseEye(` is
  called once in `gradients.glsl`, inside `chamberGradient`.
- `portable-shader.test.ts`: an exported Chamber with the pointer on carries
  the gated `mouseEye()`; with the pointer off it carries the constant form and
  no pointer uniform or constant.
- `gradient-types.test.ts` "no gradient function reads the mouse" stays as it
  is and passes.
- Rendered checks (Step 2) and export parity (Step 4).

## Done criteria

ALL must hold:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` exit 0; `pnpm test:parity` exits 0
- [ ] `pnpm snapshots:diff /tmp/eye-before /tmp/eye-after` shows 0 for every image
- [ ] `grep -c "u_mouse" packages/core/src/shaders/gradients.glsl` → `0`
- [ ] `grep -c "mouseEye(" packages/core/src/shaders/gradients.glsl` → `2`
      (the comment above the `eye` lines and the call itself)
- [ ] Export parity for `chamber` is below 1/255 with and without `--mouse`
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 003 has not landed, or the `eye` lines differ from the excerpt.
- Any snapshot changes with the pointer absent (Step 2's first diff is not 0).
- Making this work seems to need `u_mouse*` inside `gradients.glsl`, a new
  uniform, or a change to `layer.glsl` or `engine.ts`.
- The exported shader fails to compile, or export parity exceeds 1/255.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Reviewer, look at:** that `gradients.glsl` still contains no `u_mouse`;
  that `mouseEye()` returns exactly zero when the pointer is away (this is what
  keeps pointer-less frames, captures and thumbnails unchanged).
- **Strength.** `CHAMBER_LOOK` (0.6) with the default `mouseReact` (0.5) moves
  the eye about a quarter of the way to the mouth's edge. It was chosen from
  stills. Tune it by hand on a real screen; the feel also depends on the
  pointer smoother in `pointer.ts`, which this plan leaves alone.
- **With the retired 3D projection on**, the gradient is sampled on an
  object's surface and the eye still follows the pointer. Harmless, and only
  reachable from old scenes.
- **The gallery** sets `mouseReact: 0` for every room (plan 004), so the eye
  does not follow the pointer there. Letting it do so for Chamber rooms alone
  is a two-line change in `galleryFrame` (keep the room's `mouseReact` when its
  layer's type is `chamber`); it is the owner's call, since the gallery's
  premise is that the visitor only watches.
- **Phones.** There is no pointer to hover with. The natural input is tilt
  (`deviceorientation`) fed to `engine.setMouse` / `setPointerActive`; iOS
  needs a permission prompt from a tap (the gallery's Enter button would do).
  Its own plan.
- **Other spaces.** A future look that is also a space seen from a point takes
  the same two things: `mouseWarpNone` in the table and `mouseEye()` in its
  body. The unit test that says only Chamber uses them must then be widened on
  purpose.
