# Wavr — Agent Handoff Document

## What This Is

Wavr is an interactive animated gradient editor (like Unicorn Studio) built with Next.js 16, WebGL 2, and Zustand. It's a browser-native creative tool for designing, animating, and exporting GPU-rendered gradients.

**Repo:** https://github.com/litterthanlit/wavr
**Branch:** `litterthanlit/bordeux` (active development)
**Open PR:** https://github.com/litterthanlit/wavr/pull/10 (Phases 5, 6, 8, 9)

---

## What's Been Built (Complete)

### Core App (Phases 1–4)
- **WebGL 2 engine** — single fragment shader, fullscreen quad, requestAnimationFrame loop
- **9 gradient modes** — mesh (fBm), radial (ripple), linear (flow), conic (spiral), plasma (sine waves), dither (halftone dots), scanline (CRT blocks), glitch (slit-scan + data mosh), image (uploaded texture)
- **Zustand store** — single source of truth, undo/redo (50-deep snapshot stack), discrete vs continuous updates
- **UI** — Sidebar (320px) with 4 tabs (Gradient/Effects/Presets/Code), TopBar with undo/redo/randomize/play-pause/share/projects/export
- **Effects** — noise overlay, film grain, bloom, vignette, Gaussian blur, radial zoom blur, color blend, chromatic aberration, hue shift, ASCII art, ordered dithering, curl noise, kaleidoscope, reaction-diffusion, pixel sorting, domain warp, feedback loop (FBO ping-pong)
- **32 presets** across 7 categories (classic, dither, scanline, glitch, cinematic, nature, abstract) with grouped/collapsible panel
- **Export** — PNG, animated CSS, WebM video, GIF, React component, Web Component, Tailwind CSS, iframe embed, standalone player, embed widget (config-driven)
- **Keyboard shortcuts** — Space (play/pause), R (randomize), E (export), P (projects), ? (shortcuts), 1/2/3/4 (tabs), Cmd+Z/Shift+Cmd+Z (undo/redo)
- **Accessibility** — prefers-reduced-motion, focus-visible, ARIA labels
- **Error recovery** — WebGL context loss/restore, graceful fallback
- **Performance guards** — auto-degrade fBm octaves below 30fps
- **Physics-based mouse** — smoothed position (exponential lerp), velocity tracking per mode
- **Layer system** — up to 4 layers, each with independent gradient type/colors/speed/complexity/scale/distortion/opacity/blend mode
- **Animation timeline** — keyframes on 10 parameters, Hermite interpolation, loop/bounce/once modes
- **Audio reactivity** — FFT analysis, mic + file input, bass/treble/energy mapping
- **Sharing** — URL encoding (base64url hash), localStorage projects
- **Landing page** at `/`, **Editor** at `/editor`, onboarding tour, SEO

### Phase 5: Image & Texture Input
- Upload PNG/JPG as 9th gradient mode ("image") — all effects apply on top
- Image as distortion map — grayscale UV displacement for any gradient mode
- Blend image with procedural gradient — 5 blend modes (replace, normal, multiply, screen, overlay) + opacity
- Client-side only (FileReader API), resize to 2048px max, base64 in project saves
- Texture units: 0=feedback, 1=image, 2=distortion map, 3=text mask

### Phase 6: Shape Masking
- 7 SDF shapes: circle, rounded rect, ellipse, polygon (3-12 sides), star, blob (noise-distorted)
- 2 masks per layer with boolean ops (union, subtract, intersect, smooth union)
- Controls: position, scale, rotation, feathering, inversion, noise edge distortion
- Applied after all post-processing, before final fragColor output
- 22 mask uniforms set per-layer

### Phase 8: Preset Library Expansion
- 32 presets across 7 categories with grouped/collapsible panel UI
- Categories: Classic (8), Dither (4), Scanline (4), Glitch (4), Cinematic (4), Nature (4), Abstract (4)

### Phase 9: Designer Polish
- **Text mask** — canvas-to-texture pipeline, live gradient-clipped text in editor. Controls: text content, font size (32-200), weight (400-900), letter spacing, alignment. Mutually exclusive with shape mask.
- **Custom GLSL editor** — "Code" tab (4th sidebar tab), textarea with 500ms debounce compile, green/red status indicator, Reset button. User code injected as `customGradient()` function body. All uniforms + helpers (snoise, fbm, getGradientColor) available. Stored in localStorage projects, not URL sharing.
- **Embed widget export** — config-driven `<wavr-gradient>` Web Component snippet in Export modal. Serializes gradient type, colors, params, and effects subset into compact JSON config.
- **Text mask CSS export** — `background-clip: text` output when text mask is active

### Phase 7: 3D Depth Effects
- **Parallax Depth Layers** — per-layer `depth` param (-1 to 1), UV offset = `mouseSmooth * depth * strength * 0.05` with aspect correction and `fract()` wrap. Applied before all other UV transforms. Global toggle + strength in EffectsPanel, depth slider per layer in LayerPanel.
- **3D Shape Projection** — raymarching 5 SDF shapes (sphere, torus, plane, cylinder, cube) in fragment shader. 64-step march, central-difference normals, per-shape UV mapping (spherical, toroidal, planar, cylindrical, box-face). Diffuse+specular lighting with configurable intensity. Mouse + auto-rotation drives camera. Gradient resampled at surface UV via `computeGradient(surfaceUV, time)`. Applied after all post-processing, before masks. UI in GradientPanel.
- **Mesh Distortion** — global effect. 64×64 indexed triangle grid (4096 vertices, 1.1× oversize). Conditional VAO swap: quad when disabled, grid when enabled. Vertex displacement along +Z via `cheapNoise()` (sin-based v1) + mouse-reactive `exp(-dist)` falloff. MVP matrix computed per-frame from `mat4Perspective/LookAt/RotateX/RotateY/Multiply` (`lib/math.ts`). UI in EffectsPanel.
- **Mutual exclusivity** — 3D shape and mesh distortion cannot both be active. Parallax works with both. Enforced by UI toggle handlers.
- **New file:** `lib/math.ts` — minimal mat4 utilities (~80 lines, zero deps)
- **Texture units:** 0=feedback, 1=image, 2=distortion map, 3=text mask (unchanged)

---

## Tech Stack

- **pnpm monorepo** with Turborepo
- **Next.js 16** (App Router, TypeScript, Turbopack)
- **WebGL 2** with raw GLSL shaders (NO Three.js)
- **Zustand** for state management (editor only)
- **Tailwind CSS** for styling
- **LiftKit** (@chainlift/liftkit) for Material Design 3 theme tokens
- **tsup** for package builds
- **Vercel** for deployment

---

## Key Architecture Decisions

1. **Single shader program** — all 9 gradient modes selected via `u_gradientType` int uniform (0–8). No shader recompilation on parameter change. Exception: Custom GLSL editor recompiles when user code changes.
2. **Multi-pass layer rendering** — each layer rendered as separate fullscreen quad with WebGL blending. Global effects applied only on final layer.
3. **Derived state fields** — `gradientType`, `speed`, `complexity`, `scale`, `distortion`, `colors` on the store are derived from the active layer for backward compatibility.
4. **Continuous vs discrete updates** — `set()` for sliders (captures pending snapshot on first call), `setDiscrete()` for toggles/selects (pushes history immediately), `commitSet()` on pointerUp.
5. **Mouse physics on CPU** — smoothed position and velocity computed in engine.ts, passed as uniforms.
6. **Texture units** — 0=feedback FBO, 1=image texture, 2=distortion map, 3=text mask.
7. **Mask exclusivity** — shape mask and text mask are mutually exclusive (UI toggle logic).

---

## Project Structure

```
wavr/                         — pnpm monorepo root
  apps/editor/                — Next.js gradient editor app
    app/
      page.tsx                — Landing page (/)
      editor/page.tsx         — Editor (/editor), wires Canvas↔Sidebar via engineRef
      layout.tsx              — Root layout with fonts + OG metadata
      globals.css             — Tailwind + LiftKit theme tokens (light/dark)
      sitemap.ts, robots.ts   — SEO
    components/
      Canvas.tsx              — WebGL canvas, render loop, perf guards, context recovery, text mask rendering
      TopBar.tsx              — Logo, undo/redo, share, projects, export buttons
      Sidebar.tsx             — Layer panel + 4 tabbed panels (Gradient/Effects/Presets/Code)
      LayerPanel.tsx          — Layer stack with visibility/opacity/blend controls
      GradientPanel.tsx       — Type select (9 types), colors, params, image upload, mask, text mask controls
      EffectsPanel.tsx        — All effect toggles + sliders
      PresetsPanel.tsx        — Grouped/collapsible preset panel (32 presets, 7 categories)
      CustomGLSLPanel.tsx     — Custom GLSL editor textarea, compile status, reset, reference docs
      Timeline.tsx            — Keyframe timeline bar
      ExportModal.tsx         — PNG/CSS/WebM/GIF/React/WebComponent/Embed/EmbedWidget export
      ProjectsModal.tsx       — Save/load projects
      ShortcutsModal.tsx      — Keyboard shortcuts overlay
      Onboarding.tsx          — First-time walkthrough
      MobileDrawer.tsx        — Bottom drawer for mobile
      ui/                     — Slider, Toggle, ColorInput, Select, Toast
    lib/
      store.ts                — Zustand store (all state + actions + undo/redo + customGLSL)
      audio.ts                — Audio input + FFT analysis
      export.ts               — PNG/CSS/WebM/GIF/embed/embed-widget export functions
      presets/                 — Preset definitions (split by category)
      projects.ts             — localStorage project persistence
      timeline.ts             — Keyframe interpolation logic
      types.ts                — Shared types (SidebarTab = gradient | effects | presets | code)
      url.ts                  — URL state encoding/decoding
      useTheme.ts             — Theme hook (system detection + manual toggle)

  packages/core/              — @wavr/core (internal, not published)
    src/
      engine.ts               — WebGL engine (compile, render, multi-layer, mouse physics, custom shader)
      layers.ts               — Layer type definitions + factory (9 gradient types, mask params, text mask)
      config.ts               — GradientConfig ↔ GradientState bridge (resolveConfig, stateToConfig)
      types.ts                — Public types (GradientConfig, etc.)
      create.ts               — createGradient() factory for npm package consumers
      math.ts                 — Minimal mat4 utilities for MVP computation (~80 lines)
      presets/                 — Preset configs (shared between editor + npm package)
      shaders/
        vertex.glsl           — Fullscreen quad + mesh distortion vertex shader
        fragment.glsl         — Main fragment shader (~1280 lines, 9 modes + effects + masks + 3D + custom GLSL)

  packages/react/             — @wavr/gradient (published npm package)
    src/
      WavrGradient.tsx        — React component wrapping the core engine
```

---

## What's Next — See ROADMAP.md

- **Phase 10.1: Community Gallery** — browse/fork/remix public gradients (needs backend)
- **Phase 10.3: Figma/Framer Plugin** — export gradients as Figma fills or Framer components
- **Shader quality uplift** — close the visual gap with Unicorn Studio (Oklab color blending, improved noise/flow, better mouse feel, refined post-processing)

---

## Suggested Prompt for Next Agent

```
You're continuing work on Wavr, an animated gradient editor competing with Unicorn Studio.

Read these docs first:
- CLAUDE.md — code style, architecture rules, what NOT to do
- ROADMAP.md — full feature roadmap with priorities
- .context/HANDOFF.md — what's built, file map, architecture decisions

The monorepo structure is:
  apps/editor/    — Next.js editor app
  packages/core/  — @wavr/core (engine, shaders, types, presets) — internal
  packages/react/ — @wavr/gradient (published React component)

Key constraint: Raw WebGL 2 only (no Three.js). Single fragment shader,
all params via uniforms. Don't recompile shaders on param change.
```

---

## Important Notes for the Next Agent

- **Don't use Three.js** — raw WebGL only (per CLAUDE.md)
- **Don't recompile shaders on param change** — use uniforms (exception: custom GLSL editor)
- **The store has layers** — gradient params are per-layer, global effects are on store root
- **TypeScript strict mode** — no `any` types
- **Build must pass** — run `npm run build` before committing
- **Gradient type enum** — currently 0–8 in shader. Next type gets 9.
- **Fragment shader is ~1280 lines** — each gradient mode is a self-contained function, plus 3D SDF/raymarching section
- **Texture units** — 0=feedback, 1=image, 2=distortion map, 3=text mask. Next gets 4.
- **Custom GLSL** — `setCustomShader()` recompiles the shader. The `customGradient()` placeholder is replaced via regex.
- **Geometry** — engine has conditional quad/grid VAO swap for mesh distortion. `drawGeometry(useMesh)` handles this.
- **New file** — `lib/math.ts` provides mat4 utilities for MVP computation
