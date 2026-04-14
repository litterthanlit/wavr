# CLAUDE.md — Wavr

## What This Project Is

Wavr is an interactive animated gradient editor — think Unicorn Studio. Users create moving mesh gradients and visual effects through a visual editor, then export as CSS/PNG/video. Also published as `@wavr/gradient` — a standalone React component. See `ROADMAP.md` for what's next, `.context/HANDOFF.md` for full architecture details.

## Tech Stack

- **pnpm monorepo** with Turborepo
- **Next.js 16** with App Router (TypeScript)
- **WebGL 2** with raw GLSL shaders (no Three.js)
- **Zustand** for state management (editor only)
- **Tailwind CSS** for styling
- **tsup** for package builds

## Project Structure

```
apps/editor/     ← Next.js gradient editor
packages/core/   ← @wavr/core — engine, shaders, types, presets (internal)
packages/react/  ← @wavr/gradient — published React component
```

## Commands

```bash
npx pnpm install                # Install all workspace deps
npx pnpm build                  # Build everything
npx pnpm dev --filter=editor    # Dev server

# Or from apps/editor/:
cd apps/editor && npx next dev
cd apps/editor && npx next build

# Package only:
npx pnpm --filter @wavr/gradient build
```

## Architecture

Single WebGL fragment shader renders to a fullscreen quad. 9 gradient modes selected via `u_gradientType` uniform (0=mesh, 1=radial, 2=linear, 3=conic, 4=plasma, 5=dither, 6=scanline, 7=glitch, 8=image). All parameters are uniforms — no shader recompilation on parameter change. Exception: the Custom GLSL editor recompiles the shader when user code changes.

Gradient params (type, colors, speed, etc.) are per-layer. Global effects (bloom, vignette, etc.) are on the store root. Store uses `set()` for continuous updates (sliders), `setDiscrete()` for one-shot (toggles/selects), `commitSet()` on pointerUp.

**Two type systems:** `GradientConfig` (public, nested, used by npm package) and `GradientState` (flat, internal, used by editor store + engine). `resolveConfig()` and `stateToConfig()` in `packages/core/src/config.ts` bridge them.

## Adding a New Gradient Mode

Update 5 files:
1. `packages/core/src/layers.ts` — add to `gradientType` union type
2. `apps/editor/lib/store.ts` — add to randomize `types` array
3. `packages/core/src/engine.ts` — add to `typeMap` object
4. `packages/core/src/shaders/fragment.glsl` — add function + update `computeGradient()` dispatch
5. `apps/editor/components/GradientPanel.tsx` — add to `GRADIENT_OPTIONS` array

## Code Style

- TypeScript strict mode, no `any` types
- Functional React components with hooks
- GLSL uniforms prefixed with `u_` (e.g., `u_speed`)
- Prefer `const` over `let`

## What NOT to Do

- Don't use Three.js — raw WebGL only
- Don't recompile shaders on parameter change — use uniforms
- Don't use `setInterval` for render loop — use `requestAnimationFrame`
- Don't store GL context in React state — use a ref
- Don't publish `@wavr/core` — it's internal only
