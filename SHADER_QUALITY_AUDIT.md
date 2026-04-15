# Wavr Shader Quality Audit — Complete Gap Analysis

> **Purpose:** Reference document for building Wavr to Unicorn Studio quality level.
> **Last Updated:** April 2026
> **Status:** Phase 11.1-11.5 complete, remaining work itemized below.

---

## Completed ✅

### 11.1 Oklab Color Blending
**Problem:** sRGB interpolation produces muddy midpoints between saturated colors.
**Solution:** Full Oklab conversion pipeline in fragment shader.
**Files:** `lib/shaders/fragment.glsl` (lines 180-225)
**UI:** Toggle in Effects Panel → Color section (default: ON)

### 11.2 FBM Octave Rotation
**Problem:** Standard fBm without rotation produces axis-aligned artifacts.
**Solution:** `mat2 rot = mat2(0.8, 0.6, -0.6, 0.8)` rotation between octaves.
**Files:** `lib/shaders/fragment.glsl` (lines 133-150)
**UI:** None — pure quality improvement.

### 11.3 Blue Noise Film Grain
**Problem:** White noise `hash()` produces visible clumping.
**Solution:** Interleaved gradient noise (Valve technique).
**Files:** `lib/shaders/fragment.glsl` (line 237, applied at line 1289)
**UI:** None — existing grain slider now produces better output.

### 11.4 ACES Tone Mapping
**Problem:** Reinhard is functional but flat.
**Solution:** Added ACES filmic curve option.
**Files:** `lib/shaders/fragment.glsl` (lines 227-235, applied at lines 1294-1301)
**UI:** Dropdown in Effects Panel → Color section (None / Reinhard / ACES Filmic)

### 11.5 Improved Single-Pass Bloom
**Problem:** "Bloom" was just brightening highlights, no actual blur/glow.
**Solution:** 24-sample radial kernel (8 angles × 3 radii) weighted by luminance.
**Files:** `lib/shaders/fragment.glsl` (lines 1246-1268)
**UI:** None — same bloom slider, better visual result.

---

## Remaining Work — High Priority

### 11.6 Spring Mouse Physics
**Current:** Exponential decay smoothing (factor 8.0) — smooth but no overshoot.
**Target:** Spring simulation with stiffness=120, damping=12 for "weighty" feel.

**Implementation:**
```typescript
// In engine.ts, replace mouse smoothing with spring physics
private mouseVelX = 0;
private mouseVelY = 0;

// In animation loop:
const stiffness = 120;
const damping = 12;
const dt = Math.min(deltaTime, 0.033); // cap at 30fps equivalent

const dx = this.targetMouseX - this.smoothMouseX;
const dy = this.targetMouseY - this.smoothMouseY;

this.mouseVelX += (dx * stiffness - this.mouseVelX * damping) * dt;
this.mouseVelY += (dy * stiffness - this.mouseVelY * damping) * dt;

this.smoothMouseX += this.mouseVelX * dt;
this.smoothMouseY += this.mouseVelY * dt;
```

**Files to modify:** `lib/engine.ts` (~lines 720-750)
**Effort:** 2 hours
**UI:** Optional sliders for stiffness/damping (advanced panel)

---

### 11.7 Mouse Trail Effect (FBO-based)
**Current:** No trail — mouse position is instantaneous.
**Target:** Fading trail that follows cursor movement.

**Implementation approach:**
1. Create secondary FBO for trail accumulation
2. Each frame: render mouse position as soft circle to trail FBO
3. Fade trail FBO by multiplying with decay factor (0.95-0.98)
4. Composite trail FBO over gradient in final pass

**New uniforms:**
- `u_trailEnabled` (bool)
- `u_trailLength` (float, 0.9-0.99 decay)
- `u_trailWidth` (float, circle radius)
- `u_trailColor` (vec3, or use gradient color at mouse position)

**Files to modify:**
- `lib/engine.ts` — FBO creation, trail rendering pass
- `lib/shaders/fragment.glsl` — trail composite
- `lib/store.ts` — state fields
- `components/EffectsPanel.tsx` — UI controls

**Effort:** 1 day
**Dependency:** Requires multi-FBO infrastructure (see Architecture Changes)

---

### 11.8 Click Ripple Effect
**Current:** No response to click.
**Target:** Expanding ring/ripple from click position.

**Implementation (shader-only, no FBO needed):**
```glsl
uniform vec2 u_rippleOrigin;    // click position (0-1)
uniform float u_rippleTime;      // time since click
uniform float u_rippleEnabled;

// In main():
if (u_rippleEnabled > 0.5 && u_rippleTime < 2.0) {
  float dist = distance(uv, u_rippleOrigin);
  float rippleRadius = u_rippleTime * 0.5; // expands over time
  float rippleWidth = 0.05;
  float ripple = smoothstep(rippleRadius - rippleWidth, rippleRadius, dist) 
               - smoothstep(rippleRadius, rippleRadius + rippleWidth, dist);
  ripple *= 1.0 - u_rippleTime * 0.5; // fade out
  
  // Distort UVs or add brightness
  color += ripple * 0.3;
}
```

**Files to modify:**
- `lib/engine.ts` — click handler, ripple uniforms, time tracking
- `lib/shaders/fragment.glsl` — ripple effect
- `lib/store.ts` — rippleEnabled state

**Effort:** 2-3 hours
**UI:** Toggle + intensity slider

---

### 11.9 Voronoi/Worley Noise
**Current:** Only simplex/perlin noise available.
**Target:** Cellular/Voronoi patterns for organic looks.

**Implementation:**
```glsl
vec2 voronoi(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  
  float md = 8.0;
  vec2 mr;
  
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash22(n + g); // random offset per cell
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
      }
    }
  }
  return vec2(sqrt(md), dot(mr, normalize(mr)));
}
```

**Files to modify:**
- `lib/shaders/fragment.glsl` — voronoi function + new gradient mode
- `lib/layers.ts` — add "voronoi" to gradientType
- `components/GradientPanel.tsx` — UI option

**Effort:** 3-4 hours
**UI:** New gradient type option

---

### 11.10 Liquify/Fluid Distortion
**Current:** Curl noise distortion available but limited.
**Target:** More organic, fluid-like warping.

**Implementation:**
```glsl
vec2 liquify(vec2 uv, float time, float intensity) {
  vec2 warp = uv;
  
  // Multi-octave flow field
  for (int i = 0; i < 3; i++) {
    float scale = 2.0 + float(i) * 1.5;
    float speed = 0.1 + float(i) * 0.05;
    vec2 offset = vec2(
      snoise(vec3(warp * scale, time * speed)),
      snoise(vec3(warp * scale + 100.0, time * speed + 50.0))
    );
    warp += offset * intensity * (0.5 / float(i + 1));
  }
  
  return warp;
}
```

**New uniforms:**
- `u_liquifyEnabled` (bool)
- `u_liquifyIntensity` (float, 0-1)
- `u_liquifyScale` (float, 1-5)

**Files to modify:**
- `lib/shaders/fragment.glsl` — liquify function, apply in UV pipeline
- `lib/store.ts` — state fields
- `components/EffectsPanel.tsx` — UI in Distortion section

**Effort:** 2-3 hours

---

### 11.11 Soft Glow (Distinct from Bloom)
**Current:** Bloom targets bright areas only.
**Target:** Overall soft glow/haze effect.

**Implementation:**
```glsl
// Separate from bloom — adds atmospheric glow
if (u_glowEnabled) {
  vec3 glow = vec3(0.0);
  float total = 0.0;
  
  // Sample in spiral pattern for even coverage
  for (int i = 0; i < 16; i++) {
    float angle = float(i) * 2.399; // golden angle
    float radius = sqrt(float(i) / 16.0) * u_glowRadius;
    vec2 offset = vec2(cos(angle), sin(angle)) * radius;
    vec3 s = computeGradient(uv + offset, time);
    float w = 1.0 - radius / u_glowRadius;
    glow += s * w;
    total += w;
  }
  
  glow /= total;
  color = mix(color, glow, u_glowIntensity * 0.5);
}
```

**New uniforms:**
- `u_glowEnabled` (bool)
- `u_glowIntensity` (float, 0-1)
- `u_glowRadius` (float, 0.01-0.1)

**Effort:** 1-2 hours

---

### 11.12 Caustics
**Current:** Not available.
**Target:** Water caustics / light refraction patterns.

**Implementation:**
```glsl
float caustic(vec2 uv, float time) {
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float scale = 4.0 + float(i) * 2.0;
    float speed = 0.5 + float(i) * 0.2;
    vec2 p = uv * scale + time * speed;
    
    // Two overlapping wave patterns
    float w1 = sin(p.x + sin(p.y * 1.5 + time));
    float w2 = sin(p.y + sin(p.x * 1.3 - time * 0.7));
    c += abs(w1 * w2) * (1.0 / float(i + 1));
  }
  return c;
}

// Apply as overlay or UV distortion
float caust = caustic(uv, time) * u_causticIntensity;
color += color * caust * 0.3;
```

**Effort:** 2 hours
**UI:** Toggle + intensity slider

---

## Architecture Changes (Medium-Term)

### Multi-Pass FBO Pipeline
**Current:** Single-pass rendering with feedback FBO hack.
**Target:** Proper multi-pass pipeline for:
- Real gaussian bloom (extract brights → H blur → V blur → composite)
- Motion blur
- DOF (depth of field)
- Mouse trail accumulation
- Post-processing chain

**Implementation approach:**
1. Create FBO manager class
2. Define pass types: GRADIENT, EXTRACT_BRIGHTS, BLUR_H, BLUR_V, COMPOSITE
3. Chain passes based on enabled effects
4. Ping-pong FBOs for multi-pass blur

**Files to create:**
- `lib/fbo-manager.ts` — FBO creation, management, ping-pong
- `lib/shaders/blur.glsl` — Gaussian blur (separate H and V)
- `lib/shaders/extract-brights.glsl` — Threshold luminance
- `lib/shaders/composite.glsl` — Final compositing

**Effort:** 1-2 weeks
**Priority:** Required for mouse trail, real bloom, motion blur

---

### Performance Overlay
**Current:** No performance visibility.
**Target:** Optional overlay showing:
- FPS
- Draw calls
- GPU memory estimate
- Shader compile time
- Active effects count

**Implementation:**
```typescript
class PerformanceOverlay {
  private frameTimestamps: number[] = [];
  
  tick() {
    const now = performance.now();
    this.frameTimestamps.push(now);
    // Keep last 60 frames
    while (this.frameTimestamps.length > 60) {
      this.frameTimestamps.shift();
    }
  }
  
  get fps() {
    if (this.frameTimestamps.length < 2) return 0;
    const elapsed = this.frameTimestamps[this.frameTimestamps.length - 1] - this.frameTimestamps[0];
    return (this.frameTimestamps.length - 1) / (elapsed / 1000);
  }
}
```

**Effort:** 2-3 days

---

### Flatten/Compile Layers to Single Shader
**Current:** Each layer rendered separately, composited via blending.
**Target:** For export, compile all layers into single optimized shader.

**Benefits:**
- Faster rendering (single draw call)
- Smaller export bundle
- Predictable performance

**Effort:** 1 week

---

### Event Triggers
**Current:** Animation runs continuously.
**Target:** Support for:
- Scroll-triggered animations
- Hover state changes
- Click interactions
- IntersectionObserver activation

**Effort:** 1-2 weeks

---

### Video Backgrounds
**Current:** Static images only.
**Target:** Video texture support via `texImage2D` from video element.

**Implementation:**
```typescript
const video = document.createElement('video');
video.src = url;
video.loop = true;
video.muted = true;
video.play();

// In render loop:
if (video.readyState >= video.HAVE_CURRENT_DATA) {
  gl.bindTexture(gl.TEXTURE_2D, videoTexture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
}
```

**Effort:** 3-5 days

---

## Priority Order — Recommended Implementation Sequence

### Week 1 (Quick Wins)
1. ✅ Oklab color blending — DONE
2. ✅ FBM octave rotation — DONE
3. ✅ Interleaved gradient noise — DONE
4. ✅ ACES tone mapping — DONE
5. ✅ Improved bloom — DONE

### Week 2 (UX Polish)
1. Spring mouse physics (11.6) — 2 hours
2. Click ripple effect (11.8) — 2-3 hours
3. Soft glow (11.11) — 1-2 hours
4. Caustics (11.12) — 2 hours

### Week 3 (New Effects)
1. Voronoi noise (11.9) — 3-4 hours
2. Liquify distortion (11.10) — 2-3 hours

### Week 4+ (Architecture)
1. Multi-pass FBO pipeline — 1-2 weeks
2. Mouse trail effect (11.7) — 1 day (requires FBO pipeline)
3. Real gaussian bloom — 2-3 days (requires FBO pipeline)

---

## Testing Checklist

### Oklab Verification
- [ ] Create blue (#0066FF) → orange (#FF6600) gradient
- [ ] Toggle Oklab — midpoint should shift brown → purple
- [ ] Check no color banding on smooth gradients

### Tone Mapping Verification
- [ ] High brightness + bloom preset
- [ ] Compare None vs Reinhard vs ACES
- [ ] ACES should have richer shadows, softer highlights

### Bloom Verification
- [ ] Zoom to 200%
- [ ] Enable bloom at high intensity
- [ ] Glow should be visible around bright areas (not just brightening)

### Grain Verification
- [ ] Enable grain at 0.5+
- [ ] Zoom to 200%
- [ ] No visible clumping — should be evenly distributed

### FBM Verification
- [ ] Mesh gradient at high complexity
- [ ] No visible grid/axis alignment in noise pattern
- [ ] Patterns should flow organically

---

## Reference: Unicorn Studio Feature Parity

| Feature | Wavr | Unicorn Studio | Gap |
|---------|------|----------------|-----|
| Oklab blending | ✅ | ✅ | — |
| ACES tone mapping | ✅ | ✅ | — |
| Real bloom (multi-pass) | ❌ (approx) | ✅ | Needs FBO pipeline |
| Mouse trail | ❌ | ✅ | Needs FBO pipeline |
| Click ripple | ❌ | ✅ | Easy add |
| Voronoi noise | ❌ | ✅ | Easy add |
| Scroll-linked | ❌ | ✅ | Package API ready, needs triggers |
| Video backgrounds | ❌ | ✅ | Medium effort |
| Liquify distortion | ❌ | ✅ | Easy add |
| 3D shapes | ✅ | ✅ | — |
| Mesh distortion | ✅ | ✅ | — |
| Parallax depth | ✅ | ✅ | — |
| Layer blending | ✅ | ✅ | — |
| Export to code | ❌ | ✅ | Package phase |
| Figma plugin | ❌ | ✅ | Phase 10.3 |

---

## Notes for Agent

When implementing remaining items:

1. **Always test on Safari** — WebGL quirks differ from Chrome
2. **Keep uniforms flat** — nested objects break the GradientState → uniform pipeline
3. **Add to HISTORY_EXCLUDE_KEYS** if the param changes frequently (like mouse position)
4. **Run `npm run build`** after shader changes to catch GLSL syntax errors early
5. **Check both high and low DPR** — effects should scale proportionally
6. **Presets need updating** — new effects won't appear in old presets unless defaults are set

### File Location Quick Reference
- Shader: `lib/shaders/fragment.glsl`
- Engine: `lib/engine.ts`
- State: `lib/store.ts`
- Effects UI: `components/EffectsPanel.tsx`
- Gradient UI: `components/GradientPanel.tsx`
- Layer types: `lib/layers.ts`
