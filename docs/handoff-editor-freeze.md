# Handoff: editor freezes the user's computer — roll back production, then build a crash guard

**Status:** open, urgent. Written 2026-09-26.
**Reporter:** the project owner. On their machine, opening the editor freezes the whole computer, not just the tab.

> "I literally can't open the app, it crashes my whole computer, I can't get to the editor, once I press enter my screen freezes"

The owner asked for two things, in this order:
1. Roll production back to a build from before the 2026-09-25/26 rendering changes.
2. Build a crash guard so a bad start can't lock anyone out again.

---

## 1. What is known

### Symptoms and likely mechanism
- **Where it starts:** the landing page (`/`) only uses a plain 2D canvas. The freeze starts when `/editor` loads. That's when `GradientEngine` compiles the uber fragment shader (`packages/core/src/shaders/fragment.glsl`, ~1,850 lines) and starts the `requestAnimationFrame` render loop.
- **Mechanism (inferred, not confirmed):** a whole-machine freeze from a web page almost always means the GPU is hung or saturated by one very long draw or shader compile. macOS in particular can lock the whole display.
- **Not confirmed:** the owner's OS, browser and GPU are unknown.
- **Can't be reproduced in a cloud container:** there is no real GPU. Headless Chromium uses SwiftShader, which compiles the uber shader but loses the context or draws blank frames.

### What changed recently
Everything below was merged to `main` on 2026-09-25/26. Each merge has its own production deployment.

| PR | Commit (main) | Deployment URL (append `/editor`) | Rendering impact |
|---|---|---|---|
| — (before all of this) | `7065ffa` | https://wavr-dtwmma6b6-nicks-projects-14b58bdc.vercel.app | baseline |
| #21 CI + PNG export fix | `f38ea43` | https://wavr-kgv6jtr4u-nicks-projects-14b58bdc.vercel.app | none at startup |
| #22 post-pass rework | `a4a5e74` | https://wavr-iojhenqvd-nicks-projects-14b58bdc.vercel.app | **shader + render path** |
| #23 uniform upload cache | `f904a77` | https://wavr-6zulvau54-nicks-projects-14b58bdc.vercel.app | **uniform uploads** |
| #24 export rework | `81ac0ec` | https://wavr-bxwxb4tvd-nicks-projects-14b58bdc.vercel.app | capture API, `Scene3DCanvas` capture bridge, `Canvas.tsx` frame-state refactor |
| #25 IndexedDB images | `9240f00` | https://wavr-15uzm9tme-nicks-projects-14b58bdc.vercel.app | none at startup |
| #26 LiftKit cleanup | `b52a536` | https://wavr-hzo14c0ed-nicks-projects-14b58bdc.vercel.app | CSS only (pixel-identical) |
| #27 enums + presets | `53e1a3a` | https://wavr-88meft5ko-nicks-projects-14b58bdc.vercel.app | **current production** |

- **Vercel IDs:** team `team_0KpOAlZ65f8DzlPdUNNy9vA7`, project `prj_CtwdHFrjKiK0VFcWb7izKkru0zEf` (name `wavr`).
- **Deployment IDs:**
  - `7065ffa` → `dpl_45bxsW7rj7KRXYtRdHgNaaJtJ2Jq`
  - `f38ea43` → `dpl_7T6GAZaBoBusDtBgZZycK3K1vTHt`
  - `53e1a3a` → `dpl_7DsxSczSgUQ41BLgRrw3FELtcAA5`

### What the startup render does
- **Default editor state:** one mesh layer and no neighbour-sampling effect (bloom, glow, blur, chromatic aberration and pixel sort are all off). That takes `render()`'s **single-pass** path, which was structurally unchanged by #22.
  - Differences in that path are an extra `u_postPass` uniform (set to 0) and a `sampleScene()` wrapper around the `computeGradient()` call sites.
  - #23 then skips re-uploading unchanged uniforms.
- **Scene from the URL:** a URL hash (`/editor#s2.…`) restores a saved scene via `lib/url-sync.ts`. That scene may be multi-layer and heavy, which takes the composite + post-pass path. It's unknown whether the owner's URL had a hash.
- **The shader was always heavy.** The freeze may predate these changes and be a baseline problem on that machine. Nothing proves either way yet.

### Suspects (unconfirmed, in rough order)
1. **#22 post pass.** The shader grew (`sampleScene`, `u_postPass` branches). Driver compile time for the uber shader may have crossed a threshold on some GPUs. Multi-layer scenes now always do one extra full-screen pass.
2. **Baseline cost on that machine.** The uber shader plus `maxPixelRatio` 1.5 (auto mode) on a large Retina or 4K display.
3. **#23 uniform cache.** Unlikely to hang the GPU, but it changes which GL calls happen. Covered by `engine-uniform-cache.test.ts`.

---

## 2. Task A: roll back production

**This is an outward-facing change to the live site. Confirm with the owner before doing it** (they asked for it in principle, so confirm the target).

- **Target:** the deployment from before all of the above, `7065ffa` / `dpl_45bxsW7rj7KRXYtRdHgNaaJtJ2Jq`.
  - If the owner's bisect (section 4) shows the freeze starts later, roll back to the last good one instead. For example, #21 `dpl_7T6GAZaBoBusDtBgZZycK3K1vTHt` keeps the CI and PNG fixes.
- **How:** Vercel Instant Rollback, via the Vercel MCP `request_rollback` tool or the dashboard (Deployments → ⋯ → Instant Rollback / Promote).
  - `list_deployments` reported `isRollbackCandidate: false` for older deployments, and `true` only for the two most recent. Hobby plans may only allow rolling back to the previous production deployment.
  - If Instant Rollback to `dpl_45bx…` is refused, the alternatives are:
    - (a) `request_promote` on that deployment, if the plan allows.
    - (b) Revert the merges on `main`. Use a revert PR (`git revert -m 1` of each merge, newest first), **not** a force-push. Its production deploy is then the rollback.
- **Afterwards:**
  - Tell the owner which build is live.
  - Ask them to confirm `/editor` opens.
  - Note that production auto-deploys from `main`. After an Instant Rollback, Vercel stops auto-promoting new `main` deploys until someone promotes again, so tell the owner that too.

## 3. Task B: crash guard ("safe mode")

The goal is that no scene, driver or regression can lock someone out of the editor.

### Behaviour
1. **Boot marker.** Before creating `GradientEngine` in `apps/editor/components/Canvas.tsx`, write a marker to `localStorage` (e.g. key `wavr-boot`, value `{ startedAt }`).
   - Clear it once the editor has rendered healthily, e.g. the first `onFrame` fps callback from `engine.startLoop` (fires every 500 ms), or about 30 frames.
   - A freeze or crash leaves the marker behind.
2. **Automatic safe mode.** On the next load, if the marker is still there and recent (say under 10 minutes old, so a stale key from long ago doesn't trigger it), start in safe mode. Clear the marker when entering safe mode, so safe mode can't loop.
3. **Manual override.** `?safe` in the URL forces safe mode, for when a freeze kills the machine before `localStorage` is flushed. `?safe=0` forces normal mode.
4. **What safe mode does.** Apply everything at the frame-state level, like `withPerformanceMode` in `lib/frame-state.ts`, so the user's scene and the URL hash aren't overwritten:
   - Engine: `setMaxPixelRatio(0.75)` (or 1) and `setMaxFrameRate(30)`.
   - Force the single-pass path: only the active or first visible layer, with bloom, glow, blur, chromatic aberration, pixel sort, feedback, trail, 3D projection and mesh distortion off. Real bloom off.
   - Don't mount `Scene3DCanvas`.
   - **Don't auto-apply the URL hash.** It may be the scene that hangs. Show "Load the scene from this link" instead.
   - Consider starting paused (`playing: false`), so exactly one frame renders until the user presses play.
5. **Banner.** A dismissible notice explains in plain language that Wavr didn't finish starting last time, so it opened in safe mode with effects and resolution reduced. Actions: "Load full scene" and "Exit safe mode". Exiting clears flags and reloads without `?safe`. Use `role="status"` and a visible focus style.

### Implementation notes
- Put the decision logic in a pure module (e.g. `apps/editor/lib/safe-mode.ts`) with an injectable storage and clock, and unit-test it with Vitest (Node environment). Cases:
  - marker present and recent → safe;
  - marker stale → normal;
  - `?safe` → safe;
  - `?safe=0` → normal;
  - entering safe mode clears the marker.
- Wrap every `localStorage` access in try/catch; private modes can throw.
- Engine creation is in `Canvas.tsx` (`new GradientEngine(canvas, { preserveDrawingBuffer: false })`). `applyPerformanceMode()` there shows how pixel-ratio and frame caps are applied today.
- Performance presets: `getEditorPerformanceSettings()` in `lib/store.ts`. "battery" is `maxPixelRatio: 1`, `maxFrameRate: 30`, `realBloom: "off"`.
- Hash restore is `applyHashToStore()` and `initializeUrlSync()`, called from `app/editor/page.tsx`.
- Follow `CLAUDE.md` ("Rules That Are Easy To Break"). In particular, set uniforms only through the engine's cached setters.
- **Verify in headless Chromium with WebGL disabled** (`--disable-webgl --disable-3d-apis`), so the page loads: the banner appears with `?safe` and with a stale marker, and "Exit safe mode" clears it. A GPU hang itself can't be tested in the container; say so in the PR.

## 4. Diagnosis still owed (needs the owner's machine)

- **Questions:** OS, browser and GPU; whether `/editor` ever worked on that machine; whether the URL had a `#…` hash.
- **Bisect with the deployment URLs above**, adding `/editor`.
  - Ask them to save their work first, and to force-quit the browser before hard-rebooting.
  - Order: `7065ffa` (baseline) → `a4a5e74` (#22) → `f904a77` (#23).
  - If the baseline also freezes, the cause predates these changes: the uber-shader cost on that GPU.
- **Once the crash guard is live,** `?safe` gives the owner a way in to collect information: `about:gpu` / `chrome://gpu`, the renderer string, and the console output.

## 5. Other state to be aware of

- **Unmerged commit `3f7678c`** on branch `claude/project-gaps-inefficiencies-kmsr8j`: "Export video with WebCodecs, rendered frame by frame". It's pushed with no PR.
  - It adds `apps/editor/lib/video-export.ts` and the `mediabunny` dependency.
  - It doesn't touch the render path, but **don't merge it until the freeze is resolved**, so changes aren't piled on.
  - This handoff file is committed on top of it on the same branch.
- **Parity tests:** the parity harness can't check visuals, because `tests/parity/goldens/` is empty and SwiftShader draws blank frames. Any rendering change needs a real-GPU check. The Vercel preview URL for a PR works for that.
- **Remaining audit item:** cheaper bloom and glow (quarter-resolution passes, merging the two Bloom toggles). Hold it until this is resolved.
