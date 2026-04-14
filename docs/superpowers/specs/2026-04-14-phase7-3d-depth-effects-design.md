# Phase 7: 3D Depth Effects — Design Spec

## Overview

Add 3D depth to Wavr gradients through three sub-features: raymarched shape projection (7.1), parallax depth layers (7.2), and mesh distortion (7.3). All integrate into the existing single-shader architecture with minimal engine changes.

**Architecture approach:** Unified Shader (Approach A). 7.1 and 7.2 are pure fragment shader additions. 7.3 conditionally swaps the fullscreen quad for a subdivided grid mesh.

---

## 7.1 Sphere/Torus/Shape Projection (Raymarching)

### Concept

Project the computed gradient onto a 3D surface rendered via raymarching in the fragment shader. Five shapes available: sphere, torus, plane, cylinder, cube.

### How It Works

1. Build a camera ray from fragment UV + perspective uniform
2. March along the ray (max ~64 steps), evaluating the SDF for the selected shape
3. On hit: compute surface normal via central differences, map hit point to UV, sample the gradient at that UV
4. Apply lighting (diffuse + specular from a fixed light direction) scaled by `u_3dLighting`
5. On miss: discard (transparent background)

### Pipeline Position

After all post-processing effects (bloom, chromatic aberration, etc.), before mask application. This way the full gradient + effects are baked into the color that gets projected onto the 3D surface.

### Mouse Interaction

`u_mouseSmooth` drives rotation angles (azimuth from X, elevation from Y). Inherits existing physics-based smoothing from engine.ts. Auto-rotation via `u_3dRotationSpeed` accumulates over time.

### New Uniforms

| Uniform | Type | Range | Default | Description |
|---------|------|-------|---------|-------------|
| `u_3dEnabled` | bool | — | false | Toggle 3D projection |
| `u_3dShape` | int | 0-4 | 0 | 0=sphere, 1=torus, 2=plane, 3=cylinder, 4=cube |
| `u_3dPerspective` | float | 0.5-3.0 | 1.5 | FOV / perspective strength |
| `u_3dRotationSpeed` | float | 0.0-2.0 | 0.3 | Auto-rotation speed |
| `u_3dRotation` | vec2 | — | (0,0) | Current rotation (mouse + accumulated auto) |
| `u_3dZoom` | float | 0.5-2.0 | 1.0 | Camera distance |
| `u_3dLighting` | float | 0.0-1.0 | 0.5 | Lighting intensity (0=flat, 1=full diffuse+specular) |

### SDF Functions

```glsl
float sdSphere(vec3 p, float r)           // sphere
float sdTorus(vec3 p, vec2 t)             // torus (major/minor radii)
float sdPlane(vec3 p, vec3 n, float h)    // infinite plane
float sdCylinder(vec3 p, float h, float r) // capped cylinder
float sdBox(vec3 p, vec3 b)               // rounded box
```

### UI

New "3D Shape Projection" section in GradientPanel (below mask controls):
- Toggle on/off
- Shape dropdown (Sphere, Torus, Plane, Cylinder, Cube)
- Perspective slider (0.5-3.0)
- Rotation Speed slider (0.0-2.0)
- Zoom slider (0.5-2.0)
- Lighting slider (0.0-1.0)

---

## 7.2 Parallax Depth Layers

### Concept

Each layer gets a depth offset. Mouse movement shifts layers proportionally to their depth, creating a sense of parallax between layers.

### How It Works

UV offset formula:
```glsl
vec2 offset = u_mouseSmooth * u_layerDepth * u_parallaxStrength * 0.05;
offset.x *= u_resolution.y / u_resolution.x; // aspect ratio correction
uv = fract(uv + offset); // wrap for seamless edges
```

- **Damping:** 0.05 multiplier baked in. `parallaxStrength=1.0` produces max ~5% UV shift.
- **Aspect correction:** X offset scaled by height/width ratio so horizontal and vertical parallax feel equal.
- **Edge handling:** `fract()` wrap by default. Works well with procedural gradients. Image mode may want clamp — defer to follow-up.
- **Negative depth:** Supported. Moves against mouse for a "behind the screen" feel.

### Pipeline Position

Applied at the very start of the fragment shader, before distortion map and all other UV transformations. The entire gradient + effects shift together per layer.

### Interaction with 7.1

When 3D shape projection is also enabled, parallax shifts the camera origin rather than the UV, creating a subtle viewpoint shift between layers at different depths.

### New State

**Per-layer (LayerParams):**
| Param | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `depth` | float | -1.0 to 1.0 | 0.0 | Parallax depth offset |

**Global (store root):**
| Param | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `parallaxEnabled` | bool | — | false | Toggle parallax |
| `parallaxStrength` | float | 0.0-1.0 | 0.5 | Global parallax multiplier |

### New Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `u_parallaxEnabled` | bool | Toggle |
| `u_parallaxStrength` | float | Global strength |
| `u_layerDepth` | float | Per-layer depth (set each draw call) |

### UI

- **LayerPanel:** New "Depth" slider per layer (-1.0 to 1.0), shown when parallax is enabled
- **EffectsPanel:** New "Parallax Depth" section with toggle + strength slider

---

## 7.3 Mesh Distortion

### Concept

Replace the fullscreen quad with a subdivided grid mesh. Vertices are displaced along +Z (towards camera) using animated noise, then projected through an MVP matrix. Creates an interactive 3D terrain effect.

### Architecture Change

**This is a global effect**, not per-layer. All layers composite flat, then the entire output is rendered on the displaced mesh. This avoids the complexity of per-layer geometry and the "why don't my layers displace differently?" confusion.

### Engine Changes

1. **`createGridMesh(subdivisions: number)`** — generates a 64x64 indexed triangle grid
   - 4,096 vertices, ~8K triangles
   - Grid is 1.1× canvas bounds (oversized to hide displaced edges)
   - Stored as separate VAO + VBO + IBO
   - Created once on init

2. **Conditional geometry swap:**
   - When `meshDistortionEnabled=true`: bind grid VAO, draw with `TRIANGLES`
   - When `meshDistortionEnabled=false`: bind quad VAO, draw with `TRIANGLE_STRIP`
   - Zero perf cost for non-mesh users

3. **MVP matrix computation:**
   - Perspective projection from `u_3dPerspective` (shared with 7.1 if both were active, but they're mutually exclusive)
   - Camera at fixed position looking at origin
   - Rotation from mouse interaction
   - Computed per-frame in engine.ts, passed as `u_mvp` mat4 uniform

### Vertex Shader Changes

Current vertex shader is trivial (passthrough). New behavior when mesh is active:

```glsl
// v1: cheap sin-based pseudo-noise (upgrade to simplex later)
float cheapNoise(vec2 p, float freq) {
    return sin(p.x * freq) * sin(p.y * freq * 1.3);
}

void main() {
    vec3 pos = vec3(a_position, 0.0);
    if (u_meshEnabled) {
        float disp = cheapNoise(pos.xy + u_time * u_meshSpeed, u_meshFrequency);
        pos.z += disp * u_meshDisplacement;
        // Mouse-reactive: vertices near mouse get extra displacement
        float mouseDist = length(pos.xy - u_mouseSmooth);
        pos.z += exp(-mouseDist * 4.0) * u_mouseReact * u_meshDisplacement * 0.5;
    }
    gl_Position = u_meshEnabled ? u_mvp * vec4(pos, 1.0) : vec4(pos.xy, 0.0, 1.0);
    v_uv = a_position.xy * 0.5 + 0.5;
}
```

### New State (Global)

| Param | Type | Range | Default | Description |
|-------|------|-------|---------|-------------|
| `meshDistortionEnabled` | bool | — | false | Toggle mesh distortion |
| `meshDisplacement` | float | 0.0-1.0 | 0.3 | Displacement amplitude |
| `meshFrequency` | float | 0.5-5.0 | 2.0 | Noise frequency / wave density |
| `meshSpeed` | float | 0.0-2.0 | 0.5 | Displacement animation speed |

### New Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `u_meshEnabled` | bool | Toggle |
| `u_meshDisplacement` | float | Amplitude |
| `u_meshFrequency` | float | Noise scale |
| `u_meshSpeed` | float | Animation speed |
| `u_mvp` | mat4 | Model-view-projection matrix |

### UI

New "Mesh Distortion" section in EffectsPanel:
- Toggle on/off
- Displacement slider (0.0-1.0)
- Frequency slider (0.5-5.0)
- Speed slider (0.0-2.0)

---

## Mutual Exclusivity

| Feature | 3D Shape (7.1) | Parallax (7.2) | Mesh Distortion (7.3) |
|---------|:-:|:-:|:-:|
| **3D Shape (7.1)** | — | Compatible | Mutually exclusive |
| **Parallax (7.2)** | Compatible | — | Compatible |
| **Mesh Distortion (7.3)** | Mutually exclusive | Compatible | — |

**Enforcement:** UI toggles. Enabling 3D shape disables mesh distortion and vice versa. Both show a brief toast explaining why.

---

## New File

### `lib/math.ts` (~80 lines)

Minimal mat4 utility functions for MVP computation. No dependencies.

```typescript
export function mat4Perspective(fov: number, aspect: number, near: number, far: number): Float32Array
export function mat4LookAt(eye: vec3, center: vec3, up: vec3): Float32Array
export function mat4RotateX(out: Float32Array, angle: number): Float32Array
export function mat4RotateY(out: Float32Array, angle: number): Float32Array
export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array
export function mat4Identity(): Float32Array
```

---

## Modified Files Summary

| File | Changes |
|------|---------|
| `lib/shaders/fragment.glsl` | Parallax UV offset, raymarching SDFs (5 shapes), 3D projection function, lighting (~300 new lines) |
| `lib/shaders/vertex.glsl` | MVP transform, noise displacement, mouse-reactive displacement (~40 new lines) |
| `lib/engine.ts` | Grid mesh creation (VAO/VBO/IBO), conditional geometry swap, MVP matrix computation, new uniform locations + setters |
| `lib/store.ts` | New global state: 3D shape params, parallax params, mesh distortion params. Exclusivity logic in setters. |
| `lib/layers.ts` | Add `depth: number` to LayerParams + default factory |
| `components/GradientPanel.tsx` | New "3D Shape Projection" section with toggle, shape dropdown, 4 sliders |
| `components/EffectsPanel.tsx` | New "Parallax Depth" and "Mesh Distortion" sections |
| `components/LayerPanel.tsx` | Depth slider per layer (shown when parallax enabled) |
| `lib/math.ts` | **New file.** mat4 helpers for perspective, lookAt, rotate, multiply |

---

## Implementation Order

As suggested: **7.2 → 7.1 → 7.3**

1. **7.2 Parallax** — smallest surface area, immediate visual payoff, validates pipeline changes
2. **7.1 3D Shape Projection** — pure fragment shader, builds on pipeline from 7.2
3. **7.3 Mesh Distortion** — biggest engine change, saved for last when pipeline is stable
