# Plan 004: Wavr has a gallery: full screen, no interface, a slow walk through rooms of light

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a104287..HEAD -- packages/core/src/engine.ts apps/editor/app apps/editor/lib/commands.ts apps/editor/lib/url.ts apps/editor/lib/url-sync.ts apps/editor/components/ShortcutsModal.tsx apps/editor/lib/engine-render-passes.test.ts CLAUDE.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Plan 003 changes `engine.ts` by one
> line in `GRADIENT_TYPE_IDS` and `CLAUDE.md` in "Adding a Gradient Mode";
> those are expected and not a mismatch.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW–MED (a new route and one small, default-preserving engine field; nothing existing changes behaviour)
- **Depends on**: none to run; plan 003 adds two rooms (`chamber`, `skyChamber`) that the gallery picks up by itself once they exist
- **Category**: direction (new feature)
- **Planned at**: commit `a104287`, 2026-11-15

## Why this matters

The owner wants Wavr to be experienced, not only edited: "gallery mode where it
goes full screen and you're just experiencing it, like a James Turrell
exhibition". Today the only ways to see a scene are inside the editor, between
a top bar, a sidebar and a timeline, or in `/embed`, which is a bare canvas for
other sites.

This plan adds `/gallery`: a dark threshold with one button, then nothing but
light. It walks through Wavr's light-field presets, holds each for 80 seconds,
and passes to the next over 30 seconds without a cut. No interface while you
watch; a wall label fades in when the room changes or the pointer moves. From
the editor, one key (G) opens the scene you are working on in the gallery.

## What it is (so you can judge the result)

`plans/assets/004-gallery-run.jpg` is six screenshots of the working prototype
(640×360, headless Chromium), left to right, top then bottom: the threshold;
3 s after Enter (the first room rising out of the dark, label and Leave
showing); 11 s in (the room, interface gone); 3 s into a passage asked for with
the right arrow (both rooms in one frame); the next room; the label after Space
("2 of 8 · holding"). The round "N" badge is Next's dev indicator, not part of
the page.

`plans/assets/004-crossfade.jpg` is a passage from `aperture` to `emberCove` at
0, 35, 70 and 100 percent, rendered by the engine as one frame with two layers.

The design, and why:

- **A threshold.** Browsers only grant full screen from a click, so there has
  to be one. It doubles as the anteroom: black, one sentence, one accent
  button. Nothing renders behind it; the GPU starts when you enter.
- **Arrival.** The first room rises from black over 8 s (the engine's
  `brightness`), so eyes adjust instead of being hit.
- **Passages, not cuts.** While passing, the frame holds the room being left
  with the room being entered over it at a rising opacity. One engine, one
  canvas, no blank frame, and the engine compiles the next room's shader while
  the current one is still on screen. The cinematic bloom, which some rooms
  have and some don't, fades by amount (the engine field this plan adds)
  instead of switching.
- **No interface.** The cursor hides. The label (room name, "3 of 10") shows
  for 6 s on a room change or a pointer move, with a Leave button. The pointer
  does not bend the picture (`mouseReact: 0`): a visitor watches.
- **Keys.** Right/left arrows move on or back over 6 s (pressed during a
  passage, they hurry it; the picture never jumps). Space holds a room. Esc
  leaves full screen, which returns to the threshold.
- **Accessibility.** With `prefers-reduced-motion: reduce` the rooms stand
  still and never advance by themselves; arrows still dissolve between them.
  The label is `aria-live="polite"`. Nothing changes faster than a 6 s
  dissolve, so there is no flashing. The screen is kept awake (Wake Lock)
  only while inside.
- **A shared scene.** `/gallery#<state>` (the hash of any editor link) shows
  that one scene, held, with the same arrival. This is what G in the editor
  opens.

**What was and wasn't verified during planning.** All of the code this plan
adds was written and run in a scratch copy of the repo at `a104287`:
`lib/gallery.ts` and its 11 tests pass; the engine change and its test pass
(16 tests in `engine-render-passes.test.ts`); `tsc --noEmit`, ESLint and
`scripts/litt-classes.mjs --check` are clean for the new files; the page was
driven in headless Chromium through Enter, a passage, a hold and Esc with no
console or page errors, full screen engaged, and Esc returned to the threshold.
**Not** verified: the editor entry points (Step 5), a real GPU, a phone, the
shared-scene path with a real hash, Wake Lock (headless has no screen), and the
litt.md score. The prototype ran before plan 003, so with 8 rooms.

## Current state

Excerpts from commit `a104287`.

- `apps/editor/app/embed/page.tsx` — the closest existing route: a client
  page that owns a `GradientEngine` on a full-window canvas. The pattern this
  plan follows (engine in a ref, `engine.resize` from a `ResizeObserver`, loop
  stopped while the tab is hidden):

  ```tsx
  const resize = () => {
    const rect = parent.getBoundingClientRect();
    engine.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
  ```
  ```tsx
  <main className="fixed inset-0 overflow-hidden bg-black">
    <canvas ref={canvasRef} className="block h-full w-full" />
  </main>
  ```

- `packages/core/src/engine.ts` — `EngineState` (the object a frame is drawn
  from) ends:

  ```ts
    trailWidth: number;
    realBloomEnabled: boolean;
    debandEnabled: boolean;
    debandStrength: number;
    playing: boolean;
    customGLSL: string | null;
  }
  ```

  and `render()` decides the bloom like this (three lines, in this order, with
  other lines between them):

  ```ts
        const bloomActive = state.realBloomEnabled;
        if (bloomActive) this.renderBloomPyramid(sceneTexture, compositeScaleX, compositeScaleY);
  ```
  ```ts
        if (bloomActive) this.setf("u_realBloomGain", BLOOM_STRENGTH * bloomNormalization(this.bloomLevels.length));
  ```

  In `post.glsl` the bloom texture is multiplied by `u_realBloomGain` before it
  is added, so a gain that goes to 0 is a bloom that fades out.

- `packages/core/src/config.ts` — `resolveConfig(config: GradientConfig):
  EngineState` turns a preset's config into an engine state (exported from
  `@wavr/core`). `PRESET_CATALOG` (`@wavr/core/presets`) lists every preset as
  `{ id, name, category, config }`. The light-field ids today: `aperture`,
  `cobaltAperture`, `duskAperture`, `ganzfeld`, `cove`, `emberCove`, `halo`,
  `iceHalo`, `corona`, `iceVeil`, `lightWall`, `lagoonWall`. All set
  `toneMapMode: 0` and `colorProfile: "display-p3"`; they differ in `grain`,
  `hdrHeadroom` and `realBloomEnabled`.

- `apps/editor/app/editor/page.tsx` — the editor's key handler, a `switch` on
  `e.key` that runs only outside inputs:

  ```tsx
        case "s":
          if (!isMeta) toggleRenderStats();
          break;
        default: {
          const tab = SIDEBAR_TABS.find((_, i) => e.key === String(i + 1));
  ```

- `apps/editor/lib/commands.ts` — the command palette's registry. The View
  group has:

  ```ts
  commands.push({
    id: "view.renderStats",
    label: renderStatsShown() ? "Hide render stats" : "Show render stats",
    group: "View",
    keywords: ["fps", "performance", "debug", "stats", "frame rate"],
    shortcut: "S",
    run: toggleRenderStats,
  });
  ```

- `apps/editor/lib/url.ts` — `copyShareUrl(state)` shows how to get a share
  URL when the codec may not be loaded yet:

  ```ts
  if (!isUrlCodecLoaded()) await loadUrlCodec().catch(() => undefined);
  const url = getShareUrlV2(state);
  ```

- `apps/editor/components/ShortcutsModal.tsx` — the list:

  ```ts
    { keys: ["S"], action: "Show or hide render stats" },
    { keys: ["⌘Z"], action: "Undo" },
  ```

- `apps/editor/app/page.tsx` (landing) — the hero's one primary button:

  ```tsx
              <Link href="/editor" className={buttonClassName({ variant: "primary", size: "lg" })}>
                <span className="litt-trim">Open editor</span>
              </Link>
  ```

- `apps/editor/app/sitemap.ts` — lists `baseUrl` and `${baseUrl}/editor`.

Rules from `CLAUDE.md` that apply (quoted or paraphrased closely):

- "Don't store the GL context or the engine in React state; use a ref."
- "Render loop: use `requestAnimationFrame`, never `setInterval`" (the engine's
  `startLoop` does; do not add a timer-driven loop).
- "Size the live canvas only through `engine.resize()`."
- "`/editor` is prerendered, so don't read `localStorage` or `window` in the
  first render of a client component." The same holds for `/gallery`: read
  `window` only in effects and handlers.
- "Keep `@wavr/schema` runtime imports … out of … the initial bundle": the URL
  codec is loaded on demand. The gallery page imports it only when there is a
  hash.
- litt.md: classes are litt's tokens only (`text-litt-fg-muted`,
  `bg-litt-surface-1`, …); **one accent fill per view** (here: the Enter
  button); **sentence case** for every label; spacing on the 8px grid; never
  hand-edit `components/litt/*` or `lib/litt/*`. A link that looks like a
  button takes `buttonClassName` from `lib/litt-button-classes.ts`; a real
  button is litt's `Button` (`components/litt/button.tsx`).
  `data-theme="dark"` on an element gives it and its children the dark tokens
  (`lib/litt/tokens.css`), whatever the visitor's theme.
- "Only the editor presents HDR so far." The gallery does not either after
  this plan; see Maintenance notes.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | all pass |
| Editor tests only | `pnpm --filter editor test` | all pass |
| Build | `pnpm build` | exit 0; the route list includes `/gallery` |
| Dev server | `pnpm dev` | serves `http://localhost:3000` |
| litt score | `node <litt.md clone>/skills/litt-md/scripts/litt-check.mjs apps/editor/app apps/editor/components` | 90 or above (only if a litt.md clone is available; otherwise say so in your report) |

## Suggested executor toolkit

- If a browser-driving skill or Playwright is available, use it for Step 6
  (`require('playwright')`, `chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })`
  worked during planning).

## Scope

**In scope** (the only files you should modify or create):

- `packages/core/src/engine.ts` (the `realBloomAmount` field and its three uses)
- `apps/editor/lib/engine-render-passes.test.ts` (one new test)
- `apps/editor/lib/gallery.ts` (create, from `plans/assets/004-gallery.ts.txt`)
- `apps/editor/lib/gallery.test.ts` (create, from `plans/assets/004-gallery.test.ts.txt`)
- `apps/editor/app/gallery/page.tsx` (create, from `plans/assets/004-gallery-page.tsx.txt`)
- `apps/editor/app/gallery/layout.tsx` (create: metadata only)
- `apps/editor/lib/gallery-link.ts` (create)
- `apps/editor/lib/commands.ts`, `apps/editor/app/editor/page.tsx`,
  `apps/editor/components/ShortcutsModal.tsx` (the editor's entry points)
- `apps/editor/app/page.tsx` (one link on the landing), `apps/editor/app/sitemap.ts`
- `CLAUDE.md`
- `plans/README.md` (your status row)

**Out of scope** (do NOT touch):

- `apps/editor/components/Canvas.tsx` and the editor's store: the gallery has
  its own canvas and never writes to the store.
- `packages/schema`, `packages/react`, `packages/preview`: `realBloomAmount`
  is a runtime-only engine field. It is not a config field, is not saved, and
  is not in share URLs.
- `packages/core/src/shaders/*`: no shader changes.
- HDR output, sound, device tilt, a "rooms" editor: see Maintenance notes.
- `components/litt/*`, `lib/litt/*` (vendored).

## Git workflow

- Work on the branch you were given; if none, `advisor/004-gallery-mode`.
- Commits in the repo's style (sentence case, imperative, no prefix), for
  example: `Let a scene fade the cinematic bloom`, `Add the gallery's
  programme`, `Add the gallery`, `Open a scene in the gallery from the editor`,
  `Document the gallery`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test
```

**Verify**: both exit 0. If they fail before you changed anything, STOP.

### Step 1: Let a scene fade the cinematic bloom

In `packages/core/src/engine.ts`:

1. In `EngineState`, after `realBloomEnabled: boolean;` add:

   ```ts
     /** Scales the cinematic bloom, 0..1 (default 1), so a scene can fade it in and out. */
     realBloomAmount?: number;
   ```

2. In `render()`, replace `const bloomActive = state.realBloomEnabled;` with:

   ```ts
         const bloomAmount = state.realBloomEnabled ? Math.min(Math.max(state.realBloomAmount ?? 1, 0), 1) : 0;
         const bloomActive = bloomAmount > 0;
   ```

3. In the `u_realBloomGain` line, multiply by it:
   `BLOOM_STRENGTH * bloomAmount * bloomNormalization(this.bloomLevels.length)`.

Leave every other use of `bloomActive` as it is. With the field absent the
amount is exactly 1, so every existing scene draws as before.

In `apps/editor/lib/engine-render-passes.test.ts`, add this test just before
`it("post pass reads the composited scene from unit 6 and applies effects", …`:

```ts
  it("the bloom amount scales the bloom's gain, and at 0 the bloom is not drawn at all", () => {
    const gain = (overrides: Partial<EngineState>) => {
      const { engine, draws } = setup();
      engine.render(stateWith({ realBloomEnabled: true, ...overrides }));
      return { passes: draws.length, gain: draws[draws.length - 1].uniforms.u_realBloomGain };
    };
    const full = gain({});
    expect(gain({ realBloomAmount: 1 })).toEqual(full);
    expect(gain({ realBloomAmount: 0.5 }).gain).toBeCloseTo((full.gain as number) / 2);
    expect(gain({ realBloomAmount: 0 })).toEqual({ passes: 2, gain: undefined });
  });
```

**Verify**: `pnpm --filter editor test -- engine-render-passes` → all pass (16
tests in that file). `grep -rn "realBloomAmount" packages apps --include=*.ts --include=*.tsx -l`
lists only `packages/core/src/engine.ts` and the test file.

### Step 2: Add the programme

```bash
cp plans/assets/004-gallery.ts.txt apps/editor/lib/gallery.ts
cp plans/assets/004-gallery.test.ts.txt apps/editor/lib/gallery.test.ts
```

Read both. `gallery.ts` is pure (no React, no DOM, every function takes `now`
in seconds): `GALLERY_ROOM_IDS` (the rooms by preset id, in walking order; an
id the catalogue lacks is skipped, which is how plan 003's rooms join later),
`galleryRooms()`, the walk (`startWalk`, `stepWalk`, `skipWalk`, `passage`),
`blendRooms(a, b, mix)` and `galleryFrame(rooms, walk, now, arrived, playing)`.

**Verify**: `pnpm --filter editor test -- gallery` → 11 tests pass. One of
them ("only holds rooms a passage can blend") fails if a listed preset has more
than one layer or differs from the others in a global the passage does not
blend; if it fails for a room that plan 003 added, STOP and report which key
differs.

### Step 3: Add the page

```bash
mkdir -p apps/editor/app/gallery
cp plans/assets/004-gallery-page.tsx.txt apps/editor/app/gallery/page.tsx
```

Create `apps/editor/app/gallery/layout.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wavr gallery — light, slowly",
  description: "A full-screen walk through rooms of light, made with Wavr.",
};

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Read `page.tsx` before going on; what each part is for:

- The first effect creates the engine once (in a ref), sizes the canvas only
  through `engine.resize`, and destroys it on unmount. Pixel ratio up to 2, 60
  fps, adaptive render scale down to 0.6 if frames run late.
- The second effect runs while `inside`: it resolves the rooms (the shared
  scene if there is a hash, else the programme), starts the walk and the loop,
  keeps the screen awake, and listens for keys, pointer moves, tab visibility
  and the end of full screen. Its cleanup undoes all of it.
- The frame callback passed to `engine.startLoop` is the only place the walk
  advances; it calls `setRoom` only when the room being entered changes.
- `enter` asks for full screen inside the click; where the browser has none
  (an iPhone) the page already fills the window.

**Verify**: `pnpm lint` → exit 0 (this runs `scripts/litt-classes.mjs --check`,
ESLint and `tsc --noEmit` for the editor).

### Step 4: Check the page's copy and layout against litt.md

The prototype's threshold is a single column, left-aligned, centred in the
window: a small line "Wavr gallery", the title "Light, slowly.", one sentence,
the Enter button, a line of key hints, and a ghost link "Back to Wavr". Keep
that structure and wording unless the litt check objects. If a litt.md clone is
available, run the score command from the table.

**Verify**: score 90 or above, or, with no clone available, confirm by reading
the page that: the only accent fill is the Enter button; every string is
sentence case; no class names a colour outside `litt-*` tokens except
`bg-black` (the room is black before light, deliberately not a theme colour);
gaps are multiples of 4px. Report which of the two you did.

### Step 5: Open a scene in the gallery from the editor

Create `apps/editor/lib/gallery-link.ts`:

```ts
import { useGradientStore } from "./store";
import { getShareUrlV2, isUrlCodecLoaded, loadUrlCodec } from "./url-sync";

/** Opens the scene being edited in the gallery (same tab; Back returns to the editor with the scene intact). */
export async function openInGallery(): Promise<void> {
  if (!isUrlCodecLoaded()) await loadUrlCodec().catch(() => undefined);
  const url = getShareUrlV2(useGradientStore.getState());
  const at = url.indexOf("#");
  window.location.assign(`/gallery${at >= 0 ? url.slice(at) : ""}`);
}
```

Then:

- `apps/editor/lib/commands.ts`: import `openInGallery` and add, right after
  the `view.renderStats` command:

  ```ts
  commands.push({
    id: "view.gallery",
    label: "Open in gallery",
    group: "View",
    keywords: ["full screen", "fullscreen", "immersive", "present", "exhibition", "experience"],
    shortcut: "G",
    run: () => void openInGallery(),
  });
  ```

- `apps/editor/app/editor/page.tsx`: import `openInGallery` from
  `@/lib/gallery-link` and add to the key `switch`, after the `"s"` case:

  ```tsx
        case "g":
          if (!isMeta) void openInGallery();
          break;
  ```

- `apps/editor/components/ShortcutsModal.tsx`: add after the `S` entry:
  `{ keys: ["G"], action: "Open the scene in the gallery" },`

- `apps/editor/app/page.tsx` (landing): directly after the hero's "Open
  editor" `<Link>`, inside the same parent, add a second, quieter link. The
  parent is a `grid … gap-8`; wrap the two links in
  `<div className="flex flex-wrap items-center gap-2">` so they sit on one
  line:

  ```tsx
  <Link href="/gallery" className={buttonClassName({ variant: "ghost", size: "lg" })}>
    <span className="litt-trim">Visit the gallery</span>
  </Link>
  ```

  (Ghost, not primary or secondary: the landing keeps its one accent fill.)

- `apps/editor/app/sitemap.ts`: add an entry for `${baseUrl}/gallery`
  (`changeFrequency: "monthly"`, `priority: 0.8`), shaped like the others.

**Verify**: `pnpm lint && pnpm --filter editor test` → exit 0. If
`commands.test.ts` or `command-groups.test.ts` fails on a pinned list that now
has one more command, extend that expectation with `view.gallery` and say so
in your report; if it fails for another reason, STOP.

### Step 6: See it run

```bash
pnpm dev
```

Open `http://localhost:3000/gallery` (drive it with a browser tool if you have
one; otherwise ask the operator to, and list these checks for them).

**Verify** (all must hold):

1. The threshold shows as in the first image of
   `plans/assets/004-gallery-run.jpg`; the browser console has no errors.
2. Enter: the window goes full screen and the first room rises from black; the
   label and Leave show, then fade after about 6 s and the cursor disappears.
3. Right arrow: within 6 s the picture has become the next room, with no cut
   and no blank frame; the label names the new room and "2 of N".
4. Space: the label shows "· holding". Space again: it goes.
5. Esc: full screen ends and the threshold is back. Enter again works.
6. In the editor (`/editor`), press G: the gallery's threshold opens; after
   Enter the scene from the editor shows, labelled "Shared scene". The
   browser's Back returns to the editor with the same scene.
7. The landing page shows "Visit the gallery" beside "Open editor".

### Step 7: Document it

In `CLAUDE.md`:

- "Repo Layout" table, the `apps/editor` row: routes become
  `/` landing, `/editor`, `/embed`, `/gallery`.
- In the "Editor (`apps/editor`)" section add one bullet, in the file's voice:

  > - **Gallery:** `/gallery` is the full-screen walk through the light-field
  >   presets (`app/gallery/page.tsx`). Its programme is `lib/gallery.ts`,
  >   pure and tested: `GALLERY_ROOM_IDS` (preset ids in walking order), the
  >   walk (`stepWalk`, `skipWalk`) and `galleryFrame`, which during a passage
  >   draws the room being left with the room being entered over it at a
  >   rising opacity and fades the cinematic bloom with `realBloomAmount`
  >   (an engine-only field: not in configs, URLs or exports). A room must be
  >   one layer and share every global the passage does not blend
  >   (`GALLERY_BLENDED_KEYS`); the test says which. The page has its own
  >   engine and never touches the store, except to read a shared scene from
  >   the hash (`/gallery#<state>`, what G in the editor opens). It is standard
  >   range: it does not present HDR yet.

**Verify**: `grep -c "/gallery" CLAUDE.md` → at least 2.

### Step 8: Final gate

```bash
pnpm lint && pnpm test && pnpm build
```

**Verify**: all exit 0, and the build's route list includes `/gallery`.

## Test plan

- `apps/editor/lib/gallery.test.ts` (new, 11 tests, provided): the programme
  resolves in order; every room is blendable; the walk rests, advances, wraps,
  stays put without `advance` or with one room; a skip at rest starts a quick
  passage in either direction; a skip during a passage hurries it with no jump
  in `passage()`; `blendRooms` returns the room itself at 0 and 1, layers the
  entered room at the passage's opacity, blends `grain`, and fades the bloom by
  amount in both directions; `galleryFrame` starts at brightness 0, reaches the
  room's own, sets `mouseReact: 0` and passes `playing` through.
- `apps/editor/lib/engine-render-passes.test.ts` (one new test, Step 1): the
  bloom amount scales the gain; amount 1 equals the field being absent; amount
  0 draws no bloom passes.
- The page itself has no unit test (the editor's Vitest runs in Node, without
  a DOM); Step 6 is its check.

## Done criteria

ALL must hold:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` exit 0
- [ ] `apps/editor/lib/gallery.test.ts` exists and its 11 tests pass
- [ ] `grep -rn "realBloomAmount" packages --include=*.ts -l` prints only
      `packages/core/src/engine.ts`
- [ ] `grep -rn "setInterval" apps/editor/app/gallery apps/editor/lib/gallery.ts`
      prints nothing
- [ ] `grep -n "useGradientStore" apps/editor/app/gallery/page.tsx` shows it
      only inside `sharedRoom()` (a dynamic import), never a static import
- [ ] Step 6's seven checks hold (or are handed to the operator, listed)
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" do not match the code (beyond plan 003's
  expected one-line changes).
- Step 0's baseline fails before you changed anything.
- An existing engine test fails after Step 1 (the change must be invisible when
  `realBloomAmount` is absent).
- `gallery.test.ts`'s blendability test fails for any room.
- A passage shows a blank or black frame, or a visible jump, in Step 6: do not
  patch around it with timers or a second canvas; report what you saw.
- The page needs a change to `Canvas.tsx`, the store, or a vendored litt file.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Reviewer, look at:** the frame callback in `page.tsx` (it must stay
  allocation-light and must not call `setState` every frame), the effect
  cleanup (loop stopped, wake lock released, listeners removed), and that the
  landing still has one accent fill.
- **HDR is the next step, and the biggest one for the "Turrell" feeling.** The
  light fields ask for 1–2 stops of headroom; on an HDR screen the editor shows
  their light brighter than white, and the gallery, after this plan, does not.
  The editor's attach logic is an effect in `components/Canvas.tsx` (the block
  that imports `@wavr/core/webgpu-hdr-output` and calls `engine.setHdrOutput`).
  The clean way is to lift that effect into a hook both pages use, driven by
  the frame's `hdrHeadroom` (which `blendRooms` already blends) and
  `lib/useHdrDisplay.ts`. It needs an HDR display to judge, so it is its own
  plan.
- **Timing constants** (`GALLERY_HOLD_SECONDS` 80, `GALLERY_FADE_SECONDS` 30,
  `GALLERY_SKIP_SECONDS` 6, `GALLERY_ARRIVAL_SECONDS` 8) are first guesses made
  without sitting in front of it. Turrell's own cycles are slower. Tune them by
  watching, on a real screen, in the dark.
- **Adding a room**: add its preset id to `GALLERY_ROOM_IDS`. The test fails if
  it has more than one layer or a global that differs and is not blended; then
  either add that key to `GALLERY_BLENDED_KEYS` (numbers only) or leave the
  room out.
- **Not done, on purpose**: sound (a slow drone per room would deepen it, but
  autoplay rules and taste make it the owner's call); device tilt as the
  pointer on phones (needs a permission prompt on iOS); a way to choose or
  order rooms; showing the walk in `/embed` or `@wavr/gradient`.
- **Phones**: iPhone Safari has no element full screen; the page fills the
  window and the browser bars stay. Adding a web app manifest with
  `display: fullscreen` would fix that for a home-screen install.
