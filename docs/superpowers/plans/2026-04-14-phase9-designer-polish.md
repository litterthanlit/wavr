# Phase 9: Designer Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three features that transform Wavr into a professional design tool: a config-driven embed widget supporting all gradient modes, live gradient text masking, and a custom GLSL editor for power users.

**Architecture:** Text mask uses canvas-to-texture pipeline (same pattern as existing image textures). Custom GLSL editor injects user code into the fragment shader and recompiles on demand. Embed widget includes the full minified shader with a JSON config parser. All three features use the existing uniform-based rendering pipeline.

**Tech Stack:** WebGL 2, GLSL, TypeScript, Zustand, React, Tailwind CSS, Next.js 14

**Spec:** `docs/superpowers/specs/2026-04-14-phase9-designer-polish-design.md`

---

## File Structure

| File | Role |
|---|---|
| `lib/layers.ts` | Add text mask fields to `LayerParams` and `DEFAULT_LAYER` |
| `lib/store.ts` | Add `customGLSL` to `GradientState`, add to `HISTORY_EXCLUDE_KEYS` |
| `lib/engine.ts` | Add `updateTextMaskTexture()`, `setCustomShader()`, text mask + custom uniforms |
| `lib/shaders/fragment.glsl` | Add `u_textMaskEnabled`, `u_textMaskTexture`, `u_customEnabled` uniforms, `customGradient()` placeholder, text mask in `main()` |
| `lib/types.ts` | Add `"code"` to `SidebarTab` union |
| `lib/export.ts` | Add `generateEmbedConfig()`, `generateEmbedSnippet()`, update `exportCSS()` for text mask |
| `components/GradientPanel.tsx` | Add Text Mask section with text input, size/weight/spacing/align controls |
| `components/CustomGLSLPanel.tsx` | New — textarea, compile status, reset button, uniform reference |
| `components/Sidebar.tsx` | Add 4th "Code" tab |
| `components/Canvas.tsx` | Create offscreen canvas for text mask, wire to engine |
| `components/ExportModal.tsx` | Add "Embed Widget" export button |
| `app/editor/page.tsx` | Add `"4"` keyboard shortcut for Code tab |

---

## Task 1: Data Model — Text Mask Fields on LayerParams

**Files:**
- Modify: `lib/layers.ts`

- [ ] **Step 1: Add TextMaskAlign type and text mask fields to LayerParams**

After line 8 (`export type MaskBlendMode = ...`), add:

```typescript
export type TextMaskAlign = "left" | "center" | "right";
```

In the `LayerParams` interface, after `maskSmoothness: number;` (line 59), add:

```typescript
  // Text mask
  textMaskEnabled: boolean;
  textMaskContent: string;
  textMaskFontSize: number;
  textMaskFontWeight: number;
  textMaskLetterSpacing: number;
  textMaskAlign: TextMaskAlign;
```

- [ ] **Step 2: Add text mask defaults to DEFAULT_LAYER**

After `maskSmoothness: 0.1,` (line 89), add:

```typescript
  textMaskEnabled: false,
  textMaskContent: "",
  textMaskFontSize: 80,
  textMaskFontWeight: 700,
  textMaskLetterSpacing: 0,
  textMaskAlign: "center",
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Should compile. Downstream files may have type issues if they iterate all LayerParams keys, but layers.ts itself should be clean.

- [ ] **Step 4: Commit**

```bash
git add lib/layers.ts
git commit -m "feat(phase9): add text mask fields to LayerParams"
```

---

## Task 2: Store — Add customGLSL Field

**Files:**
- Modify: `lib/store.ts`

- [ ] **Step 1: Add customGLSL to GradientState interface**

After `timelinePosition: number;` (line 62), add:

```typescript
  // Custom GLSL
  customGLSL: string | null;
```

- [ ] **Step 2: Add customGLSL to HISTORY_EXCLUDE_KEYS**

After `"colors",` on line 117, add:

```typescript
  "customGLSL",
```

- [ ] **Step 3: Add customGLSL default to DEFAULTS**

After `timelinePosition: 0,` (line 240), add:

```typescript
  customGLSL: null,
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts
git commit -m "feat(phase9): add customGLSL field to store"
```

---

## Task 3: Fragment Shader — Text Mask & Custom GLSL Uniforms

**Files:**
- Modify: `lib/shaders/fragment.glsl`

- [ ] **Step 1: Add new uniform declarations**

After `uniform float u_maskSmoothness;` (line 96), add:

```glsl
// Text mask
uniform float u_textMaskEnabled;
uniform sampler2D u_textMaskTexture;

// Custom GLSL
uniform bool u_customEnabled;
```

- [ ] **Step 2: Add customGradient() placeholder**

Before the `computeGradient()` function (before line 854 `vec3 computeGradient`), add:

```glsl
// Custom GLSL placeholder — replaced by engine when user provides custom code
vec3 customGradient(vec2 uv, float time) {
  return meshGradient(uv, time); // fallback
}
```

- [ ] **Step 3: Update computeGradient() to check u_customEnabled**

Replace the `computeGradient` function (lines 854–864):

```glsl
vec3 computeGradient(vec2 uv, float time) {
  if (u_customEnabled) return customGradient(uv, time);
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

- [ ] **Step 4: Add text mask application in main()**

Replace the final 4 lines of `main()` (lines 1104–1108):

```glsl
  // Shape mask (applied after all effects)
  float mask = computeMask(v_uv, u_time * u_speed);

  // Text mask (overrides shape mask when enabled)
  if (u_textMaskEnabled > 0.5) {
    mask = texture(u_textMaskTexture, v_uv).r;
  }

  fragColor = vec4(clamp(color, 0.0, 1.0), u_layerOpacity * mask);
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS. New uniforms declared but not yet set from engine (null locations silently skipped).

- [ ] **Step 6: Commit**

```bash
git add lib/shaders/fragment.glsl
git commit -m "feat(phase9): text mask + custom GLSL uniforms and dispatch in shader"
```

---

## Task 4: Engine — Text Mask Texture & Custom Shader Compilation

**Files:**
- Modify: `lib/engine.ts`

- [ ] **Step 1: Add new uniform names to cacheUniforms()**

After `"u_maskSmoothness",` (line 133), add:

```typescript
      // Text mask
      "u_textMaskEnabled", "u_textMaskTexture",
      // Custom GLSL
      "u_customEnabled",
```

- [ ] **Step 2: Add text mask uniform setting to setLayerUniforms()**

At the end of `setLayerUniforms()`, after the mask combine section (after line 363 `this.setf("u_maskSmoothness", layer.maskSmoothness);`), add:

```typescript
    // Text mask
    this.setf("u_textMaskEnabled", layer.textMaskEnabled ? 1.0 : 0.0);
    if (layer.textMaskEnabled && this.textMaskTexture) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.textMaskTexture);
      this.seti("u_textMaskTexture", 3);
    }
```

- [ ] **Step 3: Add text mask texture field and updateTextMaskTexture() method**

After the `pendingLoads` field declaration (line 33), add:

```typescript
  private textMaskTexture: WebGLTexture | null = null;
```

After the `cleanupTextures()` method (after line 257), add:

```typescript
  updateTextMaskTexture(canvas: HTMLCanvasElement) {
    const gl = this.gl;
    if (!this.textMaskTexture) {
      this.textMaskTexture = gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textMaskTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
```

- [ ] **Step 4: Add setCustomShader() method**

After `updateTextMaskTexture()`, add:

```typescript
  setCustomShader(code: string | null): { success: boolean; error?: string } {
    const gl = this.gl;

    if (code === null) {
      // Revert to default shader
      try {
        this.initProgram();
        this.seti("u_customEnabled", 0);
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Reset failed" };
      }
    }

    // Wrap user code in customGradient function and inject into shader
    const customFunc = `vec3 customGradient(vec2 uv, float time) {\n${code}\n}`;

    // Replace the placeholder customGradient in the fragment source
    const modifiedFragment = fragmentSource.replace(
      /vec3 customGradient\(vec2 uv, float time\) \{[^}]*\}/,
      customFunc
    );

    try {
      const vertShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragShader = this.compileShader(gl.FRAGMENT_SHADER, modifiedFragment);

      const newProgram = gl.createProgram()!;
      gl.attachShader(newProgram, vertShader);
      gl.attachShader(newProgram, fragShader);
      gl.linkProgram(newProgram);

      if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(newProgram);
        gl.deleteProgram(newProgram);
        return { success: false, error: log ?? "Link failed" };
      }

      // Success — swap programs
      if (this.program) gl.deleteProgram(this.program);
      this.program = newProgram;
      gl.useProgram(newProgram);

      // Re-bind the VAO (fullscreen quad)
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const posLoc = gl.getAttribLocation(newProgram, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      this.uniforms = {};
      this.cacheUniforms();
      this.seti("u_customEnabled", 1);

      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Compilation failed";
      // Extract GLSL error from "Shader compile failed: " prefix
      const cleaned = msg.replace(/^Shader compile failed:\s*/, "");
      return { success: false, error: cleaned };
    }
  }
```

- [ ] **Step 5: Clean up text mask texture in destroy()**

In the `destroy()` method (line 567), after `this.textureCache.clear();`, add:

```typescript
    if (this.textMaskTexture) {
      this.gl.deleteTexture(this.textMaskTexture);
      this.textMaskTexture = null;
    }
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/engine.ts
git commit -m "feat(phase9): text mask texture upload and custom GLSL shader compilation"
```

---

## Task 5: GradientPanel — Text Mask UI Controls

**Files:**
- Modify: `components/GradientPanel.tsx`

- [ ] **Step 1: Add TextMaskAlign import**

Update the layers import on line 9:

```typescript
import { LayerParams, MaskParams, TextMaskAlign } from "@/lib/layers";
```

- [ ] **Step 2: Add TEXT_ALIGN_OPTIONS constant**

After `MASK_BLEND_OPTIONS` (line 38), add:

```typescript
const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];
```

- [ ] **Step 3: Add Text Mask section to GradientPanel**

In the `GradientPanel` component, between the Mask section closing `</div>` and the `<div className="border-t border-border" />` that precedes the Animation section (after line 418 `<div className="border-t border-border" />`), add:

```tsx
      {/* Text Mask */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Text Mask</SectionHeader>
        <Toggle
          label="Enable Text Mask"
          checked={activeLayer.textMaskEnabled}
          onChange={(v) => {
            // Mutually exclusive with shape mask
            const updates: Partial<LayerParams> = { textMaskEnabled: v };
            if (v) updates.maskEnabled = false;
            store.setLayerParam(updates);
          }}
        />
        {activeLayer.textMaskEnabled && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-text-tertiary">Text</span>
              <input
                type="text"
                value={activeLayer.textMaskContent}
                onChange={(e) => {
                  const newLayers = store.layers.map((l, i) =>
                    i === store.activeLayerIndex ? { ...l, textMaskContent: e.target.value } : l
                  );
                  store.set({ layers: newLayers } as Partial<typeof store>);
                }}
                onBlur={() => store.commitSet()}
                placeholder="Enter text..."
                className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded-md
                  text-text-primary placeholder:text-text-tertiary focus:outline-none
                  focus:border-accent transition-colors"
              />
            </div>
            <Slider label="Size" value={activeLayer.textMaskFontSize} min={32} max={200} step={1}
              onChange={(v) => updateLayerField("textMaskFontSize", v)}
              onCommit={() => store.commitSet()} />
            <Slider label="Weight" value={activeLayer.textMaskFontWeight} min={400} max={900} step={100}
              onChange={(v) => updateLayerField("textMaskFontWeight", v)}
              onCommit={() => store.commitSet()} />
            <Slider label="Spacing" value={activeLayer.textMaskLetterSpacing} min={-0.05} max={0.2} step={0.005}
              onChange={(v) => updateLayerField("textMaskLetterSpacing", v)}
              onCommit={() => store.commitSet()} />
            <Select
              label="Align"
              value={activeLayer.textMaskAlign}
              options={TEXT_ALIGN_OPTIONS}
              onChange={(v) => store.setLayerParam({ textMaskAlign: v as TextMaskAlign })}
            />
          </>
        )}
      </div>

      <div className="border-t border-border" />
```

- [ ] **Step 4: Update Mask toggle to disable text mask**

In the existing Mask section, update the `Enable Mask` toggle `onChange` (line 380):

Replace:
```tsx
          onChange={(v) => store.setLayerParam({ maskEnabled: v })}
```

With:
```tsx
          onChange={(v) => {
            const updates: Partial<LayerParams> = { maskEnabled: v };
            if (v) updates.textMaskEnabled = false;
            store.setLayerParam(updates);
          }}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/GradientPanel.tsx
git commit -m "feat(phase9): text mask UI controls in GradientPanel"
```

---

## Task 6: Canvas — Text Mask Texture Rendering

**Files:**
- Modify: `components/Canvas.tsx`

- [ ] **Step 1: Add text mask canvas and dirty tracking**

Inside the `Canvas` component, after the `degradedRef` declaration (line 56), add:

```typescript
  const textCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const textDirtyRef = useRef(true);
  const lastTextParamsRef = useRef<string>("");
```

- [ ] **Step 2: Add text mask rendering effect**

After the `// Reduced motion` useEffect (after line 194), add:

```typescript
  // Text mask: render text to offscreen canvas and upload as texture
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const state = useGradientStore.getState();
    const layer = state.layers[state.activeLayerIndex];
    if (!layer) return;

    // Build a key from text params to detect changes
    const paramKey = JSON.stringify({
      enabled: layer.textMaskEnabled,
      content: layer.textMaskContent,
      fontSize: layer.textMaskFontSize,
      fontWeight: layer.textMaskFontWeight,
      letterSpacing: layer.textMaskLetterSpacing,
      align: layer.textMaskAlign,
    });

    if (paramKey === lastTextParamsRef.current) return;
    lastTextParamsRef.current = paramKey;

    if (!layer.textMaskEnabled || !layer.textMaskContent) return;

    // Create offscreen canvas on first use
    if (!textCanvasRef.current) {
      textCanvasRef.current = document.createElement("canvas");
    }
    const tc = textCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    tc.width = mainCanvas.width;
    tc.height = mainCanvas.height;

    const ctx = tc.getContext("2d");
    if (!ctx) return;

    // Black background (mask = 0)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, tc.width, tc.height);

    // White text (mask = 1)
    const fontSize = layer.textMaskFontSize * (window.devicePixelRatio || 1);
    ctx.font = `${layer.textMaskFontWeight} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = `${layer.textMaskLetterSpacing}em`;

    let x: number;
    if (layer.textMaskAlign === "left") {
      ctx.textAlign = "left";
      x = fontSize * 0.5;
    } else if (layer.textMaskAlign === "right") {
      ctx.textAlign = "right";
      x = tc.width - fontSize * 0.5;
    } else {
      ctx.textAlign = "center";
      x = tc.width / 2;
    }

    ctx.fillText(layer.textMaskContent, x, tc.height / 2);

    engine.updateTextMaskTexture(tc);
  });
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/Canvas.tsx
git commit -m "feat(phase9): offscreen text mask canvas rendering and texture upload"
```

---

## Task 7: CustomGLSLPanel — New Component

**Files:**
- Create: `components/CustomGLSLPanel.tsx`

- [ ] **Step 1: Create the CustomGLSLPanel component**

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useGradientStore } from "@/lib/store";
import { GradientEngine } from "@/lib/engine";

const DEFAULT_TEMPLATE = `  vec2 p = uv * u_scale;
  float n = fbm(p + vec2(time * 0.3, time * 0.2), int(u_complexity));
  return getGradientColor(n * 0.5 + 0.5);`;

interface CustomGLSLPanelProps {
  engineRef: React.RefObject<GradientEngine | null>;
}

export default function CustomGLSLPanel({ engineRef }: CustomGLSLPanelProps) {
  const store = useGradientStore();
  const [code, setCode] = useState(store.customGLSL ?? DEFAULT_TEMPLATE);
  const [status, setStatus] = useState<{ ok: boolean; message: string }>({ ok: true, message: "Ready" });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync store → local state when store changes externally (e.g., project load)
  useEffect(() => {
    const unsub = useGradientStore.subscribe((state) => {
      if (state.customGLSL === null && code !== DEFAULT_TEMPLATE) {
        setCode(DEFAULT_TEMPLATE);
        setStatus({ ok: true, message: "Ready" });
      }
    });
    return unsub;
  }, [code]);

  const compile = useCallback((newCode: string) => {
    const engine = engineRef.current;
    if (!engine) return;

    if (!newCode.trim()) {
      // Empty code — disable custom
      const result = engine.setCustomShader(null);
      if (result.success) {
        useGradientStore.getState().set({ customGLSL: null } as Partial<ReturnType<typeof useGradientStore.getState>>);
        setStatus({ ok: true, message: "Ready" });
      }
      return;
    }

    const result = engine.setCustomShader(newCode);
    if (result.success) {
      useGradientStore.getState().set({ customGLSL: newCode } as Partial<ReturnType<typeof useGradientStore.getState>>);
      setStatus({ ok: true, message: "Compiled OK" });
    } else {
      setStatus({ ok: false, message: result.error ?? "Unknown error" });
    }
  }, [engineRef]);

  const handleChange = (newCode: string) => {
    setCode(newCode);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => compile(newCode), 500);
  };

  const handleReset = () => {
    setCode(DEFAULT_TEMPLATE);
    const engine = engineRef.current;
    if (engine) {
      engine.setCustomShader(null);
      useGradientStore.getState().set({ customGLSL: null } as Partial<ReturnType<typeof useGradientStore.getState>>);
    }
    setStatus({ ok: true, message: "Ready" });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          Custom GLSL
        </span>
        <button
          onClick={handleReset}
          className="text-[10px] text-text-tertiary hover:text-accent transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] text-text-tertiary font-mono">
          vec3 custom(vec2 uv, float time) &#123;
        </span>
        <textarea
          value={code}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          className="w-full h-48 px-3 py-2 text-[11px] font-mono leading-relaxed
            bg-surface border border-border rounded-md text-text-primary
            focus:outline-none focus:border-accent transition-colors resize-y"
        />
        <span className="text-[10px] text-text-tertiary font-mono">&#125;</span>
      </div>

      {/* Compile status */}
      <div className={`flex items-center gap-2 text-[10px] ${status.ok ? "text-green-500" : "text-red-400"}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${status.ok ? "bg-green-500" : "bg-red-400"}`} />
        <span className="font-mono break-all">{status.message}</span>
      </div>

      {/* Reference */}
      <div className="flex flex-col gap-2 text-[10px] text-text-tertiary">
        <span className="font-medium">Available uniforms:</span>
        <span className="font-mono leading-relaxed">
          u_time, u_resolution, u_mouse, u_colors[8], u_colorCount, u_speed, u_complexity, u_scale, u_distortion
        </span>
        <span className="font-medium mt-1">Available functions:</span>
        <span className="font-mono leading-relaxed">
          snoise(vec2), fbm(vec2, int), getGradientColor(float), hash(vec2), curlNoise(vec2, float)
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: May fail — `engineRef` prop not wired yet. That's Task 9.

- [ ] **Step 3: Commit**

```bash
git add components/CustomGLSLPanel.tsx
git commit -m "feat(phase9): CustomGLSLPanel component with live compile and status"
```

---

## Task 8: Sidebar — Add Code Tab

**Files:**
- Modify: `lib/types.ts`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Update SidebarTab type**

Replace `lib/types.ts` line 1:

```typescript
export type SidebarTab = "gradient" | "effects" | "presets" | "code";
```

- [ ] **Step 2: Update Sidebar component**

In `components/Sidebar.tsx`, add the import for CustomGLSLPanel after line 4:

```typescript
import CustomGLSLPanel from "@/components/CustomGLSLPanel";
```

Update the `SidebarProps` interface to include engineRef (line 15):

```typescript
interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  engineRef: React.RefObject<GradientEngine | null>;
}
```

Add the GradientEngine import after line 1:

```typescript
import { GradientEngine } from "@/lib/engine";
```

Add the Code tab to TABS array (after line 12):

```typescript
const TABS: { id: SidebarTab; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
  { id: "code", label: "Code" },
];
```

Update the component signature (line 20):

```typescript
export default function Sidebar({ activeTab, onTabChange, engineRef }: SidebarProps) {
```

Add the Code tab content in the tab content section (after line 49):

```tsx
        {activeTab === "code" && <CustomGLSLPanel engineRef={engineRef} />}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Will fail — editor/page.tsx doesn't pass `engineRef` to Sidebar yet. That's Task 9.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts components/Sidebar.tsx
git commit -m "feat(phase9): add Code tab to Sidebar with CustomGLSLPanel"
```

---

## Task 9: Editor Page — Wire Engine Ref and Keyboard Shortcut

**Files:**
- Modify: `app/editor/page.tsx`
- Modify: `components/Canvas.tsx`

- [ ] **Step 1: Expose engine ref from Canvas**

In `components/Canvas.tsx`, update the `CanvasProps` interface (line 44):

```typescript
interface CanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onEngineReady?: (engine: GradientEngine) => void;
}
```

Update the component signature (line 48):

```typescript
export default function Canvas({ onCanvasReady, onEngineReady }: CanvasProps) {
```

After `onCanvasReady?.(canvas);` (line 82), add:

```typescript
    onEngineReady?.(engine);
```

- [ ] **Step 2: Wire engine ref in editor/page.tsx**

Add `GradientEngine` import after line 4:

```typescript
import { GradientEngine } from "@/lib/engine";
```

After `const canvasElRef = useRef<HTMLCanvasElement | null>(null);` (line 22), add:

```typescript
  const engineRef = useRef<GradientEngine | null>(null);
```

Update the Canvas component (line 105):

```tsx
          <Canvas
            onCanvasReady={(el) => { canvasElRef.current = el; }}
            onEngineReady={(eng) => { engineRef.current = eng; }}
          />
```

Pass engineRef to Sidebar (line 108):

```tsx
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} engineRef={engineRef} />
```

- [ ] **Step 3: Add "4" keyboard shortcut for Code tab**

In the `handleKeyDown` switch statement, after the `case "3":` block (line 71), add:

```typescript
        case "4":
          setActiveTab("code");
          break;
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/editor/page.tsx components/Canvas.tsx
git commit -m "feat(phase9): wire engine ref to Sidebar and add Code tab shortcut"
```

---

## Task 10: Export — Text Mask CSS and Embed Widget

**Files:**
- Modify: `lib/export.ts`
- Modify: `components/ExportModal.tsx`

- [ ] **Step 1: Update exportCSS for text mask**

In `lib/export.ts`, update the `exportCSS` function (line 18) to accept optional text mask params:

```typescript
export function exportCSS(
  colors: [number, number, number][],
  textMask?: { enabled: boolean; content: string; fontSize: number; fontWeight: number; letterSpacing: number; align: string }
): string {
  const hexColors = colors.map(([r, g, b]) => {
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });

  const stops = hexColors.join(", ");

  if (textMask?.enabled && textMask.content) {
    return `.wavr-gradient-text {
  background: linear-gradient(135deg, ${stops});
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: ${textMask.fontSize}px;
  font-weight: ${textMask.fontWeight};
  letter-spacing: ${textMask.letterSpacing}em;
  text-align: ${textMask.align};
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
  }

  return `.wavr-gradient {
  background: linear-gradient(135deg, ${stops});
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
}
```

- [ ] **Step 2: Add generateEmbedConfig function**

After the `exportCSS` function, add:

```typescript
interface EmbedConfig {
  type: number;
  colors: [number, number, number][];
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  brightness?: number;
  saturation?: number;
  hueShift?: number;
  noiseEnabled?: boolean;
  noiseIntensity?: number;
  noiseScale?: number;
  grain?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  vignette?: number;
  chromaticAberration?: number;
  domainWarp?: number;
}

export function generateEmbedConfig(state: ExportableState & {
  noiseEnabled?: boolean;
  noiseIntensity?: number;
  noiseScale?: number;
  grain?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  vignette?: number;
  chromaticAberration?: number;
  hueShift?: number;
  domainWarp?: number;
}): EmbedConfig {
  const typeMap: Record<string, number> = {
    mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4,
    dither: 5, scanline: 6, glitch: 7, image: 8,
  };

  const config: EmbedConfig = {
    type: typeMap[state.gradientType] ?? 0,
    colors: state.colors.map(c => c.map(v => +v.toFixed(3)) as [number, number, number]),
    speed: +state.speed.toFixed(2),
    complexity: Math.round(state.complexity),
    scale: +state.scale.toFixed(2),
    distortion: +state.distortion.toFixed(2),
  };

  // Only include non-default values to keep config small
  if (state.brightness !== undefined && state.brightness !== 1.0) config.brightness = +state.brightness.toFixed(2);
  if (state.saturation !== undefined && state.saturation !== 1.0) config.saturation = +state.saturation.toFixed(2);
  if (state.hueShift) config.hueShift = Math.round(state.hueShift);
  if (state.noiseEnabled) {
    config.noiseEnabled = true;
    config.noiseIntensity = +(state.noiseIntensity ?? 0.3).toFixed(2);
    config.noiseScale = +(state.noiseScale ?? 1.0).toFixed(2);
  }
  if (state.grain) config.grain = +state.grain.toFixed(2);
  if (state.bloomEnabled) {
    config.bloomEnabled = true;
    config.bloomIntensity = +(state.bloomIntensity ?? 0.3).toFixed(2);
  }
  if (state.vignette) config.vignette = +state.vignette.toFixed(2);
  if (state.chromaticAberration) config.chromaticAberration = +state.chromaticAberration.toFixed(3);
  if (state.domainWarp) config.domainWarp = +state.domainWarp.toFixed(2);

  return config;
}

export function generateEmbedSnippet(config: EmbedConfig): string {
  const json = JSON.stringify(config);
  return `<script src="https://wavr.app/embed.js"></script>\n<wavr-gradient data-config='${json}' style="width:100%;height:400px;display:block"></wavr-gradient>`;
}
```

- [ ] **Step 3: Update ExportModal with text mask CSS and embed widget**

In `components/ExportModal.tsx`, update the CSS export action (line 163) to pass text mask params:

```typescript
              <ExportButton
                title="CSS"
                desc="Animated gradient with keyframes"
                action={async () => {
                  const layer = store.layers[store.activeLayerIndex];
                  const textMask = layer?.textMaskEnabled ? {
                    enabled: true,
                    content: layer.textMaskContent,
                    fontSize: layer.textMaskFontSize,
                    fontWeight: layer.textMaskFontWeight,
                    letterSpacing: layer.textMaskLetterSpacing,
                    align: layer.textMaskAlign,
                  } : undefined;
                  await copyToClipboard(exportCSS(colors, textMask));
                }}
              />
```

Add the `generateEmbedConfig` and `generateEmbedSnippet` imports (line 6):

```typescript
import {
  exportPNG, exportCSS, exportTailwindCSS, exportReactComponent,
  exportWebComponent, exportStandalonePlayer, exportGIF, copyToClipboard, exportWebM, generateEmbedCode,
  generateEmbedConfig, generateEmbedSnippet
} from "@/lib/export";
```

In the embed tab section, after the Standalone Player ExportButton (after line 197), add:

```tsx
              <ExportButton
                title="Embed Widget"
                desc="Config-driven Web Component — all gradient modes"
                action={async () => {
                  const embedState = {
                    ...stateForExport,
                    noiseEnabled: store.noiseEnabled,
                    noiseIntensity: store.noiseIntensity,
                    noiseScale: store.noiseScale,
                    grain: store.grain,
                    bloomEnabled: store.bloomEnabled,
                    bloomIntensity: store.bloomIntensity,
                    vignette: store.vignette,
                    chromaticAberration: store.chromaticAberration,
                    hueShift: store.hueShift,
                    domainWarp: store.domainWarp,
                  };
                  const config = generateEmbedConfig(embedState);
                  await copyToClipboard(generateEmbedSnippet(config));
                }}
              />
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/export.ts components/ExportModal.tsx
git commit -m "feat(phase9): text mask CSS export and embed widget config generator"
```

---

## Task 11: Integration Verification

**Files:**
- No file changes

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 3: Run dev server and verify text mask**

Run: `npm run dev`

Manual checks:
1. Open `/editor`, scroll to Text Mask section in Gradient tab
2. Toggle "Enable Text Mask" — controls appear
3. Type "WAVR" — gradient clips to text shape on canvas
4. Adjust Size slider — text gets larger/smaller
5. Adjust Weight — text gets bolder/thinner
6. Adjust Spacing — letter spacing changes
7. Change Align to Left/Right — text position shifts
8. Verify: enabling Text Mask auto-disables Shape Mask (and vice versa)
9. Export CSS with text mask enabled — output includes `background-clip: text`

- [ ] **Step 4: Verify custom GLSL editor**

1. Click "Code" tab in sidebar (or press `4`)
2. See default template code in textarea
3. Edit code — wait 500ms — green "Compiled OK" status appears
4. Write intentionally broken GLSL — red error message appears
5. Canvas continues showing last working shader during errors
6. Click "Reset" — reverts to default template
7. Switch gradient types — custom shader overrides all of them when active

- [ ] **Step 5: Verify embed widget export**

1. Open Export modal → Embed tab
2. Click "Embed Widget" — copies config snippet to clipboard
3. Verify the config JSON includes the current gradient type, colors, and active effects

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "feat(phase9): Designer Polish complete — text mask, custom GLSL, embed widget"
```
