# Wavr Gradient Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete interactive animated gradient editor (like Unicorn Studio) with WebGL rendering, real-time controls, and export capabilities.

**Architecture:** Single-page Next.js app. A WebGL 2 fragment shader renders animated gradients to a fullscreen canvas. A Zustand store holds all parameters. React sidebar controls update the store, which pipes uniforms to the shader every frame. Export system captures canvas output as PNG/CSS/WebM.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, WebGL 2, GLSL, Zustand, Tailwind CSS

---

## File Structure

```
app/
  layout.tsx          — Root layout with fonts, metadata, globals.css import
  page.tsx            — Main page: TopBar + Canvas + Sidebar + ExportModal
  globals.css         — Tailwind directives + design tokens as CSS variables

components/
  Canvas.tsx          — WebGL canvas, owns GL context (ref), render loop (rAF)
  TopBar.tsx          — Logo, randomize, play/pause, export button
  Sidebar.tsx         — 320px right panel with tab navigation
  GradientPanel.tsx   — Gradient type select, color palette editor, parameter sliders
  EffectsPanel.tsx    — Noise/particles/bloom toggle+slider groups
  PresetsPanel.tsx    — 2-column grid of preset cards
  ExportModal.tsx     — Modal with PNG/CSS/WebM export options
  ui/
    Slider.tsx        — Custom range slider with label + value display
    Toggle.tsx        — Custom toggle switch
    ColorInput.tsx    — Color swatch + hex input + native picker
    Select.tsx        — Styled dropdown

lib/
  store.ts            — Zustand store (single source of truth for all params)
  engine.ts           — WebGL setup: compile shaders, link program, cache uniforms, render loop
  presets.ts          — 8 preset definitions (Aurora, Sunset, Midnight, etc.)
  export.ts           — PNG/CSS/WebM export functions
  shaders/
    vertex.glsl       — Fullscreen quad vertex shader
    fragment.glsl     — Main fragment shader (all gradient modes + effects)
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `postcss.config.js`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/niki_g/conductor/workspaces/wavr/bordeaux
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm --no-turbopack
```

If prompted about existing files, allow overwrite (the existing files are just docs).

- [ ] **Step 2: Install dependencies**

```bash
npm install zustand
```

- [ ] **Step 3: Configure next.config.js for raw GLSL imports**

Replace `next.config.js` (or `next.config.ts`) with:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.glsl$/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
```

Create `glsl.d.ts` in the project root:

```typescript
declare module "*.glsl" {
  const value: string;
  export default value;
}
```

- [ ] **Step 4: Set up globals.css with design tokens**

Replace `app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-root: #000000;
  --color-base: #08090a;
  --color-surface: #131416;
  --color-elevated: #1c1c1f;
  --color-border: rgba(255, 255, 255, 0.06);
  --color-border-active: rgba(255, 255, 255, 0.12);
  --color-text-primary: #f7f8f8;
  --color-text-secondary: #8a8f98;
  --color-text-tertiary: #555960;
  --color-accent: #635bff;
  --font-sans: "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

body {
  background: var(--color-root);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
  overflow: hidden;
}
```

- [ ] **Step 5: Set up layout.tsx with Google Fonts**

Replace `app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Wavr — Animated Gradient Editor",
  description: "Create and export animated gradient backgrounds",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Create minimal page.tsx placeholder**

Replace `app/page.tsx`:

```tsx
export default function Home() {
  return (
    <div className="h-screen w-screen bg-root flex items-center justify-center">
      <p className="text-text-secondary font-mono text-sm">Wavr loading...</p>
    </div>
  );
}
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Open `http://localhost:3000` — should see "Wavr loading..." on black background.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Tailwind and design tokens"
```

---

## Task 2: Zustand Store

**Files:**
- Create: `lib/store.ts`

- [ ] **Step 1: Create the store**

Create `lib/store.ts`:

```typescript
import { create } from "zustand";

export interface GradientState {
  // Gradient
  gradientType: "mesh" | "radial" | "linear" | "conic" | "plasma";
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  brightness: number;
  saturation: number;
  colors: [number, number, number][];

  // Noise
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseScale: number;
  grain: number;

  // Particles
  particlesEnabled: boolean;
  particleCount: number;
  particleSize: number;
  mouseReact: number;

  // Bloom
  bloomEnabled: boolean;
  bloomIntensity: number;
  vignette: number;

  // Playback
  playing: boolean;

  // Actions
  set: (partial: Partial<GradientState>) => void;
  setColor: (index: number, color: [number, number, number]) => void;
  addColor: () => void;
  removeColor: (index: number) => void;
  loadPreset: (preset: Partial<GradientState>) => void;
  randomize: () => void;
}

function randomHue(): [number, number, number] {
  const h = Math.random() * 360;
  const s = 0.6 + Math.random() * 0.4;
  const l = 0.4 + Math.random() * 0.3;
  return hslToRgb(h, s, l);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
}

const DEFAULTS: Omit<GradientState, "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize"> = {
  gradientType: "mesh",
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  brightness: 1.0,
  saturation: 1.0,
  colors: [
    [0.388, 0.357, 1.0],
    [1.0, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  noiseEnabled: false,
  noiseIntensity: 0.3,
  noiseScale: 1.0,
  grain: 0.0,
  particlesEnabled: false,
  particleCount: 50,
  particleSize: 2.0,
  mouseReact: 0.5,
  bloomEnabled: false,
  bloomIntensity: 0.3,
  vignette: 0.0,
  playing: true,
};

export const useGradientStore = create<GradientState>((set) => ({
  ...DEFAULTS,
  set: (partial) => set(partial),
  setColor: (index, color) =>
    set((state) => {
      const colors = [...state.colors] as [number, number, number][];
      colors[index] = color;
      return { colors };
    }),
  addColor: () =>
    set((state) => {
      if (state.colors.length >= 8) return state;
      return { colors: [...state.colors, randomHue()] };
    }),
  removeColor: (index) =>
    set((state) => {
      if (state.colors.length <= 2) return state;
      return { colors: state.colors.filter((_, i) => i !== index) };
    }),
  loadPreset: (preset) => set(preset),
  randomize: () => {
    const count = 3 + Math.floor(Math.random() * 3);
    const baseHue = Math.random() * 360;
    const colors: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const hue = (baseHue + i * (360 / count) + (Math.random() - 0.5) * 30) % 360;
      colors.push(hslToRgb(hue, 0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3));
    }
    const types: GradientState["gradientType"][] = ["mesh", "radial", "linear", "conic", "plasma"];
    set({
      colors,
      gradientType: types[Math.floor(Math.random() * types.length)],
      speed: 0.2 + Math.random() * 0.8,
      complexity: 2 + Math.floor(Math.random() * 4),
      scale: 0.5 + Math.random() * 2,
      distortion: Math.random() * 0.6,
    });
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add lib/store.ts
git commit -m "feat: add Zustand store with gradient state and actions"
```

---

## Task 3: GLSL Shaders

**Files:**
- Create: `lib/shaders/vertex.glsl`, `lib/shaders/fragment.glsl`

- [ ] **Step 1: Create vertex shader**

Create `lib/shaders/vertex.glsl`:

```glsl
#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
```

- [ ] **Step 2: Create fragment shader**

Create `lib/shaders/fragment.glsl`:

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

// Uniforms
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform int u_gradientType; // 0=mesh, 1=radial, 2=linear, 3=conic, 4=plasma
uniform float u_speed;
uniform float u_complexity;
uniform float u_scale;
uniform float u_distortion;
uniform float u_brightness;
uniform float u_saturation;
uniform vec3 u_colors[8];
uniform int u_colorCount;

// Effects
uniform bool u_noiseEnabled;
uniform float u_noiseIntensity;
uniform float u_noiseScale;
uniform float u_grain;
uniform bool u_particlesEnabled;
uniform float u_particleCount;
uniform float u_particleSize;
uniform float u_mouseReact;
uniform bool u_bloomEnabled;
uniform float u_bloomIntensity;
uniform float u_vignette;

// ============================================================
// Simplex Noise 2D
// ============================================================

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ============================================================
// Fractal Brownian Motion
// ============================================================

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    value += amplitude * snoise(p * frequency);
    frequency *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

// ============================================================
// Color Interpolation
// ============================================================

vec3 getGradientColor(float t) {
  t = clamp(t, 0.0, 1.0);
  float scaledT = t * float(u_colorCount - 1);
  int idx = int(floor(scaledT));
  float frac = fract(scaledT);

  // Smooth interpolation
  frac = frac * frac * (3.0 - 2.0 * frac);

  int nextIdx = idx + 1;
  if (nextIdx >= u_colorCount) nextIdx = u_colorCount - 1;

  return mix(u_colors[idx], u_colors[nextIdx], frac);
}

// ============================================================
// Gradient Modes
// ============================================================

vec3 meshGradient(vec2 uv, float time) {
  vec2 p = uv * u_scale;
  int octaves = int(u_complexity);

  // Mouse influence
  vec2 mouseOffset = (u_mouse - 0.5) * u_mouseReact * 0.5;
  p += mouseOffset;

  // Layered fBm for organic flowing effect
  float n1 = fbm(p + vec2(time * 0.3, time * 0.2), octaves);
  float n2 = fbm(p + vec2(n1 * u_distortion + time * 0.1, n1 * u_distortion - time * 0.15), octaves);
  float n3 = fbm(p + vec2(n2 * u_distortion * 0.8, n2 * u_distortion * 0.8 + time * 0.05), octaves);

  float colorVal = n3 * 0.5 + 0.5;
  return getGradientColor(colorVal);
}

vec3 radialGradient(vec2 uv, float time) {
  vec2 center = vec2(0.5) + (u_mouse - 0.5) * u_mouseReact * 0.2;
  vec2 p = (uv - center) * u_scale;
  float dist = length(p);
  float angle = atan(p.y, p.x);

  float wave = sin(dist * u_complexity * 3.14159 - time * 2.0 + angle * 2.0) * u_distortion;
  float n = fbm(vec2(dist + wave, angle + time * 0.2) * 2.0, int(u_complexity));

  float colorVal = dist + n * u_distortion;
  colorVal = fract(colorVal);
  return getGradientColor(colorVal);
}

vec3 linearGradient(vec2 uv, float time) {
  vec2 p = uv * u_scale;
  float mouseInfluence = (u_mouse.x - 0.5) * u_mouseReact * 0.3;

  float base = p.x + p.y * 0.5 + mouseInfluence;
  float wave = sin(p.y * u_complexity * 2.0 + time * 1.5) * u_distortion * 0.3;
  float n = fbm(p + vec2(time * 0.2, 0.0), int(u_complexity)) * u_distortion;

  float colorVal = fract(base + wave + n);
  return getGradientColor(colorVal);
}

vec3 conicGradient(vec2 uv, float time) {
  vec2 center = vec2(0.5) + (u_mouse - 0.5) * u_mouseReact * 0.15;
  vec2 p = (uv - center) * u_scale;
  float angle = atan(p.y, p.x) / 6.28318 + 0.5;
  float dist = length(p);

  float spiral = angle + dist * u_complexity * 0.5 - time * 0.3;
  float n = fbm(vec2(spiral, dist) * 2.0, int(u_complexity)) * u_distortion;

  float colorVal = fract(spiral + n);
  return getGradientColor(colorVal);
}

vec3 plasmaGradient(vec2 uv, float time) {
  vec2 p = uv * u_scale * 3.0;
  vec2 mouseOff = (u_mouse - 0.5) * u_mouseReact * 0.4;
  p += mouseOff;

  float v = 0.0;
  v += sin(p.x * u_complexity + time);
  v += sin((p.y * u_complexity + time) * 0.7);
  v += sin((p.x * u_complexity + p.y * u_complexity + time) * 0.5);
  float cx = p.x + 0.5 * sin(time * 0.3);
  float cy = p.y + 0.5 * cos(time * 0.4);
  v += sin(sqrt(cx * cx + cy * cy + 1.0) * u_complexity);

  float colorVal = v * 0.25 + 0.5;
  colorVal += fbm(p * 0.5 + time * 0.1, int(min(u_complexity, 4.0))) * u_distortion * 0.3;
  return getGradientColor(fract(colorVal));
}

// ============================================================
// Particles
// ============================================================

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float renderParticles(vec2 uv, float time) {
  float result = 0.0;
  float count = u_particleCount;
  float size = u_particleSize / u_resolution.x;

  for (float i = 0.0; i < 300.0; i++) {
    if (i >= count) break;

    vec2 seed = vec2(i * 0.123, i * 0.456);
    vec2 pos = vec2(hash(seed), hash(seed + 1.0));

    // Drift
    pos.x += sin(time * 0.3 + i * 0.7) * 0.05;
    pos.y += cos(time * 0.2 + i * 1.1) * 0.05;
    pos = fract(pos);

    // Mouse reaction
    vec2 toMouse = u_mouse - pos;
    float mouseDist = length(toMouse);
    pos += normalize(toMouse + 0.001) * u_mouseReact * 0.03 / (mouseDist + 0.1);
    pos = clamp(pos, 0.0, 1.0);

    float d = length(uv - pos);
    float glow = smoothstep(size * 3.0, 0.0, d) * 0.5;
    float core = smoothstep(size, size * 0.3, d);
    result += (glow + core) * (0.5 + 0.5 * hash(seed + 2.0));
  }
  return clamp(result, 0.0, 1.0);
}

// ============================================================
// Post-Processing
// ============================================================

vec3 adjustSaturation(vec3 color, float sat) {
  float grey = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(grey), color, sat);
}

// ============================================================
// Main
// ============================================================

void main() {
  vec2 uv = v_uv;
  float time = u_time * u_speed;

  // Base gradient
  vec3 color;
  if (u_gradientType == 0) color = meshGradient(uv, time);
  else if (u_gradientType == 1) color = radialGradient(uv, time);
  else if (u_gradientType == 2) color = linearGradient(uv, time);
  else if (u_gradientType == 3) color = conicGradient(uv, time);
  else color = plasmaGradient(uv, time);

  // Noise overlay
  if (u_noiseEnabled) {
    float n = snoise(uv * u_noiseScale * 10.0 + time * 0.5) * 0.5 + 0.5;
    color = mix(color, color * (0.5 + n), u_noiseIntensity);
  }

  // Particles
  if (u_particlesEnabled) {
    float p = renderParticles(uv, u_time);
    vec3 particleColor = getGradientColor(uv.x * 0.5 + uv.y * 0.5);
    color += particleColor * p * 0.6;
  }

  // Bloom (simplified single-pass glow)
  if (u_bloomEnabled) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float bloomMask = smoothstep(0.6, 1.0, luminance);
    color += color * bloomMask * u_bloomIntensity;
  }

  // Saturation
  color = adjustSaturation(color, u_saturation);

  // Brightness
  color *= u_brightness;

  // Vignette
  if (u_vignette > 0.0) {
    float vig = length(uv - 0.5) * 1.414;
    vig = smoothstep(0.5, 1.2, vig);
    color *= 1.0 - vig * u_vignette;
  }

  // Film grain
  if (u_grain > 0.0) {
    float grainNoise = hash(uv * u_resolution + fract(u_time * 100.0)) * 2.0 - 1.0;
    color += grainNoise * u_grain * 0.15;
  }

  // Tone mapping (simple reinhard)
  color = color / (color + 1.0);

  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/shaders/
git commit -m "feat: add vertex and fragment shaders with 5 gradient modes and effects"
```

---

## Task 4: WebGL Engine

**Files:**
- Create: `lib/engine.ts`

- [ ] **Step 1: Create the WebGL engine**

Create `lib/engine.ts`:

```typescript
import vertexSource from "./shaders/vertex.glsl";
import fragmentSource from "./shaders/fragment.glsl";
import { GradientState } from "./store";

type UniformMap = Record<string, WebGLUniformLocation>;

export class GradientEngine {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms: UniformMap = {};
  private startTime: number;
  private animationId: number | null = null;
  private mouseX = 0.5;
  private mouseY = 0.5;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL 2 not supported");
    this.gl = gl;
    this.startTime = performance.now() / 1000;

    // Compile shaders
    const vertShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    // Link program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      throw new Error(`Program link failed: ${log}`);
    }

    this.program = program;
    gl.useProgram(program);

    // Setup fullscreen quad
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
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

    // Cache uniform locations
    this.cacheUniforms();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  private cacheUniforms() {
    const gl = this.gl;
    const names = [
      "u_time", "u_resolution", "u_mouse", "u_gradientType",
      "u_speed", "u_complexity", "u_scale", "u_distortion",
      "u_brightness", "u_saturation", "u_colorCount",
      "u_noiseEnabled", "u_noiseIntensity", "u_noiseScale", "u_grain",
      "u_particlesEnabled", "u_particleCount", "u_particleSize", "u_mouseReact",
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette",
    ];
    for (const name of names) {
      const loc = gl.getUniformLocation(this.program, name);
      if (loc) this.uniforms[name] = loc;
    }
    // Color array
    for (let i = 0; i < 8; i++) {
      const loc = gl.getUniformLocation(this.program, `u_colors[${i}]`);
      if (loc) this.uniforms[`u_colors[${i}]`] = loc;
    }
  }

  setMouse(x: number, y: number) {
    this.mouseX = x;
    this.mouseY = y;
  }

  resize(width: number, height: number) {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    gl.canvas.width = width * dpr;
    gl.canvas.height = height * dpr;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  private setUniforms(state: GradientState) {
    const gl = this.gl;
    const u = this.uniforms;

    const now = performance.now() / 1000 - this.startTime;
    if (u.u_time) gl.uniform1f(u.u_time, now);
    if (u.u_resolution) gl.uniform2f(u.u_resolution, gl.canvas.width, gl.canvas.height);
    if (u.u_mouse) gl.uniform2f(u.u_mouse, this.mouseX, this.mouseY);

    const typeMap: Record<string, number> = { mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4 };
    if (u.u_gradientType) gl.uniform1i(u.u_gradientType, typeMap[state.gradientType]);

    if (u.u_speed) gl.uniform1f(u.u_speed, state.speed);
    if (u.u_complexity) gl.uniform1f(u.u_complexity, state.complexity);
    if (u.u_scale) gl.uniform1f(u.u_scale, state.scale);
    if (u.u_distortion) gl.uniform1f(u.u_distortion, state.distortion);
    if (u.u_brightness) gl.uniform1f(u.u_brightness, state.brightness);
    if (u.u_saturation) gl.uniform1f(u.u_saturation, state.saturation);

    // Colors
    if (u.u_colorCount) gl.uniform1i(u.u_colorCount, state.colors.length);
    for (let i = 0; i < 8; i++) {
      const key = `u_colors[${i}]`;
      if (u[key] && i < state.colors.length) {
        gl.uniform3fv(u[key], state.colors[i]);
      }
    }

    // Effects
    if (u.u_noiseEnabled) gl.uniform1i(u.u_noiseEnabled, state.noiseEnabled ? 1 : 0);
    if (u.u_noiseIntensity) gl.uniform1f(u.u_noiseIntensity, state.noiseIntensity);
    if (u.u_noiseScale) gl.uniform1f(u.u_noiseScale, state.noiseScale);
    if (u.u_grain) gl.uniform1f(u.u_grain, state.grain);
    if (u.u_particlesEnabled) gl.uniform1i(u.u_particlesEnabled, state.particlesEnabled ? 1 : 0);
    if (u.u_particleCount) gl.uniform1f(u.u_particleCount, state.particleCount);
    if (u.u_particleSize) gl.uniform1f(u.u_particleSize, state.particleSize);
    if (u.u_mouseReact) gl.uniform1f(u.u_mouseReact, state.mouseReact);
    if (u.u_bloomEnabled) gl.uniform1i(u.u_bloomEnabled, state.bloomEnabled ? 1 : 0);
    if (u.u_bloomIntensity) gl.uniform1f(u.u_bloomIntensity, state.bloomIntensity);
    if (u.u_vignette) gl.uniform1f(u.u_vignette, state.vignette);
  }

  render(state: GradientState) {
    const gl = this.gl;
    this.setUniforms(state);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  startLoop(getState: () => GradientState, onFrame?: (fps: number) => void) {
    let lastFpsUpdate = performance.now();
    let frameCount = 0;

    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      const state = getState();
      if (!state.playing) return;

      this.render(state);

      // FPS tracking
      frameCount++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 500) {
        const fps = Math.round((frameCount / (now - lastFpsUpdate)) * 1000);
        onFrame?.(fps);
        frameCount = 0;
        lastFpsUpdate = now;
      }
    };
    loop();
  }

  stopLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  destroy() {
    this.stopLoop();
    this.gl.deleteProgram(this.program);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/engine.ts
git commit -m "feat: add WebGL engine with shader compilation, render loop, and uniform management"
```

---

## Task 5: Canvas Component

**Files:**
- Create: `components/Canvas.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create Canvas component**

Create `components/Canvas.tsx`:

```tsx
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GradientEngine } from "@/lib/engine";
import { useGradientStore } from "@/lib/store";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  const [fps, setFps] = useState(0);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engineRef.current.setMouse(x, y);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GradientEngine(canvas);
    engineRef.current = engine;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      engine.resize(parent.clientWidth, parent.clientHeight);
      // Set CSS size
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = parent.clientHeight + "px";
    };

    resize();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    engine.startLoop(() => useGradientStore.getState(), setFps);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(resizeTimeout);
      engine.destroy();
    };
  }, [handleMouseMove]);

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute bottom-3 left-3 font-mono text-[11px] text-text-tertiary bg-base/70 px-2 py-0.5 rounded">
        {fps} FPS
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update page.tsx to render Canvas**

Replace `app/page.tsx`:

```tsx
import Canvas from "@/components/Canvas";

export default function Home() {
  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      {/* TopBar placeholder */}
      <div className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center px-4">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">WAVR</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <Canvas />
        {/* Sidebar placeholder */}
        <div className="w-[320px] shrink-0 bg-base border-l border-border" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify — animated gradient renders on screen**

```bash
npm run dev
```

Open `http://localhost:3000` — should see animated mesh gradient filling the left area with FPS counter in bottom-left.

- [ ] **Step 4: Commit**

```bash
git add components/Canvas.tsx app/page.tsx
git commit -m "feat: add WebGL canvas component with live animated gradient rendering"
```

---

## Task 6: UI Primitives

**Files:**
- Create: `components/ui/Slider.tsx`, `components/ui/Toggle.tsx`, `components/ui/ColorInput.tsx`, `components/ui/Select.tsx`

These four components are independent and can be built in parallel.

- [ ] **Step 1: Create Slider component**

Create `components/ui/Slider.tsx`:

```tsx
"use client";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export default function Slider({ label, value, min, max, step, onChange, disabled }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="font-mono text-xs text-text-tertiary tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.4)]
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-0
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
          [&::-webkit-slider-thumb]:hover:scale-110"
        style={{
          background: `linear-gradient(to right, #635BFF ${percent}%, rgba(255,255,255,0.08) ${percent}%)`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create Toggle component**

Create `components/ui/Toggle.tsx`:

```tsx
"use client";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors duration-150">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-150 ${
          checked ? "bg-accent" : "bg-elevated"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
```

- [ ] **Step 3: Create ColorInput component**

Create `components/ui/ColorInput.tsx`:

```tsx
"use client";

import { useRef } from "react";

interface ColorInputProps {
  color: [number, number, number];
  onChange: (color: [number, number, number]) => void;
  onRemove?: () => void;
  canRemove?: boolean;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
  ];
}

export default function ColorInput({ color, onChange, onRemove, canRemove }: ColorInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const hex = rgbToHex(...color);

  return (
    <div className="flex items-center gap-2 group">
      <button
        className="w-7 h-7 rounded-md border border-border-active shrink-0 cursor-pointer transition-transform hover:scale-105"
        style={{ backgroundColor: hex }}
        onClick={() => pickerRef.current?.click()}
      />
      <input
        ref={pickerRef}
        type="color"
        value={hex}
        onChange={(e) => onChange(hexToRgb(e.target.value))}
        className="sr-only"
      />
      <input
        type="text"
        value={hex.toUpperCase()}
        onChange={(e) => {
          const val = e.target.value;
          if (/^#[0-9a-fA-F]{6}$/.test(val)) {
            onChange(hexToRgb(val));
          }
        }}
        className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-xs font-mono text-text-primary
          focus:outline-none focus:border-border-active transition-colors duration-150"
      />
      {canRemove && (
        <button
          onClick={onRemove}
          className="text-text-tertiary hover:text-text-primary transition-colors text-sm opacity-0 group-hover:opacity-100"
        >
          x
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create Select component**

Create `components/ui/Select.tsx`:

```tsx
"use client";

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export default function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary
          appearance-none cursor-pointer
          focus:outline-none focus:border-border-active transition-colors duration-150
          bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%238a8f98%22%20d%3D%22M3%204.5l3%203%203-3%22%2F%3E%3C%2Fsvg%3E')]
          bg-no-repeat bg-[right_8px_center]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/ui/
git commit -m "feat: add UI primitives — Slider, Toggle, ColorInput, Select"
```

---

## Task 7: Sidebar + GradientPanel

**Files:**
- Create: `components/Sidebar.tsx`, `components/GradientPanel.tsx`

- [ ] **Step 1: Create GradientPanel**

Create `components/GradientPanel.tsx`:

```tsx
"use client";

import { useGradientStore } from "@/lib/store";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import ColorInput from "@/components/ui/ColorInput";

const GRADIENT_OPTIONS = [
  { value: "mesh", label: "Mesh" },
  { value: "radial", label: "Radial" },
  { value: "linear", label: "Linear" },
  { value: "conic", label: "Conic" },
  { value: "plasma", label: "Plasma" },
];

export default function GradientPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-5 p-4">
      <Select
        label="Gradient Type"
        value={store.gradientType}
        options={GRADIENT_OPTIONS}
        onChange={(v) => store.set({ gradientType: v as typeof store.gradientType })}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-text-secondary">Colors</span>
        {store.colors.map((color, i) => (
          <ColorInput
            key={i}
            color={color}
            onChange={(c) => store.setColor(i, c)}
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

      <div className="flex flex-col gap-3">
        <Slider label="Speed" value={store.speed} min={0} max={2} step={0.01} onChange={(v) => store.set({ speed: v })} />
        <Slider label="Complexity" value={store.complexity} min={1} max={8} step={1} onChange={(v) => store.set({ complexity: v })} />
        <Slider label="Scale" value={store.scale} min={0.2} max={4} step={0.01} onChange={(v) => store.set({ scale: v })} />
        <Slider label="Distortion" value={store.distortion} min={0} max={1} step={0.01} onChange={(v) => store.set({ distortion: v })} />
        <Slider label="Brightness" value={store.brightness} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ brightness: v })} />
        <Slider label="Saturation" value={store.saturation} min={0} max={2} step={0.01} onChange={(v) => store.set({ saturation: v })} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Sidebar with tabs**

Create `components/Sidebar.tsx`:

```tsx
"use client";

import { useState } from "react";
import GradientPanel from "@/components/GradientPanel";

const TABS = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabId>("gradient");

  return (
    <div className="w-[320px] shrink-0 bg-base border-l border-border flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors duration-150 ${
              activeTab === tab.id
                ? "text-text-primary border-b border-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "effects" && (
          <div className="p-4 text-xs text-text-tertiary">Effects panel — Task 8</div>
        )}
        {activeTab === "presets" && (
          <div className="p-4 text-xs text-text-tertiary">Presets panel — Task 10</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update page.tsx to use Sidebar**

Replace `app/page.tsx`:

```tsx
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      {/* TopBar placeholder */}
      <div className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center px-4">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">WAVR</span>
      </div>
      <div className="flex flex-1 min-h-0">
        <Canvas />
        <Sidebar />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify — sidebar controls change the gradient in real-time**

Open browser: switch gradient types, drag sliders, add/change colors. All should update live.

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx components/GradientPanel.tsx app/page.tsx
git commit -m "feat: add Sidebar with GradientPanel — type, colors, and parameter controls"
```

---

## Task 8: EffectsPanel

**Files:**
- Create: `components/EffectsPanel.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Create EffectsPanel**

Create `components/EffectsPanel.tsx`:

```tsx
"use client";

import { useGradientStore } from "@/lib/store";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";

export default function EffectsPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Noise & Grain */}
      <div className="flex flex-col gap-3">
        <Toggle label="Noise Overlay" checked={store.noiseEnabled} onChange={(v) => store.set({ noiseEnabled: v })} />
        <Slider label="Intensity" value={store.noiseIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ noiseIntensity: v })} disabled={!store.noiseEnabled} />
        <Slider label="Scale" value={store.noiseScale} min={0.1} max={5} step={0.1} onChange={(v) => store.set({ noiseScale: v })} disabled={!store.noiseEnabled} />
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-3">
        <Slider label="Film Grain" value={store.grain} min={0} max={1} step={0.01} onChange={(v) => store.set({ grain: v })} />
      </div>

      <div className="border-t border-border" />

      {/* Particles */}
      <div className="flex flex-col gap-3">
        <Toggle label="Particles" checked={store.particlesEnabled} onChange={(v) => store.set({ particlesEnabled: v })} />
        <Slider label="Count" value={store.particleCount} min={10} max={300} step={1} onChange={(v) => store.set({ particleCount: v })} disabled={!store.particlesEnabled} />
        <Slider label="Size" value={store.particleSize} min={0.5} max={6} step={0.1} onChange={(v) => store.set({ particleSize: v })} disabled={!store.particlesEnabled} />
        <Slider label="Mouse React" value={store.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} disabled={!store.particlesEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Bloom & Vignette */}
      <div className="flex flex-col gap-3">
        <Toggle label="Bloom" checked={store.bloomEnabled} onChange={(v) => store.set({ bloomEnabled: v })} />
        <Slider label="Intensity" value={store.bloomIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ bloomIntensity: v })} disabled={!store.bloomEnabled} />
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-3">
        <Slider label="Vignette" value={store.vignette} min={0} max={1} step={0.01} onChange={(v) => store.set({ vignette: v })} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire EffectsPanel into Sidebar**

In `components/Sidebar.tsx`, add the import and replace the placeholder:

```tsx
// Add import at top
import EffectsPanel from "@/components/EffectsPanel";

// Replace the effects placeholder in the tab content:
{activeTab === "effects" && <EffectsPanel />}
```

- [ ] **Step 3: Verify — toggle noise, particles, bloom and see effects on canvas**

- [ ] **Step 4: Commit**

```bash
git add components/EffectsPanel.tsx components/Sidebar.tsx
git commit -m "feat: add EffectsPanel — noise, grain, particles, bloom, vignette controls"
```

---

## Task 9: TopBar

**Files:**
- Create: `components/TopBar.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create TopBar**

Create `components/TopBar.tsx`:

```tsx
"use client";

import { useGradientStore } from "@/lib/store";

interface TopBarProps {
  onExport: () => void;
}

export default function TopBar({ onExport }: TopBarProps) {
  const { playing, randomize, set } = useGradientStore();

  return (
    <header className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider">WAVR</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={randomize}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150"
        >
          Randomize
        </button>
        <button
          onClick={() => set({ playing: !playing })}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150 w-16"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs text-white bg-accent hover:bg-accent/80
            rounded-md transition-all duration-150"
        >
          Export
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Wire TopBar into page.tsx**

Replace `app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function Home() {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      <TopBar onExport={() => setExportOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <Canvas />
        <Sidebar />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify — Randomize changes gradient, Play/Pause toggles animation**

- [ ] **Step 4: Commit**

```bash
git add components/TopBar.tsx app/page.tsx
git commit -m "feat: add TopBar with randomize, play/pause, and export buttons"
```

---

## Task 10: Presets

**Files:**
- Create: `lib/presets.ts`, `components/PresetsPanel.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Create presets data**

Create `lib/presets.ts`:

```typescript
import { GradientState } from "./store";

type PresetData = Partial<Omit<GradientState, "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize">>;

export interface Preset {
  name: string;
  data: PresetData;
}

export const PRESETS: Preset[] = [
  {
    name: "Aurora",
    data: {
      gradientType: "mesh",
      speed: 0.4,
      complexity: 4,
      scale: 1.2,
      distortion: 0.35,
      brightness: 1.0,
      saturation: 1.2,
      colors: [
        [0.0, 0.9, 0.8],   // cyan
        [0.2, 0.8, 0.3],   // green
        [0.3, 0.2, 0.7],   // indigo
        [0.2, 0.4, 1.0],   // blue
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.2,
    },
  },
  {
    name: "Sunset",
    data: {
      gradientType: "mesh",
      speed: 0.3,
      complexity: 3,
      scale: 1.0,
      distortion: 0.3,
      brightness: 1.1,
      saturation: 1.3,
      colors: [
        [1.0, 0.5, 0.31],  // coral
        [1.0, 0.84, 0.0],  // gold
        [1.0, 0.65, 0.0],  // orange
        [0.94, 0.33, 0.48], // rose
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.3,
    },
  },
  {
    name: "Midnight",
    data: {
      gradientType: "mesh",
      speed: 0.25,
      complexity: 4,
      scale: 1.3,
      distortion: 0.25,
      brightness: 0.8,
      saturation: 1.0,
      colors: [
        [0.0, 0.0, 0.5],   // navy
        [0.29, 0.0, 0.51],  // indigo
        [0.0, 0.8, 0.8],   // cyan
        [0.0, 0.1, 0.4],   // dark blue
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: false,
      grain: 0.08,
      vignette: 0.4,
    },
  },
  {
    name: "Candy",
    data: {
      gradientType: "plasma",
      speed: 0.6,
      complexity: 3,
      scale: 0.8,
      distortion: 0.2,
      brightness: 1.1,
      saturation: 1.4,
      colors: [
        [1.0, 0.41, 0.71],  // pink
        [0.58, 0.0, 0.83],  // purple
        [0.0, 1.0, 1.0],   // cyan
        [1.0, 1.0, 0.0],   // yellow
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0,
    },
  },
  {
    name: "Ocean",
    data: {
      gradientType: "linear",
      speed: 0.35,
      complexity: 4,
      scale: 1.5,
      distortion: 0.4,
      brightness: 0.9,
      saturation: 1.2,
      colors: [
        [0.0, 0.0, 1.0],   // blue
        [0.25, 0.41, 0.88], // royal blue
        [0.53, 0.81, 0.92], // sky blue
        [0.0, 0.5, 0.5],   // teal
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.2,
    },
  },
  {
    name: "Lava",
    data: {
      gradientType: "mesh",
      speed: 0.5,
      complexity: 5,
      scale: 1.0,
      distortion: 0.45,
      brightness: 1.2,
      saturation: 1.4,
      colors: [
        [1.0, 0.0, 0.0],   // red
        [1.0, 0.65, 0.0],  // orange
        [1.0, 0.84, 0.0],  // gold
        [0.55, 0.0, 0.0],  // dark red
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: true,
      bloomIntensity: 0.4,
      grain: 0.06,
      vignette: 0.3,
    },
  },
  {
    name: "Cyber",
    data: {
      gradientType: "conic",
      speed: 0.4,
      complexity: 3,
      scale: 1.2,
      distortion: 0.3,
      brightness: 1.0,
      saturation: 1.3,
      colors: [
        [0.0, 1.0, 0.0],   // green
        [0.0, 1.0, 1.0],   // cyan
        [0.29, 0.0, 0.51],  // indigo
        [0.2, 0.8, 0.4],   // emerald
      ],
      noiseEnabled: false,
      particlesEnabled: true,
      particleCount: 80,
      particleSize: 2.0,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.15,
    },
  },
  {
    name: "Monochrome",
    data: {
      gradientType: "mesh",
      speed: 0.3,
      complexity: 4,
      scale: 1.0,
      distortion: 0.3,
      brightness: 1.0,
      saturation: 0.1,
      colors: [
        [0.2, 0.2, 0.2],   // charcoal
        [0.5, 0.5, 0.5],   // gray
        [0.95, 0.95, 0.95], // white
        [0.44, 0.5, 0.56],  // steel
      ],
      noiseEnabled: false,
      particlesEnabled: false,
      bloomEnabled: false,
      grain: 0.1,
      vignette: 0.25,
    },
  },
];
```

- [ ] **Step 2: Create PresetsPanel**

Create `components/PresetsPanel.tsx`:

```tsx
"use client";

import { useGradientStore } from "@/lib/store";
import { PRESETS } from "@/lib/presets";

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function PresetsPanel() {
  const loadPreset = useGradientStore((s) => s.loadPreset);

  return (
    <div className="p-4 grid grid-cols-2 gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.name}
          onClick={() => loadPreset(preset.data)}
          className="flex flex-col rounded-lg border border-border hover:border-border-active overflow-hidden
            transition-all duration-150 hover:scale-[1.02] group"
        >
          {/* Color preview */}
          <div
            className="h-20 w-full"
            style={{
              background: `linear-gradient(135deg, ${preset.data.colors!
                .map((c) => rgbToHex(...c))
                .join(", ")})`,
            }}
          />
          <div className="py-2 px-2.5 bg-surface w-full">
            <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
              {preset.name}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire PresetsPanel into Sidebar**

In `components/Sidebar.tsx`, add the import and replace the placeholder:

```tsx
// Add import at top
import PresetsPanel from "@/components/PresetsPanel";

// Replace the presets placeholder:
{activeTab === "presets" && <PresetsPanel />}
```

- [ ] **Step 4: Verify — clicking presets loads different gradients instantly**

- [ ] **Step 5: Commit**

```bash
git add lib/presets.ts components/PresetsPanel.tsx components/Sidebar.tsx
git commit -m "feat: add 8 presets with PresetsPanel grid"
```

---

## Task 11: Export System

**Files:**
- Create: `lib/export.ts`, `components/ExportModal.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create export functions**

Create `lib/export.ts`:

```typescript
export function exportPNG(canvas: HTMLCanvasElement, filename = "wavr-gradient.png") {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function exportCSS(colors: [number, number, number][]): string {
  const hexColors = colors.map(([r, g, b]) => {
    const toHex = (n: number) =>
      Math.round(n * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  });

  const stops = hexColors.join(", ");

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

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function exportWebM(
  canvas: HTMLCanvasElement,
  duration = 5000,
  filename = "wavr-gradient.webm",
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    };

    recorder.onerror = () => reject(new Error("Recording failed"));

    recorder.start();

    // Progress tracking
    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(elapsed / duration, 1));
    }, 100);

    setTimeout(() => {
      clearInterval(progressInterval);
      recorder.stop();
      onProgress?.(1);
    }, duration);
  });
}
```

- [ ] **Step 2: Create ExportModal**

Create `components/ExportModal.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import { useGradientStore } from "@/lib/store";
import { exportPNG, exportCSS, copyToClipboard, exportWebM } from "@/lib/export";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  canvasRef: HTMLCanvasElement | null;
}

export default function ExportModal({ open, onClose, canvasRef }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const colors = useGradientStore((s) => s.colors);

  if (!open) return null;

  const handlePNG = () => {
    if (canvasRef) exportPNG(canvasRef);
  };

  const handleCSS = async () => {
    const css = exportCSS(colors);
    await copyToClipboard(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWebM = async () => {
    if (!canvasRef || recording) return;
    setRecording(true);
    setProgress(0);
    await exportWebM(canvasRef, 5000, "wavr-gradient.webm", setProgress);
    setRecording(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-base border border-border rounded-xl p-6 w-[380px] shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-medium text-text-primary">Export</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg transition-colors">
            x
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handlePNG}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
              hover:border-border-active transition-all duration-150 group"
          >
            <div className="text-left">
              <div className="text-xs font-medium text-text-primary">PNG Image</div>
              <div className="text-xs text-text-tertiary mt-0.5">Full resolution screenshot</div>
            </div>
            <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">Download</span>
          </button>

          <button
            onClick={handleCSS}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
              hover:border-border-active transition-all duration-150 group"
          >
            <div className="text-left">
              <div className="text-xs font-medium text-text-primary">CSS Code</div>
              <div className="text-xs text-text-tertiary mt-0.5">Animated gradient CSS</div>
            </div>
            <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>

          <button
            onClick={handleWebM}
            disabled={recording}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
              hover:border-border-active transition-all duration-150 group disabled:opacity-50"
          >
            <div className="text-left">
              <div className="text-xs font-medium text-text-primary">WebM Video</div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {recording ? `Recording... ${Math.round(progress * 100)}%` : "5 second recording"}
              </div>
            </div>
            <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
              {recording ? "..." : "Record"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Expose canvas element from Canvas component**

Update `components/Canvas.tsx` to accept a ref callback. Add this prop and effect:

```tsx
// Change component signature to accept onCanvasReady callback:
interface CanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export default function Canvas({ onCanvasReady }: CanvasProps) {
  // ... existing code ...

  // After engine creation in useEffect, add:
  onCanvasReady?.(canvas);

  // ... rest of existing code ...
}
```

- [ ] **Step 4: Wire ExportModal into page.tsx**

Update `app/page.tsx`:

```tsx
"use client";

import { useState, useRef } from "react";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ExportModal from "@/components/ExportModal";

export default function Home() {
  const [exportOpen, setExportOpen] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      <TopBar onExport={() => setExportOpen(true)} />
      <div className="flex flex-1 min-h-0">
        <Canvas onCanvasReady={(el) => { canvasElRef.current = el; }} />
        <Sidebar />
      </div>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasElRef.current}
      />
    </div>
  );
}
```

- [ ] **Step 5: Verify — PNG downloads, CSS copies to clipboard, WebM records and downloads**

- [ ] **Step 6: Commit**

```bash
git add lib/export.ts components/ExportModal.tsx components/Canvas.tsx app/page.tsx
git commit -m "feat: add export system — PNG download, CSS copy, WebM recording"
```

---

## Task 12: Polish & Final Integration

**Files:**
- Modify: various existing files for final polish

- [ ] **Step 1: Add scrollbar styling to globals.css**

Append to `app/globals.css`:

```css
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
```

- [ ] **Step 2: Verify full application works end-to-end**

Test checklist:
- [ ] All 5 gradient types render differently
- [ ] Colors can be added, changed, removed
- [ ] All sliders update the gradient in real-time
- [ ] Mouse movement affects gradient
- [ ] Noise, particles, bloom effects toggle on/off
- [ ] All 8 presets load correctly
- [ ] Randomize generates new gradient
- [ ] Play/Pause works
- [ ] Export PNG downloads
- [ ] Export CSS copies to clipboard
- [ ] Export WebM records and downloads
- [ ] FPS counter visible

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Fix any type errors or build issues.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: polish — scrollbar styling, final integration"
```

---

## Parallelism Map

```
Task 1 (Scaffold)
  └→ Task 2 (Store) + Task 3 (Shaders) — independent, can run in parallel
       └→ Task 4 (Engine) — depends on store + shaders
            └→ Task 5 (Canvas) — depends on engine
                 ├→ Task 6 (UI Primitives) — independent of canvas internals
                 │    └→ Task 7 (GradientPanel + Sidebar) — needs UI primitives
                 │         ├→ Task 8 (EffectsPanel) — independent
                 │         └→ Task 10 (Presets) — independent
                 ├→ Task 9 (TopBar) — independent of sidebar
                 └→ Task 11 (Export) — needs canvas ref
Task 12 (Polish) — after all others
```

Tasks 2+3, 8+9+10, and 6 (within itself) can be parallelized.
