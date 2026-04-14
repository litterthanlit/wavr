# Phase 6: Shape Masking — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clip gradients to SDF shapes (circle, rounded rect, ellipse, polygon, star, blob) with feathering, inversion, boolean operations, and smooth blending.

**Architecture:** Per-layer mask params stored on `LayerParams`. SDF functions computed analytically in the fragment shader. Up to 2 masks per layer combined via boolean ops. Mask applied after all post-processing, before final `fragColor` output. 22 new uniforms set per-layer.

**Tech Stack:** WebGL 2, GLSL, TypeScript, Zustand, React, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-phase6-shape-masking-design.md`

---

## File Structure

| File | Role |
|---|---|
| `lib/layers.ts` | Add `MaskShape`, `MaskBlendMode`, `MaskParams` types. Add mask fields to `LayerParams`. Add `DEFAULT_MASK`. |
| `lib/engine.ts` | Add 22 mask uniforms to `cacheUniforms()`. Set mask uniforms in `setLayerUniforms()`. |
| `lib/shaders/fragment.glsl` | Add uniform declarations, 6 SDF functions, boolean ops, `evaluateMaskSDF()`, `computeMask()`. Apply in `main()`. |
| `components/GradientPanel.tsx` | Add collapsible Mask section with toggle, shape selects, param sliders, blend mode. |

---

## Task 1: Data Model — Mask Types & LayerParams

**Files:**
- Modify: `lib/layers.ts`

- [ ] **Step 1: Add mask types and MaskParams interface**

After the `ImageBlendMode` type (line 3), add:

```typescript
export type MaskShape = "none" | "circle" | "roundedRect" | "ellipse" | "polygon" | "star" | "blob";

export type MaskBlendMode = "union" | "subtract" | "intersect" | "smoothUnion";

export interface MaskParams {
  shape: MaskShape;
  position: [number, number];
  scale: [number, number];
  rotation: number;
  feather: number;
  invert: boolean;
  cornerRadius: number;
  sides: number;
  starInnerRadius: number;
  noiseDistortion: number;
}

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

- [ ] **Step 2: Add mask fields to LayerParams interface**

Add after `imageBlendOpacity: number;` (line 23):

```typescript
  // Mask
  maskEnabled: boolean;
  mask1: MaskParams;
  mask2: MaskParams;
  maskBlendMode: MaskBlendMode;
  maskSmoothness: number;
```

- [ ] **Step 3: Add mask defaults to DEFAULT_LAYER**

Add after `imageBlendOpacity: 1.0,` (line 48):

```typescript
  maskEnabled: false,
  mask1: { ...DEFAULT_MASK },
  mask2: { ...DEFAULT_MASK },
  maskBlendMode: "union",
  maskSmoothness: 0.1,
```

- [ ] **Step 4: Update createLayer to deep-copy mask objects**

Replace the `createLayer` function:

```typescript
export function createLayer(overrides?: Partial<LayerParams>): LayerParams {
  return {
    ...DEFAULT_LAYER,
    colors: DEFAULT_LAYER.colors.map((c) => [...c] as [number, number, number]),
    mask1: { ...DEFAULT_MASK },
    mask2: { ...DEFAULT_MASK },
    ...overrides,
  };
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: May have downstream type errors (engine doesn't read mask fields yet). layers.ts itself should compile.

- [ ] **Step 6: Commit**

```bash
git add lib/layers.ts
git commit -m "feat(phase6): add MaskShape, MaskParams, mask fields to LayerParams"
```

---

## Task 2: Engine — Mask Uniforms

**Files:**
- Modify: `lib/engine.ts`

- [ ] **Step 1: Add mask uniform names to `cacheUniforms()`**

Add to the `names` array after the image/texture uniform names:

```typescript
      // Mask uniforms
      "u_maskEnabled",
      "u_mask1Type", "u_mask1Position", "u_mask1Scale", "u_mask1Rotation",
      "u_mask1Feather", "u_mask1Invert", "u_mask1CornerRadius",
      "u_mask1Sides", "u_mask1StarInner", "u_mask1NoiseDist",
      "u_mask2Type", "u_mask2Position", "u_mask2Scale", "u_mask2Rotation",
      "u_mask2Feather", "u_mask2Invert", "u_mask2CornerRadius",
      "u_mask2Sides", "u_mask2StarInner", "u_mask2NoiseDist",
      "u_maskBlendMode", "u_maskSmoothness",
```

- [ ] **Step 2: Add mask uniform setting to `setLayerUniforms()`**

Add at the end of `setLayerUniforms()`, after the image blend uniforms:

```typescript
    // Mask uniforms
    const maskShapeMap: Record<string, number> = {
      none: 0, circle: 1, roundedRect: 2, ellipse: 3, polygon: 4, star: 5, blob: 6,
    };
    const maskBlendMap: Record<string, number> = {
      union: 0, subtract: 1, intersect: 2, smoothUnion: 3,
    };

    this.seti("u_maskEnabled", layer.maskEnabled ? 1 : 0);

    // Mask 1
    this.seti("u_mask1Type", maskShapeMap[layer.mask1.shape]);
    this.set2f("u_mask1Position", layer.mask1.position[0], layer.mask1.position[1]);
    this.set2f("u_mask1Scale", layer.mask1.scale[0], layer.mask1.scale[1]);
    this.setf("u_mask1Rotation", layer.mask1.rotation);
    this.setf("u_mask1Feather", layer.mask1.feather);
    this.setf("u_mask1Invert", layer.mask1.invert ? 1.0 : 0.0);
    this.setf("u_mask1CornerRadius", layer.mask1.cornerRadius);
    this.setf("u_mask1Sides", layer.mask1.sides);
    this.setf("u_mask1StarInner", layer.mask1.starInnerRadius);
    this.setf("u_mask1NoiseDist", layer.mask1.noiseDistortion);

    // Mask 2
    this.seti("u_mask2Type", maskShapeMap[layer.mask2.shape]);
    this.set2f("u_mask2Position", layer.mask2.position[0], layer.mask2.position[1]);
    this.set2f("u_mask2Scale", layer.mask2.scale[0], layer.mask2.scale[1]);
    this.setf("u_mask2Rotation", layer.mask2.rotation);
    this.setf("u_mask2Feather", layer.mask2.feather);
    this.setf("u_mask2Invert", layer.mask2.invert ? 1.0 : 0.0);
    this.setf("u_mask2CornerRadius", layer.mask2.cornerRadius);
    this.setf("u_mask2Sides", layer.mask2.sides);
    this.setf("u_mask2StarInner", layer.mask2.starInnerRadius);
    this.setf("u_mask2NoiseDist", layer.mask2.noiseDistortion);

    // Mask combine
    this.seti("u_maskBlendMode", maskBlendMap[layer.maskBlendMode]);
    this.setf("u_maskSmoothness", layer.maskSmoothness);
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Should compile (shader doesn't declare uniforms yet, but unused uniform locations just return null and are silently skipped).

- [ ] **Step 4: Commit**

```bash
git add lib/engine.ts
git commit -m "feat(phase6): mask uniform caching and per-layer setting in engine"
```

---

## Task 3: Fragment Shader — SDF Functions & Mask System

**Files:**
- Modify: `lib/shaders/fragment.glsl`

This is the largest task. The shader grows by ~120 lines.

- [ ] **Step 1: Add mask uniform declarations**

After the image/texture uniform block (after `uniform float u_imageBlendOpacity;`), add:

```glsl
// Mask
uniform bool u_maskEnabled;
uniform int u_mask1Type;       // 0=none, 1=circle, 2=roundedRect, 3=ellipse, 4=polygon, 5=star, 6=blob
uniform vec2 u_mask1Position;
uniform vec2 u_mask1Scale;
uniform float u_mask1Rotation;
uniform float u_mask1Feather;
uniform float u_mask1Invert;
uniform float u_mask1CornerRadius;
uniform float u_mask1Sides;
uniform float u_mask1StarInner;
uniform float u_mask1NoiseDist;
uniform int u_mask2Type;
uniform vec2 u_mask2Position;
uniform vec2 u_mask2Scale;
uniform float u_mask2Rotation;
uniform float u_mask2Feather;
uniform float u_mask2Invert;
uniform float u_mask2CornerRadius;
uniform float u_mask2Sides;
uniform float u_mask2StarInner;
uniform float u_mask2NoiseDist;
uniform int u_maskBlendMode;   // 0=union, 1=subtract, 2=intersect, 3=smoothUnion
uniform float u_maskSmoothness;
```

- [ ] **Step 2: Add SDF primitive functions**

Add a new section after the existing mouse physics functions (after `rippleEffect`) and before the color interpolation functions. Place after the "Mouse Physics" section:

```glsl
// ============================================================
// SDF Shape Primitives (for masking)
// ============================================================

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

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
  vec2 r = ab * vec2(co, sqrt(max(1.0 - co * co, 0.0)));
  return length(r - p) * sign(p.y - r.y);
}

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

float sdBlob(vec2 p, float r, float time, float dist) {
  float angle = atan(p.y, p.x);
  float noise = snoise(vec2(angle * 2.0, time * 0.5)) * dist;
  return length(p) - r * (1.0 + noise * 0.3);
}

// Boolean operations on SDF values
float opUnion(float d1, float d2) { return min(d1, d2); }
float opSubtract(float d1, float d2) { return max(d1, -d2); }
float opIntersect(float d1, float d2) { return max(d1, d2); }
float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}
```

- [ ] **Step 3: Add evaluateMaskSDF() and computeMask() functions**

Add right after the SDF primitives section, before the "Gradient Dispatch Helper" section:

```glsl
// ============================================================
// Mask Evaluation
// ============================================================

float evaluateMaskSDF(vec2 uv, int type, vec2 pos, vec2 scl, float rot,
                      bool invert, float cornerRadius, float sides, float starInner,
                      float noiseDist, float time) {
  if (type == 0) return -1.0; // none = fully inside

  vec2 p = uv - 0.5 - pos;
  float c = cos(rot), s = sin(rot);
  p = mat2(c, s, -s, c) * p;
  p /= scl;

  // Aspect ratio correction
  float aspect = u_resolution.x / u_resolution.y;
  p.x *= aspect;

  float d;
  if (type == 1) d = sdCircle(p, 0.4);
  else if (type == 2) d = sdRoundedBox(p, vec2(0.4), cornerRadius);
  else if (type == 3) d = sdEllipse(p, vec2(0.4, 0.3));
  else if (type == 4) d = sdPolygon(p, 0.4, sides);
  else if (type == 5) d = sdStar(p, 0.4, sides, starInner * sides);
  else d = sdBlob(p, 0.4, time, noiseDist);

  // Noise distortion on edges (blob already has noise built in)
  if (type != 6 && noiseDist > 0.01) {
    d += snoise(p * 8.0 + time * 0.3) * noiseDist * 0.1;
  }

  if (invert) d = -d;
  return d;
}

float computeMask(vec2 uv, float time) {
  if (!u_maskEnabled) return 1.0;
  if (u_mask1Type == 0) return 1.0;

  float d1 = evaluateMaskSDF(uv, u_mask1Type, u_mask1Position, u_mask1Scale,
    u_mask1Rotation, u_mask1Invert > 0.5,
    u_mask1CornerRadius, u_mask1Sides, u_mask1StarInner, u_mask1NoiseDist, time);

  if (u_mask2Type == 0) {
    return 1.0 - smoothstep(-u_mask1Feather, u_mask1Feather, d1);
  }

  float d2 = evaluateMaskSDF(uv, u_mask2Type, u_mask2Position, u_mask2Scale,
    u_mask2Rotation, u_mask2Invert > 0.5,
    u_mask2CornerRadius, u_mask2Sides, u_mask2StarInner, u_mask2NoiseDist, time);

  float combined;
  if (u_maskBlendMode == 0) combined = opUnion(d1, d2);
  else if (u_maskBlendMode == 1) combined = opSubtract(d1, d2);
  else if (u_maskBlendMode == 2) combined = opIntersect(d1, d2);
  else combined = opSmoothUnion(d1, d2, u_maskSmoothness);

  float feather = max(u_mask1Feather, u_mask2Feather);
  return 1.0 - smoothstep(-feather, feather, combined);
}
```

- [ ] **Step 4: Apply mask in main()**

Replace the final line of `main()`:

```glsl
  fragColor = vec4(clamp(color, 0.0, 1.0), u_layerOpacity);
```

With:

```glsl
  // Shape mask (applied after all effects)
  float mask = computeMask(v_uv, u_time * u_speed);

  fragColor = vec4(clamp(color, 0.0, 1.0), u_layerOpacity * mask);
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS. Shader compiles, all uniforms match engine bindings.

- [ ] **Step 6: Commit**

```bash
git add lib/shaders/fragment.glsl
git commit -m "feat(phase6): SDF shape primitives, boolean ops, and mask system in shader"
```

---

## Task 4: GradientPanel UI — Mask Controls

**Files:**
- Modify: `components/GradientPanel.tsx`

- [ ] **Step 1: Add mask shape options constant**

Add after the `GRADIENT_OPTIONS` array:

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

const MASK_BLEND_OPTIONS = [
  { value: "union", label: "Union" },
  { value: "subtract", label: "Subtract" },
  { value: "intersect", label: "Intersect" },
  { value: "smoothUnion", label: "Smooth Union" },
];
```

- [ ] **Step 2: Add MaskControls sub-component**

Add after the `ImageUpload` component, before `GradientPanel`:

```typescript
function MaskControls({
  label,
  mask,
  onUpdate,
}: {
  label: string;
  mask: MaskParams;
  onUpdate: (field: string, value: number | boolean | string | [number, number]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-medium text-text-tertiary">{label}</span>
      <Select
        label="Shape"
        value={mask.shape}
        options={MASK_SHAPE_OPTIONS}
        onChange={(v) => onUpdate("shape", v)}
      />
      {mask.shape !== "none" && (
        <>
          <Slider label="Position X" value={mask.position[0]} min={-1} max={1} step={0.01}
            onChange={(v) => onUpdate("position", [v, mask.position[1]])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Position Y" value={mask.position[1]} min={-1} max={1} step={0.01}
            onChange={(v) => onUpdate("position", [mask.position[0], v])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Scale X" value={mask.scale[0]} min={0.1} max={4} step={0.01}
            onChange={(v) => onUpdate("scale", [v, mask.scale[1]])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Scale Y" value={mask.scale[1]} min={0.1} max={4} step={0.01}
            onChange={(v) => onUpdate("scale", [mask.scale[0], v])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Rotation" value={mask.rotation} min={0} max={6.28} step={0.01}
            onChange={(v) => onUpdate("rotation", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Feather" value={mask.feather} min={0} max={0.5} step={0.001}
            onChange={(v) => onUpdate("feather", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Toggle label="Invert" checked={mask.invert} onChange={(v) => onUpdate("invert", v)} />
          {mask.shape === "roundedRect" && (
            <Slider label="Corner Radius" value={mask.cornerRadius} min={0} max={0.5} step={0.01}
              onChange={(v) => onUpdate("cornerRadius", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          {(mask.shape === "polygon" || mask.shape === "star") && (
            <Slider label="Sides" value={mask.sides} min={3} max={12} step={1}
              onChange={(v) => onUpdate("sides", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          {mask.shape === "star" && (
            <Slider label="Inner Radius" value={mask.starInnerRadius} min={0.1} max={0.9} step={0.01}
              onChange={(v) => onUpdate("starInnerRadius", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          <Slider label="Noise Edge" value={mask.noiseDistortion} min={0} max={1} step={0.01}
            onChange={(v) => onUpdate("noiseDistortion", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add imports for MaskParams**

Update the layers import:

```typescript
import { LayerParams, MaskParams } from "@/lib/layers";
```

- [ ] **Step 4: Add Mask section to GradientPanel**

In the `GradientPanel` component, add a new section between the Distortion Map section and the Animation section. Add this helper function inside the component:

```typescript
  const updateMask = (maskKey: "mask1" | "mask2", field: string, value: number | boolean | string | [number, number]) => {
    const currentMask = activeLayer[maskKey];
    const updatedMask = { ...currentMask, [field]: value };
    if (typeof value === "string" && field === "shape") {
      // Shape change is discrete
      store.setLayerParam({ [maskKey]: updatedMask });
    } else if (typeof value === "boolean") {
      store.setLayerParam({ [maskKey]: updatedMask });
    } else {
      // Continuous slider update
      const newLayers = store.layers.map((l, i) =>
        i === store.activeLayerIndex ? { ...l, [maskKey]: updatedMask } : l
      );
      store.set({ layers: newLayers } as Partial<typeof store>);
    }
  };
```

Then add this JSX section:

```tsx
      {/* Mask */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Mask</SectionHeader>
        <Toggle
          label="Enable Mask"
          checked={activeLayer.maskEnabled}
          onChange={(v) => store.setLayerParam({ maskEnabled: v })}
        />
        {activeLayer.maskEnabled && (
          <>
            <MaskControls
              label="Mask 1"
              mask={activeLayer.mask1}
              onUpdate={(field, value) => updateMask("mask1", field, value)}
            />
            {activeLayer.mask1.shape !== "none" && (
              <>
                <MaskControls
                  label="Mask 2"
                  mask={activeLayer.mask2}
                  onUpdate={(field, value) => updateMask("mask2", field, value)}
                />
                {activeLayer.mask2.shape !== "none" && (
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-medium text-text-tertiary">Combine</span>
                    <Select
                      label="Blend Mode"
                      value={activeLayer.maskBlendMode}
                      options={MASK_BLEND_OPTIONS}
                      onChange={(v) => store.setLayerParam({ maskBlendMode: v as LayerParams["maskBlendMode"] })}
                    />
                    {activeLayer.maskBlendMode === "smoothUnion" && (
                      <Slider label="Smoothness" value={activeLayer.maskSmoothness} min={0} max={0.5} step={0.01}
                        onChange={(v) => updateLayerField("maskSmoothness", v)}
                        onCommit={() => store.commitSet()} />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border" />
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/GradientPanel.tsx
git commit -m "feat(phase6): mask UI controls with shape select, params, and boolean combine"
```

---

## Task 5: Store — Deep Copy Mask in Snapshots

**Files:**
- Modify: `lib/store.ts`

- [ ] **Step 1: Update `deepCopyLayers` to deep-copy mask objects**

The existing `deepCopyLayers` function only deep-copies `colors`. It needs to also deep-copy `mask1` and `mask2` (which are objects). Replace:

```typescript
function deepCopyLayers(layers: LayerParams[]): LayerParams[] {
  return layers.map((l) => ({
    ...l,
    colors: l.colors.map((c) => [...c] as [number, number, number]),
    mask1: { ...l.mask1, position: [...l.mask1.position] as [number, number], scale: [...l.mask1.scale] as [number, number] },
    mask2: { ...l.mask2, position: [...l.mask2.position] as [number, number], scale: [...l.mask2.scale] as [number, number] },
  }));
}
```

This ensures undo/redo snapshots capture the correct mask state without shared references.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/store.ts
git commit -m "feat(phase6): deep-copy mask objects in undo/redo snapshots"
```

---

## Task 6: Integration Verification

**Files:**
- No file changes

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Manual checks:
1. Open `/editor`, scroll to Mask section
2. Toggle "Enable Mask" → mask controls appear
3. Select "Circle" for Mask 1 → gradient clips to a circle
4. Adjust Feather slider → edges soften
5. Toggle Invert → inside/outside swaps
6. Adjust Position X/Y → mask moves
7. Adjust Scale X/Y → mask stretches
8. Adjust Rotation → mask rotates
9. Select "Rounded Rect" → rectangle with rounded corners
10. Adjust Corner Radius → corners change
11. Select "Polygon", change Sides from 3 to 8 → triangle through octagon
12. Select "Star", adjust Inner Radius → star shape changes
13. Select "Blob", increase Noise Edge → organic animated boundary
14. Set Mask 2 to "Circle" → two masks visible
15. Change Blend Mode to "Subtract" → Mask 2 cuts a hole in Mask 1
16. Change to "Intersect" → only overlap visible
17. Change to "Smooth Union" → organic blob merge
18. Adjust Smoothness → blending radius changes
19. Undo/redo through mask changes → state reverts correctly
20. Effects (bloom, chromatic aberration) render inside the mask correctly

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(phase6): shape masking complete — 7 SDF shapes, boolean ops, smooth blending"
```
