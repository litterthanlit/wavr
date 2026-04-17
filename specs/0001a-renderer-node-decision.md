# Spec 0001a — renderer-node infrastructure decision

> **Status:** Draft — needs a call before implementing
> **Blocks:** the pixel-rendering half of spec 0001 §6 (render parity)
> **Context:** 0001 §6.2 committed to `gl` (npm) for headless WebGL. On closer inspection, `gl` is WebGL **1** only; Wavr shaders target WebGL **2**. That commitment needs revisiting.

---

## What's already shipped

- `hashFramebuffer(pixels, bucket)` and `compareHash(a, b)` live in `@wavr/schema/parity`.
- Tolerance model documented: `Math.round(v/bucket)*bucket`, same-bucket values hash identically, bucket boundaries at odd midpoints so ±1 LSB tolerance is probabilistic (~half of values tolerate +1, half tolerate -1).
- 7 fixture configs committed under `packages/schema/test/fixtures/parity/*.json`: `solid`, `mesh-3layer`, `full-effects`, `animated-plasma`, `dither-bayer`, `voronoi-classic`, `shape3d-sphere`.
- 40 tests passing: hash property tests + fixture validation (every fixture parses, migrates idempotently, round-trips through URL codec, fits under 6KB).

What's missing is the thing that actually produces pixels: `packages/renderer-node`.

---

## The problem

0001 §6.2 says:

> `packages/renderer-node/` — headless WebGL via `gl` (npm).

The `gl` npm package (https://github.com/stackgl/headless-gl) provides **WebGL 1** only. The project ticket for WebGL 2 has been open since 2017 and is dormant. Meanwhile:

- `apps/editor` creates a WebGL 2 context (`canvas.getContext("webgl2")`).
- `packages/core/src/engine.ts` assumes WebGL 2 (uniform buffer objects, `#version 300 es` shaders, etc.).
- `packages/core/src/shaders/fragment.glsl` uses GLSL ES 3.00 syntax (`in`/`out` qualifiers, `texture()` not `texture2D()`, etc.).

Downgrading to WebGL 1 would require a shader rewrite of roughly the entire render pipeline. That's not a fit for a parity harness — it would measure a different renderer.

---

## Three options

### Option A — Playwright on both sides

Use Playwright (already a reasonable dev dep for the editor-side parity test) to drive **both** sides:

- **Editor side:** Playwright loads `apps/editor` in dev, navigates to a fixture URL, freezes rAF, reads canvas pixels.
- **Renderer side:** Playwright loads a minimal standalone HTML page that imports `@wavr/core` (or `@wavr/gradient-react` once it ships in step 2), renders the fixture to a canvas, reads pixels.

Both sides go through a real WebGL 2 context (headless Chromium's ANGLE/SwiftShader). Hash comparison runs in Node via `@wavr/schema/parity`.

**Pros**
- Exercises the exact same code paths the real browser does.
- No ANGLE/driver surprises — both sides hit the same Chromium GPU backend.
- Existing Chromium/SwiftShader in CI is good enough for deterministic goldens.
- Zero new WebGL 2 abstractions to maintain.

**Cons**
- Renames the package from `renderer-node` → something like `renderer-playwright`. Tests cold-start a browser (~1–3 seconds).
- Heavier dev-time dependency (~200 MB Playwright browsers).
- Can't do SSR fallback from the same package (step 2 needed a Node-side static renderer for `<WavrGradient>` server rendering).

**Cost to implement:** ~2–3 days.

---

### Option B — swiftshader via a WebGL 2 loader (e.g. `@codedread/webgl2-loader`, custom)

There's no well-maintained WebGL 2 Node binding today. Options that exist are either:

- **ANGLE/SwiftShader compiled as a Node addon** — possible but unsupported, requires native builds per-platform.
- **Vulkan/Metal shimming via `gpu.js` or `node-gles`** — `node-gles` exists and provides WebGL 2 via ANGLE, but it's a TensorFlow-maintained side project with sparse documentation and no ARM Mac binaries.
- **Custom binding to SwiftShader** — real work, probably a week of debugging.

**Pros**
- True Node package. Fast tests. No browser spinup.
- Would also serve step 2's SSR fallback need.

**Cons**
- Real infrastructure work. Weeks not days.
- Native-addon build hell across developer machines and CI.
- You pay this cost every time someone upgrades Node or platform.

**Cost to implement:** ~1–2 weeks, plus ongoing maintenance.

---

### Option C — CPU software renderer

Reimplement the rendering pipeline in plain TypeScript. No GL at all. Parity test runs it, editor keeps running real WebGL.

**Pros**
- Zero native deps. Fastest tests possible.
- Trivially portable, deterministic by construction.

**Cons**
- **It's not a parity test anymore.** A CPU renderer hashes a CPU renderer; GPU drift is invisible to it. The whole point of the §6 harness was to catch drift between the editor's real GL and the runtime's real GL.
- Massive implementation cost (reimplementing every shader path).

**Cost to implement:** ~2–3 weeks. Worthless for the stated goal.

---

## Recommendation

**Option A (Playwright both sides).** The point of parity is "same config → same pixels in production." Production uses a browser. Testing via a browser on both sides directly measures that promise. The Node-as-a-renderer framing was aspirational; the actual need is "a deterministic environment that runs our shaders."

**Tradeoff accepted:** step 2's SSR fallback can't share the Node-renderer package. That's fine — the SSR path renders a **static preview PNG**, which can be:
- Generated once per config via the same Playwright harness during build, committed as a fingerprint.
- Or generated at runtime via a separate hosted service (Vercel function that spins up Chromium).
- Or skipped entirely — hydrate to WebGL on the client and show a loading skeleton on the server.

The right answer for SSR is almost certainly "hydrate on client + loading skeleton," which is what production React apps actually do. SSR-rendered gradients were overscoped.

---

## If Option A is approved, next PR would land

1. `packages/schema/test/fixtures/parity/<name>.<t>.hash` — committed goldens (one per fixture × three time steps).
2. `tests/parity/` at the repo root — Playwright project that:
   - Starts `apps/editor` in dev.
   - Starts a minimal `apps/parity-runner` page that imports `@wavr/core` and renders configs from the fixture directory.
   - For each fixture and `t ∈ {0, 0.5, 1.0}`: render, hash, compare against golden.
   - If hash differs, fail the test and emit both framebuffers as PNG diffs for debugging.
3. CI workflow that runs the Playwright project under `--use-gl=swiftshader` for deterministic software rendering.
4. `pnpm parity:generate` — the mode that writes fresh goldens (used once, then committed). This is how step-forward shader changes regenerate the baseline.

Estimated: one full day for the harness + one for fixture goldens + one for CI wiring.

---

## Decision needed

Pick A, B, or C. Default recommendation is A. If A, also confirm that SSR-from-Node is off the table for step 2 (hydrate-on-client is fine).
