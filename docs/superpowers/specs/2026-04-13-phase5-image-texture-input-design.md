# Phase 5: Image & Texture Input — Design Spec

## Overview

Let designers upload images as color sources, distortion maps, or blend targets. This unlocks poster-style effects and photo-gradient composites. All three sub-features (5.1, 5.2, 5.3) ship in one phase.

**Key decisions from brainstorming:**
- Option C UI: "image" as 9th gradient type (5.1) + texture overlay section for any type (5.2/5.3)
- Per-layer image storage (each layer gets its own color image + distortion map)
- Primary upload + expandable distortion map slot (clean by default)
- Texture cache in engine keyed by data URL hash (shared GPU textures across layers)
- Images stay client-side only (FileReader API), no server uploads

---

## 1. Data Model

### LayerParams additions (`lib/layers.ts`)

```typescript
// New fields on LayerParams
imageData: string | null;              // base64 data URL of color image
imageScale: number;                    // 0.1–4.0, default 1.0
imageOffset: [number, number];         // UV offset [-1, 1], default [0, 0]
distortionMapData: string | null;      // base64 data URL of distortion map
distortionMapEnabled: boolean;         // default false
distortionMapIntensity: number;        // 0–1, default 0.3
imageBlendMode: ImageBlendMode;        // how image composites with procedural gradient
imageBlendOpacity: number;             // 0–1, default 1.0
```

### New types

```typescript
type ImageBlendMode = "replace" | "normal" | "multiply" | "screen" | "overlay";
```

- `"replace"` — image IS the gradient (used when gradientType === "image")
- `"normal" | "multiply" | "screen" | "overlay"` — blend image over procedural gradient

### 9th gradient type

`"image"` added to the `gradientType` union. Shader type int = 8. When selected, the shader samples `u_imageTexture` instead of computing procedural color. All existing effects apply on top.

### Behavior matrix

| gradientType | imageData set | distortionMapEnabled | Result |
|---|---|---|---|
| `"image"` | yes | no | Image is the color source (5.1) |
| `"image"` | yes | yes | Image color + distortion displacement (5.1 + 5.2) |
| `"image"` | no | no | Fallback: solid black (show upload prompt in UI) |
| any other | yes | no | Procedural gradient blended with image (5.3) |
| any other | no | yes | Procedural gradient with distortion map displacement (5.2) |
| any other | yes | yes | All three: distortion → procedural → image blend (5.1+5.2+5.3) |
| any other | no | no | Normal behavior, no change |

### Defaults for `createDefaultLayer()`

All new fields default to off/null:
```typescript
imageData: null,
imageScale: 1.0,
imageOffset: [0, 0],
distortionMapData: null,
distortionMapEnabled: false,
distortionMapIntensity: 0.3,
imageBlendMode: "replace",
imageBlendOpacity: 1.0,
```

### Persistence

- **localStorage projects:** `imageData` and `distortionMapData` stored as base64 data URLs in the layer JSON
- **Shareable URLs:** Image data excluded (too large for URL hash). Only procedural settings shared. If a shared URL references type "image" with no imageData, editor shows the upload prompt.
- **Undo/redo:** Image data changes tracked in snapshot history (same as color changes)

---

## 2. Engine & Texture Management

### Texture cache (`lib/engine.ts`)

```typescript
// New properties on GradientEngine
private textureCache: Map<string, WebGLTexture>;   // hash(dataURL) → GPU texture
private textureRefCount: Map<string, number>;       // hash → number of layers referencing it
```

### Texture lifecycle

1. **Load:** When a layer has `imageData` or `distortionMapData`, engine hashes the data URL, checks cache. Cache miss → `createTextureFromDataURL()`. Cache hit → reuse existing WebGLTexture.
2. **Bind:** During per-layer render, bind color image to texture unit 1 (`u_imageTexture`), distortion map to texture unit 2 (`u_distortionMap`). Unit 0 reserved for `u_prevFrame` (feedback loop).
3. **Cleanup:** After each frame, compare cache keys against all layer references. Orphaned textures → `gl.deleteTexture()`.

### Image preprocessing

Before creating a GPU texture from a data URL:
- Decode via `Image` element + `onload`
- If either dimension > 2048px, resize via offscreen `<canvas>` maintaining aspect ratio
- Format: `RGBA` / `UNSIGNED_BYTE`
- Filtering: `LINEAR`
- Wrapping: `CLAMP_TO_EDGE`
- Flip: `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`

### Cache key

Use the full data URL string as the cache `Map` key. Data URLs are immutable (same image = same string), so no hashing needed — `Map` handles string equality natively. This avoids hash collision risk entirely.

### New uniforms

```
u_imageTexture              sampler2D     (texture unit 1)
u_distortionMap             sampler2D     (texture unit 2)
u_hasImage                  float         (0.0 or 1.0)
u_hasDistortionMap          float         (0.0 or 1.0)
u_imageScale                float
u_imageOffset               vec2
u_distortionMapIntensity    float
u_imageBlendMode            int           (0=replace, 1=normal, 2=multiply, 3=screen, 4=overlay)
u_imageBlendOpacity         float
```

### typeMap update

```typescript
{ mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4, dither: 5, scanline: 6, glitch: 7, image: 8 }
```

### setLayerUniforms() changes

Extended to:
1. Read `imageData`, `distortionMapData`, and all image params from the current layer
2. Look up (or create) textures in cache
3. Bind to appropriate texture units
4. Set all new uniforms
5. Set `u_hasImage` / `u_hasDistortionMap` flags based on whether textures exist

---

## 3. Shader Integration

### Fragment shader (`lib/shaders/fragment.glsl`)

#### New uniforms block (add after existing uniforms)

```glsl
uniform sampler2D u_imageTexture;
uniform sampler2D u_distortionMap;
uniform float u_hasImage;
uniform float u_hasDistortionMap;
uniform float u_imageScale;
uniform vec2 u_imageOffset;
uniform float u_distortionMapIntensity;
uniform int u_imageBlendMode;
uniform float u_imageBlendOpacity;
```

#### New function: `imageGradient()` (type 8)

```glsl
vec3 imageGradient(vec2 uv, float time) {
    vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;
    // Mouse displacement before sampling
    if (u_mouseReact > 0.01) {
        imgUV = fluidDisplace(imgUV, u_mouseSmooth, u_mouseVelocity, u_mouseReact);
    }
    return texture(u_imageTexture, clamp(imgUV, 0.0, 1.0)).rgb;
}
```

Added to `computeGradient()` dispatch:
```glsl
else if (u_gradientType == 8) return imageGradient(uv, time);
```

#### Distortion map — applied in `main()` before `computeGradient()`

```glsl
if (u_hasDistortionMap > 0.5) {
    vec2 distSample = texture(u_distortionMap, uv).rg;
    uv += (distSample - 0.5) * u_distortionMapIntensity;
}
```

Works with ALL gradient types. Applied before curl noise and kaleidoscope so everything chains.

#### Image blend — applied in `main()` after `computeGradient()`, before post-processing

```glsl
if (u_hasImage > 0.5 && u_gradientType != 8) {
    vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;
    vec4 imgSample = texture(u_imageTexture, clamp(imgUV, 0.0, 1.0));
    vec3 imgColor = imgSample.rgb;
    float imgAlpha = imgSample.a * u_imageBlendOpacity;

    if (u_imageBlendMode == 0) col = imgColor;                                    // replace
    else if (u_imageBlendMode == 1) col = mix(col, imgColor, imgAlpha);            // normal
    else if (u_imageBlendMode == 2) col = mix(col, col * imgColor, imgAlpha);      // multiply
    else if (u_imageBlendMode == 3) col = mix(col, 1.0 - (1.0 - col) * (1.0 - imgColor), imgAlpha);  // screen
    else if (u_imageBlendMode == 4) {                                              // overlay
        vec3 ov = mix(2.0 * col * imgColor,
                      1.0 - 2.0 * (1.0 - col) * (1.0 - imgColor),
                      step(0.5, col));
        col = mix(col, ov, imgAlpha);
    }
}
```

#### Updated pipeline order in `main()`

1. Distortion map UV displacement ← NEW
2. Curl noise UV distortion
3. Kaleidoscope
4. `computeGradient()` (type 8 = image sampling)
5. Image blend over procedural gradient ← NEW (if image present and type ≠ 8)
6. Noise overlay
7. Reaction-diffusion
8. Chromatic aberration
9. Hue shift → saturation → brightness
10. Bloom → vignette
11. Gaussian blur → radial blur
12. Feedback loop
13. Film grain → tone mapping
14. Pixel sorting → ordered dithering
15. Output with layer opacity

---

## 4. UI — GradientPanel

### Gradient type dropdown

Add "Image" as 9th option in `GRADIENT_OPTIONS`:
```typescript
{ value: "image", label: "Image", icon: "🖼" }  // or appropriate icon
```

### Image upload section (visible when gradientType === "image" OR imageData is set)

Appears below the type dropdown, above colors:

```
┌─────────────────────────────┐
│  [drag-and-drop zone]       │
│  Drop image or click to     │
│  upload (PNG, JPG, WebP)    │
│                             │
│  [thumbnail preview]        │  ← shows after upload, click to remove
│                             │
│  Scale ────────●──── 1.0    │
│  Offset X ──●──────── 0.0   │
│  Offset Y ──●──────── 0.0   │
│                             │
│  ☐ Distortion Map           │  ← checkbox, reveals second upload
│  [drag-and-drop zone]       │  ← only visible when checked
│  Intensity ──●────── 0.3    │
│                             │
│  Blend Mode [Normal ▾]      │  ← only visible when type ≠ "image"
│  Blend Opacity ──────● 1.0  │  ← only visible when type ≠ "image"
└─────────────────────────────┘
```

### Conditional visibility rules

| Control | Visible when |
|---|---|
| Upload zone + preview | always (in image section) |
| Scale, Offset X/Y | `imageData` is set |
| Distortion Map checkbox | always (in image section) |
| Distortion upload + intensity | `distortionMapEnabled === true` |
| Blend Mode dropdown | `gradientType !== "image"` AND `imageData` is set |
| Blend Opacity slider | `gradientType !== "image"` AND `imageData` is set |
| Color palette | hidden when `gradientType === "image"` (colors come from the image) |

### Image section visibility

The image section itself appears when:
- `gradientType === "image"` — always show (it's the primary input)
- Any other type — show as a collapsible "Texture Overlay" section below colors

### File handling

- Accept: `image/png, image/jpeg, image/webp`
- Read via `FileReader.readAsDataURL()`
- Resize to max 2048px via offscreen canvas before storing
- Store result in `layer.imageData` via `setLayerParam()`
- Use `setDiscrete()` for image upload/remove (undo-trackable one-shot)

---

## 5. Store Changes

### `lib/store.ts`

**randomize():** Add `"image"` to the types array. When randomized to "image" with no imageData, skip to next type (image mode requires an explicit upload).

**New store actions:**
```typescript
setLayerImage: (layerIndex: number, dataURL: string | null) => void;
setLayerDistortionMap: (layerIndex: number, dataURL: string | null) => void;
```

These are convenience wrappers around `setLayerParam()` that use `setDiscrete()` since image upload is a one-shot action.

**Derived fields:** No new top-level derived fields needed. Image params are accessed via `layers[activeLayerIndex]` directly.

**URL encoding (`lib/url.ts`):** Exclude `imageData` and `distortionMapData` from URL serialization. Include all other image params (scale, offset, blend mode, etc.) so the procedural settings survive sharing.

**Project persistence (`lib/projects.ts`):** No changes needed — `imageData` and `distortionMapData` are already on the layer object and will serialize to localStorage JSON naturally. Large base64 strings may push localStorage limits — add a try/catch on save with a toast warning if quota exceeded.

---

## 6. Files Changed

| File | Changes |
|---|---|
| `lib/layers.ts` | Add image fields to `LayerParams`, `ImageBlendMode` type, `"image"` to gradientType union, defaults |
| `lib/store.ts` | Add `"image"` to randomize types, `setLayerImage()`, `setLayerDistortionMap()` actions |
| `lib/engine.ts` | Texture cache + ref counting, `createTextureFromDataURL()`, bind to units 1/2, new uniforms, cleanup |
| `lib/shaders/fragment.glsl` | New uniforms, `imageGradient()` function, distortion map in main(), image blend in main(), dispatch case 8 |
| `components/GradientPanel.tsx` | "Image" in GRADIENT_OPTIONS, upload zone, thumbnail preview, scale/offset sliders, distortion map toggle, blend controls |
| `lib/url.ts` | Exclude imageData/distortionMapData from serialization |
| `lib/projects.ts` | Add try/catch for localStorage quota on save |

---

## 7. Constraints

- **No server uploads** — images stay client-side via FileReader API
- **Max 2048×2048** — resize before GPU upload for memory safety
- **No shader recompilation** — all image features driven by uniforms and texture presence flags
- **Texture unit allocation:** 0 = feedback prevFrame, 1 = color image, 2 = distortion map
- **Per-layer textures** — each layer independently owns its image and distortion map references
- **Shared GPU textures** — identical images across layers share one WebGLTexture via cache
- **URL sharing excludes images** — only procedural params travel in the URL hash
