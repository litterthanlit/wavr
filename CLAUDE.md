# CLAUDE.md — Wavr

## What This Project Is

Wavr is an interactive animated gradient editor — think Unicorn Studio. Users create moving mesh gradients and visual effects through a visual editor, then export as CSS/PNG/video. See `PRD.md` for product spec, `ROADMAP.md` for what's next, `.context/HANDOFF.md` for full architecture details.

## Tech Stack

- **Next.js 14+** with App Router (TypeScript)
- **WebGL 2** with raw GLSL shaders (no Three.js)
- **Zustand** for state management
- **Tailwind CSS** for styling

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
```

## Architecture

Single WebGL fragment shader renders to a fullscreen quad. 9 gradient modes selected via `u_gradientType` uniform (0=mesh, 1=radial, 2=linear, 3=conic, 4=plasma, 5=dither, 6=scanline, 7=glitch, 8=image). All parameters are uniforms — no shader recompilation on parameter change. Exception: the Custom GLSL editor recompiles the shader when user code changes.

Gradient params (type, colors, speed, etc.) are per-layer. Global effects (bloom, vignette, etc.) are on the store root. Store uses `set()` for continuous updates (sliders), `setDiscrete()` for one-shot (toggles/selects), `commitSet()` on pointerUp.

Sidebar has 4 tabs: Gradient, Effects, Presets, Code. Keyboard shortcuts 1-4 switch tabs.

## Adding a New Gradient Mode

Update 5 files:
1. `lib/layers.ts` — add to `gradientType` union type
2. `lib/store.ts` — add to randomize `types` array
3. `lib/engine.ts` — add to `typeMap` object
4. `lib/shaders/fragment.glsl` — add function + update `computeGradient()` dispatch
5. `components/GradientPanel.tsx` — add to `GRADIENT_OPTIONS` array

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
- Don't add a backend — client-only tool
