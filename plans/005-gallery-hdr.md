# Plan 005: The gallery's light is brighter than white on an HDR screen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a104287..HEAD -- apps/editor/components/Canvas.tsx apps/editor/lib/hdr-status.ts apps/editor/lib/useHdrDisplay.ts packages/core/src/webgpu-hdr-output.ts packages/core/src/hdr.ts`
> must print nothing. Then check that plan 004 has landed:
> `ls apps/editor/app/gallery/page.tsx apps/editor/lib/gallery.ts` must list
> both files. If `Canvas.tsx` changed, compare the "Current state" excerpt
> against the live code; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (moves the editor's working HDR code into a shared hook; the move is mechanical and was run, but HDR itself can only be judged on an HDR display)
- **Depends on**: plans/004-gallery-mode.md (must be DONE)
- **Category**: direction (new feature)
- **Planned at**: commit `a104287`, 2026-11-18 (on top of plan 004's files as that plan installs them)

## Why this matters

A Turrell room works because the light is brighter than anything around it.
On a standard screen the brightest thing Wavr can show is white, the same
white as a web page. On an HDR screen (recent MacBook Pro, Pro Display XDR,
most recent phones and OLED monitors) it can show light several times
brighter than white, and Wavr's light-field presets already ask for that: 1 to
2 stops of `hdrHeadroom` each. The editor presents it. The gallery, after plan
004, does not: it is the one place built for watching, and it shows the
standard-range picture.

This plan makes the gallery present HDR whenever the screen can, by lifting
the editor's attach logic out of `Canvas.tsx` into a hook both pages use. No
engine, shader or programme change: `lib/gallery.ts` already blends
`hdrHeadroom` between rooms, and the engine reads it every frame.

## What it is (so you can judge the result)

- On a standard screen nothing changes anywhere.
- On an HDR screen, inside the gallery, the wall label's second line reads
  "1 of 10 · HDR", the openings and rims of the rooms glow visibly brighter
  than the white of the label text, and the rooms' walls look as they did.
- The editor behaves exactly as before.

`plans/assets/005-gallery-hdr.png` is the prototype's gallery on a simulated
HDR screen (headless Chromium): the label says "· HDR" and the picture comes
from the HDR canvas. The opening is clipped to white there only because a
screenshot is 8-bit; that clipping is the evidence that its values are above
white.

**What was and wasn't verified during planning.** The three changes below were
made in a scratch copy of the repo (at `a104287` plus plan 004's files) and
run: `tsc --noEmit`, ESLint (no warnings) and `litt-classes.mjs --check` are
clean; the editor's 743 unit tests pass; and both pages were driven in headless
Chromium with `matchMedia("(dynamic-range: high)")` stubbed to match and
WebGPU on SwiftShader's Vulkan. Observed, with no console or page errors:

| Moment | WebGL canvas | HDR canvas |
|---|---|---|
| Gallery threshold | opacity 1 | `display: none` |
| Inside, 12 s | opacity 0 | `display: block`, 480×270, label "Cove · 1 of 8 · HDR" |
| After a passage | opacity 0 | block, label "Aperture · 2 of 8 · HDR" |
| After leaving | opacity 1 | `display: none` |
| Entered again | opacity 0 | block |
| `/editor` (opens on Aperture) | opacity 0 | block |

**Not** verified, and not verifiable without the hardware: how it looks on a
real HDR display (brightness, banding, the passage between rooms of different
headroom), Safari, and a phone. Step 5 is that check and needs the owner.

## Current state

Excerpts from commit `a104287`.

- `apps/editor/components/Canvas.tsx` — the editor's canvas. It renders two
  canvases:

  ```tsx
      <canvas
        ref={canvasRef}
        className="block"
      />
      <canvas
        ref={hdrCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden h-full w-full"
      />
  ```

  and attaches the HDR output in an effect that starts:

  ```tsx
  // HDR: while the scene asks for headroom and the screen can show it, frames
  // go to an extended-range WebGPU canvas laid over the WebGL one (which the
  // engine then only packs frames onto). The WebGL canvas stays in place,
  // invisible, so it keeps the layout and the pointer. Attaching and detaching
  // draw a frame at once, so the swap shows no blank frame. The effect runs
  // after the engine's own, and again whenever that rebuilds the engine.
  useEffect(() => {
    const engine = engineRef.current;
    const glCanvas = canvasRef.current;
    const hdrCanvas = hdrCanvasRef.current;
    if (!hdrWanted || hdrDisplay !== true || !engine || !glCanvas || !hdrCanvas) {
      setHdrStatus("off");
      return;
    }
  ```

  and ends `}, [hdrWanted, hdrDisplay, onCanvasReady, onEngineReady]);`. In
  between it imports `@wavr/core/webgpu-hdr-output` on demand, calls
  `createWebGPUHdrOutput(hdrCanvas, useGradientStore.getState().colorProfile)`,
  then `engine.setHdrOutput(created)`, shows the HDR canvas
  (`style.display = "block"`), hides the WebGL one (`style.opacity = "0"`),
  and reports through `setHdrStatus` (`"off" | "starting" | "on" |
  "unsupported" | "lost"`). Its cleanup detaches and disposes.

- `apps/editor/lib/useHdrDisplay.ts` — `useHdrDisplay(): boolean | null`,
  whether the screen matches `(dynamic-range: high)`; `null` during hydration.
- `apps/editor/lib/hdr-status.ts` — `setHdrStatus(next)` and
  `useHdrStatus()`, a module-level store the Effects panel reads.
- `packages/core/src/engine.ts` — `setHdrOutput(output | null)` "draws the
  last state again at once either way"; while an output is attached each live
  frame's peak is `hdrPeak(state.hdrHeadroom)`, read per frame. The output's
  `present(range, profile)` reconfigures its canvas when a frame's profile
  differs from the one it was created with.
- `apps/editor/app/gallery/page.tsx` (from plan 004) — one canvas, an engine
  in `engineRef` created by the first effect, a second effect that runs while
  `inside` and resolves the rooms into `roomsRef.current`. Its key handler has
  (after plan 004's asset was updated on 2026-11-18):

  ```tsx
      } else if (e.key === "Escape") {
        // A browser in full screen takes Esc itself (onFullscreen then brings the threshold back); this is for the rest.
        if (document.fullscreenElement) void document.exitFullscreen();
        else setInside(false);
      }
  ```

  If your `page.tsx` instead has `e.key === "Escape" && !document.fullscreenElement`,
  plan 004 was executed from the earlier asset: make that one edit first (it is
  in scope here), then continue.

Rules from `CLAUDE.md` that apply (quoted):

- "Don't store the GL context or the engine in React state; use a ref."
- "While presenting, the WebGL canvas's `drawingBufferColorSpace` stays
  `"srgb"` (it holds data)" and "The WebGL canvas stays in place at
  `opacity: 0`, so it keeps the layout and the pointer." The hook keeps both
  as they are; do not hide the WebGL canvas any other way.
- "Captures and exports are standard range." Nothing here touches them.
- "Headless Chromium reports a standard-range screen, so to see the editor
  attach its output, stub `matchMedia("(dynamic-range: high)")`." And WebGPU
  there needs `--enable-features=Vulkan --use-vulkan=swiftshader
  --use-webgpu-adapter=swiftshader`: "with the default backend, presenting any
  WebGPU canvas loses the device and the WebGL context with it."

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0, no warnings from the files you touched |
| Unit tests | `pnpm test` | all pass |
| Build | `pnpm build` | exit 0 |
| HDR parity | `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` | all pass (includes `hdr.test.ts`) |
| Dev server | `pnpm dev` | serves `http://localhost:3000` |

Drop `CHROMIUM_PATH=…` where Playwright's own browser is installed.
`pnpm test:parity` empties `test-results/`.

## Scope

**In scope** (the only files you should modify or create):

- `apps/editor/lib/useHdrOutput.ts` (create, from `plans/assets/005-useHdrOutput.ts.txt`)
- `apps/editor/components/Canvas.tsx` (apply `plans/assets/005-canvas.patch`)
- `apps/editor/app/gallery/page.tsx` (apply `plans/assets/005-gallery-page.patch`)
- `CLAUDE.md`
- `plans/README.md` (your status row)

**Out of scope** (do NOT touch):

- `packages/core/*`: the engine, the WebGPU output and the shaders are not
  changed. If HDR seems to need an engine change, STOP.
- `apps/editor/lib/gallery.ts`: it already blends `hdrHeadroom`.
- `apps/editor/lib/hdr-status.ts`, `useHdrDisplay.ts`, `EffectsPanel.tsx`.
- `/embed`, `@wavr/gradient`, `@wavr/preview`: they stay standard range (see
  Maintenance notes).

## Git workflow

- Work on the branch you were given; if none, `advisor/005-gallery-hdr`.
- Three commits in the repo's style (sentence case, imperative, no prefix):
  `Move the HDR output's attach logic into a hook`, `Present HDR in the
  gallery`, `Document HDR in the gallery`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test
```

**Verify**: both exit 0. If they fail before you changed anything, STOP.

### Step 1: Move the attach logic into a hook

```bash
cp plans/assets/005-useHdrOutput.ts.txt apps/editor/lib/useHdrOutput.ts
git apply plans/assets/005-canvas.patch
```

Read both results. `useHdrOutput({ engineRef, glCanvasRef, hdrCanvasRef,
wanted, initialProfile?, engineKey? })` is the effect that was in `Canvas.tsx`,
unchanged in what it does. Its three differences from the inline effect, all
deliberate:

- `wanted` replaces the store read: the caller says whether what it shows asks
  for headroom.
- `initialProfile` (a stable, module-level function) replaces
  `useGradientStore.getState().colorProfile`; `Canvas.tsx` passes
  `sceneProfile`, which is that same read.
- `engineKey` replaces `onCanvasReady, onEngineReady` in the dependency list:
  `Canvas.tsx` builds it with
  `useMemo(() => [onCanvasReady, onEngineReady], [onCanvasReady, onEngineReady])`,
  so it changes identity exactly when either callback does, which is when the
  engine's own effect rebuilds the engine.

In `Canvas.tsx` the hook call must stay **after** the engine's `useEffect`
(effects run in order, and the hook reads `engineRef.current` when its effect
runs).

**Verify**: `pnpm lint && pnpm --filter editor test` → exit 0, and ESLint
prints no warning for `Canvas.tsx` or `useHdrOutput.ts`.
`grep -n "webgpu-hdr-output\|setHdrOutput" apps/editor/components/Canvas.tsx`
prints nothing; the same grep on `apps/editor/lib/useHdrOutput.ts` prints
lines.

If `git apply` rejects the patch, `Canvas.tsx` has drifted: STOP (do not apply
it by hand).

### Step 2: Present HDR in the gallery

```bash
git apply plans/assets/005-gallery-page.patch
```

What it adds to `apps/editor/app/gallery/page.tsx`:

- a second canvas over the first, with the classes the editor's HDR canvas
  has: `pointer-events-none absolute inset-0 hidden h-full w-full`;
- `hdrWanted` state: set, once the rooms are resolved inside, to whether any
  of them asks for headroom, and reset in that effect's cleanup, so the output
  exists only while the visitor is inside;
- the `useHdrOutput` call, after both effects (no `initialProfile`: the first
  frame carries the room's profile and the output takes it);
- " · HDR" in the label's second line while `useHdrStatus()` is `"on"`.

If `git apply` rejects it because plan 004's page differs from the asset this
patch was made against, make the same four edits by hand, in the places just
described, and say so in your report. Nothing else in the page changes.

**Verify**: `pnpm lint && pnpm test` → exit 0.
`grep -c "hdrCanvasRef" apps/editor/app/gallery/page.tsx` → `3`.

### Step 3: See it attach, on a simulated HDR screen

Start `pnpm dev`, then run this with Node from any directory where
`require('playwright')` resolves (adjust the port if yours differs):

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl',
    '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-vulkan=swiftshader',
    '--use-webgpu-adapter=swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => q === '(dynamic-range: high)'
      ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent() { return false; } }
      : real(q);
  });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const canvases = () => p.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => `${getComputedStyle(c).display}/${getComputedStyle(c).opacity}`).join(' '));
  await p.goto('http://localhost:3000/gallery', { waitUntil: 'networkidle' });
  console.log('threshold', await canvases());
  await p.getByRole('button', { name: 'Enter' }).click();
  await p.waitForTimeout(12000); await p.mouse.move(100, 100); await p.waitForTimeout(600);
  console.log('inside', await canvases(), '|', (await p.locator('p[aria-live]').innerText()).replace(/\n/g, ' · '));
  await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  console.log('left', await canvases());
  await p.goto('http://localhost:3000/editor', { waitUntil: 'networkidle' }); await p.waitForTimeout(8000);
  console.log('editor', await canvases());
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
```

**Verify**: it prints exactly this shape (the room's name may differ):

```
threshold block/1 none/1
inside block/0 block/1 | <room> · 1 of <N> · HDR
left block/1 none/1
editor block/0 block/1
errors []
```

`inside … block/0 block/1` with "· HDR" is the gallery presenting through the
HDR canvas; `editor block/0 block/1` is the editor still doing so after the
move. If `inside` shows `block/1 none/1` and no "· HDR", the browser has no
WebGPU adapter in your environment (the status went to "unsupported"): say so
in your report and rely on Step 4 and the owner's check, do not change code.

### Step 4: Gate

```bash
pnpm lint && pnpm test && pnpm build
CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity
```

**Verify**: all exit 0. (`hdr.test.ts` exercises the engine and the WebGPU
output, which this plan does not change; it guards against an accident.)

### Step 5: Hand the real check to the owner

This step is a note in your report, not something you can run. Ask the owner
to open the deployed preview on an HDR screen (for example a MacBook Pro's
built-in display, in Chrome) and confirm:

1. `/gallery` → Enter: the label shows "· HDR", and the rooms' light is
   plainly brighter than the label's white text.
2. A passage between a 2-stop room (`halo`) and a 1-stop room (`lightWall`)
   has no jump in brightness at its start or end.
3. No banding on the dark walls of `chamber` (if plan 003 has landed).
4. Leaving (Esc) and entering again still works, and moving the window to a
   standard screen and back does not leave a blank canvas.
5. `/editor` still shows HDR on Aperture, with the Effects panel's caption as
   before.

### Step 6: Document it

In `CLAUDE.md`:

- In the Editor section's **HDR** bullet, change "`Canvas.tsx` imports the
  WebGPU output on demand and lays its canvas over the WebGL one" to say that
  `lib/useHdrOutput.ts` does this, for `Canvas.tsx` and for the gallery, and
  change the last sentence, "Only the editor presents HDR so far (`/embed`,
  `@wavr/gradient` and `@wavr/preview` don't yet)", to "The editor and the
  gallery present HDR (`/embed`, `@wavr/gradient` and `@wavr/preview` don't
  yet)". Add: "Call the hook after the effect that creates the engine."
- In the **Gallery** bullet plan 004 added, replace its last sentence ("It is
  standard range: it does not present HDR yet.") with: "On an HDR screen it
  presents through `useHdrOutput` while the visitor is inside; the frame's
  `hdrHeadroom` is blended between rooms like the other blended globals."
- In "Rendering Architecture", the **HDR output** bullet ends "Captures and
  exports are standard range." Leave it; it is still true.

**Verify**: `grep -c "useHdrOutput" CLAUDE.md` → at least 2, and
`grep -c "Only the editor presents HDR" CLAUDE.md` → 0.

## Test plan

- No new unit test: the editor's Vitest runs in Node without a DOM, and the
  hook is an effect over WebGPU and two canvases. What guards it: the existing
  743 unit tests (nothing may change), `tests/parity/hdr.test.ts` (engine and
  output), Step 3's script (attach, detach, reattach, and the editor after the
  move), and the owner's check on real hardware.
- If the executor's environment allows, keeping Step 3's script as
  `tests/parity/gallery-hdr.test.ts` would be worth a follow-up plan: it needs
  a built or served editor, which the parity harness does not start today, so
  it is deliberately not part of this one.

## Done criteria

ALL must hold:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` exit 0
- [ ] `CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm test:parity` exits 0
- [ ] `grep -rn "createWebGPUHdrOutput" apps/editor --include=*.ts --include=*.tsx -l`
      prints only `apps/editor/lib/useHdrOutput.ts`
- [ ] Step 3's script prints the expected five lines (or the report says the
      environment has no WebGPU adapter)
- [ ] `git diff --stat` touches only the in-scope files; `git diff --stat -- packages`
      prints nothing
- [ ] The report lists Step 5's checks for the owner
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 004 has not landed, or `Canvas.tsx` no longer matches the excerpt.
- `plans/assets/005-canvas.patch` does not apply.
- Step 3 shows `editor block/1 none/1` while `inside` attached: the move broke
  the editor's attach. Revert Step 1 and report.
- Step 3 reports any page or console error.
- After leaving the gallery the WebGL canvas stays at opacity 0, or after
  entering again nothing draws.
- Making it work appears to need a change under `packages/`.

## Maintenance notes

- **Reviewer, look at:** that `Canvas.tsx`'s hook call sits after the engine
  effect; that `engineKey`'s `useMemo` lists both callbacks; that the gallery
  resets `hdrWanted` in the cleanup (otherwise a WebGPU device stays alive
  behind the threshold).
- **`hdr-status` is one module-level value** shared by whichever page is open.
  The editor and the gallery are separate routes, so they never present at the
  same time. If a page ever mounts two HDR canvases, the status must become
  per-output first.
- **Brightness in a dark room.** Two stops is four times white; in a dark room
  on a 1000-nit screen that can be a lot. If the owner finds it harsh, the
  place to soften it is the gallery's frame (`galleryFrame` in
  `lib/gallery.ts`): scale `hdrHeadroom` there by a gallery-wide factor, not
  the presets, which the editor shares.
- **The arrival** raises `brightness` from 0 to 1 over 8 s; in HDR that ramp
  ends above white, so it is steeper to the eye than in standard range. If it
  reads as too fast on real hardware, lengthen `GALLERY_ARRIVAL_SECONDS`.
- **Next:** `/embed` and `@wavr/gradient` are still standard range. The hook
  is editor-local (`apps/editor/lib`) on purpose: a published component should
  get its own decision about loading WebGPU. Do that as its own plan once the
  gallery has been lived with.
