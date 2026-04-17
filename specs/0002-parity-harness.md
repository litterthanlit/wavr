# Spec 0002 — Parity harness (Playwright)

> **Status:** Draft
> **Blocks:** Step 0 completion
> **Depends on:** spec 0001 (`@wavr/schema` — schema, URL codec, `hashFramebuffer`, fixtures)
> **Supersedes:** spec 0001 §6.2's `packages/renderer-node` (see 0001a for why)

---

## 1. What this harness actually tests

**Positioning refinement.** Spec 0001 framed this as "editor and npm package produce identical pixels." On inspection, both go through `GradientEngine` from `@wavr/core` — they share the renderer by construction. The real job of the parity harness is therefore:

**Regression detection.** Given a fixture config and a committed golden hash, today's `@wavr/core` renderer must produce the same framebuffer hash as the golden. Any change to a shader, a uniform, a blend-mode branch, or the render pipeline shows up as a golden mismatch.

Secondary benefit: when step 2 ships `<WavrGradient>` in React, it becomes an easy gate to verify the React wrapper didn't accidentally diverge (runs the same harness pointed at the wrapper instead of raw `GradientEngine`).

---

## 2. Architecture

```
tests/parity/
├── playwright.config.ts        # Chromium-only, --use-gl=swiftshader
├── pages/
│   └── runner.html             # Minimal page: loads @wavr/core, exposes window.render
├── runner.test.ts              # The actual test file
└── goldens/
    ├── solid.t0.hash
    ├── solid.t500.hash
    ├── solid.t1000.hash
    └── … (7 fixtures × 3 time steps = 21 goldens)
```

- **One Playwright project** at `tests/parity/`. Not per-package.
- **One test runner page** (`runner.html`) — a tiny static HTML file + a bundled `runner.js` (built via tsup from `runner.ts`) that imports `@wavr/core`, mounts a 512×512 canvas, and exposes the render contract from §3.
- **One Playwright test file** iterates fixtures × time steps, calls `page.evaluate()` to render + read pixels, hashes via `@wavr/schema/parity`, compares to golden.
- **Generate mode:** `pnpm parity:generate` writes fresh goldens instead of comparing. Used once, then committed.

### Bundling

`runner.ts` imports `@wavr/core` and `@wavr/schema`. tsup bundles it to a single `runner.js` next to `runner.html`, output mode `iife`, target `es2022`. The `parity` pnpm script runs the bundle step before Playwright:

```json
"scripts": {
  "build:runner": "tsup tests/parity/pages/runner.ts --format iife --out-dir tests/parity/pages",
  "test:parity": "pnpm build:runner && playwright test --config tests/parity/playwright.config.ts",
  "parity:generate": "PARITY_WRITE=1 pnpm test:parity"
}
```

Playwright loads `runner.html` via `file://` — no static server needed.

### Why a separate HTML page, not `apps/editor`

Using `apps/editor` would couple parity tests to editor UI state, URL routing, and every component that mounts on `/editor`. A dedicated `runner.html` is:
- 50 lines of code, zero UI
- Same `GradientEngine` as the editor (so regressions still surface)
- Fast to boot (<500ms vs ~3s for the editor)
- Survives editor refactors that have nothing to do with rendering

---

## 3. Runner contract

`runner.html` exposes exactly this on `window`:

```ts
declare global {
  interface Window {
    __wavrReady: Promise<void>;
    __wavrRender: (config: GradientConfig, time: number) => Promise<Uint8Array>;
  }
}
```

- `__wavrReady` resolves once `GradientEngine` is instantiated, canvas is 512×512, and one warmup frame has rendered (shader compilation completes).
- `__wavrRender(config, time)` returns a promise. Steps: apply config via `handle.update(config)`; pause the rAF loop (`handle.pause()`); call `handle.setTime(time)`; wait one `requestAnimationFrame` tick so the engine renders; `gl.readPixels` into a Uint8Array; return it. Awaiting the rAF tick is what makes this correct without new engine APIs.
- Canvas has fixed `width=512 height=512` attributes AND CSS size `512px × 512px`; runner.html sets `body { margin: 0 }` and the engine creates the context with `{ preserveDrawingBuffer: true }` so `readPixels` works after the frame settles.
- `window.devicePixelRatio` is NOT relied upon — `readPixels` reads the framebuffer's native size, which is what `width`/`height` attributes set.

**Dependency note.** This contract uses the existing `GradientHandle.update/pause/setTime` API from `packages/core/src/create.ts`. No `@wavr/core` changes required for v1 of the harness. If rAF-tick coordination proves flaky (shouldn't, but), the follow-up is adding `engine.renderNow()` to core — ~10 lines.

---

## 4. Playwright config

```ts
// tests/parity/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  fullyParallel: false, // deterministic order; shader compile is not thread-safe in SwiftShader
  workers: 1,
  use: {
    // Load runner.html via file:// or a tiny static server — file:// is fine.
    launchOptions: {
      args: [
        "--use-gl=swiftshader",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  projects: [{ name: "chromium-swiftshader", use: { browserName: "chromium" } }],
});
```

- `--use-gl=swiftshader` forces the software renderer. **This is the deterministic-goldens lever.** Without it, goldens drift with host GPU.
- `fullyParallel: false` + `workers: 1` because shader-compile determinism across parallel pages in SwiftShader is not a guarantee we want to bet on.

---

## 5. Golden workflow

**Generate (rarely):**
```bash
pnpm parity:generate
```
- Runs the test in write-mode via `PARITY_WRITE=1`.
- For each fixture × t ∈ {0, 0.5, 1.0}, renders + hashes, writes `tests/parity/goldens/<name>.t<ms>.hash`.
- Files are plain text: one hex SHA-256 per file.
- Committed alongside the code change that triggered the regeneration, with a CHANGELOG line explaining what changed visually.

**Verify (every PR):**
```bash
pnpm test:parity
```
- Same loop, but compares instead of writes. Mismatch → fail with both hashes logged and a PNG diff emitted to `test-results/` for debugging.

---

## 6. CI wiring

```yaml
# .github/workflows/parity.yml (new)
name: parity
on: [pull_request]
jobs:
  parity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:parity
```

SwiftShader ships with Playwright's Chromium — no extra system deps.

---

## 7. Failure-mode UX

When a parity test fails, the developer needs to know **what drifted**, not just "hash didn't match."

On mismatch, the test:
1. Saves `test-results/<fixture>.t<ms>.actual.png` (the rendered frame).
2. Saves `test-results/<fixture>.t<ms>.golden.png` alongside if the golden was originally captured as a PNG (optional — v1 may ship hash-only).
3. Emits a PNG diff via `pixelmatch` if both exist.
4. Logs: `Parity drift in <fixture> at t=<ms>. Expected <golden hash>, got <actual hash>. See test-results/.`

For v1, hash-only is acceptable. PNG goldens + diff can ship in a follow-up if debugging time warrants it.

---

## 8. Acceptance criteria

- [ ] `pnpm test:parity` green for all 7 fixtures × 3 time steps = 21 assertions.
- [ ] `pnpm parity:generate` writes all 21 golden files; re-running it produces zero-diff output.
- [ ] Intentionally change one numeric in `animated-plasma.json` (e.g. `scale: 0.8 → 0.9`); `test:parity` fails on that fixture at all three time steps, passes on the other six fixtures.
- [ ] Intentionally change the `computePlasma` function body in `fragment.glsl` (one-line tweak inside the plasma branch); `test:parity` fails on `animated-plasma` only. If the shader edit hits a universal code path (tone map, post-process), all fixtures fail — also acceptable, just means the mutation wasn't targeted enough to prove per-fixture isolation.
- [ ] CI workflow passes on a fresh PR with no code change.
- [ ] Runner page loads, compiles shaders, and renders one frame in < 1 second on CI hardware (measured via `page.goto` timing + `__wavrReady`).
- [ ] No flake on 10 consecutive CI runs.

---

## 9. Out of scope

- SSR-from-Node rendering. Step 2 ships hydrate-on-client + loading skeleton.
- Animation timing tests (e.g. verifying `speed=1` advances by exactly 1 time unit per second). The hash at t=0.5 and t=1.0 implicitly covers this.
- Non-Chromium browsers. The parity contract is "our renderer, our shaders, deterministic." Cross-browser pixel parity is a separate problem and not what this harness is for.
- GPU fuzz testing (varying `--use-gl=desktop` etc). Goldens are specifically for SwiftShader.

---

## 10. Implementation order

1. Add Playwright + tsup + pixelmatch as dev deps at the repo root.
2. `tests/parity/pages/runner.html` + `runner.ts` (bundled via tsup to `runner.js`) — minimal surface, verify it renders one fixture to a visible canvas in manual `playwright test --ui` mode.
3. `tests/parity/playwright.config.ts` with `--use-gl=swiftshader`.
4. `tests/parity/runner.test.ts` — basic test that loads runner.html, asserts `__wavrReady` resolves, renders one fixture, dumps the pixel count to sanity-check.
5. Wire `pnpm parity:generate` (sets `PARITY_WRITE=1`, test writes goldens instead of asserting).
6. Wire compare mode (default) — reads goldens, compares hashes, emits `test-results/<fixture>.t<ms>.actual.png` on mismatch.
7. **Initial goldens generation.** Add a GitHub Actions workflow `.github/workflows/parity-generate.yml` with `workflow_dispatch` that runs `pnpm parity:generate` and commits the goldens to the PR branch. Trigger it once from the implementation PR; commit the resulting 21 `.hash` files. This is the canonical environment — developer-machine goldens are never committed.
8. `.github/workflows/parity.yml` for per-PR verification (compare mode only).
9. Negative-control tests (mutate fixture, mutate shader, verify detection) — run locally, document the expected failures in the PR description.

---

## 11. Open questions

- **Bucket choice for parity.** Spec 0001 §6.3 said `bucket=2` tolerates ±1 LSB for most values. With SwiftShader on both sides of the comparison (generate and verify both run on SwiftShader in CI), the drift is effectively zero and bucket=1 would work. But bucket=2 survives a SwiftShader version bump. **Default to bucket=2.** Revisit if flakes appear.
- **Developer machine goldens.** Resolved: goldens come from CI only, via `workflow_dispatch` action that commits back. Local `pnpm parity:generate` is for developer-side iteration only and its output must never land in `tests/parity/goldens/`. A CI pre-check can grep-diff against the committed goldens on every PR to enforce this, but simpler: goldens live in a directory only the `parity-generate` workflow writes to (enforced by CODEOWNERS + convention).

## 12. Local-run performance note (ship this known issue)

Observed during implementation: on macOS, Playwright's Chromium with `--use-angle=swiftshader` is catastrophically slow for Wavr's ~133 KB bundled shader set (many programs: main + trail + bloom extract + blur + per-effect passes). Shader compile + a render + `readPixels` on a 512×512 canvas is measured in minutes per test, not seconds. This is a macOS SwiftShader characteristic, not a harness bug.

- **CI (Linux + headless SwANGLE):** expected to complete a full 21-test run in under 5 minutes based on typical reports from other repos of comparable shader complexity. Per-test timeout is set to 10 minutes as a safety ceiling.
- **Local dev:** don't expect `pnpm test:parity` to finish in a reasonable time on macOS. Use it for spot-checking one fixture via `--grep` if needed; full golden generation is CI-only.
- **Follow-up if CI also exceeds 5 min/test:** drop canvas to 256×256 for the harness (still meaningful; `hashFramebuffer` doesn't care), or split shader bundle into per-gradient-type programs so fixtures only compile what they need.
