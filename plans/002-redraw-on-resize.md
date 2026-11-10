# Plan 002: A Wavr canvas never shows a blank frame while it is resized

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 8409970..HEAD -- packages/core/src/engine.ts apps/editor/lib/portable-runtime.ts apps/editor/lib/portable-runtime.test.ts CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 001 has landed; this plan was
> refreshed against it.)

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (independent of plan 001; either order)
- **Category**: bug
- **Planned at**: commit `8409970`, 2026-11-10 (written against `e7b88af`; line numbers refreshed after plan 001 landed, nothing else changed)

## Why this matters

The look the owner wants (see `plans/001-cove-light-field.md`) lives in a card
that changes size continuously: a button grows into a card and back. Today a
Wavr canvas goes blank for every frame in which it is resized, so a gradient in
an animating container flickers or disappears for the whole animation. Two
smaller symptoms have the same cause: the canvas blinks while a window or
sidebar is dragged, and a **paused** gradient that is resized stays blank until
something else changes.

The cause: setting a canvas's `width` or `height` clears it. Every Wavr surface
resizes from a `ResizeObserver`, and the browser runs those callbacks *after*
the frame's `requestAnimationFrame` callbacks (where the engine draws) and
*before* it paints. So the frame is drawn, then cleared, then painted blank.
The fix is to draw again right after the size changes. The engine already does
exactly this in two other places.

**Evidence.** The planner could not install the repo's dependencies, so this
was reproduced with a page that copies the engine's pattern (a WebGL 2 canvas
with `preserveDrawingBuffer: false`, a `requestAnimationFrame` draw loop, a
`ResizeObserver` that sets `canvas.width` / `height`) while its container is
resized every frame, in headless Chromium: **37 of 40 screenshots showed a
blank canvas; with a redraw after the resize, 0 of 40.** The page and the
counting script are `plans/assets/002-resize-repro.html` and
`plans/assets/002-resize-repro.cjs`. It was not run against Wavr's own build.

## Current state

Excerpts are from commit `8409970`.

- `packages/core/src/engine.ts:1024-1035` — `resize()` sets the size and does
  not draw:

  ```ts
  resize(width: number, height: number) {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    const nextWidth = Math.max(1, Math.floor(width * dpr));
    const nextHeight = Math.max(1, Math.floor(height * dpr));
    if (gl.canvas.width !== nextWidth || gl.canvas.height !== nextHeight) {
      gl.canvas.width = nextWidth;
      gl.canvas.height = nextHeight;
      this.renderScaleController?.reset(performance.now());
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }
  ```

- Every surface calls it from a `ResizeObserver` and nothing else:
  `packages/react/src/WavrGradient.tsx:118-121`,
  `apps/editor/components/Canvas.tsx:150-164`,
  `apps/editor/app/embed/page.tsx:46-68`,
  `packages/preview/src/preview.ts:43-54`. Fixing `resize()` fixes all four.

- The render loop (`engine.ts:2298-2327`) redraws a paused scene only for a
  new state or a moving pointer, so nothing repaints a paused canvas after a
  resize:

  ```ts
      if (!state.playing) {
        // Paused: the animation clock stands still, so redraw only for a new
        // state or while the pointer, ripple or trail is still moving.
        if (state !== lastPausedState || this.isPointerAnimating(state)) {
  ```

- **The precedent to copy**, `engine.ts:2191-2202`. `setHdrOutput()` draws the
  last state again at once, and swallows a draw error because the render loop
  reports it:

  ```ts
  setHdrOutput(output: HdrOutput | null) {
    if (output === this.hdrOutput) return;
    this.hdrOutput = output;
    if (!output) this.destroyHdrTarget();
    const state = this.lastState;
    if (!state || this.gl.isContextLost()) return;
    try {
      this.render(state);
    } catch {
      // A frame that can't be drawn fails the render loop, which reports it.
    }
  }
  ```

  `captureImageData()` (`engine.ts:2546-2551`) knows the same fact:
  "Resizing cleared the visible canvas; redraw it so a paused editor isn't
  left blank until the next state change."

- `this.lastState` (`engine.ts:2400`) is the state of the most recent
  `render()` call; `render()` sets it on entry (`engine.ts:2037`). It is
  `null` until the first frame.

- `apps/editor/lib/portable-runtime.ts:272-303` — the runtime that code
  exports embed (a template string that becomes the exported file) has the
  same pattern:

  ```js
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  ```

  and its loop ends, inside the template:

  ```js
  ${pointer ? "    steer(dt);\n" : ""}    gl.uniform1f(uTime, time);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    render();
  ```

- `apps/editor/lib/portable-runtime.test.ts:91-94` — the test harness's fake
  observer ignores its callback:

  ```ts
      ResizeObserver: class {
        observe() {}
        disconnect() {}
      },
  ```

**Test patterns to follow.**

- Engine tests build a real `GradientEngine` on a recording fake context:
  `apps/editor/lib/engine-capture.test.ts` (its `state()` and `setup()`
  helpers, lines 18–27, and "captures at a larger size, then restores the
  canvas and redraws it", lines 60–77, which asserts a redraw to the canvas
  the same way this plan needs).
- No existing test calls `engine.resize()`: it reads `window.devicePixelRatio`
  and the tests run in Node, where `window` does not exist. Stub it
  (`vi.stubGlobal`, as `engine-render-scale.test.ts` does for
  `requestAnimationFrame`).

## Commands you will need

Read from `package.json` and `.github/workflows/ci.yml`; **not executed during
planning**. If one behaves differently from the table, STOP.

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| All unit tests | `pnpm test` | exit 0 |
| Some editor tests | `pnpm --filter editor exec vitest run lib/<file>.test.ts` | all pass |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope** (the only files you should modify or create):

- `packages/core/src/engine.ts` — the `resize()` method only
- `apps/editor/lib/engine-resize.test.ts` (create)
- `apps/editor/lib/portable-runtime.ts` — the resize observer and the draw
  call of the runtime template only
- `apps/editor/lib/portable-runtime.test.ts`
- `CLAUDE.md` — one new bullet
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- `WavrGradient.tsx`, `Canvas.tsx`, `apps/editor/app/embed/page.tsx`,
  `packages/preview/src/preview.ts`: they call `engine.resize()` and get the
  fix through it. Do not add redraws there.
- Do not change *when* the canvas is resized (for example deferring it to the
  next animation frame). Callers read `canvas.width` straight after
  `resize()` (the editor sizes its text mask from it).
- `captureImageData()` and `capturePixels()`: they size the canvas themselves
  and already redraw.
- The engine's frame-rate cap, the render loop and `render()` itself.
- Adding `children` or new props to `WavrGradient`.

## Git workflow

- Branch: the repo's branches are named `claude/<slug>`. Use the branch the
  operator gave you; otherwise `claude/redraw-on-resize`.
- Commit style: a short sentence-case imperative subject, no prefix, e.g.
  (from `git log`) "Fit the editor to the phone's width", "Gate slider keys in
  the capture phase". One commit per step is fine.
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

**Verify**: all exit 0. If lint or tests fail before any change, STOP.

### Step 1: Write the engine test first

Create `apps/editor/lib/engine-resize.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GradientEngine, createLayer, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import { createFakeGL } from "./test-utils/fake-webgl";

function state(overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "lightWall", colors: [[1, 0, 0], [0, 0, 1]] }] });
  return { ...base, layers: [createLayer({ gradientType: "lightWall" })], ...overrides };
}

function setup() {
  const fake = createFakeGL(); // canvas is 16×8
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

describe("GradientEngine.resize", () => {
  beforeEach(() => {
    // resize() reads the device pixel ratio from window, which Node lacks.
    vi.stubGlobal("window", { devicePixelRatio: 1 });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the last state again at once when the canvas changes size", () => {
    const { engine, canvas, draws } = setup();
    engine.setElapsedTime(5);
    engine.render(state());
    const before = draws.length;

    engine.resize(32, 20);
    expect([canvas.width, canvas.height]).toEqual([32, 20]);
    // Setting the size cleared the canvas, so it is drawn again, at the new size and the same time.
    expect(draws.length).toBeGreaterThan(before);
    const redraw = draws[draws.length - 1];
    expect(redraw.target).toBeNull();
    expect(redraw.uniforms.u_resolution).toEqual([32, 20]);
    expect(redraw.uniforms.u_time).toBe(5);
    expect(engine.getElapsedTime()).toBe(5);
  });

  it("draws nothing when the size is unchanged", () => {
    const { engine, draws } = setup();
    engine.render(state());
    const before = draws.length;
    engine.resize(16, 8);
    expect(draws.length).toBe(before);
  });

  it("only sizes the canvas before the first frame", () => {
    const { engine, canvas, draws } = setup();
    engine.resize(32, 20);
    expect([canvas.width, canvas.height]).toEqual([32, 20]);
    expect(draws).toHaveLength(0);
  });
});
```

**Verify**:

```bash
pnpm --filter editor exec vitest run lib/engine-resize.test.ts
```

→ exactly **one** test fails ("draws the last state again at once when the
canvas changes size", at `expect(draws.length).toBeGreaterThan(before)`); the
other two pass. That failure is the bug. If the file fails to load, or a
different test fails, fix the test file (compare with
`apps/editor/lib/engine-capture.test.ts`) before going on; if it still does
after one attempt, STOP.

### Step 2: Redraw in `resize()`

In `packages/core/src/engine.ts`, replace the `resize()` method shown in
"Current state" with:

```ts
  /**
   * Sizes the canvas for a box of `width` x `height` CSS pixels. Setting a
   * canvas's size clears it, and a ResizeObserver runs after the frame's draw
   * and before its paint, so when the size changes the last state is drawn
   * again at once: a canvas that is being resized (a window drag, a container
   * that animates) never presents a blank frame, and a paused one is not left
   * blank.
   */
  resize(width: number, height: number) {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    const nextWidth = Math.max(1, Math.floor(width * dpr));
    const nextHeight = Math.max(1, Math.floor(height * dpr));
    const resized = gl.canvas.width !== nextWidth || gl.canvas.height !== nextHeight;
    if (resized) {
      gl.canvas.width = nextWidth;
      gl.canvas.height = nextHeight;
      this.renderScaleController?.reset(performance.now());
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    const state = this.lastState;
    if (!resized || !state || gl.isContextLost()) return;
    try {
      this.render(state);
    } catch {
      // A frame that can't be drawn fails the render loop, which reports it.
    }
  }
```

Nothing else in the file changes.

**Verify**:

```bash
pnpm --filter editor exec vitest run lib/engine-resize.test.ts lib/engine-capture.test.ts lib/engine-render-scale.test.ts lib/engine-hdr.test.ts lib/engine-render-passes.test.ts
```

→ all pass, including the three new tests.

```bash
pnpm lint
```

→ exit 0.

### Step 3: The exported runtime

Code exports (React component, web component, standalone player) carry their
own small runtime, generated from a template string in
`apps/editor/lib/portable-runtime.ts`. Give it the same fix.

**3a. Test first.** In `apps/editor/lib/portable-runtime.test.ts`:

- In `launch()`, next to `let queue: (() => void)[] = [];`, add:

  ```ts
  const resizeCallbacks: (() => void)[] = [];
  ```

- Replace the fake `ResizeObserver` in `env` with one that keeps its callback:

  ```ts
      ResizeObserver: class {
        constructor(callback: () => void) {
          resizeCallbacks.push(callback);
        }
        observe() {}
        disconnect() {}
      },
  ```

- In the object `launch()` returns, after `step(ms) { … },`, add:

  ```ts
      /** Runs the resize observer's callback, as the browser does when the canvas's box changes. */
      resized() {
        for (const callback of resizeCallbacks) callback();
      },
  ```

- In `describe("drawing", …)`, after "skips frames closer than 1/45 s, and
  hidden pages", add:

  ```ts
      it("draws again at once when the canvas is resized, at the size it now has", () => {
        const run = launch({}, language);
        run.step(100);
        expect(run.fake.draws).toHaveLength(1);
        // Setting a canvas's size clears it; the frame is drawn again before the browser paints.
        Object.assign(run.canvas, { clientWidth: 320, clientHeight: 200 });
        run.resized();
        expect(run.fake.draws).toHaveLength(2);
        expect(run.last()).toMatchObject({ u_resolution: [480, 300] });
        expect(run.last().u_time).toBeCloseTo(0.1, 9);
      });
  ```

**Verify**: `pnpm --filter editor exec vitest run lib/portable-runtime.test.ts`
→ exactly the new test fails, once per language (`js` and `ts`: 2 failures),
at `toHaveLength(2)`. Every other test passes.

**3b. Fix the template.** In `apps/editor/lib/portable-runtime.ts`, inside the
runtime template:

- Replace

  ```js
    const observer = new ResizeObserver(resize);
  ```

  with

  ```js
    // Setting a canvas's size clears it, and the observer runs after this
    // frame's draw: draw again at once, so a canvas that is being resized
    // never shows a blank frame.
    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
  ```

  Leave the two lines after it (`observer.observe(canvas);` and `resize();`)
  as they are: the first `resize()` must not draw (nothing is set up yet).

- Split the three GL calls at the end of `render` into a `draw` function,
  declared just before `const render = () => {`:

  ```js
    const draw = () => {
      gl.uniform1f(uTime, time);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  ```

  and make the end of `render` call it. The line that is now

  ```js
  ${pointer ? "    steer(dt);\n" : ""}    gl.uniform1f(uTime, time);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  ```

  becomes

  ```js
  ${pointer ? "    steer(dt);\n" : ""}    draw();
    };
  ```

  Keep the template's indentation exactly as the surrounding lines have it
  (the emitted file is formatted by it). `draw` is declared after `observer`
  but is only called later, from the observer's callback and from `render`,
  so the order is fine.

**Verify**:

```bash
pnpm --filter editor exec vitest run lib/portable-runtime.test.ts lib/export.test.ts lib/export-typecheck.test.ts lib/export-fidelity.test.ts lib/portable-shader.test.ts
```

→ all pass.

### Step 4: Record the rule

In `CLAUDE.md`, section "Rules That Are Easy To Break", add this bullet after
the "**Render loop:**" bullet:

```markdown
- **Resizing:** setting a canvas's size clears it, and a `ResizeObserver` runs after the frame's draw and before its paint. `engine.resize()` therefore draws the last state again when the size changed; size the live canvas only through it. Code that sets `canvas.width` itself must redraw too (as `captureImageData` and the exported runtime do), or a canvas that is being resized, or a paused one, shows blank frames.
```

**Verify**: `grep -c "^- \*\*Resizing:\*\*" CLAUDE.md` → `1`.

### Step 5: Final gate

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

- New file `apps/editor/lib/engine-resize.test.ts` (Step 1), modelled on
  `apps/editor/lib/engine-capture.test.ts`: a resize that changes the size
  redraws to the canvas at the new size and the same clock; an unchanged size
  draws nothing; before the first frame it only sizes the canvas.
- One new test in `apps/editor/lib/portable-runtime.test.ts` (Step 3), run for
  both languages: the resize observer's callback draws at once at the new
  size and the current time.
- Both are written before the fix and must fail first (Steps 1 and 3a), so
  they are known to detect the bug.
- Verification: `pnpm test` → all pass, including 3 + 2 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0; `apps/editor/lib/engine-resize.test.ts` exists with 3 passing tests; the new runtime test passes for `js` and `ts`
- [ ] `pnpm build` exits 0
- [ ] `grep -c "this.render(state)" packages/core/src/engine.ts` → `4` (it is `3` before the change)
- [ ] `grep -c "const observer = new ResizeObserver(resize);" apps/editor/lib/portable-runtime.ts` → `0`
- [ ] `git status --short` shows no modified file outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm lint` or `pnpm test` fails at Step 0, before any change.
- The code at the locations in "Current state" doesn't match the excerpts
  (in particular if `resize()` already draws, or `lastState` no longer exists).
- In Step 1 the new engine test **passes** before the fix: the bug is not
  where this plan says it is.
- After Step 2 any existing engine test fails (a redraw is now counted where a
  test did not expect one). Report which; do not weaken the test.
- A step seems to need a change to `render()`, the render loop, or a file in
  the out-of-scope list.

## Maintenance notes

- **Check it in a real browser** (the unit tests prove a draw is issued, not
  what the screen shows). On the PR's Vercel preview or `pnpm dev`: open
  `/editor`, pause the animation, drag the window's edge. Before this change
  the canvas goes blank and stays blank; after it, it keeps its picture.
  `plans/assets/002-resize-repro.html` shows the mechanism on its own: open
  it with `?mode=engine&morph=1` (flickers) and `?mode=redraw&morph=1` (steady).
- **Cost.** While a canvas is being resized it is drawn twice per frame (once
  by the loop, once by `resize()`). That is the price of never showing a blank
  frame, and it only lasts as long as the resize. If it ever matters, the
  alternative is to defer the size change to the start of the next frame's
  draw, which needs every caller that reads `canvas.width` after `resize()`
  (the editor's text mask) to move too.
- **A text mask lags one frame.** `Canvas.tsx` re-renders the text mask
  texture after `engine.resize()` returns, so the redraw inside it uses the
  previous mask, stretched; the next frame corrects it. Before this change
  that frame was blank.
- **HDR.** With an HDR output attached, `render()` presents through it, so the
  redraw covers that path too; it was not exercised here.
- Reviewers: confirm `resize()` draws only when the size actually changed (an
  observer can fire with the same size), and that the first `resize()` of the
  exported runtime still does not draw.
