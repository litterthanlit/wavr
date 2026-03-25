# Wavr — Product Requirements Document

## Vision

Wavr is an interactive web tool for creating, customizing, and exporting animated gradient backgrounds and visual effects — similar to [Unicorn Studio](https://www.unicorn.studio). Users design moving gradients through a visual editor with real-time controls, then export as CSS, images, or video for use on websites, presentations, and social media.

---

## Target Users

- Web designers and developers who need animated gradient backgrounds
- Creative professionals building hero sections, landing pages, or social content
- Non-technical users who want beautiful animated visuals without writing code

---

## Core Architecture

### Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Rendering:** WebGL 2 with custom GLSL shaders (via raw WebGL or Three.js)
- **UI:** React + Tailwind CSS
- **State:** Zustand for global state management
- **Export:** Canvas API (PNG), MediaRecorder API (WebM/MP4), clipboard API (CSS)

### Why WebGL

CSS gradients cannot achieve organic mesh-style morphing. WebGL fragment shaders run on the GPU and can render complex noise-based color fields at 60fps. All gradient types are rendered via a single fullscreen quad with different shader programs.

---

## Features

### 1. Gradient Engine (MVP — Priority 1)

Five gradient modes, all GPU-rendered via GLSL fragment shaders:

| Mode | Description |
|------|-------------|
| **Mesh Gradient** | Organic flowing color blobs using layered fractal Brownian motion (fBm). The signature look — colors morph and blend like liquid. |
| **Radial Gradient** | Circular gradient with animated wave distortion along the radius and angle. |
| **Linear Flow** | Directional gradient with sinusoidal wave displacement and noise modulation. |
| **Conic Spiral** | Angular gradient that spirals outward with noise-based distortion. |
| **Plasma** | Classic plasma effect using summed sine waves across multiple axes. |

**Shader requirements:**
- 2D simplex noise function (not Perlin — simplex is faster and has fewer directional artifacts)
- fBm (fractal Brownian motion) with configurable octave count
- Smooth color interpolation between user-defined color stops (2–8 colors)
- All parameters are uniforms updated every frame — no shader recompilation on parameter change

**Parameters (all real-time):**
- `speed` (0–2): Animation time multiplier
- `complexity` (1–8): Number of fBm octaves / wave frequency multiplier
- `scale` (0.2–4): Zoom level of the gradient pattern
- `distortion` (0–1): How much noise displaces the base gradient
- `brightness` (0.1–2): Output brightness multiplier
- `saturation` (0–2): Color saturation adjustment

### 2. Effects Stack (Priority 1)

Layered post-processing effects applied on top of the gradient:

**Noise & Grain:**
- Animated Perlin/simplex noise overlay blended with the gradient
- Film grain effect (per-frame random noise)
- Controls: noise intensity, noise scale, grain amount

**Particles:**
- Floating luminous particles rendered in the fragment shader (or a second draw pass)
- Each particle has a random position that drifts over time
- Particles react to mouse position (attract/repel based on `mouseReact` parameter)
- Controls: count (10–300), size, mouse reactivity strength
- Particles inherit colors from the gradient palette

**Bloom & Glow:**
- Soft bloom on bright areas (threshold + blur)
- Vignette darkening at edges
- Controls: bloom intensity, vignette strength

### 3. Control Panel UI (Priority 1)

Right sidebar (320px) with tabbed navigation:

**Tab: Gradient**
- Dropdown for gradient type selection
- Color palette editor: list of color swatches with hex input + native color picker per color, add/remove buttons (min 2, max 8)
- Sliders for speed, complexity, scale, distortion, brightness, saturation
- Each slider shows its current value in monospace text

**Tab: Effects**
- Toggle switches for noise, particles, bloom (each independently on/off)
- Sliders for each effect's parameters (only interactive when toggled on)

**Tab: Presets**
- Grid of preset cards (2-column) with live gradient preview thumbnails
- Minimum 8 presets: Aurora, Sunset, Midnight, Candy, Ocean, Lava, Cyber, Monochrome
- Clicking a preset loads all its parameters and colors instantly

**Top Bar:**
- Logo + app name (left)
- Randomize button — generates random colors (analogous/complementary scheme) and random parameters
- Play/Pause toggle for animation
- Export button (opens export modal)

**Design Language:**
- Dark mode exclusively: `#000` root, `#08090a` base, `#1c1c1f` surfaces
- Inter font for UI, JetBrains Mono for values
- 1px borders at `rgba(255,255,255,0.06)`
- Glass-morphism header: `rgba(8,9,10,0.7)` + `backdrop-filter: blur(20px)`
- Slider thumbs: white circles with subtle shadow
- Toggle switches: custom styled (not native checkboxes)
- Transitions: 0.15s cubic-bezier(.25,.46,.45,.94)

### 4. Mouse Interactivity (Priority 1)

- Track mouse position over the canvas area
- Pass normalized mouse coordinates (0–1) as a uniform to the shader
- Gradient subtly shifts/warps toward mouse position
- Particles drift toward or away from mouse based on reactivity setting

### 5. Export System (Priority 2)

Modal with three export options:

**PNG Image:**
- `canvas.toBlob()` → download link
- Full resolution (canvas pixel dimensions)

**CSS Code:**
- Generate an approximation of the gradient as animated CSS
- `linear-gradient` with the user's color stops
- `@keyframes` for background-position animation
- Copy to clipboard with toast confirmation

**WebM Video:**
- `canvas.captureStream(30)` → `MediaRecorder`
- Record for 5 seconds (or user-configurable)
- Download as `.webm`

### 6. FPS Counter (Priority 3)

- Small monospace counter in bottom-left corner of canvas
- Updates every 500ms
- Shows current rendering FPS

---

## Presets Data

Each preset defines: gradient type, speed, complexity, distortion, color array (as RGB floats), and which effects are enabled.

```
Aurora:     mesh, speed=0.4, colors=[cyan, green, indigo, blue]
Sunset:     mesh, speed=0.3, colors=[coral, gold, orange, rose]
Midnight:   mesh, speed=0.25, colors=[navy, indigo, cyan, dark-blue], grain=0.08
Candy:      plasma, speed=0.6, colors=[pink, purple, cyan, yellow]
Ocean:      linear, speed=0.35, colors=[blue, royal-blue, sky-blue, teal]
Lava:       mesh, speed=0.5, colors=[red, orange, gold, dark-red], grain=0.06
Cyber:      conic, speed=0.4, colors=[green, cyan, indigo, emerald], particles=on
Monochrome: mesh, speed=0.3, colors=[charcoal, gray, white, steel], saturation=0.1, grain=0.1
```

---

## UI Layout

```
┌──────────────────────────────────────────────────┬──────────────────┐
│  [Logo] Wavr          [Rand] [⏸] [Export] │  Gradient │ FX │ Pre │
│─────────────────────────────────────────────────│──────────────────│
│                                                  │  Gradient Type   │
│                                                  │  [Mesh ▾]        │
│                                                  │                  │
│              WebGL Canvas                        │  Colors          │
│           (full remaining space)                 │  ■ #635BFF [hex] │
│                                                  │  ■ #FF6B6B [hex] │
│                                                  │  ■ #40E0D0 [hex] │
│                                                  │  [+ Add Color]   │
│                                                  │                  │
│                                                  │  Speed     0.50  │
│                                                  │  ──●────────     │
│                                                  │  Complexity 3.0  │
│                                                  │  ────●──────     │
│  60 FPS                                          │  ...              │
└──────────────────────────────────────────────────┴──────────────────┘
```

---

## Performance Requirements

- Maintain 60fps on modern hardware (M1+ Mac, discrete GPU PCs)
- Degrade gracefully: reduce fBm octaves or particle count if FPS drops below 30
- Canvas should resize on window resize (debounced)
- Use `devicePixelRatio` for sharp rendering on Retina displays

---

## File Structure (Suggested)

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Canvas.tsx              # WebGL canvas + render loop
│   ├── Sidebar.tsx             # Right panel container
│   ├── GradientPanel.tsx       # Gradient type + color + animation controls
│   ├── EffectsPanel.tsx        # Noise, particles, bloom controls
│   ├── PresetsPanel.tsx        # Preset grid
│   ├── TopBar.tsx              # Logo + action buttons
│   ├── ExportModal.tsx         # Export options modal
│   ├── ui/
│   │   ├── Slider.tsx          # Custom styled range slider
│   │   ├── Toggle.tsx          # Custom toggle switch
│   │   ├── ColorInput.tsx      # Color picker + hex input row
│   │   └── Select.tsx          # Styled dropdown
├── lib/
│   ├── shaders/
│   │   ├── vertex.glsl         # Simple fullscreen quad vertex shader
│   │   ├── gradient.glsl       # Main fragment shader with all gradient modes
│   │   └── noise.glsl          # Simplex noise + fBm functions (importable)
│   ├── engine.ts               # WebGL setup, program compilation, render loop
│   ├── presets.ts              # Preset definitions
│   ├── export.ts               # PNG, CSS, WebM export logic
│   └── store.ts                # Zustand store for all parameters
├── public/
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

---

## Out of Scope (Future)

- User accounts / saving projects to cloud
- Template marketplace
- Figma/Framer plugin
- Custom shader code editor
- Audio reactivity
- 3D gradient effects
