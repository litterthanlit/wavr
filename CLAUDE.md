# CLAUDE.md — Wavr

## What This Project Is

Wavr is an interactive animated gradient editor — think Unicorn Studio. Users create moving mesh gradients and visual effects through a visual editor, then export as CSS/PNG/video. Read `PRD.md` for the full product spec.

## Tech Stack

- **Next.js 14+** with App Router (TypeScript)
- **WebGL 2** with raw GLSL shaders (no Three.js abstraction — we need direct control over uniforms and shader programs)
- **React** for the UI shell
- **Tailwind CSS** for styling
- **Zustand** for state management (single store for all gradient parameters)

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
```

## Architecture

### Rendering Pipeline

The core is a WebGL fragment shader rendering to a fullscreen quad. The render loop runs via `requestAnimationFrame` and passes all parameters as uniforms every frame.

```
[Zustand Store] → [uniforms] → [Fragment Shader] → [Canvas]
       ↑                                                 ↓
  [React UI Controls]                           [Export: PNG/CSS/WebM]
```

**Key design decisions:**
- ONE shader program with all gradient modes selected via a `u_gradientType` integer uniform — avoid recompiling shaders when switching modes
- Noise functions (simplex noise, fBm) are defined in a shared GLSL include
- Colors are passed as a `vec3[8]` uniform array with a `u_colorCount` int
- Mouse position is a `vec2` uniform updated on `mousemove`
- Effects (noise overlay, grain, particles, bloom, vignette) are all computed in the same fragment shader after the base gradient

### State Management

Single Zustand store in `lib/store.ts`. Shape:

```typescript
interface GradientState {
  gradientType: 'mesh' | 'radial' | 'linear' | 'conic' | 'plasma'
  speed: number          // 0–2
  complexity: number     // 1–8
  scale: number          // 0.2–4
  distortion: number     // 0–1
  brightness: number     // 0.1–2
  saturation: number     // 0–2
  colors: [number, number, number][]  // RGB floats, 2–8 entries
  noiseEnabled: boolean
  noiseIntensity: number
  noiseScale: number
  grain: number
  particlesEnabled: boolean
  particleCount: number
  particleSize: number
  mouseReact: number
  bloomEnabled: boolean
  bloomIntensity: number
  vignette: number
  playing: boolean
}
```

### Component Structure

```
page.tsx
├── TopBar          — logo, randomize, play/pause, export button
├── Canvas          — WebGL canvas, owns the render loop and GL context
├── Sidebar
│   ├── GradientPanel   — type select, color editor, animation sliders
│   ├── EffectsPanel    — noise/particles/bloom toggles + sliders
│   └── PresetsPanel    — preset card grid
└── ExportModal     — PNG / CSS / WebM export options
```

### Shader Architecture

The fragment shader structure:

```glsl
// 1. Simplex noise + fBm utility functions
// 2. Color interpolation (getGradientColor)
// 3. Main: compute base gradient by type (mesh/radial/linear/conic/plasma)
// 4. Apply noise overlay if enabled
// 5. Render particles if enabled
// 6. Apply bloom if enabled
// 7. Post-process: saturation, brightness, vignette, grain, tone mapping
```

## Code Style

- TypeScript strict mode
- Functional React components with hooks
- GLSL shaders as template literals or imported `.glsl` files (use raw loader)
- No `any` types
- Prefer `const` over `let`
- Use descriptive uniform names prefixed with `u_` (e.g., `u_speed`, `u_noiseIntensity`)

## Design System

Dark mode only. Reference these tokens:

```
Background:   #000000 (root), #08090a (base), #131416 (surface), #1c1c1f (elevated)
Borders:      rgba(255,255,255,0.06) default, rgba(255,255,255,0.12) active
Text:         #f7f8f8 (primary), #8a8f98 (secondary), #555960 (tertiary)
Accent:       #635BFF (primary actions)
Fonts:        Inter (UI), JetBrains Mono (values/code)
Radius:       8px (cards), 6px (buttons/inputs)
Transitions:  0.15s cubic-bezier(.25,.46,.45,.94)
Sidebar:      320px width, 52px header height
Top bar:      52px height, glass-morphism (blur 20px)
```

## Common Pitfalls

- **Shader compilation errors are silent** — always check `gl.getShaderParameter(shader, gl.COMPILE_STATUS)` and log `gl.getShaderInfoLog()`
- **WebGL uniform locations** — cache them once after program link, don't call `getUniformLocation` every frame
- **Canvas sizing** — multiply by `devicePixelRatio` for sharp rendering, set CSS size separately from canvas attribute size
- **Color format** — UI uses hex strings, shader uses RGB floats (0–1). Convert at the boundary.
- **GLSL loops** — WebGL 1 requires constant loop bounds. Use `if (float(i) >= u_count) break;` pattern for dynamic counts
- **MediaRecorder** — not all browsers support `video/webm;codecs=vp9`, fall back to default codec

## What NOT to Do

- Don't use Three.js — we need direct WebGL control for performance and simplicity
- Don't use CSS animations for the gradient canvas — CSS can't do mesh-style morphing
- Don't recompile shaders on parameter change — use uniforms
- Don't use `setInterval` for the render loop — use `requestAnimationFrame`
- Don't store GL context in React state — use a ref
- Don't add a backend or database — this is a client-only tool
