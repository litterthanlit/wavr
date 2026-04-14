# Phase 6: Shape Masking — Design Spec

## Overview

Clip gradients to shapes using SDF (Signed Distance Field) functions computed analytically in the fragment shader. This unlocks hero sections, cards, avatars, creative layouts, and organic shape compositions. SDF-first architecture gives us feathering, anti-aliasing, boolean operations, smooth blending, shape morphing, and mask animation — capabilities that competing tools like Unicorn Studio, Figma, and Framer cannot match.

**Differentiators over competition:**
- **Smooth boolean operations** — organic blobby mask interactions via the `k` parameter (no other design tool exposes this)
- **Shape morphing** — smoothly animate between any two SDF shapes (impossible with path-based masking)
- **Noise-distorted edges** — organic, living mask boundaries
- **Resolution-independent** — SDFs are computed analytically, not rasterized

---

## 1. Mask Architecture

### Per-layer masks

Each layer can have **up to 2 masks** that combine via boolean operations. Masks are per-layer (same as gradient params), not global. This follows the existing pattern and keeps the uniform count manageable.

### SDF pipeline

Masks apply in the shader **after** the gradient + image blend + all post-processing, right before the final `fragColor` output. This means effects (bloom, chromatic aberration, etc.) render inside the mask, which is the expected behavior for a creative tool.

```
distortion map → curl → kaleidoscope → computeGradient → image blend →
noise → reaction-diff → chromatic aberration → hue/sat/brightness →
bloom → vignette → blur → feedback → grain → tone map → pixel sort → dither → ASCII →
██ MASK APPLIED HERE ██ → fragColor with layer opacity
```

### Why after post-processing

If the mask applied before effects, bloom would be clipped at the mask edge (ugly). By masking last, bloom glow naturally bleeds to the mask boundary and fades via feathering — this matches how After Effects and motion design tools work.

---

## 2. Data Model

### MaskParams type (`lib/layers.ts`)

```typescript
export type MaskShape = "none" | "circle" | "roundedRect" | "ellipse" | "polygon" | "star" | "blob";

export type MaskBlendMode = "union" | "subtract" | "intersect" | "smoothUnion";

export interface MaskParams {
  shape: MaskShape;
  position: [number, number];     // UV offset from center [-1, 1], default [0, 0]
  scale: [number, number];        // scale multiplier, default [1, 1]
  rotation: number;               // radians, default 0
  feather: number;                // edge softness 0–1, default 0.01
  invert: boolean;                // flip inside/outside, default false
  // Shape-specific params
  cornerRadius: number;           // roundedRect: per-corner radius 0–0.5, default 0.1
  sides: number;                  // polygon: 3–12, default 6
  starInnerRadius: number;        // star: inner/outer ratio 0.1–0.9, default 0.4
  noiseDistortion: number;        // blob/organic edge distortion 0–1, default 0
}
```

### LayerParams additions

```typescript
// Added to LayerParams
mask1: MaskParams;
mask2: MaskParams;
maskBlendMode: MaskBlendMode;    // how mask1 and mask2 combine, default "union"
maskSmoothness: number;          // k parameter for smooth booleans 0–0.5, default 0.1
maskEnabled: boolean;            // master toggle, default false
```

### Defaults

```typescript
export const DEFAULT_MASK: MaskParams = {
  shape: "none",
  position: [0, 0],
  scale: [1, 1],
  rotation: 0,
  feather: 0.01,
  invert: false,
  cornerRadius: 0.1,
  sides: 6,
  starInnerRadius: 0.4,
  noiseDistortion: 0,
};
```

---

## 3. SDF Functions in Shader

### Primitive SDFs

All SDFs take a centered UV coordinate ([-0.5, 0.5] range after aspect ratio correction) and return a signed distance value: negative inside, positive outside.

**Circle:**
```glsl
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}
```

**Rounded Rectangle** (per-corner radius support):
```glsl
float sdRoundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}
```

**Ellipse:**
```glsl
float sdEllipse(vec2 p, vec2 ab) {
    p = abs(p);
    if (p.x > p.y) { p = p.yx; ab = ab.yx; }
    float l = ab.y * ab.y - ab.x * ab.x;
    float m = ab.x * p.x / l;
    float m2 = m * m;
    float n = ab.y * p.y / l;
    float n2 = n * n;
    float c = (m2 + n2 - 1.0) / 3.0;
    float c3 = c * c * c;
    float q = c3 + m2 * n2 * 2.0;
    float d = c3 + m2 * n2;
    float g = m + m * n2;
    float co;
    if (d < 0.0) {
        float h = acos(q / c3) / 3.0;
        float s = cos(h);
        float t = sin(h) * sqrt(3.0);
        float rx = sqrt(-c * (s + t + 2.0) + m2);
        float ry = sqrt(-c * (s - t + 2.0) + m2);
        co = (ry + sign(l) * rx + abs(g) / (rx * ry) - m) / 2.0;
    } else {
        float h = 2.0 * m * n * sqrt(d);
        float s = sign(q + h) * pow(abs(q + h), 1.0 / 3.0);
        float u = sign(q - h) * pow(abs(q - h), 1.0 / 3.0);
        float rx = -s - u - c * 4.0 + 2.0 * m2;
        float ry = (s - u) * sqrt(3.0);
        float rm = sqrt(rx * rx + ry * ry);
        co = (ry / sqrt(rm - rx) + 2.0 * g / rm - m) / 2.0;
    }
    vec2 r2 = ab * vec2(co, sqrt(1.0 - co * co));
    return length(r2 - p) * sign(p.y - r2.y);
}
```

**Regular Polygon** (N sides):
```glsl
float sdPolygon(vec2 p, float r, float n) {
    float an = 3.14159265 / n;
    float he = r * cos(an);
    p = abs(p);
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= vec2(he, 0.0);
    p.y += clamp(-p.y, 0.0, r * sin(an));
    return length(p) * sign(p.x);
}
```

**Star** (N points with inner radius ratio):
```glsl
float sdStar(vec2 p, float r, float n, float m) {
    float an = 3.14159265 / n;
    float en = 3.14159265 / m;
    vec2 acs = vec2(cos(an), sin(an));
    vec2 ecs = vec2(cos(en), sin(en));
    float bn = mod(atan(p.x, p.y), 2.0 * an) - an;
    p = length(p) * vec2(cos(bn), abs(sin(bn)));
    p -= r * acs;
    p += ecs * clamp(-dot(p, ecs), 0.0, r * acs.y / ecs.y);
    return length(p) * sign(p.x);
}
```

**Blob** (noise-distorted circle):
```glsl
float sdBlob(vec2 p, float r, float time, float distortion) {
    float angle = atan(p.y, p.x);
    float noise = snoise(vec2(angle * 2.0, time * 0.5)) * distortion;
    return length(p) - r * (1.0 + noise * 0.3);
}
```

### Boolean Operations

```glsl
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(d1, -d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
    float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0 - h);
}
```

### Mask Evaluation

```glsl
// Returns raw SDF distance (negative inside, positive outside)
float evaluateMaskSDF(vec2 uv, int type, vec2 pos, vec2 scl, float rot,
                      bool invert, float cornerRadius, float sides, float starInner,
                      float noiseDist, float time) {
    if (type == 0) return -1.0; // none = fully inside

    // Transform UV: center, apply position/rotation/scale
    vec2 p = uv - 0.5 - pos;
    float c = cos(rot), s = sin(rot);
    p = mat2(c, s, -s, c) * p;
    p /= scl;

    // Aspect ratio correction
    float aspect = u_resolution.x / u_resolution.y;
    p.x *= aspect;

    float d;
    if (type == 1) d = sdCircle(p, 0.4);                                    // circle
    else if (type == 2) d = sdRoundedBox(p, vec2(0.4), cornerRadius);       // roundedRect
    else if (type == 3) d = sdEllipse(p, vec2(0.4, 0.3));                   // ellipse
    else if (type == 4) d = sdPolygon(p, 0.4, sides);                       // polygon
    else if (type == 5) d = sdStar(p, 0.4, sides, starInner * sides);       // star
    else d = sdBlob(p, 0.4, time, noiseDist);                               // blob

    // Noise distortion on edges (if not blob, which already has it)
    if (type != 6 && noiseDist > 0.01) {
        d += snoise(p * 8.0 + time * 0.3) * noiseDist * 0.1;
    }

    if (invert) d = -d;

    return d; // raw SDF — feathering applied in computeMask()
}

float computeMask(vec2 uv, float time) {
    if (!u_maskEnabled) return 1.0;
    if (u_mask1Type == 0) return 1.0; // no masks

    float d1 = evaluateMaskSDF(uv, u_mask1Type, u_mask1Position, u_mask1Scale,
        u_mask1Rotation, u_mask1Invert > 0.5,
        u_mask1CornerRadius, u_mask1Sides, u_mask1StarInner, u_mask1NoiseDist, time);

    if (u_mask2Type == 0) {
        // Single mask — apply feathering and return
        return 1.0 - smoothstep(-u_mask1Feather, u_mask1Feather, d1);
    }

    float d2 = evaluateMaskSDF(uv, u_mask2Type, u_mask2Position, u_mask2Scale,
        u_mask2Rotation, u_mask2Invert > 0.5,
        u_mask2CornerRadius, u_mask2Sides, u_mask2StarInner, u_mask2NoiseDist, time);

    // Boolean combine on raw SDF values (correct distance field operations)
    float combined;
    if (u_maskBlendMode == 0) combined = opUnion(d1, d2);
    else if (u_maskBlendMode == 1) combined = opSubtract(d1, d2);
    else if (u_maskBlendMode == 2) combined = opIntersect(d1, d2);
    else combined = opSmoothUnion(d1, d2, u_maskSmoothness);

    // Use the larger feather of the two masks for the combined edge
    float feather = max(u_mask1Feather, u_mask2Feather);
    return 1.0 - smoothstep(-feather, feather, combined);
}
```

### Integration in `main()`

At the very end of `main()`, just before the final `fragColor` assignment:

```glsl
  // Shape mask (applied last, after all effects)
  float mask = computeMask(v_uv, u_time * u_speed);

  fragColor = vec4(clamp(color, 0.0, 1.0), u_layerOpacity * mask);
```

---

## 4. Uniforms

### Per-mask uniforms (×2 for mask1 and mask2)

```
u_maskEnabled           bool
u_mask1Type             int     (0=none, 1=circle, 2=roundedRect, 3=ellipse, 4=polygon, 5=star, 6=blob)
u_mask1Position         vec2
u_mask1Scale            vec2
u_mask1Rotation         float
u_mask1Feather          float
u_mask1Invert           float   (0 or 1)
u_mask1CornerRadius     float
u_mask1Sides            float
u_mask1StarInner        float
u_mask1NoiseDist        float
u_mask2Type             int
u_mask2Position         vec2
u_mask2Scale            vec2
u_mask2Rotation         float
u_mask2Feather          float
u_mask2Invert           float
u_mask2CornerRadius     float
u_mask2Sides            float
u_mask2StarInner        float
u_mask2NoiseDist        float
u_maskBlendMode         int     (0=union, 1=subtract, 2=intersect, 3=smoothUnion)
u_maskSmoothness        float
```

22 new uniforms total. These are set per-layer in `setLayerUniforms()`.

---

## 5. UI — Mask Controls

### Location

New collapsible **"Mask"** section in GradientPanel, positioned between the Distortion Map section and Animation section. This keeps all per-layer visual controls together.

### Layout

```
┌──────────────────────────────────┐
│ ☐ Enable Mask                    │
│                                  │
│ ── Mask 1 ──────────────────     │
│ Shape  [Circle ▾]                │
│ Position X ──●──────── 0.0       │
│ Position Y ──●──────── 0.0       │
│ Scale X ─────────●──── 1.0       │
│ Scale Y ─────────●──── 1.0       │
│ Rotation ──●──────── 0°          │
│ Feather ──●──────── 0.01         │
│ ☐ Invert                        │
│ Corner Radius ──●──── 0.1   *    │ * only for roundedRect
│ Sides ──────────●──── 6     *    │ * only for polygon/star
│ Inner Radius ───●──── 0.4   *    │ * only for star
│ Noise Edge ─────●──── 0.0        │
│                                  │
│ ── Mask 2 ──────────────────     │
│ Shape  [None ▾]                  │
│ (controls appear when != none)   │
│                                  │
│ ── Combine ─────────────────     │
│ Blend Mode [Union ▾]             │
│ Smoothness ─────●──── 0.1   *    │ * only for smoothUnion
└──────────────────────────────────┘
```

### Conditional visibility

| Control | Visible when |
|---|---|
| All mask controls | `maskEnabled === true` |
| Mask 2 section | `mask1.shape !== "none"` |
| Combine section | `mask2.shape !== "none"` |
| Corner Radius | shape === "roundedRect" |
| Sides | shape === "polygon" or "star" |
| Inner Radius | shape === "star" |
| Smoothness | maskBlendMode === "smoothUnion" |
| Noise Edge | always (works on all shapes) |

### Shape options dropdown

```typescript
const MASK_SHAPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "circle", label: "Circle" },
  { value: "roundedRect", label: "Rounded Rect" },
  { value: "ellipse", label: "Ellipse" },
  { value: "polygon", label: "Polygon" },
  { value: "star", label: "Star" },
  { value: "blob", label: "Blob" },
];
```

---

## 6. Files Changed

| File | Changes |
|---|---|
| `lib/layers.ts` | Add `MaskShape`, `MaskBlendMode`, `MaskParams` types. Add `mask1`, `mask2`, `maskBlendMode`, `maskSmoothness`, `maskEnabled` to `LayerParams`. Add `DEFAULT_MASK`. |
| `lib/store.ts` | No new actions needed — mask params update via existing `setLayerParam()`. Mask fields excluded from `LAYER_PARAM_KEYS` (not derived to top level). |
| `lib/engine.ts` | Add 22 mask uniforms to `cacheUniforms()`. Set mask uniforms in `setLayerUniforms()` from layer's mask params. |
| `lib/shaders/fragment.glsl` | Add 22 uniform declarations. Add 6 SDF functions. Add boolean ops. Add `evaluateMask()` and `computeMask()`. Apply mask at end of `main()`. |
| `components/GradientPanel.tsx` | Add Mask section with toggle, shape selects, param sliders, blend mode, conditional visibility. |

---

## 7. Constraints

- **No stencil buffer** — all masking via SDF in the fragment shader
- **No shader recompilation** — mask type selected via uniform int, not preprocessor
- **Max 2 masks per layer** — keeps uniform count reasonable (22 new)
- **No SVG path masks in this phase** — rasterize-to-texture approach deferred to Phase 9 (Designer Polish)
- **Masks are per-layer** — each layer independently masked, composited via existing blend mode system
- **Mask params update via `setLayerParam()`** — no new store actions needed
- **Noise distortion uses existing `snoise()`** — no new noise functions

---

## 8. Future Extensions (Not in Scope)

- SVG path texture masks (Phase 9)
- On-canvas drag handles for mask position/scale/rotation
- Mask keyframing on timeline
- Shape morphing animation (e.g., circle → star over time)
- More than 2 masks per layer
- Mask presets (e.g., "card", "avatar", "hero")
