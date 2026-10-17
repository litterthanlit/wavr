# CLAUDE.md — Wavr

## What This Project Is

Wavr is an interactive animated gradient editor — think Unicorn Studio. Users build moving mesh gradients and effects in a visual editor, then export as PNG/GIF/WebM, code (CSS, React, web component) or embeds. See `PRD.md` for the product spec, `ROADMAP.md` for what's next, `docs/` and `specs/` for design notes. `.context/HANDOFF.md` predates the monorepo; trust the code over it.

## Repo Layout

pnpm workspace + Turborepo. Node version in `.nvmrc`.

| Path | Package | What it is |
|---|---|---|
| `apps/editor` | `editor` | Next.js 16 (App Router) editor. Routes: `/` landing, `/editor`, `/embed` |
| `packages/core` | `@wavr/core` | WebGL 2 engine (`engine.ts`), GLSL shaders, layers, presets, `createGradient` |
| `packages/schema` | `@wavr/schema` | Zod schema, migrations, URL codec, scene documents, parity helpers |
| `packages/react` | `@wavr/gradient` | React component wrapping the engine |
| `packages/preview` | `@wavr/preview` | In-preview editor overlay for agent / landing-page workflows |
| `packages/create-wavr` | `create-wavr` | CLI that scaffolds a Wavr landing page |
| `tests/parity` | — | Playwright render-parity harness (see Testing) |
| `skills/wavr` | — | Agent skill for generating Wavr backgrounds |

## Commands

```bash
pnpm dev            # editor dev server
pnpm lint           # tsc --noEmit for packages, ESLint for the editor
pnpm test           # vitest in every package that has tests
pnpm build          # tsup for packages, `next build --webpack` for the editor
pnpm --filter editor test        # one package
pnpm test:parity    # Playwright parity harness
pnpm snapshots [dir]  # render every gradient type and parity fixture to PNGs (see Testing)
```

CI (`.github/workflows/ci.yml`) runs lint, test and build on every PR; `parity.yml` runs the parity harness.

## Rendering Architecture (`packages/core/src/engine.ts`)

One pipeline for every scene: each visible layer is drawn into ping-pong composite targets by its **layer program**, then one **post program** applies the global effects to the composited image and writes the final target (canvas, feedback FBO or capture FBO). Targets are RGBA16F where the GPU can render to them (RGBA8 otherwise), so deband and tone mapping see unquantized colour.

Shaders (`packages/core/src/shaders/`) are assembled by string concatenation in `shader-sources.ts`; the parts are `common.glsl` (uniforms, noise, Oklab, `getGradientColor`, SDF masks), `mouse.glsl`, `gradients.glsl`, `layer.glsl`, `post.glsl`.
- **Layer programs:** one per gradient type, compiled with `#define WAVR_GRADIENT <shader id>`. Each gradient function in `gradients.glsl` sits in an `#if WAVR_GRADIENT == <id>` guard, so a program holds exactly one of them. Layer main calls `computeGradient()` once; it also does parallax, distortion map, the 3D raymarch (finds the surface UV first), image blend, mask, opacity and the blend over `u_compositePrev`.
- **Post program:** one, with no gradient code. Neighbour-sampling effects (bloom, glow, blur, radial blur, chromatic aberration, pixel sort) are fetches of the composited scene through `sampleScene()`. The reaction-diffusion palette and `u_speed` come from the last visible layer.
- **Why:** the old uber shader called the gradient dispatcher from ~70 sites; the compiler inlined all of them (494 KB translated), and the first draw took ~100 s on SwiftShader and froze the main thread or tripped the GPU watchdog elsewhere. Keep gradient code out of post, call `computeGradient` once, and never re-evaluate a gradient for a neighbour tap.
- **Lazy, cached compile:** `layerPrograms` holds a program per gradient id (plus `custom`), created the first time a visible layer needs it. With `KHR_parallel_shader_compile` nothing blocks: `render()` draws nothing and returns false (the last frame stays on screen) until every program the frame needs has linked. See `isReady(state)`, `isCompiling()` and `getMetrics().pendingPrograms`. Don't call `getProgramParameter(LINK_STATUS)` or `getShaderParameter` before `COMPLETION_STATUS_KHR` is true; they block. `capturePixels` / `captureImageData` force completion so exports are never blank. A compile or link failure throws with the info log (the render loop stops and calls `onError`); errors read `ERROR: <file>:<line>`, numbered per file in `shader-sources.ts`.
- **Custom GLSL:** `setCustomShader()` compiles (synchronously, to report errors) a layer program whose `customGradient` is the user's code. While set, every layer uses it. Only the helpers in `common.glsl` / `mouse.glsl` are available to it, not the built-in gradient functions.
- **Context restore:** `initProgram()` drops every program, FBO and texture; programs are recompiled on demand.

Per-layer params (type, colors, speed, masks, images, …) live on each layer. Global effects live on the store root.

## Rules That Are Easy To Break

- **Uniforms:** set layer/post-program uniforms only through `setf` / `seti` / `set2f` / `setMat4` (and the colour loop in `setPalette`). They upload to the program last bound with `useProgram()` and skip unchanged values via a per-location cache; locations belong to one program, and `disposeProgram()` drops its entries. A raw `gl.uniform*` call on those programs desyncs the cache. A uniform must also be listed in `PROGRAM_UNIFORM_NAMES`, or it is silently never set (a test checks this against the GLSL).
- **Reading pixels:** don't read pixels from the WebGL canvas (`toBlob`, `toDataURL`, `drawImage`). The editor uses `preserveDrawingBuffer: false`, so the buffer is blank after presentation. Use `engine.captureImageData({ state, time, width, height })`. It renders offscreen and restores the live clock, canvas size and state. The 3D overlay has the same constraint; use the `SceneCapture` function from `Scene3DCanvas`.
- **Sampler units:** never leave a texture bound to a sampler unit while rendering into it (a WebGL feedback loop). Each sampler has a fixed unit (0 prev frame, 1 image, 2 distortion map, 3 text mask, 4 trail, 5 previous layers, 6 scene). `render()` unbinds 5/6 before each layer draw, and the post pass unbinds what it bound.
- **Render loop:** use `requestAnimationFrame`, never `setInterval`. That goes for export capture loops too.
- **GL context:** don't store the GL context or the engine in React state; use a ref.
- **Three.js:** the gradient engine is raw WebGL. Three.js / React Three Fiber is confined to the lazy-loaded 3D scene overlay (`components/Scene3DCanvas.tsx`).
- **Canvas callbacks:** `Canvas` tears down and rebuilds the WebGL engine whenever `onCanvasReady` / `onEngineReady` change identity. Pass `useCallback`s (as `app/editor/page.tsx` does), never inline arrows.
- **Hydration:** `/editor` is prerendered, so don't read `localStorage` or `window` in the first render of a client component. The mismatch forces React to throw away the server HTML (error #418). Read it after hydration, or through `useSyncExternalStore` with a server snapshot (see `lib/useTheme.ts`).
- **No backend:** Wavr is a client-only tool.

## Editor (`apps/editor`)

- **Store (`lib/store.ts`, Zustand):**
  - `set()` for continuous updates (sliders), `setDiscrete()` for one-shot changes (toggles, selects), `commitSet()` on pointer-up to close an undo step.
  - `lib/url-sync.ts` mirrors the schema-owned slice into the URL hash.
  - The zod-backed codec (decode, validate, encode) lives in `lib/url-codec.ts` and loads on demand through `loadUrlCodec()`. Keep `@wavr/schema` runtime imports other than `DEFAULT_CONFIG` out of `url-sync.ts`, `url.ts` and anything else in the initial bundle. That is why `applyHashToStore()` is async (it applies an empty hash synchronously). `/embed` bundles the codec statically.
- **Sidebar:** 5 tabs (Gradient, Scene, Effects, Presets, Code), switched with keys 1–5.
- **Lazy UI:**
  - The initial bundle is the canvas, top bar, layer panel, Gradient tab and timeline. Everything else (other tabs, modals, command palette, onboarding, mobile drawer body) is a `next/dynamic` import in `components/lazy.tsx`, which also exports `preload*` helpers for hover/focus and `prefetchEditorChunks` (one chunk per idle slot).
  - New modals and tabs go there. Mount a modal with `useEverOpened(open)` so it loads on first open and stays mounted afterwards.- **Frame state:** `lib/frame-state.ts` (`applyTimeline`, `withPerformanceMode`) builds the per-frame state. It's shared by `Canvas.tsx` and export, so exports match the live view.
- **Export:**
  - `lib/export.ts` handles PNG (1×/2×/4×) and GIF, both rendered offscreen at exact times.
  - GIFs are encoded by `lib/gif.ts` (median-cut palette, ordered dither, LZW) in `lib/gif.worker.ts`.
  - Code/embed exports are simplified single-layer shaders and warn about what they drop.
- **Projects:**
  - `lib/projects.ts` stores projects in `localStorage` (`wavr-projects`). Uploaded images go to IndexedDB via `lib/image-store.ts`, and projects hold `wavr-image:<sha256>` references.
  - `saveProject`, `deleteProject` and `projectStateForLoad` are async and serialized; await them.

## Adding a Gradient Mode

The canonical list is `GRADIENT_TYPES` in `packages/schema/src/enums.ts` (zod-free). The schema, engine and preview derive their types and lists from it. Then:
1. `packages/core/src/engine.ts`: add a shader id to `GRADIENT_TYPE_IDS` (a type error until you do). The portable exports in `export.ts` reuse it.
2. `packages/core/src/shaders/gradients.glsl`: add the gradient function inside `#if WAVR_GRADIENT == <id>` … `#endif`, and an `#elif WAVR_GRADIENT == <id>` branch in `computeGradient()`.
3. `packages/react/src/types.ts`: add it to the published `GradientType` union. This copy stays standalone so the `.d.ts` files don't depend on `@wavr/core`; `types.check.ts` fails `pnpm lint` if it drifts.
4. `apps/editor/lib/gradient-types.ts`: add a `GRADIENT_OPTIONS` entry, plus the random / premium lists as appropriate.
5. Optionally, `defaultSoftnessForGradientType` in `packages/core/src/layers.ts`.

`apps/editor/lib/gradient-types.test.ts` fails if a type is missing an editor option, a shader id, a guard or a dispatch branch.

## Testing

- **Editor unit tests:** Vitest over `apps/editor/lib/**/*.test.ts`, in a Node environment. `.glsl` imports are stubbed.
- **Engine tests:** `lib/test-utils/fake-webgl.ts` is a recording fake WebGL 2 context (options: `parallelCompile`, `floatTargets`; `controls` to fail or finish compiles). Construct a real `GradientEngine` on it to assert draw targets, per-draw uniforms, bound textures, program creation and upload counts (see `engine-render-passes.test.ts`, `engine-programs.test.ts`, `engine-uniform-cache.test.ts`, `engine-capture.test.ts`). `engine-shader-sources.test.ts` reads the real `.glsl` files and checks the assembled sources: one gradient function per layer program, one `computeGradient` call, no gradient code in post.
- **Parity harness:** `pnpm test:parity` renders real frames on headless Chromium's SwiftShader. Its page compiles every gradient type before the first test, so a shader that fails to compile fails CI with the GLSL log. `tests/parity/goldens/` is empty, so until the `parity-generate` workflow commits goldens, each fixture only has to render a non-blank frame; once any golden exists, a missing one fails. Set `CHROMIUM_PATH` to use an existing Chromium. Any change to rendered output still needs a look (below), and a check on a real GPU (the Vercel preview works).
- **Snapshots:** `pnpm snapshots [dir]` (default `test-results/snapshots`) renders every gradient type (default layer; `image` gets a generated picture) and every parity fixture at t=1s, 512×512, with `engine.captureImageData`, and prints timing per image. `--only mesh,fixture-solid`, `--time`, `--size`. Compare a run against one from another commit when you touch shaders or the engine.

## Code Style

- TypeScript strict, no `any`
- Functional React components with hooks; Tailwind CSS for styling
- GLSL uniforms prefixed with `u_` (e.g. `u_speed`)
- Prefer `const` over `let`
- Match the comment density and idioms of the surrounding code
