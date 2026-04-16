# Wavr PRD — Professional WebGL Gradient Engine

> **Version:** 2.0
> **Last Updated:** April 2026
> **Goal:** Photoshop/After Effects level WebGL effects, full Unicorn Studio parity + differentiation

---

## Executive Summary

Wavr is a real-time animated gradient editor built with WebGL 2. Phase 1-11 established core functionality. This PRD defines Phase 12+ to reach professional-grade quality competitive with:

- **Unicorn Studio** — Direct competitor (gradient backgrounds as a service)
- **After Effects** — Motion graphics benchmark
- **Photoshop** — Layer compositing benchmark
- **Cinema 4D / Blender** — 3D/particle reference

**Target outcome:** The most powerful browser-based gradient engine. Ship as npm package, Figma plugin, and standalone editor.

---

## Current State (Phases 1-11 Complete)

### Core Engine
- ✅ WebGL 2 renderer (raw GLSL, no Three.js)
- ✅ 9 gradient types (mesh, radial, linear, conic, plasma, dither, scanline, glitch, voronoi)
- ✅ Multi-layer compositing (5 blend modes)
- ✅ Oklab color space interpolation
- ✅ Multi-pass FBO pipeline

### Effects
- ✅ Bloom (real gaussian + single-pass approximation)
- ✅ Chromatic aberration, vignette, film grain
- ✅ Curl noise, liquify, kaleidoscope distortion
- ✅ Caustics, soft glow
- ✅ Click ripple, mouse trail
- ✅ 3D projection (sphere, torus, cube, cylinder, plane)
- ✅ Parallax depth layers
- ✅ Mesh distortion

### Animation
- ✅ Continuous playback with speed control
- ✅ Basic keyframe timeline
- ✅ Spring mouse physics

### Export
- ✅ npm package (`@wavr/gradient`) — built, not published
- ✅ Monorepo structure (packages/core, packages/react)

---

## Gap Analysis

### vs Unicorn Studio

| Feature | Wavr | Unicorn | Priority |
|---------|------|---------|----------|
| Blend modes | 5 | 15+ | **P0** |
| Scroll-linked animation | API only | Full triggers | **P0** |
| Hover/click states | Ripple only | State machine | **P0** |
| Figma plugin | ❌ | ✅ | **P0** |
| Preset cloud gallery | ❌ | ✅ | P1 |
| Webflow/Framer export | ❌ | ✅ | P1 |
| Vue/Svelte wrappers | ❌ | ✅ | P2 |

### vs Photoshop/After Effects

| Feature | Wavr | Pro Tools | Priority |
|---------|------|-----------|----------|
| Blend modes | 5 | 27 | **P0** |
| Layer styles | ❌ | Full | **P1** |
| LUT color grading | ❌ | Full | **P1** |
| Curves/levels | ❌ | Full | P1 |
| Motion blur | ❌ | Full | P2 |
| Depth of field | ❌ | Full | P2 |
| Particles | ❌ | Full | **P1** |
| Fluid simulation | ❌ | Full | P2 |
| Expression language | ❌ | Full | P3 |
| Text/SDF rendering | Mask only | Full | P2 |

---

## Phase 12: Professional Polish (P0)

**Goal:** Close critical gaps with Unicorn Studio. ~2 weeks.

### 12.1 Full Blend Mode Library

Add all 27 Photoshop blend modes to layer compositing.

**Modes to add (22 new):**

```
// Darken Group
- Darken
- Color Burn
- Linear Burn
- Darker Color

// Lighten Group
- Lighten
- Color Dodge
- Linear Dodge (Add) — rename existing "add"
- Lighter Color

// Contrast Group
- Soft Light
- Hard Light
- Vivid Light
- Linear Light
- Pin Light
- Hard Mix

// Inversion Group
- Difference
- Exclusion
- Subtract
- Divide

// Component Group
- Hue
- Saturation
- Color
- Luminosity
```

**Implementation:**

```glsl
vec3 blendSoftLight(vec3 base, vec3 blend) {
  return mix(
    sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
    2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
    step(0.5, blend)
  );
}

vec3 blendHue(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(blendHSL.x, baseHSL.y, baseHSL.z));
}
// ... etc for each mode
```

**Files:**
- `lib/shaders/blend-modes.glsl` — NEW, all blend functions
- `lib/shaders/fragment.glsl` — include and dispatch
- `lib/layers.ts` — extend BlendMode union
- `components/LayerPanel.tsx` — dropdown with all modes

**Effort:** 2 days

---

### 12.2 Event System (Hover/Scroll/Click Triggers)

Full interaction state machine for embedded gradients.

**States:**
```typescript
type InteractionState = 'idle' | 'hover' | 'active' | 'disabled';
```

**Triggers:**
```typescript
interface EventTriggers {
  onHover?: {
    enter: Partial<GradientConfig>;  // animate to this state
    leave: Partial<GradientConfig>;  // animate back
    duration: number;                 // ms
    easing: EasingFunction;
  };
  onScroll?: {
    mode: 'scrub' | 'trigger';
    start: number;    // scroll % to start (0-1)
    end: number;      // scroll % to end
    timeline: Keyframe[];
  };
  onClick?: {
    effect: 'ripple' | 'flash' | 'custom';
    config?: Partial<GradientConfig>;
  };
  onInView?: {
    threshold: number;  // 0-1
    animation: 'play' | 'scrub';
  };
}
```

**Implementation:**

```typescript
// packages/react/src/WavrGradient.tsx
export function WavrGradient({ 
  config, 
  events,
  ...props 
}: WavrGradientProps) {
  const ref = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GradientHandle>(null);
  
  // Hover
  useEffect(() => {
    if (!events?.onHover) return;
    const el = ref.current;
    const handleEnter = () => {
      engineRef.current?.animateTo(events.onHover.enter, {
        duration: events.onHover.duration,
        easing: events.onHover.easing
      });
    };
    const handleLeave = () => {
      engineRef.current?.animateTo(events.onHover.leave, {
        duration: events.onHover.duration,
        easing: events.onHover.easing
      });
    };
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mouseenter', handleEnter);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [events?.onHover]);
  
  // Scroll
  useEffect(() => {
    if (!events?.onScroll) return;
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const progress = scrollY / maxScroll;
      
      if (events.onScroll.mode === 'scrub') {
        const t = remap(progress, events.onScroll.start, events.onScroll.end, 0, 1);
        engineRef.current?.setTimelineProgress(clamp(t, 0, 1));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [events?.onScroll]);
  
  // IntersectionObserver
  useEffect(() => {
    if (!events?.onInView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          engineRef.current?.play();
        } else {
          engineRef.current?.pause();
        }
      },
      { threshold: events.onInView.threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [events?.onInView]);
}
```

**Engine additions:**

```typescript
interface GradientHandle {
  // Existing
  play(): void;
  pause(): void;
  setTime(t: number): void;
  
  // New
  animateTo(config: Partial<GradientConfig>, options: AnimateOptions): void;
  setTimelineProgress(t: number): void;  // 0-1, normalized
  getState(): InteractionState;
}

interface AnimateOptions {
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
  onComplete?: () => void;
}
```

**Files:**
- `packages/core/src/animate.ts` — NEW, tween/spring animation
- `packages/core/src/create.ts` — add animateTo, setTimelineProgress
- `packages/react/src/WavrGradient.tsx` — event hooks
- `packages/react/src/types.ts` — EventTriggers interface

**Effort:** 1 week

---

### 12.3 Figma Plugin

Embed Wavr gradients in Figma designs.

**Features:**
- Browse/search presets
- Customize gradient in plugin UI
- Insert as rectangle with gradient fill (rasterized)
- Export as code snippet
- Sync with Wavr editor (deep link)

**Architecture:**

```
figma-plugin/
├── manifest.json
├── code.ts          # Plugin logic (runs in Figma sandbox)
├── ui.html          # Plugin UI (iframe)
├── ui.tsx           # React UI
└── wavr-renderer/   # Headless WebGL renderer for preview
```

**Plugin UI:**
- Preset gallery (grid)
- Live preview canvas (WebGL)
- Param controls (simplified subset)
- "Insert to Figma" button → rasterizes to ImageData → inserts rectangle

**Code.ts:**
```typescript
figma.showUI(__html__, { width: 400, height: 600 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'insert-gradient') {
    const { imageData, width, height } = msg;
    
    const rect = figma.createRectangle();
    rect.resize(width, height);
    
    const image = figma.createImage(imageData);
    rect.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
    
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    figma.viewport.scrollAndZoomIntoView([rect]);
  }
};
```

**Effort:** 1 week

---

## Phase 13: Pro Effects (P1)

**Goal:** Photoshop/After Effects feature parity. ~3 weeks.

### 13.1 Layer Styles

Non-destructive effects applied per layer.

**Styles:**
```typescript
interface LayerStyles {
  dropShadow?: {
    enabled: boolean;
    color: RGBColor;
    opacity: number;      // 0-1
    angle: number;        // degrees
    distance: number;     // px
    spread: number;       // 0-1
    size: number;         // blur radius
  };
  innerShadow?: { /* same params */ };
  outerGlow?: {
    enabled: boolean;
    color: RGBColor;
    opacity: number;
    spread: number;
    size: number;
  };
  innerGlow?: { /* same params */ };
  bevel?: {
    enabled: boolean;
    style: 'outer' | 'inner' | 'emboss';
    depth: number;
    direction: 'up' | 'down';
    size: number;
    soften: number;
    angle: number;
    altitude: number;
    highlightColor: RGBColor;
    shadowColor: RGBColor;
  };
  stroke?: {
    enabled: boolean;
    color: RGBColor;
    size: number;
    position: 'inside' | 'center' | 'outside';
  };
}
```

**Implementation approach:**
- Render layer to FBO
- Apply each style as additional pass
- Composite result

**Effort:** 1 week

---

### 13.2 LUT Color Grading

Professional color grading via 3D lookup tables.

**Features:**
- Load .cube LUT files (industry standard)
- Built-in cinematic LUTs (teal/orange, film emulation, etc.)
- LUT intensity slider (blend with original)
- Stack multiple LUTs

**Implementation:**

```glsl
uniform sampler3D u_lutTexture;
uniform float u_lutIntensity;

vec3 applyLUT(vec3 color) {
  // LUT is 32x32x32 or 64x64x64
  vec3 lutCoord = color * (LUT_SIZE - 1.0) / LUT_SIZE + 0.5 / LUT_SIZE;
  vec3 graded = texture(u_lutTexture, lutCoord).rgb;
  return mix(color, graded, u_lutIntensity);
}
```

**Files:**
- `lib/lut-loader.ts` — parse .cube files
- `lib/shaders/lut.glsl` — 3D texture sampling
- `lib/presets/luts/` — bundled LUTs
- `components/ColorGradingPanel.tsx` — NEW panel

**Effort:** 4 days

---

### 13.3 Particle System

GPU-accelerated particles using transform feedback.

**Emitter types:**
- Point, Line, Circle, Rectangle, Sphere, Mesh surface

**Particle properties:**
- Position, velocity, acceleration
- Size (start/end + curve)
- Color (gradient over lifetime)
- Rotation, angular velocity
- Lifetime, age

**Forces:**
- Gravity
- Wind (directional)
- Turbulence (noise-based)
- Vortex
- Attract/repel points

**Rendering:**
- Billboard quads (default)
- Stretched billboards (velocity-aligned)
- Custom textures (soft circle, star, custom)
- Additive/alpha blending

**Implementation:**

```typescript
interface ParticleSystem {
  emitter: {
    type: 'point' | 'line' | 'circle' | 'rect' | 'sphere';
    position: [number, number, number];
    size: [number, number, number];
    rate: number;         // particles/second
    burst?: number;       // one-shot count
  };
  particle: {
    lifetime: [number, number];  // min/max seconds
    speed: [number, number];
    size: [number, number] | Curve;
    color: RGBColor[] | Gradient;
    rotation: [number, number];
    gravity: number;
  };
  forces: Force[];
  maxParticles: number;   // buffer size
  blendMode: 'additive' | 'alpha' | 'multiply';
}
```

**Architecture:**
- Particle state in float textures (position, velocity, life)
- Update shader: physics simulation via transform feedback
- Render shader: billboard geometry, sample state textures

**Effort:** 2 weeks

---

### 13.4 Curves & Levels

Photoshop-style tonal adjustments.

**Curves:**
- RGB master curve
- Individual R, G, B curves
- Bezier control points
- Real-time preview

**Levels:**
- Input levels (black point, white point, gamma)
- Output levels
- Per-channel adjustment

**Implementation:**

```glsl
// Curves applied via 1D LUT texture (256 entries per channel)
uniform sampler2D u_curvesLUT;  // 256x4 (R, G, B, RGB)

vec3 applyCurves(vec3 color) {
  return vec3(
    texture(u_curvesLUT, vec2(color.r, 0.125)).r,  // R channel
    texture(u_curvesLUT, vec2(color.g, 0.375)).g,  // G channel
    texture(u_curvesLUT, vec2(color.b, 0.625)).b,  // B channel
  );
}

// Levels
vec3 applyLevels(vec3 color, vec3 inBlack, vec3 inWhite, vec3 gamma, vec3 outBlack, vec3 outWhite) {
  color = clamp((color - inBlack) / (inWhite - inBlack), 0.0, 1.0);
  color = pow(color, 1.0 / gamma);
  color = mix(outBlack, outWhite, color);
  return color;
}
```

**UI:**
- Curves editor component (drag control points)
- Histogram display
- Levels sliders

**Effort:** 1 week

---

## Phase 14: Advanced Motion (P2)

**Goal:** After Effects-level animation. ~3 weeks.

### 14.1 Motion Blur

Velocity-based per-pixel blur.

**Implementation:**
1. Render velocity buffer (screen-space motion vectors)
2. Store previous frame positions
3. Blur in direction of motion

```glsl
uniform sampler2D u_velocityBuffer;
uniform float u_shutterAngle;  // 0-360, affects blur length

vec3 motionBlur(vec2 uv, vec3 color) {
  vec2 velocity = texture(u_velocityBuffer, uv).xy;
  velocity *= u_shutterAngle / 360.0;
  
  vec3 result = color;
  const int SAMPLES = 16;
  for (int i = 1; i < SAMPLES; i++) {
    float t = float(i) / float(SAMPLES - 1) - 0.5;
    result += texture(u_sceneTexture, uv + velocity * t).rgb;
  }
  return result / float(SAMPLES);
}
```

**Effort:** 1 week

---

### 14.2 Depth of Field

Focus plane with bokeh blur.

**Parameters:**
- Focal distance
- Aperture (f-stop)
- Bokeh shape (circle, hexagon, custom)

**Implementation:**
- Use parallax depth or 3D z-buffer
- Blur based on distance from focal plane
- Shaped bokeh via weighted sampling

**Effort:** 4 days

---

### 14.3 Fluid Simulation

Real-time Navier-Stokes for ink/smoke effects.

**Passes:**
1. Advection (move quantities along velocity field)
2. Diffusion (viscosity)
3. Pressure projection (enforce incompressibility)
4. Apply forces (mouse interaction, gravity)

**Features:**
- Interactive (mouse pushes fluid)
- Color advection (dye injection)
- Vorticity confinement (preserves swirls)
- Viscosity control

**Effort:** 2 weeks

---

### 14.4 Advanced Timeline

After Effects-style animation system.

**Features:**
- Bezier curve editor for keyframes
- Graph editor (value vs speed graphs)
- Easing presets (bounce, elastic, expo, etc.)
- Loop modes (repeat, pingpong, clamp)
- Time expressions (wiggle, random, math)

**Expression language (subset of JS):**

```javascript
// Wiggle
wiggle(frequency, amplitude)

// Loop
loopIn('pingpong')
loopOut('cycle')

// Math
Math.sin(time * 2) * 50

// Property links
thisComp.layer("Background").opacity
```

**Effort:** 3 weeks

---

## Phase 15: Platform Expansion (P2)

### 15.1 Framework Wrappers

Publish packages for all major frameworks.

```
@wavr/gradient       — React (exists)
@wavr/gradient-vue   — Vue 3
@wavr/gradient-svelte — Svelte
@wavr/gradient-vanilla — No framework
@wavr/gradient-webcomponent — Custom element
```

**Effort:** 1 week (each is thin wrapper)

---

### 15.2 Platform Plugins

- **Webflow** — Custom code component + designer extension
- **Framer** — Code component
- **Wordpress** — Block + shortcode
- **Shopify** — Theme section

**Effort:** 1 week per platform

---

### 15.3 Community Gallery

Cloud-based preset sharing.

**Features:**
- Browse/search public presets
- Like, save, remix
- User profiles
- Featured/trending
- Categories/tags

**Backend:**
- Vercel Postgres or Supabase
- Cloudflare R2 for preset JSON storage
- Auth via Clerk or Auth.js

**Effort:** 2 weeks

---

## Implementation Roadmap

### Sprint 1 (Weeks 1-2): P0 Critical
| Item | Effort | Owner |
|------|--------|-------|
| 12.1 Full blend modes | 2 days | — |
| 12.2 Event system | 5 days | — |
| 12.3 Figma plugin | 5 days | — |

### Sprint 2 (Weeks 3-4): P1 Pro Effects
| Item | Effort | Owner |
|------|--------|-------|
| 13.2 LUT color grading | 4 days | — |
| 13.4 Curves & levels | 5 days | — |
| npm publish @wavr/gradient | 1 day | — |

### Sprint 3 (Weeks 5-6): P1 Continued
| Item | Effort | Owner |
|------|--------|-------|
| 13.1 Layer styles | 5 days | — |
| 13.3 Particle system (phase 1) | 5 days | — |

### Sprint 4 (Weeks 7-8): P2 Motion
| Item | Effort | Owner |
|------|--------|-------|
| 13.3 Particle system (complete) | 5 days | — |
| 14.1 Motion blur | 5 days | — |

### Sprint 5+ (Weeks 9+): P2/P3
- Depth of field
- Fluid simulation
- Advanced timeline
- Community gallery
- Platform plugins

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Blend modes | 5 | 27 |
| npm weekly downloads | 0 | 1,000 |
| Figma plugin installs | 0 | 5,000 |
| GitHub stars | ~50 | 500 |
| Presets in gallery | 8 | 200 |
| Framework wrappers | 1 | 5 |

---

## Technical Constraints

- **Bundle size:** Main entry < 50KB gzipped
- **Performance:** 60fps on M1 MacBook, 30fps on 2019 iPhone
- **Browser support:** Chrome 90+, Safari 15+, Firefox 90+, Edge 90+
- **WebGL:** WebGL 2 required (98% browser coverage)

---

## Open Questions

1. **Particle texture atlas** — Bundle common particle textures or require user upload?
2. **LUT licensing** — Which film emulation LUTs can be bundled legally?
3. **Expression sandbox** — Full JS eval or restricted DSL for timeline expressions?
4. **Pricing model** — Free editor + paid cloud features? Or fully open source?

---

## Appendix: Blend Mode Formulas

```glsl
// Reference implementations for all 27 modes

// Normal
vec3 blendNormal(vec3 base, vec3 blend) { return blend; }

// Multiply
vec3 blendMultiply(vec3 base, vec3 blend) { return base * blend; }

// Screen
vec3 blendScreen(vec3 base, vec3 blend) { return 1.0 - (1.0 - base) * (1.0 - blend); }

// Overlay
vec3 blendOverlay(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend,
    1.0 - 2.0 * (1.0 - base) * (1.0 - blend),
    step(0.5, base)
  );
}

// Soft Light
vec3 blendSoftLight(vec3 base, vec3 blend) {
  return mix(
    2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
    sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
    step(0.5, blend)
  );
}

// Hard Light
vec3 blendHardLight(vec3 base, vec3 blend) {
  return blendOverlay(blend, base);
}

// Color Dodge
vec3 blendColorDodge(vec3 base, vec3 blend) {
  return min(base / (1.0 - blend + 0.001), 1.0);
}

// Color Burn
vec3 blendColorBurn(vec3 base, vec3 blend) {
  return 1.0 - min((1.0 - base) / (blend + 0.001), 1.0);
}

// Darken
vec3 blendDarken(vec3 base, vec3 blend) { return min(base, blend); }

// Lighten
vec3 blendLighten(vec3 base, vec3 blend) { return max(base, blend); }

// Difference
vec3 blendDifference(vec3 base, vec3 blend) { return abs(base - blend); }

// Exclusion
vec3 blendExclusion(vec3 base, vec3 blend) {
  return base + blend - 2.0 * base * blend;
}

// Linear Dodge (Add)
vec3 blendLinearDodge(vec3 base, vec3 blend) { return min(base + blend, 1.0); }

// Linear Burn
vec3 blendLinearBurn(vec3 base, vec3 blend) { return max(base + blend - 1.0, 0.0); }

// Vivid Light
vec3 blendVividLight(vec3 base, vec3 blend) {
  return mix(
    blendColorBurn(base, 2.0 * blend),
    blendColorDodge(base, 2.0 * (blend - 0.5)),
    step(0.5, blend)
  );
}

// Linear Light
vec3 blendLinearLight(vec3 base, vec3 blend) {
  return mix(
    blendLinearBurn(base, 2.0 * blend),
    blendLinearDodge(base, 2.0 * (blend - 0.5)),
    step(0.5, blend)
  );
}

// Pin Light
vec3 blendPinLight(vec3 base, vec3 blend) {
  return mix(
    min(base, 2.0 * blend),
    max(base, 2.0 * blend - 1.0),
    step(0.5, blend)
  );
}

// Hard Mix
vec3 blendHardMix(vec3 base, vec3 blend) {
  return step(1.0, base + blend);
}

// Subtract
vec3 blendSubtract(vec3 base, vec3 blend) { return max(base - blend, 0.0); }

// Divide
vec3 blendDivide(vec3 base, vec3 blend) { return base / (blend + 0.001); }

// Hue (requires RGB↔HSL conversion)
vec3 blendHue(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(blendHSL.x, baseHSL.yz));
}

// Saturation
vec3 blendSaturation(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(baseHSL.x, blendHSL.y, baseHSL.z));
}

// Color
vec3 blendColor(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(blendHSL.xy, baseHSL.z));
}

// Luminosity
vec3 blendLuminosity(vec3 base, vec3 blend) {
  vec3 baseHSL = rgbToHsl(base);
  vec3 blendHSL = rgbToHsl(blend);
  return hslToRgb(vec3(baseHSL.xy, blendHSL.z));
}

// Darker Color (compare luminance, pick darker)
vec3 blendDarkerColor(vec3 base, vec3 blend) {
  float lumBase = dot(base, vec3(0.299, 0.587, 0.114));
  float lumBlend = dot(blend, vec3(0.299, 0.587, 0.114));
  return lumBase < lumBlend ? base : blend;
}

// Lighter Color (compare luminance, pick lighter)
vec3 blendLighterColor(vec3 base, vec3 blend) {
  float lumBase = dot(base, vec3(0.299, 0.587, 0.114));
  float lumBlend = dot(blend, vec3(0.299, 0.587, 0.114));
  return lumBase > lumBlend ? base : blend;
}
```

---

## Appendix: HSL Conversion

```glsl
vec3 rgbToHsl(vec3 c) {
  float maxC = max(c.r, max(c.g, c.b));
  float minC = min(c.r, min(c.g, c.b));
  float l = (maxC + minC) * 0.5;
  
  if (maxC == minC) return vec3(0.0, 0.0, l);
  
  float d = maxC - minC;
  float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
  float h;
  
  if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  
  return vec3(h / 6.0, s, l);
}

float hueToRgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
  if (t < 1.0/2.0) return q;
  if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
  return p;
}

vec3 hslToRgb(vec3 c) {
  if (c.y == 0.0) return vec3(c.z);
  
  float q = c.z < 0.5 ? c.z * (1.0 + c.y) : c.z + c.y - c.z * c.y;
  float p = 2.0 * c.z - q;
  
  return vec3(
    hueToRgb(p, q, c.x + 1.0/3.0),
    hueToRgb(p, q, c.x),
    hueToRgb(p, q, c.x - 1.0/3.0)
  );
}
```
