# Wavr — Roadmap to Unicorn Studio Parity

## Completed

### Core Product (Phases 1–4)
- 5 original gradient modes: mesh, radial, linear, conic, plasma
- 20+ effects: noise, grain, bloom, vignette, blur, chromatic aberration, curl noise, kaleidoscope, reaction-diffusion, pixel sort, feedback loop, ASCII, ordered dither, hue shift, domain warp
- Layer system: 4 layers, 5 blend modes
- Animation timeline: keyframes, Hermite interpolation, loop/bounce/once
- Physics-based mouse reactivity per gradient mode
- Export: PNG, CSS, WebM, GIF, React component, Web Component, Tailwind, iframe embed, scroll-linked
- Audio reactivity: FFT, mic + file, bass/treble/energy mapping
- Sharing: URL encoding, localStorage projects
- UI: sidebar, topbar, undo/redo, keyboard shortcuts, onboarding, responsive, accessible
- Landing page, SEO, light/dark mode

### New Gradient Modes
- **Dither** (type=5) — halftone dot pattern, clean dissolution to organic flowing
- **Scanline** (type=6) — CRT vertical color blocks with scanline + crosshatch texture overlay
- **Glitch** (type=7) — slit-scan pixel drag to data mosh fragmentation
- **Image** (type=8) — uploaded image as gradient source, all effects applied on top

### Phase 5: Image & Texture Input ✅
- Upload PNG/JPG as gradient color source (9th gradient mode)
- Image as distortion map (UV displacement driven by grayscale)
- Blend image with procedural gradient (5 blend modes + opacity)
- Client-side only, resize to 2048px max, base64 in project saves

### Phase 8: Preset Library Expansion ✅
- 32 presets across 7 categories (classic, dither, scanline, glitch, cinematic, nature, abstract)
- Grouped/collapsible preset panel UI

### Phase 6: Shape Masking ✅
- 7 SDF shapes: circle, rounded rect, ellipse, polygon, star, blob
- 2 masks per layer with boolean ops (union, subtract, intersect, smooth union)
- Feathering, inversion, noise-distorted edges
- Applied after all post-processing in shader pipeline

### Phase 9: Designer Polish ✅
- **Text mask** — live gradient-clipped text via canvas-to-texture pipeline
- **Custom GLSL editor** — Code tab in sidebar, 500ms debounce compile, live error display
- **Embed widget** — config-driven `<wavr-gradient>` Web Component export for all gradient modes

---

## Phase 7: 3D Depth Effects (Next Up)

**Goal:** This is Unicorn Studio's killer differentiator. Gradients projected onto 3D surfaces with parallax and perspective.

### 7.1 Sphere/Torus Projection
- Raymarching in fragment shader — project the gradient onto a sphere or torus
- Mouse controls rotation angle
- Controls: shape (sphere, torus, plane), perspective strength, rotation speed

### 7.2 Parallax Depth Layers
- Multiple gradient layers at different simulated depths
- Mouse movement creates parallax shift between layers
- Subtle but powerful for hero sections

### 7.3 Mesh Distortion
- 3D plane mesh with vertex displacement driven by noise
- Gradient rendered as texture on the displaced mesh
- Would require switching from fullscreen quad to actual vertex mesh — vertex shader becomes non-trivial

---

## Phase 10: Community & Distribution

### 10.1 Community Gallery
- Browse, fork, remix public gradients
- Needs backend (Vercel Postgres or KV)
- User profiles (optional, can start anonymous)

### 10.2 npm Package
- `@wavr/gradient` — standalone React component
- Zero-config: `<WavrGradient preset="aurora" />`
- Tree-shakeable, <20KB gzipped

### 10.3 Figma/Framer Plugin
- Export Wavr gradient as a Figma fill or Framer component
- Import Figma gradient tokens into Wavr

---

## Priority Order

| Phase | Impact | Effort | Status |
|-------|--------|--------|--------|
| 5. Image/Texture Input | Very High | Medium | ✅ Shipped |
| 8. Preset Expansion | High | Low | ✅ Shipped |
| 6. Shape Masking | High | Medium | ✅ Shipped |
| 9. Designer Polish | High | Medium | ✅ Shipped |
| 7. 3D Depth Effects | Very High | High | Next |
| 10. Community | Medium | High | Planned |
