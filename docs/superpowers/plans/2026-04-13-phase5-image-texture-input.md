# Phase 5: Image & Texture Input — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let designers upload images as color sources, distortion maps, or blend targets — with all existing effects applied on top.

**Architecture:** New "image" gradient type (type 8) samples from an uploaded texture instead of computing procedural color. A texture overlay system lets any gradient type blend with an uploaded image or use a grayscale distortion map for UV displacement. Per-layer image storage with a shared GPU texture cache in the engine.

**Tech Stack:** WebGL 2 (raw), TypeScript, Zustand, Next.js 14, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-phase5-image-texture-input-design.md`

---

## File Structure

| File | Role |
|---|---|
| `lib/layers.ts` | Add `ImageBlendMode` type, image fields to `LayerParams`, update `gradientType` union, update defaults |
| `lib/store.ts` | Add `"image"` to randomize, add `setLayerImage()` / `setLayerDistortionMap()` actions |
| `lib/engine.ts` | Texture cache, `loadImageTexture()`, bind to texture units 1/2, new uniforms in `cacheUniforms()` / `setLayerUniforms()`, cleanup |
| `lib/shaders/fragment.glsl` | New uniforms, `imageGradient()` function, distortion map + image blend in `main()`, dispatch case 8 |
| `components/GradientPanel.tsx` | "Image" option, upload zone, thumbnail, scale/offset sliders, distortion map toggle, blend controls |
| `lib/url.ts` | Strip `imageData` / `distortionMapData` from URL encoding |
| `lib/projects.ts` | Try/catch on localStorage save for quota errors |

---

## Task 1: Data Model — LayerParams & Types

**Files:**
- Modify: `lib/layers.ts:1-41`

- [ ] **Step 1: Add `ImageBlendMode` type and update `gradientType` union**

In `lib/layers.ts`, add the new type and update the interface:

```typescript
export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "add";

export type ImageBlendMode = "replace" | "normal" | "multiply" | "screen" | "overlay";

export interface LayerParams {
  gradientType: "mesh" | "radial" | "linear" | "conic" | "plasma" | "dither" | "scanline" | "glitch" | "image";
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  colors: [number, number, number][];
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  // Image / texture
  imageData: string | null;
  imageScale: number;
  imageOffset: [number, number];
  distortionMapData: string | null;
  distortionMapEnabled: boolean;
  distortionMapIntensity: number;
  imageBlendMode: ImageBlendMode;
  imageBlendOpacity: number;
}
```

- [ ] **Step 2: Update `DEFAULT_LAYER` and `createLayer()`**

Update the default layer to include image field defaults:

```typescript
export const DEFAULT_LAYER: LayerParams = {
  gradientType: "mesh",
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  colors: [
    [0.388, 0.357, 1.0],
    [1.0, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  opacity: 1.0,
  blendMode: "normal",
  visible: true,
  imageData: null,
  imageScale: 1.0,
  imageOffset: [0, 0],
  distortionMapData: null,
  distortionMapEnabled: false,
  distortionMapIntensity: 0.3,
  imageBlendMode: "replace",
  imageBlendOpacity: 1.0,
};
```

No changes needed to `createLayer()` — the spread of `DEFAULT_LAYER` already covers new fields.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Compilation errors in `store.ts` and `engine.ts` where `gradientType` union is used (this is expected — we'll fix in subsequent tasks). If the error is only in downstream files, this task is correct.

- [ ] **Step 4: Commit**

```bash
git add lib/layers.ts
git commit -m "feat(phase5): add image fields to LayerParams and ImageBlendMode type"
```

---

## Task 2: Store — Randomize & Image Actions

**Files:**
- Modify: `lib/store.ts:374-401` (randomize), `lib/store.ts:475-486` (setLayerParam area)

- [ ] **Step 1: Add `"image"` to randomize types array — but skip if no imageData**

In `lib/store.ts`, update the `randomize` action. Change the types array at line 382 and add skip logic:

```typescript
  randomize: () => {
    const count = 3 + Math.floor(Math.random() * 3);
    const baseHue = Math.random() * 360;
    const colors: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const hue = (baseHue + i * (360 / count) + (Math.random() - 0.5) * 30) % 360;
      colors.push(hslToRgb(hue, 0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3));
    }
    // Exclude "image" from randomize — it requires an explicit upload
    const types: LayerParams["gradientType"][] = ["mesh", "radial", "linear", "conic", "plasma", "dither", "scanline", "glitch"];
    const gradientType = types[Math.floor(Math.random() * types.length)];
    const speed = 0.2 + Math.random() * 0.8;
    const complexity = 2 + Math.floor(Math.random() * 4);
    const scale = 0.5 + Math.random() * 2;
    const distortion = Math.random() * 0.6;

    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex
        ? { ...l, colors, gradientType, speed, complexity, scale, distortion }
        : l
    );
    rawSet({
      layers: newLayers,
      ...deriveActiveLayerFields(newLayers, current.activeLayerIndex),
    });
  },
```

Note: The types array is unchanged from current code — "image" is intentionally excluded. This step just ensures the randomize function stays correct after the `LayerParams` type change.

- [ ] **Step 2: Add `setLayerImage` and `setLayerDistortionMap` actions**

Add these to the `GradientState` interface (after `moveLayer` at line 93):

```typescript
  // Image actions
  setLayerImage: (layerIndex: number, dataURL: string | null) => void;
  setLayerDistortionMap: (layerIndex: number, dataURL: string | null) => void;
```

Add to `HISTORY_EXCLUDE_KEYS` array:

```typescript
  "setLayerImage", "setLayerDistortionMap",
```

Add the implementations after `moveLayer` (after line 535):

```typescript
  setLayerImage: (layerIndex, dataURL) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === layerIndex ? { ...l, imageData: dataURL } : l
    );
    rawSet({ layers: newLayers });
  },

  setLayerDistortionMap: (layerIndex, dataURL) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === layerIndex ? { ...l, distortionMapData: dataURL } : l
    );
    rawSet({ layers: newLayers });
  },
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: May still fail on engine.ts (typeMap doesn't include "image" yet). Store should compile clean.

- [ ] **Step 4: Commit**

```bash
git add lib/store.ts
git commit -m "feat(phase5): add setLayerImage/setLayerDistortionMap store actions"
```

---

## Task 3: Engine — Texture Cache & Loading

**Files:**
- Modify: `lib/engine.ts:8-29` (class properties), `lib/engine.ts:95-124` (cacheUniforms), `lib/engine.ts:203-219` (setLayerUniforms), `lib/engine.ts:419-424` (destroy)

- [ ] **Step 1: Add texture cache properties and loading method**

Add after line 28 (after `feedbackHeight`):

```typescript
  // Image texture cache
  private textureCache: Map<string, WebGLTexture> = new Map();
  private pendingLoads: Set<string> = new Set();
```

Add the texture loading method after `destroyFeedbackFBOs()` (after line 186):

```typescript
  loadImageTexture(dataURL: string): WebGLTexture | null {
    // Return cached texture if available
    if (this.textureCache.has(dataURL)) {
      return this.textureCache.get(dataURL)!;
    }

    // If already loading, return null (will be available next frame)
    if (this.pendingLoads.has(dataURL)) {
      return null;
    }

    // Start async load
    this.pendingLoads.add(dataURL);
    const img = new Image();
    img.onload = () => {
      this.pendingLoads.delete(dataURL);
      const gl = this.gl;

      // Resize if needed (max 2048px)
      let source: TexImageSource = img;
      if (img.width > 2048 || img.height > 2048) {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(2048 / img.width, 2048 / img.height);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        source = canvas;
      }

      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, null);

      this.textureCache.set(dataURL, tex);
    };
    img.src = dataURL;

    return null; // Not ready yet — will appear in cache next frame
  }

  cleanupTextures(layers: LayerParams[]) {
    // Collect all data URLs referenced by layers
    const referenced = new Set<string>();
    for (const layer of layers) {
      if (layer.imageData) referenced.add(layer.imageData);
      if (layer.distortionMapData) referenced.add(layer.distortionMapData);
    }

    // Delete orphaned textures
    for (const [key, tex] of this.textureCache) {
      if (!referenced.has(key)) {
        this.gl.deleteTexture(tex);
        this.textureCache.delete(key);
      }
    }
  }
```

- [ ] **Step 2: Add new uniform names to `cacheUniforms()`**

In `cacheUniforms()` at line 97, add to the `names` array:

```typescript
    const names = [
      "u_time", "u_resolution", "u_mouse", "u_gradientType",
      "u_speed", "u_complexity", "u_scale", "u_distortion",
      "u_brightness", "u_saturation", "u_colorCount",
      "u_noiseEnabled", "u_noiseIntensity", "u_noiseScale", "u_grain",
      "u_mouseReact",
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette", "u_radialBlurAmount",
      "u_blurEnabled", "u_blurAmount",
      "u_mouseSmooth", "u_mouseVelocity", "u_colorBlend",
      "u_chromaticAberration", "u_hueShift",
      "u_asciiEnabled", "u_asciiSize", "u_ditherEnabled", "u_ditherSize",
      "u_layerOpacity", "u_isBaseLayer",
      "u_curlEnabled", "u_curlIntensity", "u_curlScale",
      "u_kaleidoscopeEnabled", "u_kaleidoscopeSegments", "u_kaleidoscopeRotation",
      "u_reactionDiffEnabled", "u_reactionDiffIntensity", "u_reactionDiffScale",
      "u_pixelSortEnabled", "u_pixelSortIntensity", "u_pixelSortThreshold",
      "u_domainWarp",
      "u_feedbackEnabled", "u_feedbackDecay", "u_prevFrame",
      // Image/texture uniforms
      "u_imageTexture", "u_distortionMap",
      "u_hasImage", "u_hasDistortionMap",
      "u_imageScale", "u_imageOffset",
      "u_distortionMapIntensity",
      "u_imageBlendMode", "u_imageBlendOpacity",
    ];
```

- [ ] **Step 3: Update `setLayerUniforms()` — add `image: 8` to typeMap and bind textures**

Replace the `setLayerUniforms` method:

```typescript
  private setLayerUniforms(layer: LayerParams) {
    const gl = this.gl;
    const typeMap: Record<string, number> = {
      mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4,
      dither: 5, scanline: 6, glitch: 7, image: 8,
    };
    this.seti("u_gradientType", typeMap[layer.gradientType]);
    this.setf("u_speed", layer.speed);
    this.setf("u_complexity", layer.complexity);
    this.setf("u_scale", layer.scale);
    this.setf("u_distortion", layer.distortion);
    this.seti("u_colorCount", layer.colors.length);
    for (let i = 0; i < 8; i++) {
      const key = `u_colors[${i}]`;
      if (this.uniforms[key] !== undefined && i < layer.colors.length) {
        gl.uniform3fv(this.uniforms[key], layer.colors[i]);
      }
    }
    this.setf("u_layerOpacity", layer.opacity);

    // Image texture (unit 1)
    const imageTex = layer.imageData ? this.loadImageTexture(layer.imageData) : null;
    if (imageTex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, imageTex);
      this.seti("u_imageTexture", 1);
      this.setf("u_hasImage", 1.0);
    } else {
      this.setf("u_hasImage", 0.0);
    }

    // Distortion map (unit 2)
    const distortionTex = (layer.distortionMapEnabled && layer.distortionMapData)
      ? this.loadImageTexture(layer.distortionMapData)
      : null;
    if (distortionTex) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, distortionTex);
      this.seti("u_distortionMap", 2);
      this.setf("u_hasDistortionMap", 1.0);
    } else {
      this.setf("u_hasDistortionMap", 0.0);
    }

    // Image transform uniforms
    this.setf("u_imageScale", layer.imageScale);
    this.set2f("u_imageOffset", layer.imageOffset[0], layer.imageOffset[1]);
    this.setf("u_distortionMapIntensity", layer.distortionMapIntensity);

    // Blend mode: replace=0, normal=1, multiply=2, screen=3, overlay=4
    const blendModeMap: Record<string, number> = {
      replace: 0, normal: 1, multiply: 2, screen: 3, overlay: 4,
    };
    this.seti("u_imageBlendMode", blendModeMap[layer.imageBlendMode]);
    this.setf("u_imageBlendOpacity", layer.imageBlendOpacity);
  }
```

- [ ] **Step 4: Update `render()` to clean up textures**

In the `render()` method, add cleanup at the end (before the feedback blit section, around line 345):

```typescript
    // Clean up unused cached textures
    this.cleanupTextures(state.layers);
```

- [ ] **Step 5: Update `destroy()` to clean up texture cache**

In `destroy()` at line 419, add texture cleanup:

```typescript
  destroy() {
    this.stopLoop();
    this.destroyFeedbackFBOs();
    // Clean up texture cache
    for (const tex of this.textureCache.values()) {
      this.gl.deleteTexture(tex);
    }
    this.textureCache.clear();
    if (this.program) this.gl.deleteProgram(this.program);
  }
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: Should fail only on shader (fragment.glsl doesn't declare the new uniforms yet). Engine and store should compile.

- [ ] **Step 7: Commit**

```bash
git add lib/engine.ts
git commit -m "feat(phase5): texture cache, image loading, and per-layer texture binding"
```

---

## Task 4: Fragment Shader — Uniforms, imageGradient, Distortion, Blend

**Files:**
- Modify: `lib/shaders/fragment.glsl:1-62` (uniforms), `lib/shaders/fragment.glsl:646-659` (computeGradient), `lib/shaders/fragment.glsl:665-706` (main)

- [ ] **Step 1: Add new uniform declarations**

After line 61 (`uniform sampler2D u_prevFrame;`), add:

```glsl
// Image / texture
uniform sampler2D u_imageTexture;
uniform sampler2D u_distortionMap;
uniform float u_hasImage;
uniform float u_hasDistortionMap;
uniform float u_imageScale;
uniform vec2 u_imageOffset;
uniform float u_distortionMapIntensity;
uniform int u_imageBlendMode;  // 0=replace, 1=normal, 2=multiply, 3=screen, 4=overlay
uniform float u_imageBlendOpacity;
```

- [ ] **Step 2: Add `imageGradient()` function**

Add before `computeGradient()` (before line 646), after the `glitchGradient()` function:

```glsl
// ============================================================
// Image Gradient (type 8) — samples uploaded texture
// ============================================================

vec3 imageGradient(vec2 uv, float time) {
  vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;

  // Apply mouse displacement before sampling
  if (u_mouseReact > 0.01) {
    vec2 mouseDir = imgUV - u_mouseSmooth;
    float mouseDist = length(mouseDir);
    float mouseRadius = 0.35 * u_mouseReact;
    if (mouseDist < mouseRadius) {
      float strength = (1.0 - mouseDist / mouseRadius);
      strength *= strength;
      vec2 vel = u_mouseVelocity;
      imgUV += (mouseDir / (mouseDist + 0.001)) * strength * 0.05 * u_mouseReact;
      imgUV += vel * strength * 0.01;
    }
  }

  return texture(u_imageTexture, clamp(imgUV, 0.0, 1.0)).rgb;
}
```

- [ ] **Step 3: Update `computeGradient()` dispatch**

Change the `computeGradient` function (line 650-659) to add case 8:

```glsl
vec3 computeGradient(vec2 uv, float time) {
  if (u_gradientType == 0) return meshGradient(uv, time);
  else if (u_gradientType == 1) return radialGradient(uv, time);
  else if (u_gradientType == 2) return linearGradient(uv, time);
  else if (u_gradientType == 3) return conicGradient(uv, time);
  else if (u_gradientType == 4) return plasmaGradient(uv, time);
  else if (u_gradientType == 5) return ditherGradient(uv, time);
  else if (u_gradientType == 6) return scanlineGradient(uv, time);
  else if (u_gradientType == 7) return glitchGradient(uv, time);
  else return imageGradient(uv, time);
}
```

- [ ] **Step 4: Add distortion map UV displacement in `main()`**

In `main()`, add BEFORE the curl noise block (before line 669, after `float time = u_time * u_speed;`):

```glsl
  // Distortion map UV displacement (applied first, chains with everything)
  if (u_hasDistortionMap > 0.5) {
    vec2 distSample = texture(u_distortionMap, uv).rg;
    uv += (distSample - 0.5) * u_distortionMapIntensity;
  }
```

- [ ] **Step 5: Add image blend over procedural gradient in `main()`**

In `main()`, add AFTER the radial blur / `computeGradient()` block (after line 705, where `color` is assigned) and BEFORE the noise overlay (before line 708):

```glsl
  // Image blend over procedural gradient (5.3 — when type != image but image is uploaded)
  if (u_hasImage > 0.5 && u_gradientType != 8) {
    vec2 imgUV = (uv - 0.5) / u_imageScale + 0.5 + u_imageOffset;
    vec4 imgSample = texture(u_imageTexture, clamp(imgUV, 0.0, 1.0));
    vec3 imgColor = imgSample.rgb;
    float imgAlpha = imgSample.a * u_imageBlendOpacity;

    if (u_imageBlendMode == 0) color = imgColor;
    else if (u_imageBlendMode == 1) color = mix(color, imgColor, imgAlpha);
    else if (u_imageBlendMode == 2) color = mix(color, color * imgColor, imgAlpha);
    else if (u_imageBlendMode == 3) color = mix(color, 1.0 - (1.0 - color) * (1.0 - imgColor), imgAlpha);
    else if (u_imageBlendMode == 4) {
      vec3 ov = mix(2.0 * color * imgColor,
                    1.0 - 2.0 * (1.0 - color) * (1.0 - imgColor),
                    step(0.5, color));
      color = mix(color, ov, imgAlpha);
    }
  }
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS. All shader uniforms now match engine bindings. All TypeScript types align.

- [ ] **Step 7: Commit**

```bash
git add lib/shaders/fragment.glsl
git commit -m "feat(phase5): imageGradient, distortion map displacement, and image blend in shader"
```

---

## Task 5: GradientPanel UI — Image Upload & Controls

**Files:**
- Modify: `components/GradientPanel.tsx:1-93`

- [ ] **Step 1: Add "Image" to GRADIENT_OPTIONS**

Update the array at line 8:

```typescript
const GRADIENT_OPTIONS = [
  { value: "mesh", label: "Mesh" },
  { value: "radial", label: "Radial" },
  { value: "linear", label: "Linear" },
  { value: "conic", label: "Conic" },
  { value: "plasma", label: "Plasma" },
  { value: "dither", label: "Dither" },
  { value: "scanline", label: "Scanline" },
  { value: "glitch", label: "Glitch" },
  { value: "image", label: "Image" },
];
```

- [ ] **Step 2: Add image resize utility function**

Add before the `GradientPanel` component:

```typescript
const MAX_IMAGE_SIZE = 2048;

function resizeAndLoadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= MAX_IMAGE_SIZE && img.height <= MAX_IMAGE_SIZE) {
          resolve(reader.result as string);
          return;
        }
        const ratio = Math.min(MAX_IMAGE_SIZE / img.width, MAX_IMAGE_SIZE / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 3: Add ImageUpload component**

Add before the `GradientPanel` component:

```typescript
function ImageUpload({
  label,
  imageData,
  onUpload,
  onRemove,
}: {
  label: string;
  imageData: string | null;
  onUpload: (dataURL: string) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataURL = await resizeAndLoadImage(file);
    onUpload(dataURL);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (imageData) {
    return (
      <div className="relative group">
        <img
          src={imageData}
          alt={label}
          className="w-full h-24 object-cover rounded-md border border-border"
        />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-surface/80 text-text-secondary
            hover:bg-error hover:text-white text-xs flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer
          hover:border-accent hover:bg-accent/5 transition-colors"
      >
        <p className="text-xs text-text-tertiary">
          Drop image or click to upload
        </p>
        <p className="text-[10px] text-text-tertiary mt-1">PNG, JPG, WebP</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </>
  );
}
```

Add the `React` import at the top of the file:

```typescript
import React from "react";
```

- [ ] **Step 4: Add image section to GradientPanel**

Replace the entire `GradientPanel` component with:

```typescript
export default function GradientPanel() {
  const store = useGradientStore();
  const activeLayer = store.layers[store.activeLayerIndex];
  const isImageType = store.gradientType === "image";

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Type */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Type</SectionHeader>
        <Select
          label="Gradient Type"
          value={store.gradientType}
          options={GRADIENT_OPTIONS}
          onChange={(v) => store.setDiscrete({ gradientType: v as typeof store.gradientType })}
        />
      </div>

      {/* Image Upload — shown when type is "image" */}
      {isImageType && (
        <>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-3">
            <SectionHeader>Image Source</SectionHeader>
            <ImageUpload
              label="Color image"
              imageData={activeLayer.imageData}
              onUpload={(url) => store.setLayerImage(store.activeLayerIndex, url)}
              onRemove={() => store.setLayerImage(store.activeLayerIndex, null)}
            />
            {activeLayer.imageData && (
              <>
                <Slider label="Scale" value={activeLayer.imageScale} min={0.1} max={4} step={0.01}
                  onChange={(v) => {
                    const newLayers = store.layers.map((l, i) =>
                      i === store.activeLayerIndex ? { ...l, imageScale: v } : l
                    );
                    store.set({ layers: newLayers } as Partial<typeof store>);
                  }}
                  onCommit={() => store.commitSet()} />
                <Slider label="Offset X" value={activeLayer.imageOffset[0]} min={-1} max={1} step={0.01}
                  onChange={(v) => {
                    const newLayers = store.layers.map((l, i) =>
                      i === store.activeLayerIndex ? { ...l, imageOffset: [v, l.imageOffset[1]] as [number, number] } : l
                    );
                    store.set({ layers: newLayers } as Partial<typeof store>);
                  }}
                  onCommit={() => store.commitSet()} />
                <Slider label="Offset Y" value={activeLayer.imageOffset[1]} min={-1} max={1} step={0.01}
                  onChange={(v) => {
                    const newLayers = store.layers.map((l, i) =>
                      i === store.activeLayerIndex ? { ...l, imageOffset: [l.imageOffset[0], v] as [number, number] } : l
                    );
                    store.set({ layers: newLayers } as Partial<typeof store>);
                  }}
                  onCommit={() => store.commitSet()} />
              </>
            )}
          </div>
        </>
      )}

      <div className="border-t border-border" />

      {/* Colors — hidden when type is "image" */}
      {!isImageType && (
        <>
          <div className="flex flex-col gap-2">
            <SectionHeader>Colors</SectionHeader>
            {(store.colors as [number, number, number][]).map((color, i) => (
              <ColorInput
                key={i}
                color={color}
                onChange={(c) => store.setColor(i, c)}
                onCommit={() => store.commitSet()}
                onRemove={() => store.removeColor(i)}
                canRemove={store.colors.length > 2}
              />
            ))}
            {store.colors.length < 8 && (
              <button
                onClick={() => store.addColor()}
                className="text-xs text-text-tertiary hover:text-accent transition-colors py-1"
              >
                + Add Color
              </button>
            )}
          </div>

          <div className="border-t border-border" />
        </>
      )}

      {/* Texture Overlay — shown for non-image types */}
      {!isImageType && (
        <>
          <div className="flex flex-col gap-3">
            <SectionHeader>Texture Overlay</SectionHeader>
            <ImageUpload
              label="Blend image"
              imageData={activeLayer.imageData}
              onUpload={(url) => store.setLayerImage(store.activeLayerIndex, url)}
              onRemove={() => store.setLayerImage(store.activeLayerIndex, null)}
            />
            {activeLayer.imageData && (
              <>
                <Select
                  label="Blend Mode"
                  value={activeLayer.imageBlendMode}
                  options={[
                    { value: "normal", label: "Normal" },
                    { value: "multiply", label: "Multiply" },
                    { value: "screen", label: "Screen" },
                    { value: "overlay", label: "Overlay" },
                    { value: "replace", label: "Replace" },
                  ]}
                  onChange={(v) => store.setLayerParam({ imageBlendMode: v as LayerParams["imageBlendMode"] })}
                />
                <Slider label="Blend Opacity" value={activeLayer.imageBlendOpacity} min={0} max={1} step={0.01}
                  onChange={(v) => {
                    const newLayers = store.layers.map((l, i) =>
                      i === store.activeLayerIndex ? { ...l, imageBlendOpacity: v } : l
                    );
                    store.set({ layers: newLayers } as Partial<typeof store>);
                  }}
                  onCommit={() => store.commitSet()} />
                <Slider label="Image Scale" value={activeLayer.imageScale} min={0.1} max={4} step={0.01}
                  onChange={(v) => {
                    const newLayers = store.layers.map((l, i) =>
                      i === store.activeLayerIndex ? { ...l, imageScale: v } : l
                    );
                    store.set({ layers: newLayers } as Partial<typeof store>);
                  }}
                  onCommit={() => store.commitSet()} />
              </>
            )}
          </div>

          <div className="border-t border-border" />
        </>
      )}

      {/* Distortion Map — available for all types */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Distortion Map</SectionHeader>
        <Toggle
          label="Enable Distortion Map"
          checked={activeLayer.distortionMapEnabled}
          onChange={(v) => store.setLayerParam({ distortionMapEnabled: v })}
        />
        {activeLayer.distortionMapEnabled && (
          <>
            <ImageUpload
              label="Distortion map"
              imageData={activeLayer.distortionMapData}
              onUpload={(url) => store.setLayerDistortionMap(store.activeLayerIndex, url)}
              onRemove={() => store.setLayerDistortionMap(store.activeLayerIndex, null)}
            />
            {activeLayer.distortionMapData && (
              <Slider label="Intensity" value={activeLayer.distortionMapIntensity} min={0} max={1} step={0.01}
                onChange={(v) => {
                  const newLayers = store.layers.map((l, i) =>
                    i === store.activeLayerIndex ? { ...l, distortionMapIntensity: v } : l
                  );
                  store.set({ layers: newLayers } as Partial<typeof store>);
                }}
                onCommit={() => store.commitSet()} />
            )}
          </>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Animation */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Animation</SectionHeader>
        <Slider label="Speed" value={store.speed} min={0} max={2} step={0.01} onChange={(v) => store.set({ speed: v })} onCommit={() => store.commitSet()} />
        <Slider label="Complexity" value={store.complexity} min={1} max={8} step={1} onChange={(v) => store.set({ complexity: v })} onCommit={() => store.commitSet()} />
        <Slider label="Scale" value={store.scale} min={0.2} max={4} step={0.01} onChange={(v) => store.set({ scale: v })} onCommit={() => store.commitSet()} />
        <Slider label="Distortion" value={store.distortion} min={0} max={1} step={0.01} onChange={(v) => store.set({ distortion: v })} onCommit={() => store.commitSet()} />
        {store.gradientType === "mesh" && (
          <Slider label="Domain Warp" value={store.domainWarp} min={0} max={1} step={0.01} onChange={(v) => store.set({ domainWarp: v })} onCommit={() => store.commitSet()} />
        )}
      </div>

      <div className="border-t border-border" />

      {/* Appearance */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Appearance</SectionHeader>
        <Slider label="Brightness" value={store.brightness} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ brightness: v })} onCommit={() => store.commitSet()} />
        <Slider label="Saturation" value={store.saturation} min={0} max={2} step={0.01} onChange={(v) => store.set({ saturation: v })} onCommit={() => store.commitSet()} />
        <Slider label="Hue Shift" value={store.hueShift} min={0} max={360} step={1} onChange={(v) => store.set({ hueShift: v })} onCommit={() => store.commitSet()} />
      </div>
    </div>
  );
}
```

Add the missing imports at the top:

```typescript
import Toggle from "@/components/ui/Toggle";
import { LayerParams } from "@/lib/layers";
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/GradientPanel.tsx
git commit -m "feat(phase5): image upload UI, texture overlay, distortion map controls"
```

---

## Task 6: URL Encoding — Strip Image Data

**Files:**
- Modify: `lib/projects.ts:42-74` (exportProjectState)
- Modify: `lib/url.ts:4-13` (encodeState)

- [ ] **Step 1: Update `exportProjectState` to add new fields**

The `exportProjectState` function explicitly copies fields. The image data on layers will serialize automatically since we spread the layer object. However, for URL encoding we need to strip the large fields. Add a helper function in `lib/projects.ts` after the `exportProjectState` function:

```typescript
export function exportProjectStateForUrl(state: GradientState): ProjectState {
  const exported = exportProjectState(state);
  // Strip large image data from URL encoding
  exported.layers = exported.layers.map((l) => ({
    ...l,
    imageData: null,
    distortionMapData: null,
  }));
  return exported;
}
```

- [ ] **Step 2: Update `encodeState` in url.ts to use the URL-safe export**

In `lib/url.ts`, change the import and function:

```typescript
import { GradientState } from "./store";
import { exportProjectStateForUrl, ProjectState } from "./projects";

export function encodeState(state: GradientState): string {
  const data = exportProjectStateForUrl(state);
  const json = JSON.stringify(data);
  const base64 = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return base64;
}
```

- [ ] **Step 3: Add try/catch to `saveProject` for localStorage quota**

In `lib/projects.ts`, wrap the `localStorage.setItem` call in `saveProject`:

```typescript
export function saveProject(name: string, state: GradientState): void {
  const projects = loadProjects();
  const existing = projects.findIndex((p) => p.name === name);
  const entry: SavedProject = {
    name,
    timestamp: Date.now(),
    state: exportProjectState(state),
  };
  if (existing >= 0) {
    projects[existing] = entry;
  } else {
    projects.push(entry);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error("Storage quota exceeded. Try removing unused projects or images.");
    }
    throw e;
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/url.ts lib/projects.ts
git commit -m "feat(phase5): strip image data from URL encoding, localStorage quota handling"
```

---

## Task 7: Integration Test — Full Build & Manual Verification

**Files:**
- No file changes — verification only

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: PASS with zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings).

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Manual checks:
1. Open `/editor`
2. Select "Image" gradient type → upload zone appears, color palette hides
3. Upload a PNG → thumbnail preview shows, image renders on canvas
4. Adjust Scale slider → image zooms
5. Adjust Offset X/Y → image shifts
6. Switch to "Mesh" type → "Texture Overlay" section appears
7. Upload an image in Texture Overlay → procedural gradient blends with image
8. Change blend mode dropdown → visual change on canvas
9. Enable Distortion Map → upload zone appears
10. Upload a grayscale image → UV displacement visible on canvas
11. Click Randomize → does not select "image" type
12. Undo after image upload → image reverts
13. Save project → reload page → load project → image data persists
14. Share URL → URL doesn't contain massive base64 blob

- [ ] **Step 4: Commit integration verification**

```bash
git add -A
git commit -m "feat(phase5): image & texture input — complete"
```
