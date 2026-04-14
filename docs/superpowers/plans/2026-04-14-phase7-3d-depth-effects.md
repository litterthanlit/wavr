# Phase 7: 3D Depth Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 3D depth to Wavr gradients through parallax depth layers, raymarched shape projection, and mesh distortion.

**Architecture:** Unified Shader approach. Parallax (7.2) and 3D shape projection (7.1) are pure fragment shader additions — no engine changes. Mesh distortion (7.3) conditionally swaps the fullscreen quad for a 64x64 grid when active. Implementation order: 7.2 → 7.1 → 7.3 (smallest surface area first).

**Tech Stack:** WebGL 2, GLSL ES 3.0, TypeScript, Zustand, React

**Design Spec:** `docs/superpowers/specs/2026-04-14-phase7-3d-depth-effects-design.md`

---

## File Structure

### New Files
- `lib/math.ts` — mat4 utility functions (perspective, lookAt, rotate, multiply, identity). ~80 lines, zero dependencies.

### Modified Files
- `lib/layers.ts` — Add `depth` param to `LayerParams`
- `lib/store.ts` — Add parallax, 3D shape, and mesh distortion state + mutual exclusivity logic
- `lib/shaders/fragment.glsl` — Parallax UV offset, SDF functions, raymarching, 3D projection
- `lib/shaders/vertex.glsl` — MVP transform, noise displacement for mesh mode
- `lib/engine.ts` — Grid mesh creation, VAO swap, MVP computation, new uniform setters
- `components/EffectsPanel.tsx` — Parallax and Mesh Distortion UI sections
- `components/GradientPanel.tsx` — 3D Shape Projection UI section
- `components/LayerPanel.tsx` — Per-layer depth slider

---

## Task 1: Add Parallax State to Store and Layers

**Files:**
- Modify: `lib/layers.ts:37-69` (LayerParams interface)
- Modify: `lib/layers.ts:71-105` (DEFAULT_LAYER)
- Modify: `lib/store.ts:5-109` (GradientState interface)
- Modify: `lib/store.ts:194-246` (DEFAULTS)

- [ ] **Step 1: Add `depth` to LayerParams**

In `lib/layers.ts`, add `depth` to the `LayerParams` interface after line 68 (after `textMaskAlign`):

```typescript
  // Parallax depth
  depth: number;
```

Add the default value to `DEFAULT_LAYER` after line 104 (after `textMaskAlign: "center"`):

```typescript
  depth: 0,
```

- [ ] **Step 2: Add parallax and 3D state to GradientState**

In `lib/store.ts`, add to the `GradientState` interface after line 65 (after `customGLSL: string | null;`):

```typescript
  // 3D Depth Effects (Phase 7)
  // Parallax
  parallaxEnabled: boolean;
  parallaxStrength: number;
  // 3D Shape Projection
  threeDEnabled: boolean;
  threeDShape: number; // 0=sphere, 1=torus, 2=plane, 3=cylinder, 4=cube
  threeDPerspective: number;
  threeDRotationSpeed: number;
  threeDZoom: number;
  threeDLighting: number;
  // Mesh Distortion
  meshDistortionEnabled: boolean;
  meshDisplacement: number;
  meshFrequency: number;
  meshSpeed: number;
```

- [ ] **Step 3: Add defaults**

In `lib/store.ts`, add to the `DEFAULTS` object after line 245 (after `customGLSL: null,`):

```typescript
  // 3D Depth Effects
  parallaxEnabled: false,
  parallaxStrength: 0.5,
  threeDEnabled: false,
  threeDShape: 0,
  threeDPerspective: 1.5,
  threeDRotationSpeed: 0.3,
  threeDZoom: 1.0,
  threeDLighting: 0.5,
  meshDistortionEnabled: false,
  meshDisplacement: 0.3,
  meshFrequency: 2.0,
  meshSpeed: 0.5,
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/layers.ts lib/store.ts
git commit -m "feat(phase7): add parallax, 3D shape, and mesh distortion state"
```

---

## Task 2: Add Parallax Uniforms and Fragment Shader Logic

**Files:**
- Modify: `lib/shaders/fragment.glsl:1-104` (uniforms section)
- Modify: `lib/shaders/fragment.glsl:883-891` (main function, before distortion map)

- [ ] **Step 1: Declare parallax uniforms in fragment shader**

In `lib/shaders/fragment.glsl`, add after line 104 (after `uniform bool u_customEnabled;`):

```glsl
// Parallax depth (Phase 7)
uniform bool u_parallaxEnabled;
uniform float u_parallaxStrength;
uniform float u_layerDepth;
```

- [ ] **Step 2: Add parallax UV offset to main()**

In `lib/shaders/fragment.glsl`, in the `main()` function, add **before** the distortion map block (before the existing line `// Distortion map UV displacement`). The parallax offset goes first because it shifts the entire layer's UV before any other transformation:

```glsl
  // Parallax depth offset (applied first — shifts entire layer)
  if (u_parallaxEnabled) {
    vec2 offset = u_mouseSmooth * u_layerDepth * u_parallaxStrength * 0.05;
    offset.x *= u_resolution.y / u_resolution.x; // aspect ratio correction
    uv = fract(uv + offset); // wrap for seamless edges
  }
```

This goes at line 885, right after `float time = u_time * u_speed;` and before `// Distortion map UV displacement`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. The new uniforms are declared but not yet wired from the engine.

- [ ] **Step 4: Commit**

```bash
git add lib/shaders/fragment.glsl
git commit -m "feat(phase7): parallax UV offset in fragment shader"
```

---

## Task 3: Wire Parallax Uniforms in Engine

**Files:**
- Modify: `lib/engine.ts:100-148` (cacheUniforms)
- Modify: `lib/engine.ts:361-459` (setLayerUniforms)
- Modify: `lib/engine.ts:461-505` (setGlobalUniforms)

- [ ] **Step 1: Register new uniform names in cacheUniforms()**

In `lib/engine.ts`, add to the `names` array inside `cacheUniforms()` (after `"u_customEnabled"` at line 138):

```typescript
      // Phase 7: Parallax
      "u_parallaxEnabled", "u_parallaxStrength", "u_layerDepth",
```

- [ ] **Step 2: Set parallax global uniforms**

In `lib/engine.ts`, add to `setGlobalUniforms()` after line 504 (after the `u_feedbackDecay` line):

```typescript
    // Parallax
    this.seti("u_parallaxEnabled", isBaseLayer || state.parallaxEnabled ? (state.parallaxEnabled ? 1 : 0) : 0);
    this.setf("u_parallaxStrength", state.parallaxStrength);
```

Wait — parallax should be active on **all** layers (not just the base layer), since the whole point is each layer shifts differently. Correct approach:

```typescript
    // Parallax (active on all layers, not just base)
    this.seti("u_parallaxEnabled", state.parallaxEnabled ? 1 : 0);
    this.setf("u_parallaxStrength", state.parallaxStrength);
```

- [ ] **Step 3: Set per-layer depth uniform**

In `lib/engine.ts`, add to `setLayerUniforms()` after line 379 (after `this.setf("u_layerOpacity", layer.opacity);`):

```typescript
    // Parallax depth (per-layer)
    this.setf("u_layerDepth", layer.depth);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds. Parallax is now fully wired from store → engine → shader.

- [ ] **Step 5: Commit**

```bash
git add lib/engine.ts
git commit -m "feat(phase7): wire parallax uniforms in engine"
```

---

## Task 4: Parallax UI — EffectsPanel + LayerPanel

**Files:**
- Modify: `components/EffectsPanel.tsx:111-118` (Advanced section area)
- Modify: `components/LayerPanel.tsx:110-143` (active layer controls)

- [ ] **Step 1: Add Parallax section to EffectsPanel**

In `components/EffectsPanel.tsx`, add a new "3D Depth" section **before** the Advanced section (before the `<div className="border-t border-border my-1" />` at line 111):

```tsx
      {/* 3D Depth */}
      <Section title="3D Depth">
        <Toggle label="Parallax" checked={store.parallaxEnabled} onChange={(v) => store.setDiscrete({ parallaxEnabled: v })} />
        <Slider label="Strength" value={store.parallaxStrength} min={0} max={1} step={0.01} onChange={(v) => store.set({ parallaxStrength: v })} onCommit={() => store.commitSet()} disabled={!store.parallaxEnabled} />
      </Section>

      <div className="border-t border-border my-1" />
```

- [ ] **Step 2: Add depth slider to LayerPanel**

In `components/LayerPanel.tsx`, add a depth slider inside the active layer controls section, after the Blend Mode `</div>` (after line 140, before the closing `</div>` of the flex column):

```tsx
            {store.parallaxEnabled && (
              <Slider
                label="Depth"
                value={store.layers[store.activeLayerIndex]?.depth ?? 0}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => {
                  const newLayers = store.layers.map((l, i) =>
                    i === store.activeLayerIndex ? { ...l, depth: v } : l
                  );
                  store.set({ layers: newLayers });
                }}
                onCommit={() => store.commitSet()}
              />
            )}
```

Note: We also need access to `parallaxEnabled` from the store. The existing `const store = useGradientStore();` already provides this.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. Parallax is now fully functional end-to-end.

- [ ] **Step 4: Manual QA**

Run: `npm run dev`

Test:
1. Open http://localhost:3000/editor
2. Add a second layer (+ Add in layer panel)
3. Go to Effects tab → 3D Depth → Toggle Parallax ON
4. Set Layer 1 depth to -0.5, Layer 2 depth to 0.5
5. Move mouse across the canvas
6. Verify: layers shift in opposite directions proportional to their depth values
7. Verify: no edge artifacts (UV wraps seamlessly)

- [ ] **Step 5: Commit**

```bash
git add components/EffectsPanel.tsx components/LayerPanel.tsx
git commit -m "feat(phase7): parallax UI in EffectsPanel and LayerPanel"
```

---

## Task 5: 3D Shape SDF Functions in Fragment Shader

**Files:**
- Modify: `lib/shaders/fragment.glsl` (add SDF functions after noise helpers, before gradient functions)

- [ ] **Step 1: Add 3D uniforms**

In `lib/shaders/fragment.glsl`, add after the parallax uniforms (added in Task 2):

```glsl
// 3D Shape Projection (Phase 7)
uniform bool u_3dEnabled;
uniform int u_3dShape;           // 0=sphere, 1=torus, 2=plane, 3=cylinder, 4=cube
uniform float u_3dPerspective;   // 0.5-3.0
uniform float u_3dRotationSpeed;
uniform vec2 u_3dRotation;       // accumulated rotation (azimuth, elevation)
uniform float u_3dZoom;          // 0.5-2.0
uniform float u_3dLighting;      // 0.0-1.0
```

- [ ] **Step 2: Add SDF functions and raymarching**

Add these functions after the existing noise helper functions but before the gradient mode functions (before `vec3 getGradientColor`). Find the section comment `// ============================================================` that precedes the color helpers and insert before it:

```glsl
// ============================================================
// 3D SDF Functions (Phase 7)
// ============================================================

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdPlane(vec3 p) {
  return p.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sceneSDF(vec3 p) {
  if (u_3dShape == 0) return sdSphere(p, 0.8);
  else if (u_3dShape == 1) return sdTorus(p, vec2(0.6, 0.25));
  else if (u_3dShape == 2) return sdPlane(p + vec3(0.0, 0.3, 0.0));
  else if (u_3dShape == 3) return sdCylinder(p, 0.8, 0.5);
  else return sdBox(p, vec3(0.6));
}

vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  return normalize(vec3(
    sceneSDF(p + vec3(h, 0, 0)) - sceneSDF(p - vec3(h, 0, 0)),
    sceneSDF(p + vec3(0, h, 0)) - sceneSDF(p - vec3(0, h, 0)),
    sceneSDF(p + vec3(0, 0, h)) - sceneSDF(p - vec3(0, 0, h))
  ));
}

// Map 3D hit point to 2D UV for gradient sampling
vec2 mapToUV(vec3 p, vec3 n) {
  if (u_3dShape == 0) {
    // Sphere: spherical coordinates
    float u = atan(p.z, p.x) / 6.28318 + 0.5;
    float v = asin(clamp(p.y / 0.8, -1.0, 1.0)) / 3.14159 + 0.5;
    return vec2(u, v);
  } else if (u_3dShape == 1) {
    // Torus: angle around ring + angle around tube
    float u = atan(p.z, p.x) / 6.28318 + 0.5;
    vec2 q = vec2(length(p.xz) - 0.6, p.y);
    float v = atan(q.y, q.x) / 6.28318 + 0.5;
    return vec2(u, v);
  } else if (u_3dShape == 2) {
    // Plane: XZ position
    return p.xz * 0.5 + 0.5;
  } else if (u_3dShape == 3) {
    // Cylinder: angle + height
    float u = atan(p.z, p.x) / 6.28318 + 0.5;
    float v = p.y * 0.5 + 0.5;
    return vec2(u, v);
  } else {
    // Box: planar projection based on dominant normal axis
    vec3 an = abs(n);
    if (an.x > an.y && an.x > an.z) return p.yz * 0.8 + 0.5;
    else if (an.y > an.z) return p.xz * 0.8 + 0.5;
    else return p.xy * 0.8 + 0.5;
  }
}

mat3 rotationMatrix(float azimuth, float elevation) {
  float ca = cos(azimuth), sa = sin(azimuth);
  float ce = cos(elevation), se = sin(elevation);
  // Y rotation (azimuth) * X rotation (elevation)
  return mat3(
    ca,  sa * se, sa * ce,
    0.0, ce,      -se,
    -sa, ca * se, ca * ce
  );
}

vec4 raymarched3D(vec2 screenUV, vec3 gradientColor) {
  // Camera setup
  float fov = u_3dPerspective;
  vec2 uv = (screenUV - 0.5) * 2.0;
  uv.x *= u_resolution.x / u_resolution.y; // aspect ratio

  vec3 ro = vec3(0.0, 0.0, 2.5 / u_3dZoom); // ray origin (camera)
  vec3 rd = normalize(vec3(uv / fov, -1.0));  // ray direction

  // Apply rotation from mouse + auto-rotation
  mat3 rot = rotationMatrix(u_3dRotation.x, u_3dRotation.y);
  ro = rot * ro;
  rd = rot * rd;

  // Raymarching
  float t = 0.0;
  float hit = -1.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) { hit = t; break; }
    if (t > 10.0) break;
    t += d;
  }

  if (hit < 0.0) return vec4(0.0); // miss — transparent

  vec3 p = ro + rd * hit;
  vec3 n = calcNormal(p);
  vec2 surfaceUV = mapToUV(p, n);

  // Sample gradient at the surface UV
  // The gradientColor was computed at screenUV — we need to resample at surfaceUV
  // We pass surfaceUV back and the caller resamples
  // For now, use the passed-in color and apply lighting

  // Lighting
  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
  float diffuse = max(dot(n, lightDir), 0.0);
  float specular = pow(max(dot(reflect(-lightDir, n), normalize(-rd)), 0.0), 32.0);

  float ambient = 0.3;
  float lit = ambient + (diffuse * 0.6 + specular * 0.4) * u_3dLighting;
  // When lighting=0, just show the flat gradient. When lighting=1, full shading.
  float shade = mix(1.0, lit, u_3dLighting);

  return vec4(gradientColor * shade, 1.0);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds. SDF functions compile but aren't called from main() yet.

- [ ] **Step 4: Commit**

```bash
git add lib/shaders/fragment.glsl
git commit -m "feat(phase7): 3D SDF functions and raymarching in fragment shader"
```

---

## Task 6: Wire 3D Projection into the Render Pipeline

**Files:**
- Modify: `lib/shaders/fragment.glsl:1117-1126` (main function, before mask application)
- Modify: `lib/engine.ts:100-148` (cacheUniforms)
- Modify: `lib/engine.ts:461-505` (setGlobalUniforms)

- [ ] **Step 1: Add 3D projection call in main()**

In `lib/shaders/fragment.glsl`, add the 3D projection block **after** the ASCII art effect (after the `}` closing the ASCII block around line 1115) and **before** the shape mask comment (`// Shape mask`):

```glsl
  // 3D Shape Projection (raymarching)
  if (u_3dEnabled) {
    vec4 projected = raymarched3D(v_uv, color);
    if (projected.a > 0.0) {
      color = projected.rgb;
    } else {
      discard; // miss — transparent background
    }
  }
```

- [ ] **Step 2: Register 3D uniform names in engine cacheUniforms()**

In `lib/engine.ts`, add to the `names` array in `cacheUniforms()` (after the parallax uniforms added in Task 3):

```typescript
      // Phase 7: 3D Shape Projection
      "u_3dEnabled", "u_3dShape", "u_3dPerspective",
      "u_3dRotationSpeed", "u_3dRotation", "u_3dZoom", "u_3dLighting",
```

- [ ] **Step 3: Set 3D global uniforms in engine**

In `lib/engine.ts`, add to `setGlobalUniforms()` after the parallax uniforms (added in Task 3):

```typescript
    // 3D Shape Projection
    this.seti("u_3dEnabled", state.threeDEnabled ? 1 : 0);
    this.seti("u_3dShape", state.threeDShape);
    this.setf("u_3dPerspective", state.threeDPerspective);
    this.setf("u_3dRotationSpeed", state.threeDRotationSpeed);
    this.setf("u_3dZoom", state.threeDZoom);
    this.setf("u_3dLighting", state.threeDLighting);
```

- [ ] **Step 4: Compute and set 3D rotation from mouse + auto-rotation**

The rotation accumulates over time from auto-rotation speed, plus mouse position offsets the viewing angle. Add rotation tracking to the engine class.

In `lib/engine.ts`, add private fields after line 22 (after `private prevSmoothY = 0.5;`):

```typescript
  // 3D rotation accumulator
  private rotationAngle = 0;
```

In the `startLoop` method, inside the loop (after the mouse velocity computation around line 635, before `this.render(state);`):

```typescript
      // Accumulate 3D auto-rotation
      if (state.threeDEnabled) {
        this.rotationAngle += state.threeDRotationSpeed * dt;
      }
```

In `setGlobalUniforms()`, after the `u_3dLighting` line:

```typescript
    // Rotation: auto-rotation + mouse-driven offset
    if (state.threeDEnabled) {
      const azimuth = this.rotationAngle + (this.smoothMouseX - 0.5) * 2.0;
      const elevation = (this.smoothMouseY - 0.5) * 1.5;
      this.set2f("u_3dRotation", azimuth, elevation);
    }
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds. 3D projection is wired but has no UI controls yet.

- [ ] **Step 6: Commit**

```bash
git add lib/shaders/fragment.glsl lib/engine.ts
git commit -m "feat(phase7): wire 3D shape projection into render pipeline"
```

---

## Task 7: 3D Shape Projection UI

**Files:**
- Modify: `components/GradientPanel.tsx` (add 3D Shape section)
- Modify: `components/EffectsPanel.tsx` (mutual exclusivity with mesh distortion)

- [ ] **Step 1: Add 3D Shape Projection section to GradientPanel**

In `components/GradientPanel.tsx`, find the end of the component (before the final closing `</div>` of the panel). Add a new section for 3D shape controls. This goes after the existing animation/appearance sliders section:

```tsx
      {/* 3D Shape Projection */}
      <div className="border-t border-border my-2" />
      <div className="flex flex-col gap-3">
        <Toggle
          label="3D Shape Projection"
          checked={store.threeDEnabled}
          onChange={(v) => {
            const updates: Partial<typeof store> = { threeDEnabled: v };
            if (v && store.meshDistortionEnabled) {
              updates.meshDistortionEnabled = false;
            }
            store.setDiscrete(updates);
          }}
        />
        {store.threeDEnabled && (
          <>
            <Select
              label="Shape"
              value={String(store.threeDShape)}
              options={[
                { value: "0", label: "Sphere" },
                { value: "1", label: "Torus" },
                { value: "2", label: "Plane" },
                { value: "3", label: "Cylinder" },
                { value: "4", label: "Cube" },
              ]}
              onChange={(v) => store.setDiscrete({ threeDShape: Number(v) })}
            />
            <Slider label="Perspective" value={store.threeDPerspective} min={0.5} max={3} step={0.1} onChange={(v) => store.set({ threeDPerspective: v })} onCommit={() => store.commitSet()} />
            <Slider label="Rotation Speed" value={store.threeDRotationSpeed} min={0} max={2} step={0.01} onChange={(v) => store.set({ threeDRotationSpeed: v })} onCommit={() => store.commitSet()} />
            <Slider label="Zoom" value={store.threeDZoom} min={0.5} max={2} step={0.01} onChange={(v) => store.set({ threeDZoom: v })} onCommit={() => store.commitSet()} />
            <Slider label="Lighting" value={store.threeDLighting} min={0} max={1} step={0.01} onChange={(v) => store.set({ threeDLighting: v })} onCommit={() => store.commitSet()} />
          </>
        )}
      </div>
```

Note: The `GradientState` type needs `threeDEnabled`, `threeDShape`, etc. — these were added in Task 1.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Manual QA**

Run: `npm run dev`

Test:
1. Open editor, go to Gradient tab
2. Toggle "3D Shape Projection" ON
3. Verify: gradient renders on a sphere
4. Switch shape to Torus — verify donut shape
5. Adjust Perspective slider — verify FOV changes
6. Adjust Zoom — verify camera gets closer/farther
7. Adjust Lighting — at 0: flat/unlit gradient, at 1: full shading
8. Move mouse — verify shape rotates based on mouse position
9. Verify: Rotation Speed slider controls auto-rotation speed

- [ ] **Step 4: Commit**

```bash
git add components/GradientPanel.tsx
git commit -m "feat(phase7): 3D shape projection UI controls"
```

---

## Task 8: 3D Projection — Resample Gradient at Surface UV

**Files:**
- Modify: `lib/shaders/fragment.glsl` (refactor main to allow resampling)

The current 3D projection uses the screen-space gradient color and applies lighting. This looks OK but the gradient is "screen-projected" rather than "surface-mapped." For a proper look, we should re-sample `computeGradient()` at the surface UV when 3D is enabled.

- [ ] **Step 1: Update raymarched3D to return surface UV**

Replace the `raymarched3D` function to return a struct with surface UV and lighting:

Change the return type and the call site. Instead of passing `gradientColor` into `raymarched3D`, have it return the surface UV and shade factor. In `main()`:

```glsl
  // 3D Shape Projection (raymarching)
  if (u_3dEnabled) {
    vec4 projected = raymarched3D(v_uv);
    if (projected.a > 0.0) {
      // projected.xy = surface UV, projected.z = shade factor
      vec3 surfaceColor = computeGradient(projected.xy, time);
      color = surfaceColor * projected.z;
    } else {
      discard;
    }
  }
```

And update `raymarched3D` signature and return:

```glsl
// Returns: xy=surfaceUV, z=shadeFactor, w=hit (0=miss, 1=hit)
vec4 raymarched3D(vec2 screenUV) {
  // ... same camera/raymarching logic, but remove gradientColor param ...
  
  if (hit < 0.0) return vec4(0.0); // miss

  vec3 p = ro + rd * hit;
  vec3 n = calcNormal(p);
  vec2 surfaceUV = mapToUV(p, n);

  vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6));
  float diffuse = max(dot(n, lightDir), 0.0);
  float specular = pow(max(dot(reflect(-lightDir, n), normalize(-rd)), 0.0), 32.0);
  float ambient = 0.3;
  float lit = ambient + (diffuse * 0.6 + specular * 0.4) * u_3dLighting;
  float shade = mix(1.0, lit, u_3dLighting);

  return vec4(surfaceUV, shade, 1.0);
}
```

- [ ] **Step 2: Verify build and visual result**

Run: `npm run build`
Expected: Build succeeds. The gradient now wraps around 3D shapes instead of being screen-projected.

- [ ] **Step 3: Commit**

```bash
git add lib/shaders/fragment.glsl
git commit -m "feat(phase7): resample gradient at surface UV for proper 3D mapping"
```

---

## Task 9: Create mat4 Math Utilities

**Files:**
- Create: `lib/math.ts`

- [ ] **Step 1: Write mat4 utility functions**

Create `lib/math.ts` with minimal mat4 helpers needed for MVP computation:

```typescript
// Minimal mat4 utilities for WebGL MVP matrices. No dependencies.

export function mat4Identity(): Float32Array {
  const out = new Float32Array(16);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

export function mat4Perspective(
  fov: number, aspect: number, near: number, far: number
): Float32Array {
  const out = new Float32Array(16);
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

export function mat4LookAt(
  eye: [number, number, number],
  center: [number, number, number],
  up: [number, number, number]
): Float32Array {
  const out = new Float32Array(16);
  let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;

  z0 = eye[0] - center[0];
  z1 = eye[1] - center[1];
  z2 = eye[2] - center[2];
  len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
  z0 *= len; z1 *= len; z2 *= len;

  x0 = up[1] * z2 - up[2] * z1;
  x1 = up[2] * z0 - up[0] * z2;
  x2 = up[0] * z1 - up[1] * z0;
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
  if (len > 0) { len = 1 / len; x0 *= len; x1 *= len; x2 *= len; }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;

  out[0] = x0; out[1] = y0; out[2] = z0;
  out[4] = x1; out[5] = y1; out[6] = z1;
  out[8] = x2; out[9] = y2; out[10] = z2;
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
  out[15] = 1;
  return out;
}

export function mat4RotateX(m: Float32Array, angle: number): Float32Array {
  const out = new Float32Array(m);
  const s = Math.sin(angle), c = Math.cos(angle);
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  out[4] = a10 * c + a20 * s;
  out[5] = a11 * c + a21 * s;
  out[6] = a12 * c + a22 * s;
  out[7] = a13 * c + a23 * s;
  out[8] = a20 * c - a10 * s;
  out[9] = a21 * c - a11 * s;
  out[10] = a22 * c - a12 * s;
  out[11] = a23 * c - a13 * s;
  return out;
}

export function mat4RotateY(m: Float32Array, angle: number): Float32Array {
  const out = new Float32Array(m);
  const s = Math.sin(angle), c = Math.cos(angle);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  out[0] = a00 * c - a20 * s;
  out[1] = a01 * c - a21 * s;
  out[2] = a02 * c - a22 * s;
  out[3] = a03 * c - a23 * s;
  out[8] = a00 * s + a20 * c;
  out[9] = a01 * s + a21 * c;
  out[10] = a02 * s + a22 * c;
  out[11] = a03 * s + a23 * c;
  return out;
}

export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[i] * b[j * 4] +
        a[4 + i] * b[j * 4 + 1] +
        a[8 + i] * b[j * 4 + 2] +
        a[12 + i] * b[j * 4 + 3];
    }
  }
  return out;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add lib/math.ts
git commit -m "feat(phase7): mat4 utility functions for MVP computation"
```

---

## Task 10: Create Grid Mesh Geometry in Engine

**Files:**
- Modify: `lib/engine.ts` (add grid mesh creation and VAO management)

- [ ] **Step 1: Add grid mesh fields to engine class**

In `lib/engine.ts`, add private fields after the `textMaskTexture` field (around line 33):

```typescript
  // Grid mesh for mesh distortion (Phase 7)
  private quadVAO!: WebGLVertexArrayObject;
  private gridVAO: WebGLVertexArrayObject | null = null;
  private gridIndexCount = 0;
```

- [ ] **Step 2: Store the quad VAO reference**

In `initProgram()`, the current code creates a VAO and buffer but doesn't store the VAO reference. Modify the VAO creation (around lines 70-81) to store it:

```typescript
    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
```

Similarly, in `setCustomShader()` (around line 309-317), update to use `this.quadVAO`:

```typescript
      // Re-bind the quad VAO
      this.quadVAO = gl.createVertexArray()!;
      gl.bindVertexArray(this.quadVAO);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const posLoc = gl.getAttribLocation(newProgram, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
```

- [ ] **Step 3: Add grid mesh creation method**

Add a method to the `GradientEngine` class after `initProgram()`:

```typescript
  private initGridMesh() {
    const gl = this.gl;
    const subdivisions = 64;
    const extent = 1.1; // 1.1× oversize to hide displaced edges

    // Generate vertices
    const vertices: number[] = [];
    for (let y = 0; y <= subdivisions; y++) {
      for (let x = 0; x <= subdivisions; x++) {
        const px = (x / subdivisions) * 2 * extent - extent;
        const py = (y / subdivisions) * 2 * extent - extent;
        vertices.push(px, py);
      }
    }

    // Generate indices (two triangles per quad)
    const indices: number[] = [];
    const cols = subdivisions + 1;
    for (let y = 0; y < subdivisions; y++) {
      for (let x = 0; x < subdivisions; x++) {
        const i = y * cols + x;
        indices.push(i, i + 1, i + cols);
        indices.push(i + 1, i + cols + 1, i + cols);
      }
    }
    this.gridIndexCount = indices.length;

    this.gridVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.gridVAO);

    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);
  }
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds. Grid is created but not yet used for rendering.

- [ ] **Step 5: Commit**

```bash
git add lib/engine.ts
git commit -m "feat(phase7): grid mesh creation and VAO management in engine"
```

---

## Task 11: Mesh Distortion Vertex Shader

**Files:**
- Modify: `lib/shaders/vertex.glsl`

- [ ] **Step 1: Update vertex shader with displacement and MVP**

Replace the entire content of `lib/shaders/vertex.glsl`:

```glsl
#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

// Mesh distortion uniforms (Phase 7)
uniform bool u_meshEnabled;
uniform float u_meshDisplacement;
uniform float u_meshFrequency;
uniform float u_meshSpeed;
uniform float u_time;
uniform mat4 u_mvp;
uniform vec2 u_mouseSmooth;
uniform float u_mouseReact;

// Cheap sin-based noise (v1 — upgrade to simplex later)
float cheapNoise(vec2 p, float freq) {
  return sin(p.x * freq * 3.14159) * sin(p.y * freq * 3.14159 * 1.3)
       + sin(p.x * freq * 2.17 + 1.7) * sin(p.y * freq * 1.87 + 2.3) * 0.5;
}

void main() {
  // UV is always derived from position (works for both quad and grid)
  // Grid extends to ±1.1, so we need to clamp UV to 0-1 range
  v_uv = clamp(a_position * 0.5 + 0.5, 0.0, 1.0);

  if (u_meshEnabled) {
    vec3 pos = vec3(a_position, 0.0);

    // Animated noise displacement along +Z
    float animOffset = u_time * u_meshSpeed;
    float disp = cheapNoise(pos.xy + animOffset, u_meshFrequency) * 0.5;

    // Mouse-reactive: vertices near mouse get extra displacement
    vec2 mousePos = u_mouseSmooth * 2.0 - 1.0; // convert 0-1 to -1..1
    float mouseDist = length(pos.xy - mousePos);
    float mouseInfluence = exp(-mouseDist * 3.0) * u_mouseReact;

    pos.z = (disp + mouseInfluence * 0.3) * u_meshDisplacement;

    gl_Position = u_mvp * vec4(pos, 1.0);
  } else {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds. The vertex shader now references uniforms that aren't set yet — they'll be wired in the next task.

- [ ] **Step 3: Commit**

```bash
git add lib/shaders/vertex.glsl
git commit -m "feat(phase7): mesh distortion vertex shader with noise displacement"
```

---

## Task 12: Wire Mesh Distortion in Engine (MVP + Draw Calls)

**Files:**
- Modify: `lib/engine.ts` (add import, MVP computation, conditional draw, uniform wiring)

- [ ] **Step 1: Import mat4 utilities**

In `lib/engine.ts`, add at the top (after the existing imports):

```typescript
import { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply } from "./math";
```

- [ ] **Step 2: Register mesh distortion uniforms in cacheUniforms()**

Add to the `names` array:

```typescript
      // Phase 7: Mesh Distortion
      "u_meshEnabled", "u_meshDisplacement", "u_meshFrequency", "u_meshSpeed", "u_mvp",
```

- [ ] **Step 3: Add private helper to set mat4 uniform**

Add to the engine class (after `set2f`):

```typescript
  private setMat4(name: string, val: Float32Array) {
    const loc = this.uniforms[name];
    if (loc !== undefined) this.gl.uniformMatrix4fv(loc, false, val);
  }
```

- [ ] **Step 4: Set mesh uniforms in setGlobalUniforms()**

Add after the 3D shape uniforms:

```typescript
    // Mesh Distortion
    this.seti("u_meshEnabled", state.meshDistortionEnabled ? 1 : 0);
    this.setf("u_meshDisplacement", state.meshDisplacement);
    this.setf("u_meshFrequency", state.meshFrequency);
    this.setf("u_meshSpeed", state.meshSpeed);

    // MVP matrix for mesh distortion
    if (state.meshDistortionEnabled) {
      const canvas = this.gl.canvas as HTMLCanvasElement;
      const aspect = canvas.width / canvas.height;
      const proj = mat4Perspective(Math.PI / 3, aspect, 0.1, 100.0);
      const view = mat4LookAt([0, 0.8, 2.0], [0, 0, 0], [0, 1, 0]);
      // Add subtle mouse-driven rotation
      const azimuth = (this.smoothMouseX - 0.5) * 0.5;
      const elevation = (this.smoothMouseY - 0.5) * 0.3;
      let mv = mat4RotateY(view, azimuth);
      mv = mat4RotateX(mv, elevation);
      const mvp = mat4Multiply(proj, mv);
      this.setMat4("u_mvp", mvp);
    }
```

- [ ] **Step 5: Initialize grid mesh lazily and swap draw calls**

In the `render()` method, we need to swap between quad and grid geometry. Replace the draw calls in the render method.

Find the three `gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)` calls in `render()` (lines 562, 575, 581). Each one needs to become conditional:

Add a helper method to the class:

```typescript
  private drawGeometry(useMesh: boolean) {
    const gl = this.gl;
    if (useMesh) {
      if (!this.gridVAO) this.initGridMesh();
      gl.bindVertexArray(this.gridVAO!);
      gl.drawElements(gl.TRIANGLES, this.gridIndexCount, gl.UNSIGNED_INT, 0);
    } else {
      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
```

Then replace the three `gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)` calls with:

```typescript
      this.drawGeometry(state.meshDistortionEnabled);
```

- [ ] **Step 6: Ensure quadVAO is bound after draw**

After the multi-layer rendering loop, rebind the quad VAO as the default:

```typescript
    // Restore quad VAO as default
    this.gl.bindVertexArray(this.quadVAO);
```

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: Build succeeds. Mesh distortion is fully wired but has no UI yet.

- [ ] **Step 8: Commit**

```bash
git add lib/engine.ts
git commit -m "feat(phase7): wire mesh distortion MVP and conditional draw in engine"
```

---

## Task 13: Mesh Distortion UI + Mutual Exclusivity

**Files:**
- Modify: `components/EffectsPanel.tsx`

- [ ] **Step 1: Add Mesh Distortion controls to EffectsPanel**

In `components/EffectsPanel.tsx`, add to the "3D Depth" section (created in Task 4), after the Parallax controls:

```tsx
        <Toggle
          label="Mesh Distortion"
          checked={store.meshDistortionEnabled}
          onChange={(v) => {
            const updates: Partial<typeof store> = { meshDistortionEnabled: v };
            if (v && store.threeDEnabled) {
              updates.threeDEnabled = false;
            }
            store.setDiscrete(updates);
          }}
        />
        <Slider label="Displacement" value={store.meshDisplacement} min={0} max={1} step={0.01} onChange={(v) => store.set({ meshDisplacement: v })} onCommit={() => store.commitSet()} disabled={!store.meshDistortionEnabled} />
        <Slider label="Frequency" value={store.meshFrequency} min={0.5} max={5} step={0.1} onChange={(v) => store.set({ meshFrequency: v })} onCommit={() => store.commitSet()} disabled={!store.meshDistortionEnabled} />
        <Slider label="Speed" value={store.meshSpeed} min={0} max={2} step={0.01} onChange={(v) => store.set({ meshSpeed: v })} onCommit={() => store.commitSet()} disabled={!store.meshDistortionEnabled} />
```

- [ ] **Step 2: Verify mutual exclusivity**

The toggle handlers in both GradientPanel (Task 7) and EffectsPanel (this task) enforce mutual exclusivity:
- Enabling 3D Shape → disables Mesh Distortion
- Enabling Mesh Distortion → disables 3D Shape

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Manual QA**

Run: `npm run dev`

Test:
1. Go to Effects tab → 3D Depth section
2. Toggle Mesh Distortion ON
3. Verify: canvas shows a wavy/displaced mesh surface with gradient
4. Adjust Displacement — verify wave amplitude changes
5. Adjust Frequency — verify wave density changes
6. Adjust Speed — verify animation speed changes
7. Move mouse — verify vertices near mouse react
8. Toggle 3D Shape ON in Gradient tab — verify Mesh Distortion auto-disables
9. Toggle Mesh Distortion ON — verify 3D Shape auto-disables

- [ ] **Step 5: Commit**

```bash
git add components/EffectsPanel.tsx
git commit -m "feat(phase7): mesh distortion UI with mutual exclusivity"
```

---

## Task 14: Final Integration — Build Verification and Cleanup

**Files:**
- Modify: `lib/engine.ts` (vertex shader uniform passthrough for u_time, u_mouseSmooth, u_mouseReact)

- [ ] **Step 1: Ensure vertex shader uniforms are set**

The vertex shader now uses `u_time`, `u_mouseSmooth`, and `u_mouseReact` — these are already set in `setGlobalUniforms()`, so they're available to both vertex and fragment shaders automatically (same program). Verify this is the case.

The `u_time` uniform is set via `this.setf("u_time", this.elapsedTime)` in `setGlobalUniforms()`.
The `u_mouseSmooth` is set via `this.set2f("u_mouseSmooth", ...)`.
The `u_mouseReact` is set via `this.setf("u_mouseReact", state.mouseReact)`.

These are shared across both shaders in the same program — no additional wiring needed.

- [ ] **Step 2: Full build check**

Run: `npm run build`
Expected: Build succeeds with zero errors and zero warnings related to Phase 7 code.

- [ ] **Step 3: Full manual QA**

Run: `npm run dev`

Complete QA checklist:
1. **Parallax:** Enable parallax, set different depths on 2 layers, verify mouse-driven shift
2. **3D Sphere:** Enable 3D shape, select Sphere, verify gradient wraps around sphere
3. **3D Torus:** Switch to Torus, verify donut shape
4. **3D Cube:** Switch to Cube, verify box shape with correct face UV mapping
5. **3D + Parallax:** Enable both, verify layers shift at different depths while 3D is active
6. **Mesh Distortion:** Enable mesh, verify wavy terrain
7. **Mesh + Parallax:** Both enabled, verify they compose correctly
8. **Mutual exclusivity:** 3D + Mesh cannot both be active
9. **Effects on 3D:** Enable bloom, chromatic aberration with 3D shape — verify effects are baked into projection
10. **Existing features:** Verify no regression — masks, text mask, feedback loop, presets all still work
11. **Performance:** Check FPS counter stays above 30fps with 3D enabled

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(phase7): integration fixes from QA"
```

- [ ] **Step 5: Update HANDOFF.md and ROADMAP.md**

Add Phase 7 to the completed sections in both docs:
- `ROADMAP.md`: Move Phase 7 to Completed, mark as ✅
- `.context/HANDOFF.md`: Add Phase 7 section with technical details

```bash
git add ROADMAP.md .context/HANDOFF.md
git commit -m "docs: update ROADMAP.md and HANDOFF.md for Phase 7 completion"
```
