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
| [002](002-redraw-on-resize.md) | A Wavr canvas never shows a blank frame while it is resized | P1 | S | — | TODO |

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

## Dependency notes

- 001 and 002 are independent and touch different code, except that both add
  a line to `CLAUDE.md` (different sections). They can run in either order or
  in parallel.
- Together they deliver the request: 001 is the picture, 002 is what lets the
  picture survive a container that animates its size. 001 alone already works
  for a card of fixed size and for a full-bleed hero.

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
