# Phase 9: Designer Polish — Design Spec

## Overview

Three features that transform Wavr from a gradient playground into a professional design tool: a config-driven embed widget that works across all gradient modes, live gradient text masking, and a custom GLSL editor for power users.

---

## 1. Lightweight Embed Widget

### Problem

The existing `exportStandalonePlayer()` and `exportWebComponent()` only render mesh/fBm gradients. Designers using radial, glitch, dither, scanline, image, or any other mode get a broken embed.

### Solution

A **config-driven `<wavr-gradient>` Web Component** that includes a minified version of the full fragment shader and reads parameters from a `data-config` JSON attribute.

### How it works

1. New file `lib/embed.ts` generates the embed script as a string
2. The script contains the full vertex + fragment shader (minified), a minimal WebGL2 bootstrap, and a config parser
3. Config JSON encodes: gradient type, colors, speed, complexity, scale, distortion, effects subset (bloom, vignette, grain, hue shift, chromatic aberration, noise), mask params
4. No image/texture support in embed (images can't serialize into a small config)
5. Target size: ~8–12KB gzipped

### Usage

```html
<script src="https://wavr.app/embed.js"></script>
<wavr-gradient data-config='{"type":"glitch","colors":[[1,0.4,0.4],[0.2,0.8,0.8]],"speed":0.5}'
  style="width:100%;height:400px;display:block">
</wavr-gradient>
```

### Config schema

```typescript
interface EmbedConfig {
  type: number;                        // 0–8 (gradient type index)
  colors: [number, number, number][];  // RGB 0–1
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  // Optional effects (omitted = disabled/default)
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
  // Optional mask
  maskEnabled?: boolean;
  mask1Type?: number;
  mask1Position?: [number, number];
  mask1Scale?: [number, number];
  mask1Rotation?: number;
  mask1Feather?: number;
  mask1Invert?: boolean;
  mask1CornerRadius?: number;
  mask1Sides?: number;
  mask1StarInner?: number;
  mask1NoiseDist?: number;
}
```

### Export flow

New "Embed Widget" option in the Export modal's Embed tab. Serializes current editor state into the config JSON. Generates the `<wavr-gradient>` snippet for clipboard copy.

The embed script itself is generated at build time as a static asset (`public/embed.js`), not inline. The export only generates the HTML snippet that references it.

### Scroll-linked mode

The Web Component supports `mode="scroll"` attribute (same as existing standalone player). When set, animation time is driven by page scroll position instead of wall clock.

---

## 2. Text Integration

### Problem

Designers want gradient text for hero sections, headings, and logos. Wavr has no text support — you can't preview or export gradient text.

### Solution: Two-layer approach

**Layer 1: Live text mask in the editor (shader-based)**

Text is rendered to an offscreen `<canvas>` using the Canvas 2D API, then uploaded as a WebGL texture. The fragment shader samples this texture as an alpha mask — the same pattern as the existing image texture system.

**Layer 2: CSS export with `background-clip: text`**

When text mask is active, CSS/Tailwind exports generate `background-clip: text` with `color: transparent`. React and Web Component exports include the text overlay.

### Data model

New fields on `LayerParams`:

```typescript
// Text mask
textMaskEnabled: boolean;
textMaskContent: string;                              // the text string, default ""
textMaskFontSize: number;                             // 32–200, default 80
textMaskFontWeight: number;                           // 400–900, default 700
textMaskLetterSpacing: number;                        // -0.05 to 0.2 (em), default 0
textMaskAlign: "left" | "center" | "right";           // default "center"
```

Defaults:

```typescript
export const DEFAULT_TEXT_MASK = {
  textMaskEnabled: false,
  textMaskContent: "",
  textMaskFontSize: 80,
  textMaskFontWeight: 700,
  textMaskLetterSpacing: 0,
  textMaskAlign: "center" as const,
};
```

### Text texture pipeline

1. When `textMaskEnabled` is true and `textMaskContent` is non-empty, render text to an offscreen `<canvas>` element
2. Canvas size matches the WebGL canvas dimensions (for 1:1 pixel mapping)
3. Fill the canvas with black, draw white text using `ctx.font`, `ctx.fillText`, `ctx.textAlign`
4. Upload as a WebGL texture on texture unit 3 (`u_textMaskTexture`)
5. Re-render the text canvas only when text params change (not every animation frame) — track with a dirty flag
6. In the shader, sample the texture and use the red channel as the mask alpha

### Shader integration

New uniforms:

```glsl
uniform float u_textMaskEnabled;
uniform sampler2D u_textMaskTexture;
```

In `main()`, after the existing shape mask application:

```glsl
// Text mask (mutually exclusive with shape mask)
if (u_textMaskEnabled > 0.5) {
  float textAlpha = texture(u_textMaskTexture, v_uv).r;
  mask = textAlpha;
}
```

When text mask is enabled, it replaces the shape mask value. They are mutually exclusive — enabling text mask disables shape mask in the UI (toggle logic, not shader logic).

### Engine changes

- New method `GradientEngine.updateTextMaskTexture(canvas: HTMLCanvasElement)` that uploads the canvas as a texture to unit 3
- Add `u_textMaskEnabled` and `u_textMaskTexture` to `cacheUniforms()`
- Set `u_textMaskEnabled` in `setLayerUniforms()` from `layer.textMaskEnabled`

### UI — Text Mask section in GradientPanel

New collapsible section between Mask and Animation:

```
┌──────────────────────────────────┐
│ ☐ Enable Text Mask               │
│                                  │
│ Text ┌────────────────────────┐  │
│      │ WAVR                   │  │
│      └────────────────────────┘  │
│ Size ─────────●──────── 80px     │
│ Weight ───────●──────── 700      │
│ Spacing ──────●──────── 0        │
│ Align  [Center ▾]                │
└──────────────────────────────────┘
```

When text mask is toggled on, shape mask is automatically toggled off (and vice versa).

### CSS export changes

When `textMaskEnabled` is true, `exportCSS()` wraps the gradient in:

```css
.wavr-gradient-text {
  background: linear-gradient(135deg, #color1, #color2, ...);
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 80px;
  font-weight: 700;
  letter-spacing: 0em;
  text-align: center;
}
```

---

## 3. Custom GLSL Editor

### Problem

Power users (creative coders, shader artists) want to tweak the gradient math directly. The fragment shader is locked — changes only go through uniforms.

### Solution

New **"Custom GLSL" tab** in the Sidebar (4th tab alongside Gradient/Effects/Presets).

### How it works

1. A code `<textarea>` (~20 lines visible) pre-populated with the current gradient mode's function body
2. User edits the GLSL code; changes compile on a 500ms debounce
3. On compile success: shader swaps in live, green status indicator
4. On compile error: red status with the GLSL error message below the editor, previous working shader stays active
5. A "Reset" button restores the original function for the current gradient mode

### Shader injection

The custom code replaces the body of a `customGradient()` function that the shader calls when `u_customEnabled` is true. The user writes a function body that receives `(vec2 uv, float time)` and returns `vec3 color`.

Template shown to the user:

```glsl
// Returns RGB color for the given UV and time
// All uniforms (u_colors, u_complexity, u_scale, etc.)
// and helpers (snoise, fbm, getGradientColor) are available.
vec3 custom(vec2 uv, float time) {
  vec2 p = uv * u_scale;
  float n = fbm(p + vec2(time * 0.3), int(u_complexity));
  return getGradientColor(n * 0.5 + 0.5);
}
```

### Engine changes

New method on `GradientEngine`:

```typescript
setCustomShader(code: string): { success: boolean; error?: string }
```

Implementation:
1. Wrap the user's code in a `vec3 customGradient(vec2 uv, float time) { ... }` function
2. Inject it into the fragment shader source before `computeGradient()`
3. Modify `computeGradient()` to check `u_customEnabled` first: `if (u_customEnabled) return customGradient(uv, time);`
4. Compile a new program. If compilation fails, return the error string and keep the old program
5. If compilation succeeds, swap programs, re-cache uniforms, re-bind VAO

New uniforms:

```glsl
uniform bool u_customEnabled;
```

### Data model

Single new field on the **store root** (not per-layer — custom shader applies globally):

```typescript
customGLSL: string | null;  // null = use built-in modes
```

Added to `HISTORY_EXCLUDE_KEYS` (not tracked in undo/redo — too noisy).

### UI — CustomGLSLPanel component

New component `components/CustomGLSLPanel.tsx`:

```
┌──────────────────────────────────┐
│ Custom GLSL                      │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ vec3 custom(vec2 uv, ...    │ │
│ │   vec2 p = uv * u_scale;   │ │
│ │   float n = fbm(p + ...    │ │
│ │   return getGradientColor(  │ │
│ │     n * 0.5 + 0.5);        │ │
│ │ }                           │ │
│ └──────────────────────────────┘ │
│                                  │
│ ● Compiled OK          [Reset]  │
│                                  │
│ Available uniforms:              │
│ u_time, u_resolution, u_mouse,  │
│ u_colors[8], u_colorCount,      │
│ u_speed, u_complexity, u_scale, │
│ u_distortion                     │
│                                  │
│ Available functions:             │
│ snoise(vec2), fbm(vec2, int),   │
│ getGradientColor(float),         │
│ hash(vec2)                       │
└──────────────────────────────────┘
```

### Sidebar tab integration

The Sidebar currently has 3 tabs: Gradient, Effects, Presets. Add a 4th: **Code**.

- Tab bar: `[Gradient] [Effects] [Presets] [Code]`
- Keyboard shortcut: `4` key (existing: 1=Gradient, 2=Effects, 3=Presets)

### Constraints

- Custom GLSL has access to all existing uniforms and helper functions
- Custom GLSL is NOT included in URL sharing or embed exports (too large, security risk)
- Custom GLSL IS stored in localStorage projects (so it persists across sessions)
- No syntax highlighting in v1 — plain monospace textarea. Syntax highlighting is a future enhancement.

---

## 4. Files Changed

| File | Changes |
|---|---|
| `lib/layers.ts` | Add text mask fields to `LayerParams`, add `DEFAULT_TEXT_MASK` |
| `lib/store.ts` | Add `customGLSL: string \| null` to `GradientState`, add to `HISTORY_EXCLUDE_KEYS`. Deep-copy text mask fields not needed (all primitives). |
| `lib/engine.ts` | Add `updateTextMaskTexture()`, `setCustomShader()`. Add text mask + custom uniforms to `cacheUniforms()` and `setLayerUniforms()`. |
| `lib/shaders/fragment.glsl` | Add `u_textMaskEnabled`, `u_textMaskTexture`, `u_customEnabled` uniforms. Add `customGradient()` placeholder. Update `computeGradient()` dispatch. Update mask application in `main()`. |
| `lib/export.ts` | New `generateEmbedConfig()` function. Update `exportCSS()` for text mask. New `generateEmbedSnippet()`. |
| `lib/embed.ts` | New file — generates the standalone embed script with full shader. |
| `components/GradientPanel.tsx` | Add Text Mask section with text input, size/weight/spacing sliders, align select. |
| `components/CustomGLSLPanel.tsx` | New file — textarea, compile status, reset button, reference docs. |
| `components/Sidebar.tsx` | Add 4th "Code" tab, render `CustomGLSLPanel`. |
| `components/ExportModal.tsx` | Add "Embed Widget" export option in Embed tab. |
| `components/Canvas.tsx` | Create offscreen canvas for text mask, pass to engine on text param changes. |
| `public/embed.js` | Generated at build time — the standalone embed script. |

---

## 5. Constraints

- **No external font loading** — text mask uses system fonts only (system-ui, sans-serif). Keeps it simple, avoids CORS/loading complexity.
- **No syntax highlighting** in GLSL editor v1 — plain `<textarea>` with monospace font.
- **Text mask and shape mask are mutually exclusive** — toggling one disables the other in the UI.
- **Custom GLSL not in URL sharing** — only stored in localStorage projects.
- **Embed widget has no image/texture support** — images can't serialize into a small config.
- **No shader recompilation on parameter change** — only on custom GLSL edits (which is inherently a recompilation).
- **Embed script is a static asset** — generated during build, served from `public/embed.js`.

---

## 6. Future Extensions (Not in Scope)

- Google Fonts integration for text mask
- Syntax highlighting / CodeMirror in GLSL editor
- GLSL editor autocomplete for uniforms
- Multi-line text / paragraph support
- Text animation (typing, reveal, scroll-triggered)
- Embed widget CDN hosting
- Embed widget with image texture support via external URL
