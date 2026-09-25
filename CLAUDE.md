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
```

CI (`.github/workflows/ci.yml`) runs lint, test and build on every PR; `parity.yml` runs the parity harness.

## Rendering Architecture (`packages/core/src/engine.ts`)

One uber fragment shader (`shaders/fragment.glsl`) renders every layer; the gradient mode is picked by the `u_gradientType` uniform. Parameters are uniforms, so changing them never recompiles. The exception is the Custom GLSL editor, which recompiles via `setCustomShader()`.

`render()` takes one of two paths:
- **Single pass:** one visible layer and no neighbour-sampling effect. The gradient and global effects are drawn in one draw.
- **Composite + post pass:** otherwise. Each layer is blended into ping-pong FBOs with global effects off. Then one more draw of the same shader with `u_postPass = 1` applies global effects (bloom, glow, blur, vignette, grain, tone mapping, …) to the composited image. Effects that sample neighbouring pixels read it through `sampleScene()`, one texture fetch instead of re-running the gradient. `usesNeighborSampling()` decides the path.

Per-layer params (type, colors, speed, masks, images, …) live on each layer. Global effects live on the store root.

## Rules That Are Easy To Break

- **Uniforms:** set main-program uniforms only through `setf` / `seti` / `set2f` / `setMat4` (and the colour loop in `setLayerUniforms`). They skip unchanged values via a per-location cache. A raw `gl.uniform*` call on the main program desyncs that cache. `cacheUniforms()` clears it; it must run whenever `this.program` changes.
- **Reading pixels:** don't read pixels from the WebGL canvas (`toBlob`, `toDataURL`, `drawImage`). The editor uses `preserveDrawingBuffer: false`, so the buffer is blank after presentation. Use `engine.captureImageData({ state, time, width, height })`. It renders offscreen and restores the live clock, canvas size and state. The 3D overlay has the same constraint; use the `SceneCapture` function from `Scene3DCanvas`.
- **Sampler units:** never leave a texture bound to a sampler unit while rendering into it (a WebGL feedback loop). `render()` unbinds units 5/6 before each layer draw.
- **Render loop:** use `requestAnimationFrame`, never `setInterval`. That goes for export capture loops too.
- **GL context:** don't store the GL context or the engine in React state; use a ref.
- **Three.js:** the gradient engine is raw WebGL. Three.js / React Three Fiber is confined to the lazy-loaded 3D scene overlay (`components/Scene3DCanvas.tsx`).
- **No backend:** Wavr is a client-only tool.

## Editor (`apps/editor`)

- **Store (`lib/store.ts`, Zustand):**
  - `set()` for continuous updates (sliders), `setDiscrete()` for one-shot changes (toggles, selects), `commitSet()` on pointer-up to close an undo step.
  - `lib/url-sync.ts` mirrors the schema-owned slice into the URL hash.
- **Sidebar:** 5 tabs (Gradient, Scene, Effects, Presets, Code), switched with keys 1–5.
- **Frame state:** `lib/frame-state.ts` (`applyTimeline`, `withPerformanceMode`) builds the per-frame state. It's shared by `Canvas.tsx` and export, so exports match the live view.
- **Export:**
  - `lib/export.ts` handles PNG (1×/2×/4×) and GIF, both rendered offscreen at exact times.
  - GIFs are encoded by `lib/gif.ts` (median-cut palette, ordered dither, LZW) in `lib/gif.worker.ts`.
  - Code/embed exports are simplified single-layer shaders and warn about what they drop.
- **Projects:**
  - `lib/projects.ts` stores projects in `localStorage` (`wavr-projects`). Uploaded images go to IndexedDB via `lib/image-store.ts`, and projects hold `wavr-image:<sha256>` references.
  - `saveProject`, `deleteProject` and `projectStateForLoad` are async and serialized; await them.

## Adding a Gradient Mode

Update every one of these, or types and exports drift:
1. `packages/schema/src/primitives.ts`: `GradientType` enum
2. `packages/core/src/layers.ts`: `GradientType` union (+ `defaultSoftnessForGradientType` if needed)
3. `packages/core/src/engine.ts`: `GRADIENT_TYPE_MAP`
4. `packages/core/src/shaders/fragment.glsl`: the gradient function, the `computeGradient()` dispatch, and the `u_gradientType` comment
5. `packages/react/src/types.ts`: `GradientType`
6. `packages/preview/src/config.ts`: its gradient type list
7. `apps/editor/lib/gradient-types.ts`: `GRADIENT_OPTIONS`, plus the random / premium lists as appropriate
8. `apps/editor/lib/export.ts`: both gradient-type-to-id maps used by the portable exports

## Testing

- **Editor unit tests:** Vitest over `apps/editor/lib/**/*.test.ts`, in a Node environment. `.glsl` imports are stubbed.
- **Engine tests:** `lib/test-utils/fake-webgl.ts` is a recording fake WebGL 2 context. Construct a real `GradientEngine` on it to assert draw targets, per-draw uniforms, bound textures and upload counts (see `engine-render-passes.test.ts`, `engine-uniform-cache.test.ts`, `engine-capture.test.ts`).
- **Parity harness:** it can't check visuals today. Headless Chromium's SwiftShader compiles the uber-shader but draws blank frames, and `tests/parity/goldens/` is empty, so the comparisons are skipped. A shader that fails to compile still fails CI. Any change to rendered output needs a manual check on a real GPU (the Vercel preview works).

## Code Style

- TypeScript strict, no `any`
- Functional React components with hooks; Tailwind CSS for styling
- GLSL uniforms prefixed with `u_` (e.g. `u_speed`)
- Prefer `const` over `let`
- Match the comment density and idioms of the surrounding code
