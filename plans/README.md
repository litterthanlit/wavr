# Implementation Plans

Written on 2026-11-10 against commit `e7b88af`, for one request: make Wavr able
to produce the look of a reference clip, a rounded card that glows from its
edges round a dark core ("smooth, James Turrell-esque") and holds that look
while it changes shape. This was a targeted planning run, not a full audit of
the codebase.

Each executor: read the plan fully before starting, honor its STOP conditions,
and update your row when done.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| [001](001-cove-light-field.md) | Wavr has a Cove look: a frame lit from its edges round a dark core | P1 | M | — | DONE (commits `535fe3f`, `3fdc3cc`, `8409970`; reviewed) |
| [002](002-redraw-on-resize.md) | A Wavr canvas never shows a blank frame while it is resized | P1 | S | — | DONE (commits `07916f8`, `2acceab`, `5264728`; reviewed) |
| [003](003-chamber-light-field.md) | Wavr has a Chamber look: a room of light, seen in depth | P1 | M | — | TODO |
| [004](004-gallery-mode.md) | Wavr has a gallery: full screen, no interface, a slow walk through rooms of light | P1 | M | — (gains two rooms from 003) | TODO |
| [005](005-gallery-hdr.md) | The gallery's light is brighter than white on an HDR screen | P1 | S | 004 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (with one-line reason) | REJECTED (with one-line rationale — finding fixed independently or approach abandoned)

## Execution log

- **001, 2026-11-10: DONE.** Executed in an isolated worktree and reviewed:
  all 25 changed files are in scope; the shader in `gradients.glsl` is
  byte-identical to the plan's and the GLSL change is purely additive; lint,
  tests and build pass; every existing type and fixture renders 0/255
  different (20 images); both presets pass the luminance check (`cove`
  0.641 0.486 0.301 0.167 0.093 0.038, the prototype's numbers to three
  decimals); the code export matches the engine to 0.02/255; the parity
  harness passes (23 tests). Not yet seen on a real GPU, with bloom, or on an
  HDR display: see the plan's maintenance notes.
- What the run taught, for later plans:
  - `pnpm test:parity` does not find `/opt/pw-browsers/chromium` by itself
    (its Playwright config reads only `CHROMIUM_PATH`). Run it as
    `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` where
    Playwright's own browser is not installed. Plan 001's command table was
    wrong about this.
  - `pnpm test:parity` empties `test-results/` (it is Playwright's output
    directory). Run it last, or keep snapshot output elsewhere.
  - Plan 001's check `grep -c "cove" CLAUDE.md` expects 3 but counts lines;
    the three edits sit on one line, so it prints 1. The edits are right.
  - `pnpm lint`, `pnpm test` and `pnpm build` go through Turborepo, which
    replays a cached result when nothing a task reads has changed (`cache
    hit` in the output).
- Plan 002 was refreshed after 001 landed: one line added to `engine.ts`
  moved its line references down by one. Its excerpts still match the code.
- **002, 2026-11-11: DONE.** Executed in an isolated worktree on top of the
  merged Cove work and reviewed: the 5 changed files are in scope and the
  code is the plan's; lint, tests (731 in the editor) and build pass. The new
  tests detect the bug: with `engine.ts` put back, the engine test fails
  ("expected 2 to be greater than 2"), and with `portable-runtime.ts` put
  back, the runtime test fails for both languages.
  - Checked with the real engine in a browser, which planning could not do: a
    page that wires `createGradient` to a `ResizeObserver` as `@wavr/gradient`
    does, showing the Cove preset in a container resized every frame, on
    headless Chromium (SwiftShader). Built without the fix, 39 of 40
    screenshots showed a blank canvas and a paused canvas stayed blank after
    one resize; with the fix, 0 of 40 and the paused canvas kept its picture.
  - Still to see by eye on a real GPU: drag the editor window's edge while
    paused.

## Dependency notes

- 003 and 004 (second run, below) are independent and can run in either order
  or in parallel. They meet in one place: 004's gallery lists `chamber` and
  `skyChamber` among its rooms and skips ids the catalogue lacks, so it walks
  8 rooms before 003 lands and 10 after. Both edit `CLAUDE.md` (different
  sections) and 003 adds one line to `engine.ts` far from 004's change.
- Recommended order: 003 first. It is the picture; the gallery is the frame.
- 005 requires 004: it adds HDR to the page 004 creates (its page patch is made
  against 004's page asset). It does not depend on 003. Its last check needs
  the owner in front of an HDR display.

- 001 and 002 are independent and touch different code, except that both add
  a line to `CLAUDE.md` (different sections). They can run in either order or
  in parallel.
- Together they deliver the request: 001 is the picture, 002 is what lets the
  picture survive a container that animates its size. 001 alone already works
  for a card of fixed size and for a full-bleed hero.

## Second run, 2026-11-15: an experience, not only an editor

Written against commit `a104287` for one request: "turn Wavr into a visionary
sensory experience … make it look 3D … a gallery mode where it goes full
screen and you're just experiencing it, like a James Turrell exhibition."
Plans only; a different model implements. A targeted planning run again, not
an audit.

What the request comes down to:

- **Depth.** Every Wavr look was light on a flat wall. Turrell's rooms read as
  deep through perspective, light falling off along walls, a reflecting floor
  and parallax. Plan 003 adds a look with all four, in closed form, at the
  cost of the existing light fields.
- **A place to watch.** No interface, full screen, slow change, no cuts. Plan
  004 adds `/gallery`.

What was verified while planning (in a scratch copy of the repo with
dependencies installed; nothing in the working tree but `plans/` changed):

- 003's shader was rendered by `pnpm snapshots` (the real engine, headless
  Chromium) at several shapes, times and settings and tuned by eye; renders are
  in `assets/003-*.jpg`. Benchmarked level with `cove` and `aperture`.
- 004's code was written and run: its unit tests and the engine test pass,
  lint and typecheck are clean, and the page was driven in headless Chromium
  through enter, a passage, a hold and leave with no errors
  (`assets/004-gallery-run.jpg`). The sources the plan installs are
  `assets/004-*.txt`.
- While prototyping 005 the gallery page's Esc handling turned out to rely on
  the browser leaving full screen by itself; `assets/004-gallery-page.tsx.txt`
  was updated on 2026-11-18 so Esc always leaves. Plan 005 says what to do if
  004 was executed from the earlier asset.
- Not verified by anyone yet: a real GPU, an HDR display, a phone, 003 under
  its final id and through the code exports, 004's editor entry points.

Options for the owner, deliberately not planned (each is a decision, not a
task):

- **HDR in the gallery.** Planned since: plan 005 (written 2026-11-18, when
  the owner asked for it). Its code was run on a simulated HDR screen; how it
  looks on a real one is the owner's check.
- **The pointer as your head.** In Chamber, the pointer (or a phone's tilt)
  moving the eye would make the room answer like a window. It needs the
  "gradients never read the pointer" rule reworded and two tests changed. Plan
  003's maintenance notes give the design.
- **Sound.** A slow drone per room. Powerful when right, tacky when not, and
  browsers block audio until a click (the Enter button would count).
- **A second depth look** after Turrell's corner projections (a cube of light
  that seems to float). Only after Chamber has been seen on real screens.

## What the reference is, and what Wavr was missing

The clip shows a card on a pale page morphing between a wide button, a small
square and a tall card. Measured frame by frame:

- Light enters from all four edges and falls off exponentially, to 1/e about
  every tenth of the card's shorter side, whatever the card's shape.
- The rim is pale rose-white; brightness saturates toward it gradually, as
  film does, with no clipped band.
- The colour comes from two or three large soft pools (cobalt, violet,
  periwinkle) sitting along the edges and drifting; the core is dark navy and
  changes shape as they move.
- There is no grain, no banding and no hard edge anywhere inside the card.

Wavr's nearest look, `aperture`, has the rim-to-core idea but puts it in an
opening of fixed proportions inside a wall, coloured by depth alone. Nothing in
Wavr followed the canvas's own shape. That is plan 001.

Separately, every Wavr surface clears its canvas when it is resized and does
not draw again until the next frame, so a gradient in a container that animates
its size is blank for the whole animation. That is plan 002.

## What was verified while planning, and what was not

- Plan 001's shader was compiled and rendered in headless Chromium inside the
  repo's real layer program, and tuned against the clip. Renders are in
  `assets/001-*.jpg`.
- Plan 002's cause was reproduced with a page that copies the engine's resize
  pattern (`assets/002-resize-repro.html`): 37 of 40 frames blank, 0 of 40
  with the fix.
- Nothing was run through the repo's own toolchain: dependencies were not
  installed, so `pnpm lint`, `pnpm test`, the snapshot harness and the code
  exports were not executed. The plans' commands come from `package.json` and
  CI, and each plan starts with a baseline step that stops if they do not
  behave as described.

## Findings considered and rejected

- **Second run: the existing 3D paths** (the raymarched 3D shape projection in
  `layer.glsl`, the mesh distortion, the Three.js scene overlay) as the way to
  "look 3D": rejected. They put a gradient on an object; the request is light
  in a space. The editor has already retired the first two from its panels.
- **Second run: gallery as a mode of the editor** (hide the panels, full-screen
  the editor's canvas): rejected. Walking through presets would write to the
  editor's store, undo history and URL; a separate route has its own engine,
  is a link anyone can be sent, and loads none of the editor.
- **Second run: two stacked canvases cross-faded with CSS** for the passages:
  rejected. Two engines, two contexts, and no path to HDR. One frame with two
  layers does it in the engine (`assets/004-crossfade.jpg`).
- **Second run: a raymarched room** for Chamber: rejected. A box seen from
  inside is three divisions, and a rectangle's light on a wall has an exact
  formula; a march would cost more and band.

- **Extend `aperture` instead of adding a type**: rejected. Filling the frame
  would need its proportions slider to track the canvas, its wall stop to go
  unused and a second colour model beside its depth ramp; the result would be
  two looks behind one name, and existing Aperture scenes would have to be
  proven unchanged. A new type is additive and the repo has a documented path
  for it.
- **A corner-radius control for Cove** (so the frame of light follows a pill):
  deferred, described in plan 001's maintenance notes. Card radii up to about
  a quarter of the shorter side already look right; a full pill dims the rim
  at its ends and wants a rounded-frame term that needs its own tuning.
- **A transparent rim, so the card melts into any page**: not worth doing.
  Setting the palette's last stop near the page colour does it, with no alpha
  path through the engine, exports and captures.
- **`children` on `<WavrGradient>`**: not worth doing. Layering content over
  the gradient is one wrapper `div`; plan 001 documents the recipe in the
  agent skill.
- **Deferring the canvas resize to the next frame's draw** (instead of drawing
  twice during a resize): rejected for plan 002. Callers read the canvas size
  straight after `resize()`, and the engine already redraws at once in two
  other places.
- **A CSS-only export of Cove** (inset shadows and blurred blobs): not looked
  at. `exportCSS` is an approximation by design; revisit if someone asks for
  Cove without WebGL.
