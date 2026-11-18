# Plan 007: The gallery can be heard: a held chord per room, off unless asked for

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: plan 004 must have landed:
> `ls apps/editor/app/gallery/page.tsx apps/editor/lib/gallery.ts` lists both.
> Then confirm each anchor quoted in Step 2 occurs exactly once in
> `apps/editor/app/gallery/page.tsx` (plan 005 may also have landed; it does
> not touch those anchors). A missing or repeated anchor is a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW technically (one new module, opt-in, no dependency); the real risk is taste, and nobody has listened to it yet
- **Depends on**: plans/004-gallery-mode.md (must be DONE). Independent of 003, 005 and 006.
- **Category**: direction (new feature)
- **Planned at**: commit `a104287`, 2026-11-18 (on top of plan 004's files)

## Why this matters

The owner asked for "a visionary sensory experience". The gallery (plan 004)
is one sense. A room of slowly changing light is deepened by a sound that does
what the light does: holds, breathes, and changes without an edge. The
tradition is specific: sustained sine tones in simple whole-number ratios (La
Monte Young and Marian Zazeela's Dream House pairs exactly this with coloured
light).

This plan gives each room one held chord of sine tones, tuned from the room's
own colours, passing from one room's chord to the next as the picture does.
It is generated in the browser (Web Audio oscillators): no audio files, no
dependency, nothing to license or download.

It is **off unless the visitor turns it on**. A page that makes sound unasked
is hostile, and most Turrell rooms are silent; the silent gallery stays the
default experience.

## What it is (so you can judge the result)

- The threshold gains one switch under the Enter button: "Sound". Off by
  default, not remembered between visits.
- Inside, M turns the sound on or off. While on, the wall label's second line
  ends "· sound".
- Entering with sound on: silence, rising over 8 s with the light. Leaving:
  it fades over 1.5 s and the audio device is released. Hiding the tab
  suspends it.
- Each room's chord is four tones: a root, a fifth above it, an octave above
  it, and one colour tone on top. Each tone is two oscillators a fraction of a
  hertz apart, so it swells and fades once every three to seven seconds.
- The mapping from colour to sound (`roomTone`, pure and tested):
  - the mean hue of the room's **light** (every stop but the first, which is
    the wall or room) picks the root from five just intervals above A2
    (110 Hz): unison, major second, major third, fifth, major sixth;
  - warm light (reds to yellows, magentas) puts a major tenth on top, cool
    light a major ninth;
  - the room's overall lightness opens a low-pass filter (500–2000 Hz).
- A passage crossfades the two chords at equal power, driven by the same
  eased passage value as the picture, so sound and light move together.

The chords of today's eight rooms (hertz; `chamber` and `skyChamber` join when
plan 003 lands):

| Room | Tones | Filter |
|---|---|---|
| cove, aperture, corona | 165.0 247.5 330.0 371.3 | 1234–1494 |
| halo, ganzfeld, lightWall | 183.3 275.0 366.7 458.3 | 1138–1499 |
| emberCove, duskAperture | 110.0 165.0 220.0 275.0 | 1215–1263 |

**What was and wasn't verified during planning.** Written and run in a scratch
copy (at `a104287` plus plans 004 and 005):

- `lib/gallery-sound.ts` and its 7 unit tests pass; `tsc`, ESLint and
  `litt-classes.mjs --check` are clean with the page edits of Step 2.
- The page was driven in headless Chromium with the audio output tapped by an
  analyser. Measured:

  | Moment | Audio |
  |---|---|
  | Threshold, and inside with sound off | no audio context created at all |
  | Sound on, 2 s after Enter | running, RMS 0.009 |
  | 10 s (risen) | RMS 0.036, peak 0.083 |
  | Mid passage, then next room | RMS 0.041, then 0.057; peak 0.091 |
  | After M | context closed |
  | After M again, 10 s | a new context, RMS 0.036 |
  | After leaving | context closed |

  No console or page errors. Full scale is 1.0, so the peak leaves more than
  20 dB of headroom: it cannot clip.
- **Not verified: what it sounds like.** No one has heard it. The numbers
  above say it plays, at a modest level, without clipping; they cannot say it
  is beautiful. Step 4 hands that judgement to the owner, and the Maintenance
  notes say what to turn if it is not.

## Current state

`apps/editor/app/gallery/page.tsx`, as plan 004 installs it. The parts this
plan touches (each quoted line is an anchor for Step 2):

- the import of the programme:

  ```tsx
  import {
    galleryFrame, galleryRooms, skipWalk, startWalk, stepWalk,
    type GalleryRoom, type GalleryWalk,
  } from "@/lib/gallery";
  ```

- the refs: `const labelTimerRef = useRef<number | null>(null);`
- the frame callback's last line:
  `return galleryFrame(rooms, walk, now, arrivedRef.current, !stillRef.current);`
- the visibility handler:

  ```tsx
        if (document.visibilityState === "hidden") {
          engine.stopLoop();
          return;
        }
        start();
        keepAwake();
  ```

- the key handler's `} else if (e.key === "Escape") {` branch;
- where the rooms are resolved:
  `roomsRef.current = shared ? [shared] : galleryRooms();`
- the inside effect's cleanup, which begins `cancelled = true;` then
  `engine.stopLoop();`
- `enter`: `document.documentElement.requestFullscreen?.().catch(() => {});`
  then `setInside(true);`
- the threshold: `<Button variant="primary" size="lg" onClick={enter}>Enter</Button>`
  and the hint
  `Arrow keys move between rooms. Space holds a room. Esc leaves.`
- the label: `{holding ? " · holding" : ""}`

`apps/editor/lib/gallery.ts` exports `easePassage(t)` and
`passage(walk, now)` (the passage's progress, 0..1), which the page does not
import yet.

`apps/editor/components/ui/Toggle.tsx` is Wavr's adapter over litt's Switch:
`<Toggle label="…" checked={…} onChange={…} />`, already neutral-toned (the
house rule: "switches take `tone="neutral"`", one accent fill per view).

Rules from `CLAUDE.md` that apply: sentence case for labels; litt tokens only;
call sites use the `components/ui/*` adapter where one exists; "No backend:
Wavr is a client-only tool"; don't read `localStorage` or `window` in a first
render.

Browser rule that shapes the design: a page may only start audio from inside a
user gesture (a click or key press). So the sound is started in the Enter
click handler and in the M key handler, never in an effect.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint + typecheck | `pnpm lint` | exit 0 |
| Unit tests | `pnpm test` | all pass |
| Editor tests only | `pnpm --filter editor test -- gallery-sound` | 7 pass |
| Build | `pnpm build` | exit 0 |
| Dev server | `pnpm dev` | serves `http://localhost:3000` |

## Scope

**In scope** (the only files you should modify or create):

- `apps/editor/lib/gallery-sound.ts` (create, from `plans/assets/007-gallery-sound.ts.txt`)
- `apps/editor/lib/gallery-sound.test.ts` (create, from `plans/assets/007-gallery-sound.test.ts.txt`)
- `apps/editor/app/gallery/page.tsx`
- `CLAUDE.md`
- `plans/README.md` (your status row)

**Out of scope** (do NOT touch):

- `apps/editor/lib/gallery.ts`: the walk and the frame are not changed.
- The editor, `/embed`, `packages/*`: sound exists only in the gallery. Do not
  bring back the editor's removed audio reactivity.
- Audio files, an audio library, a reverb impulse, a worklet: none. If the
  result seems to need one, STOP.
- Remembering the choice (`localStorage`): deliberately not done; see
  Maintenance notes.

## Git workflow

- Work on the branch you were given; if none, `advisor/007-gallery-sound`.
- Commits in the repo's style (sentence case, imperative, no prefix), for
  example: `Add the gallery's sound`, `Let a visitor turn the gallery's sound
  on`, `Document the gallery's sound`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 0: Baseline

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm test
```

**Verify**: both exit 0.

### Step 1: Add the module

```bash
cp plans/assets/007-gallery-sound.ts.txt apps/editor/lib/gallery-sound.ts
cp plans/assets/007-gallery-sound.test.ts.txt apps/editor/lib/gallery-sound.test.ts
```

Read `gallery-sound.ts`. Its top half is pure: `hueOf`, `roomTone(colors)`,
`passageGains(mix)`. Its bottom half, `startGallerySound()`, builds the graph
(per chord: oscillator pairs → a gain each → one low-pass → a voice gain → a
master gain → the output) and returns `{ follow(a, b, mix), setSuspended,
stop }`, or `null` where there is no Web Audio (as in the Node test).

**Verify**: `pnpm --filter editor test -- gallery-sound` → 7 tests pass. If
"the programme has at least three roots" fails after plan 003 added rooms,
that is real information (the rooms sound too alike): STOP and report the
roots; do not weaken the test.

### Step 2: Wire it into the page

Ten edits in `apps/editor/app/gallery/page.tsx`. Each "after"/"replace" names
an anchor from "Current state".

1. Replace the programme import with:

   ```tsx
   import Toggle from "@/components/ui/Toggle";
   import {
     easePassage, galleryFrame, galleryRooms, passage, skipWalk, startWalk, stepWalk,
     type GalleryRoom, type GalleryWalk,
   } from "@/lib/gallery";
   import { roomTone, startGallerySound, type GallerySound, type RoomTone } from "@/lib/gallery-sound";
   ```

2. After `const labelTimerRef = useRef<number | null>(null);` add:

   ```tsx
     // The sound, while it plays, and each room's chord. Off unless the visitor asks for it.
     const soundRef = useRef<GallerySound | null>(null);
     const tonesRef = useRef<RoomTone[]>([]);
     const [soundOn, setSoundOn] = useState(false);
   ```

3. Replace the frame callback's `return galleryFrame(…);` line with:

   ```tsx
             const tones = tonesRef.current;
             soundRef.current?.follow(tones[walk.room], walk.next === null ? null : tones[walk.next], easePassage(passage(walk, now)));
             return galleryFrame(rooms, walk, now, arrivedRef.current, !stillRef.current);
   ```

4. In the visibility handler, add as its first line:

   ```tsx
         soundRef.current?.setSuspended(document.visibilityState === "hidden");
   ```

5. In the key handler, before `} else if (e.key === "Escape") {`, add a
   branch:

   ```tsx
         } else if (e.key === "m" || e.key === "M") {
           // A key press may start sound, as the Enter click may.
           if (soundRef.current) {
             soundRef.current.stop();
             soundRef.current = null;
           } else {
             soundRef.current = startGallerySound();
           }
           setSoundOn(soundRef.current !== null);
           showLabel();
   ```

6. After `roomsRef.current = shared ? [shared] : galleryRooms();` add:

   ```tsx
           tonesRef.current = roomsRef.current.map((entry) => roomTone(entry.state.layers[0]?.colors ?? []));
   ```

7. In the inside effect's cleanup, after `engine.stopLoop();` add:

   ```tsx
         soundRef.current?.stop();
         soundRef.current = null;
   ```

8. In `enter`, between the full-screen request and `setInside(true);` add:

   ```tsx
       // Sound, like full screen, has to start inside the click.
       if (soundOn) soundRef.current = startGallerySound();
   ```

9. Replace the Enter button with:

   ```tsx
               <div className="grid justify-items-start gap-4">
                 <Button variant="primary" size="lg" onClick={enter}>Enter</Button>
                 <Toggle label="Sound" checked={soundOn} onChange={setSoundOn} />
               </div>
   ```

   and the hint with
   `Arrow keys move between rooms. Space holds a room. M turns the sound on or off. Esc leaves.`

10. Before `{holding ? " · holding" : ""}` add:

    ```tsx
                  {soundOn ? " · sound" : ""}
    ```

**Verify**: `pnpm lint && pnpm test` → exit 0.
`grep -c "soundRef" apps/editor/app/gallery/page.tsx` → at least 8.
`grep -n "startGallerySound()" apps/editor/app/gallery/page.tsx` shows exactly
two calls, one in `enter` and one in the key handler, and none inside a
`useEffect` body other than within that key handler.

### Step 3: See it play

Start `pnpm dev` and run this with Node where `require('playwright')` resolves
(adjust the port if yours differs). It taps whatever reaches the speakers with
an analyser:

```js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
  await p.addInitScript(() => {
    const Real = window.AudioContext;
    window.__contexts = [];
    window.AudioContext = class extends Real { constructor(...a) { super(...a); window.__contexts.push(this); this.__an = this.createAnalyser(); this.__an.fftSize = 8192; } };
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest === this.context.destination && this.context.__an) connect.call(this, this.context.__an);
      return connect.call(this, dest, ...rest);
    };
    window.__level = () => {
      const c = window.__contexts[window.__contexts.length - 1];
      if (!c) return 'no context';
      if (c.state === 'closed') return 'closed';
      const d = new Float32Array(8192); c.__an.getFloatTimeDomainData(d);
      let s = 0, pk = 0; for (const v of d) { s += v * v; pk = Math.max(pk, Math.abs(v)); }
      return `${c.state} rms ${Math.sqrt(s / d.length).toFixed(3)} peak ${pk.toFixed(3)}`;
    };
  });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const level = async (what) => console.log(what.padEnd(22), await p.evaluate(() => window.__level()));
  await p.goto('http://localhost:3000/gallery', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: 'Enter' }).click(); await p.waitForTimeout(3000);
  await level('sound off');
  await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
  await p.getByRole('switch', { name: 'Sound' }).click();
  await p.getByRole('button', { name: 'Enter' }).click(); await p.waitForTimeout(10000);
  await level('sound on, 10 s');
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(8000);
  await level('next room');
  await p.keyboard.press('m'); await p.waitForTimeout(3000);
  await level('after M');
  await p.keyboard.press('Escape'); await p.waitForTimeout(3000);
  console.log('errors', JSON.stringify(errs));
  await b.close();
})();
```

**Verify**: it prints

```
sound off              no context
sound on, 10 s         running rms 0.03… peak 0.0…
next room              running rms 0.0… peak 0.…
after M                closed
errors []
```

with every RMS between 0.01 and 0.12 and every peak below 0.3. "no context"
with sound off matters as much as the levels: a visitor who never asks for
sound must never have an audio device opened.

### Step 4: Hand the listening to the owner

A note in your report, not something you can run. Ask the owner to open the
preview's `/gallery` with headphones and with laptop speakers, switch Sound
on, enter, and stay through at least two passages. What to listen for:

1. It rises from silence with the light and is never startling.
2. It reads as one held, slowly breathing sound, not as a buzz or an alarm.
3. A passage between rooms is a change of colour in the sound, with no click,
   gap or swell in loudness.
4. On laptop speakers the lowest rooms (root 110 Hz) are still audible.
5. M off and on, leaving, and switching tabs each do what the label says.

If it is not good, the answer may be to ship the gallery silent. Say so in
the report rather than tuning blind.

### Step 5: Document it

In `CLAUDE.md`, extend the **Gallery** bullet plan 004 added with:

> Sound is opt-in (a switch on the threshold, M inside): `lib/gallery-sound.ts`
> gives each room a held chord of sine tones from its colours (`roomTone`,
> pure and tested) and crossfades chords at equal power on the passage's own
> value. Web Audio oscillators only, no files. It starts inside the Enter click
> or the M key press (browsers allow sound only from a gesture), never in an
> effect, and no audio context exists until then.

**Verify**: `grep -c "gallery-sound" CLAUDE.md` → at least 1.

### Step 6: Final gate

```bash
pnpm lint && pnpm test && pnpm build
```

**Verify**: all exit 0.

## Test plan

- `apps/editor/lib/gallery-sound.test.ts` (new, 7 tests, provided): hue of
  primaries and of a grey; every room in the programme gets a root from the
  five just intervals, a fifth and an octave above it, gains that sum to 1 and
  fall with pitch, nothing above 500 Hz, beats slower than 1 Hz and a filter
  between 500 and 2000 Hz; the programme has at least three distinct roots;
  the chord follows the light, not the wall (warm → tenth, cool → ninth; one
  colour is its own light; equal colours give equal keys); a lighter room has
  a higher cutoff; passage gains are equal power at five points and clamp;
  `startGallerySound()` is `null` without Web Audio.
- The graph itself is checked in a browser (Step 3) and by ear (Step 4).

## Done criteria

ALL must hold:

- [ ] `pnpm lint`, `pnpm test`, `pnpm build` exit 0
- [ ] `apps/editor/lib/gallery-sound.test.ts` exists and its 7 tests pass
- [ ] `grep -rn "new AudioContext\|AudioContextClass()" apps/editor --include=*.ts --include=*.tsx -l`
      prints only `apps/editor/lib/gallery-sound.ts`
- [ ] `ls apps/editor/public | grep -ci "\.mp3\|\.wav\|\.ogg"` → `0`; `git diff --stat -- '**/package.json' pnpm-lock.yaml` prints nothing
- [ ] Step 3's script prints "no context" with sound off and levels in range with it on
- [ ] The report lists Step 4's checks for the owner
- [ ] `git status` shows no files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 004 has not landed, or an anchor in Step 2 is missing or repeated.
- An audio context exists before the visitor asks for sound (Step 3's first
  line is not "no context").
- Step 3 shows a peak above 0.3, an RMS of 0 with sound on, or any error.
- Getting sound to start seems to need creating the context in an effect, or
  on page load.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Nobody has heard this yet.** Everything below is where to turn it, in
  `gallery-sound.ts`:
  - too loud or too quiet: `SOUND_LEVEL` (0.16);
  - too low for small speakers: `SOUND_BASE_HZ` (110; try 147);
  - too restless: the `beat` values in `roomTone` (smaller is slower);
  - too plain: the chord's `ratios` and `weights`; a seventh harmonic (7/4)
    is the classic next colour;
  - too dry: a reverb needs an impulse response (a file, or a generated noise
    burst); that is a real addition and wants its own decision.
- **Rooms that share a chord.** Three of today's rooms sound the same notes.
  The mapping has only five roots on purpose (few, consonant); finer steps
  would make neighbouring rooms clash during a passage.
- **Not remembered.** The switch resets each visit. Remembering it would mean
  reading `localStorage` after hydration (see `lib/useTheme.ts` for the
  pattern) and, more to the point, a page that makes sound the moment you
  press Enter because of a choice made last month.
- **Safari and phones.** iOS plays Web Audio only after a touch and mutes it
  with the ring switch; both are respected by starting inside the Enter tap.
  Untested.
- **Reviewer, look at:** that `follow` is the only per-frame audio call and
  allocates nothing once the voices exist; that `stop` closes the context.
