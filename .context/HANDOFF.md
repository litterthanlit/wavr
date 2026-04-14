# Wavr — Agent Handoff Document

## What This Is

Wavr is an interactive animated gradient editor (like Unicorn Studio) built with Next.js 16, WebGL 2, and Zustand. It's a browser-native creative tool for designing, animating, and exporting GPU-rendered gradients. Also published as `@wavr/gradient` — a standalone React component for embedding gradients.

**Repo:** https://github.com/litterthanlit/wavr
**Branch:** `litterthanlit/bordeux` (active development)
**Open PR:** https://github.com/litterthanlit/wavr/pull/11 (monorepo + npm package)

---

## Project Structure (Monorepo)

```
wavr/
├── apps/
│   └── editor/              ← Next.js gradient editor app
│       ├── app/             ← Pages (/, /editor)
│       ├── components/      ← React components (Canvas, Sidebar, panels, modals)
│       ├── lib/             ← Editor-only: store, timeline, export, audio, presets (old format)
│       ├── src/             ← LiftKit CSS + utilities
│       ├── public/
│       ├── package.json
│       ├── next.config.ts
│       └── tsconfig.json
├── packages/
│   ├── core/                ← @wavr/core (internal, not published)
│   │   ├── src/
│   │   │   ├── engine.ts    ← GradientEngine class (WebGL2, render loop, mouse physics)
│   │   │   ├── layers.ts    ← LayerParams, MaskParams, defaults
│   │   │   ├── math.ts      ← mat4 utilities for MVP computation
│   │   │   ├── types.ts     ← Public API types (GradientConfig, LayerConfig, RGBColor)
│   │   │   ├── config.ts    ← resolveConfig() + stateToConfig() mapping
│   │   │   ├── create.ts    ← createGradient() imperative API
│   │   │   ├── index.ts     ← Barrel exports
│   │   │   ├── shaders/
│   │   │   │   ├── fragment.glsl  ← ~1280 lines, 9 modes + effects + 3D
│   │   │   │   └── vertex.glsl   ← Mesh distortion + MVP
│   │   │   └── presets/     ← All presets in GradientConfig format
│   │   │       ├── index.ts  ← Tree-shakeable named exports
│   │   │       ├── all.ts    ← Full preset map
│   │   │       └── *.ts      ← Per-category files
│   │   └── package.json
│   └── react/               ← @wavr/gradient (published to npm)
│       ├── src/
│       │   ├── WavrGradient.tsx  ← React wrapper (~120 lines)
│       │   ├── index.ts     ← Main entry
│       │   ├── presets.ts   ← Re-exports from core
│       │   └── presets-all.ts
│       ├── dist/            ← Built output (ESM + CJS + DTS)
│       ├── tsup.config.ts
│       └── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── package.json             ← Workspace root
├── CLAUDE.md
├── ROADMAP.md
└── docs/superpowers/        ← Design specs + implementation plans
```

---

## What's Been Built (Complete)

### Core App (Phases 1–4)
- **WebGL 2 engine** — single fragment shader, fullscreen quad, requestAnimationFrame loop
- **9 gradient modes** — mesh (fBm), radial (ripple), linear (flow), conic (spiral), plasma (sine waves), dither (halftone dots), scanline (CRT blocks), glitch (slit-scan + data mosh), image (uploaded texture)
- **Zustand store** — single source of truth, undo/redo (50-deep snapshot stack), discrete vs continuous updates
- **UI** — Sidebar (320px) with 4 tabs (Gradient/Effects/Presets/Code), TopBar with undo/redo/randomize/play-pause/share/projects/export
- **Effects** — noise overlay, film grain, bloom, vignette, Gaussian blur, radial zoom blur, color blend, chromatic aberration, hue shift, ASCII art, ordered dithering, curl noise, kaleidoscope, reaction-diffusion, pixel sorting, domain warp, feedback loop (FBO ping-pong)
- **32 presets** across 7 categories (classic, dither, scanline, glitch, cinematic, nature, abstract)
- **Export** — PNG, animated CSS, WebM video, GIF, React component, Web Component, Tailwind CSS, iframe embed, standalone player, embed widget
- **Keyboard shortcuts, accessibility, error recovery, performance guards**
- **Layer system** — up to 4 layers, blend modes, independent params
- **Animation timeline** — keyframes, Hermite interpolation, loop/bounce/once
- **Audio reactivity** — FFT analysis, mic + file input
- **Sharing** — URL encoding, localStorage projects

### Phase 5: Image & Texture Input
- Upload PNG/JPG as 9th gradient mode, image as distortion map, 5 blend modes

### Phase 6: Shape Masking
- 7 SDF shapes, 2 masks per layer, boolean ops, feathering

### Phase 7: 3D Depth Effects
- **Parallax Depth Layers** — per-layer depth offset, mouse-driven UV shift with damping + aspect correction
- **3D Shape Projection** — raymarched SDFs (sphere, torus, plane, cylinder, cube), surface UV mapping, diffuse+specular lighting
- **Mesh Distortion** — 64×64 grid, sin-noise vertex displacement, MVP projection, mouse-reactive terrain
- **Mutual exclusivity** — 3D shape and mesh distortion can't both be active

### Phase 8: Preset Library Expansion
- 32 presets across 7 categories with grouped/collapsible panel

### Phase 9: Designer Polish
- Text mask, custom GLSL editor, embed widget export, text mask CSS export

### Phase 10.2: npm Package (@wavr/gradient)
- **Monorepo restructure** — pnpm workspaces + Turborepo, three packages (core, react, editor)
- **`@wavr/core`** (internal) — engine decoupled from Zustand store via `EngineState` interface, `createGradient()` imperative API, `resolveConfig()`/`stateToConfig()` mapping between clean `GradientConfig` and flat engine state, all presets converted to `GradientConfig` format
- **`@wavr/gradient`** (published) — `<WavrGradient config={aurora} />` React component with mouse+touch interaction, scroll-linked mode, pause/play, speed multiplier, ResizeObserver, WebGL context loss handling
- **Three entry points:** `@wavr/gradient` (component + types), `@wavr/gradient/presets` (tree-shakeable), `@wavr/gradient/presets/all` (full map)
- **Build:** tsup (ESM + CJS + DTS), full shader bundled (~5KB gzipped)
- **Editor dogfoods core** — imports engine, layers, math from `@wavr/core`

---

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Turbopack)
- **WebGL 2** with raw GLSL shaders (NO Three.js)
- **Zustand** for state management (editor only)
- **Tailwind CSS** for styling
- **LiftKit** (@chainlift/liftkit) for Material Design 3 theme tokens
- **pnpm workspaces** + **Turborepo** for monorepo
- **tsup** (esbuild) for package builds

---

## Key Architecture Decisions

1. **Single shader program** — all 9 gradient modes selected via `u_gradientType` int uniform (0–8). No shader recompilation on parameter change. Exception: Custom GLSL editor.
2. **Multi-pass layer rendering** — each layer rendered as separate fullscreen quad with WebGL blending. Global effects applied only on final layer.
3. **Two type systems** — `GradientState` (flat, internal, used by editor store + engine) and `GradientConfig` (nested, public, used by npm package). `resolveConfig()` and `stateToConfig()` bridge them.
4. **Continuous vs discrete updates** — `set()` for sliders, `setDiscrete()` for toggles/selects, `commitSet()` on pointerUp.
5. **Mouse physics on CPU** — smoothed position + velocity in engine.ts, passed as uniforms.
6. **Texture units** — 0=feedback FBO, 1=image, 2=distortion map, 3=text mask.
7. **Conditional geometry** — `drawGeometry(useMesh)` swaps quad VAO for 64×64 grid when mesh distortion is active.
8. **Engine decoupled from store** — `EngineState` interface in core, `GradientState` in editor. Editor's store satisfies `EngineState` (structural typing).

---

## Commands

```bash
# From repo root:
npx pnpm install              # Install all workspace deps
npx pnpm build                # Build everything (turbo)
npx pnpm dev --filter=editor  # Dev server for editor

# Editor only:
cd apps/editor && npx next build
cd apps/editor && npx next dev

# Package only:
npx pnpm --filter @wavr/gradient build
ls packages/react/dist/       # Verify outputs
```

---

## What's Next — See ROADMAP.md

1. **10.1 Community Gallery** — browse, fork, remix public gradients (first backend)
2. **10.3 Figma/Framer Plugin** — export gradients as Figma fills or Framer components

---

## Suggested Prompt for Next Agent

```
You're continuing work on Wavr, an animated gradient editor + npm package.

Read these docs first:
- CLAUDE.md — code style, architecture rules, what NOT to do
- ROADMAP.md — full feature roadmap with priorities
- .context/HANDOFF.md — what's built, file map, architecture decisions

The project is a pnpm monorepo:
- apps/editor/ — Next.js editor app
- packages/core/ — internal engine + shader + presets
- packages/react/ — published as @wavr/gradient

Remaining roadmap items:
- 10.1 Community Gallery — needs backend for first time
- 10.3 Figma/Framer Plugin

Key files:
- packages/core/src/engine.ts — WebGL engine
- packages/core/src/shaders/fragment.glsl — ~1280 line shader
- packages/core/src/types.ts — public GradientConfig type
- apps/editor/lib/store.ts — Zustand store
```

---

## Important Notes for the Next Agent

- **Don't use Three.js** — raw WebGL only (per CLAUDE.md)
- **Don't recompile shaders on param change** — use uniforms (exception: custom GLSL editor)
- **Monorepo** — pnpm workspaces, use `npx pnpm` if pnpm isn't installed globally
- **Two type systems** — `GradientConfig` (public, nested) vs `GradientState` (internal, flat). Use `resolveConfig()` / `stateToConfig()` to convert.
- **TypeScript strict mode** — no `any` types
- **Build must pass** — `npx pnpm build` from root
- **Fragment shader is ~1280 lines** — 9 gradient modes + effects + 3D SDF/raymarching
- **Texture units** — 0=feedback, 1=image, 2=distortion map, 3=text mask
- **Geometry** — engine has conditional quad/grid VAO swap. `drawGeometry(useMesh)` handles this.
- **Package entry points** — `@wavr/gradient`, `@wavr/gradient/presets`, `@wavr/gradient/presets/all`
