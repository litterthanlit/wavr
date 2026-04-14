# @wavr/gradient npm Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure Wavr into a monorepo and publish `@wavr/gradient`, a standalone React component for embedding animated WebGL gradients.

**Architecture:** Three-package monorepo — `@wavr/core` (internal engine + shader + presets), `@wavr/gradient` (published React wrapper), and `apps/editor` (existing Next.js app). The React component wraps a vanilla `createGradient()` API. Full shader bundled (~5KB gzipped) for editor parity.

**Tech Stack:** pnpm workspaces, Turborepo, tsup (esbuild), TypeScript, React 18+, WebGL 2

**Design Spec:** `docs/superpowers/specs/2026-04-14-wavr-gradient-npm-package-design.md`

---

## File Structure

### New Files

```
packages/core/
├── src/
│   ├── index.ts              ← Public exports
│   ├── types.ts              ← GradientConfig, LayerConfig, RGBColor
│   ├── config.ts             ← resolveConfig(), stateToConfig()
│   ├── create.ts             ← createGradient() imperative API
│   ├── engine.ts             ← (moved from lib/engine.ts)
│   ├── layers.ts             ← (moved from lib/layers.ts)
│   ├── math.ts               ← (moved from lib/math.ts)
│   ├── shaders/
│   │   ├── fragment.glsl     ← (moved from lib/shaders/fragment.glsl)
│   │   └── vertex.glsl       ← (moved from lib/shaders/vertex.glsl)
│   └── presets/
│       ├── index.ts          ← Individual named exports (tree-shakeable)
│       ├── all.ts            ← Full preset map
│       ├── classic.ts        ← (converted from lib/presets/classic.ts)
│       ├── dither.ts
│       ├── scanline.ts
│       ├── glitch.ts
│       ├── cinematic.ts
│       ├── nature.ts
│       └── abstract.ts
├── package.json
└── tsconfig.json

packages/react/
├── src/
│   ├── index.ts              ← Main entry: WavrGradient + types
│   ├── WavrGradient.tsx      ← React wrapper component
│   ├── presets.ts            ← Re-exports from @wavr/core/presets
│   └── presets-all.ts        ← Re-exports from @wavr/core/presets/all
├── package.json
├── tsconfig.json
└── tsup.config.ts

Root config:
├── pnpm-workspace.yaml
├── turbo.json
└── package.json              ← Workspace root
```

### Modified Files (Editor Import Updates)

All files in `components/` and `app/` that import from `@/lib/engine`, `@/lib/layers`, `@/lib/math`, or `@/lib/presets` will be updated to import from `@wavr/core`. Files that import from `@/lib/store`, `@/lib/timeline`, `@/lib/export`, `@/lib/audio`, `@/lib/projects`, `@/lib/url` stay unchanged (editor-only modules).

---

## Phase A: Monorepo Setup & Core Package

### Task 1: Initialize Monorepo Workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Modify: `package.json` (root workspace config)

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "lint": {}
  }
}
```

- [ ] **Step 3: Update root package.json**

Replace the current `package.json` content with a workspace root config. The editor's deps move to `apps/editor/package.json` in a later task.

```json
{
  "name": "wavr",
  "private": true,
  "scripts": {
    "dev": "turbo dev --filter=editor",
    "build": "turbo build",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.4.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

- [ ] **Step 4: Install pnpm and turbo**

```bash
npm install -g pnpm
pnpm install
```

Note: Don't run install yet — we need to create the workspace packages first. Just create the config files for now.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json
git commit -m "chore: initialize monorepo workspace config"
```

---

### Task 2: Create packages/core — Scaffold and Move Engine Files

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`
- Move: `lib/engine.ts` → `packages/core/src/engine.ts`
- Move: `lib/layers.ts` → `packages/core/src/layers.ts`
- Move: `lib/math.ts` → `packages/core/src/math.ts`
- Move: `lib/shaders/fragment.glsl` → `packages/core/src/shaders/fragment.glsl`
- Move: `lib/shaders/vertex.glsl` → `packages/core/src/shaders/vertex.glsl`
- Create: `packages/core/src/glsl.d.ts`

- [ ] **Step 1: Create packages/core/package.json**

```json
{
  "name": "@wavr/core",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./presets": "./src/presets/index.ts",
    "./presets/all": "./src/presets/all.ts"
  },
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create packages/core/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

- [ ] **Step 3: Create GLSL type declaration**

Create `packages/core/src/glsl.d.ts`:

```typescript
declare module "*.glsl" {
  const value: string;
  export default value;
}
```

- [ ] **Step 4: Move engine files**

```bash
mkdir -p packages/core/src/shaders
cp lib/engine.ts packages/core/src/engine.ts
cp lib/layers.ts packages/core/src/layers.ts
cp lib/math.ts packages/core/src/math.ts
cp lib/shaders/fragment.glsl packages/core/src/shaders/fragment.glsl
cp lib/shaders/vertex.glsl packages/core/src/shaders/vertex.glsl
```

Note: We `cp` (not `mv`) for now — the editor still needs the originals until imports are updated in Task 7.

- [ ] **Step 5: Fix engine.ts imports for new location**

In `packages/core/src/engine.ts`, the imports reference relative paths. Update:

```typescript
import vertexSource from "./shaders/vertex.glsl";
import fragmentSource from "./shaders/fragment.glsl";
import { BlendMode, LayerParams } from "./layers";
import { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply } from "./math";
```

Remove the import of `GradientState` from `./store` — the engine currently imports this type. Instead, define a minimal `EngineState` interface in engine.ts that only includes the fields the engine actually reads. Read the current `GradientState` usage in engine.ts to determine the exact fields needed.

The engine's `render(state: GradientState)` method reads specific fields. Create a local interface:

```typescript
// Minimal state interface for the engine (decoupled from Zustand store)
export interface EngineState {
  layers: LayerParams[];
  brightness: number;
  saturation: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseScale: number;
  grain: number;
  mouseReact: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  vignette: number;
  blurEnabled: boolean;
  blurAmount: number;
  radialBlurAmount: number;
  colorBlend: number;
  chromaticAberration: number;
  hueShift: number;
  asciiEnabled: boolean;
  asciiSize: number;
  ditherEnabled: boolean;
  ditherSize: number;
  curlEnabled: boolean;
  curlIntensity: number;
  curlScale: number;
  kaleidoscopeEnabled: boolean;
  kaleidoscopeSegments: number;
  kaleidoscopeRotation: number;
  reactionDiffEnabled: boolean;
  reactionDiffIntensity: number;
  reactionDiffScale: number;
  pixelSortEnabled: boolean;
  pixelSortIntensity: number;
  pixelSortThreshold: number;
  domainWarp: number;
  feedbackEnabled: boolean;
  feedbackDecay: number;
  parallaxEnabled: boolean;
  parallaxStrength: number;
  threeDEnabled: boolean;
  threeDShape: number;
  threeDPerspective: number;
  threeDRotationSpeed: number;
  threeDZoom: number;
  threeDLighting: number;
  meshDistortionEnabled: boolean;
  meshDisplacement: number;
  meshFrequency: number;
  meshSpeed: number;
  playing: boolean;
  customGLSL: string | null;
}
```

Replace `GradientState` with `EngineState` in the `render()`, `setGlobalUniforms()`, and `startLoop()` method signatures.

- [ ] **Step 6: Create packages/core/src/index.ts**

```typescript
export { GradientEngine } from "./engine";
export type { EngineState } from "./engine";
export type { LayerParams, BlendMode, ImageBlendMode, MaskParams, MaskShape, MaskBlendMode, TextMaskAlign } from "./layers";
export { createLayer, DEFAULT_LAYER, DEFAULT_MASK, MAX_LAYERS } from "./layers";
export { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply, mat4Identity } from "./math";
```

- [ ] **Step 7: Verify core compiles**

```bash
cd packages/core && npx tsc --noEmit
```

Expected: No errors (or only errors about missing .glsl module resolution — acceptable since tsup will handle that at build time).

- [ ] **Step 8: Commit**

```bash
git add packages/core/
git commit -m "feat: create @wavr/core package with engine, shaders, and layers"
```

---

### Task 3: Create Public Types (GradientConfig, LayerConfig, RGBColor)

**Files:**
- Create: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create types.ts**

```typescript
/** RGB color as normalized floats [0-1, 0-1, 0-1] */
export type RGBColor = [number, number, number];

export interface LayerConfig {
  type: "mesh" | "radial" | "linear" | "conic" | "plasma"
      | "dither" | "scanline" | "glitch";
  colors: RGBColor[];
  speed?: number;
  complexity?: number;
  scale?: number;
  distortion?: number;
  opacity?: number;
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "add";
  depth?: number;
}

export interface GradientConfig {
  layers: LayerConfig[];

  // Global effects
  brightness?: number;
  saturation?: number;
  bloom?: { enabled: boolean; intensity: number };
  vignette?: number;
  grain?: number;
  noise?: { enabled: boolean; intensity: number; scale: number };
  chromaticAberration?: number;
  hueShift?: number;
  domainWarp?: number;
  mouseReact?: number;
  curl?: { enabled: boolean; intensity: number; scale: number };
  kaleidoscope?: { enabled: boolean; segments: number; rotation: number };
  reactionDiffusion?: { enabled: boolean; intensity: number; scale: number };
  pixelSort?: { enabled: boolean; intensity: number; threshold: number };
  blur?: { enabled: boolean; amount: number };
  radialBlur?: number;
  feedback?: { enabled: boolean; decay: number };
  ascii?: { enabled: boolean; size: number };
  dither?: { enabled: boolean; size: number };

  // Phase 7 — Parallax
  parallax?: { enabled: boolean; strength: number };

  // Phase 7 — 3D Shape Projection
  shape3d?: {
    enabled: boolean;
    shape: "sphere" | "torus" | "plane" | "cylinder" | "cube";
    perspective: number;
    rotationSpeed: number;
    zoom: number;
    lighting: number;
  };

  // Phase 7 — Mesh Distortion
  meshDistortion?: {
    enabled: boolean;
    displacement: number;
    frequency: number;
    speed: number;
  };
}

export interface GradientHandle {
  update(config: Partial<GradientConfig>): void;
  play(): void;
  pause(): void;
  setMouse(x: number, y: number): void;
  setTime(t: number): void;
  setSpeed(multiplier: number): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface CreateGradientOptions {
  onError?: (error: Error) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}
```

- [ ] **Step 2: Add type exports to index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export type { GradientConfig, LayerConfig, RGBColor, GradientHandle, CreateGradientOptions } from "./types";
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): public types — GradientConfig, LayerConfig, GradientHandle"
```

---

### Task 4: Create Config Mapping (resolveConfig / stateToConfig)

**Files:**
- Create: `packages/core/src/config.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create config.ts**

This file maps between the clean public `GradientConfig` and the flat internal `EngineState`.

```typescript
import { GradientConfig, LayerConfig } from "./types";
import { EngineState } from "./engine";
import { LayerParams, createLayer } from "./layers";

const LAYER_DEFAULTS: Required<Omit<LayerConfig, "type" | "colors">> = {
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  opacity: 1.0,
  blendMode: "normal",
  depth: 0,
};

function resolveLayer(layer: LayerConfig): LayerParams {
  return createLayer({
    gradientType: layer.type,
    colors: layer.colors,
    speed: layer.speed ?? LAYER_DEFAULTS.speed,
    complexity: layer.complexity ?? LAYER_DEFAULTS.complexity,
    scale: layer.scale ?? LAYER_DEFAULTS.scale,
    distortion: layer.distortion ?? LAYER_DEFAULTS.distortion,
    opacity: layer.opacity ?? LAYER_DEFAULTS.opacity,
    blendMode: layer.blendMode ?? LAYER_DEFAULTS.blendMode,
    depth: layer.depth ?? LAYER_DEFAULTS.depth,
  });
}

export function resolveConfig(config: GradientConfig): EngineState {
  const layers = config.layers.map(resolveLayer);

  return {
    layers,
    brightness: config.brightness ?? 1.0,
    saturation: config.saturation ?? 1.0,
    noiseEnabled: config.noise?.enabled ?? false,
    noiseIntensity: config.noise?.intensity ?? 0.3,
    noiseScale: config.noise?.scale ?? 1.0,
    grain: config.grain ?? 0,
    mouseReact: config.mouseReact ?? 0.5,
    bloomEnabled: config.bloom?.enabled ?? false,
    bloomIntensity: config.bloom?.intensity ?? 0.3,
    vignette: config.vignette ?? 0,
    blurEnabled: config.blur?.enabled ?? false,
    blurAmount: config.blur?.amount ?? 0,
    radialBlurAmount: config.radialBlur ?? 0,
    colorBlend: 0,
    chromaticAberration: config.chromaticAberration ?? 0,
    hueShift: config.hueShift ?? 0,
    asciiEnabled: config.ascii?.enabled ?? false,
    asciiSize: config.ascii?.size ?? 8,
    ditherEnabled: config.dither?.enabled ?? false,
    ditherSize: config.dither?.size ?? 4,
    curlEnabled: config.curl?.enabled ?? false,
    curlIntensity: config.curl?.intensity ?? 0.5,
    curlScale: config.curl?.scale ?? 1.0,
    kaleidoscopeEnabled: config.kaleidoscope?.enabled ?? false,
    kaleidoscopeSegments: config.kaleidoscope?.segments ?? 6,
    kaleidoscopeRotation: config.kaleidoscope?.rotation ?? 0,
    reactionDiffEnabled: config.reactionDiffusion?.enabled ?? false,
    reactionDiffIntensity: config.reactionDiffusion?.intensity ?? 0.5,
    reactionDiffScale: config.reactionDiffusion?.scale ?? 1.0,
    pixelSortEnabled: config.pixelSort?.enabled ?? false,
    pixelSortIntensity: config.pixelSort?.intensity ?? 0.5,
    pixelSortThreshold: config.pixelSort?.threshold ?? 0.5,
    domainWarp: config.domainWarp ?? 0,
    feedbackEnabled: config.feedback?.enabled ?? false,
    feedbackDecay: config.feedback?.decay ?? 0.5,
    parallaxEnabled: config.parallax?.enabled ?? false,
    parallaxStrength: config.parallax?.strength ?? 0.5,
    threeDEnabled: config.shape3d?.enabled ?? false,
    threeDShape: config.shape3d ? ["sphere", "torus", "plane", "cylinder", "cube"].indexOf(config.shape3d.shape) : 0,
    threeDPerspective: config.shape3d?.perspective ?? 1.5,
    threeDRotationSpeed: config.shape3d?.rotationSpeed ?? 0.3,
    threeDZoom: config.shape3d?.zoom ?? 1.0,
    threeDLighting: config.shape3d?.lighting ?? 0.5,
    meshDistortionEnabled: config.meshDistortion?.enabled ?? false,
    meshDisplacement: config.meshDistortion?.displacement ?? 0.3,
    meshFrequency: config.meshDistortion?.frequency ?? 2.0,
    meshSpeed: config.meshDistortion?.speed ?? 0.5,
    playing: true,
    customGLSL: null,
  };
}

const SHAPE_NAMES = ["sphere", "torus", "plane", "cylinder", "cube"] as const;

export function stateToConfig(state: EngineState): GradientConfig {
  const config: GradientConfig = {
    layers: state.layers.map((l) => ({
      type: l.gradientType as LayerConfig["type"],
      colors: l.colors,
      speed: l.speed,
      complexity: l.complexity,
      scale: l.scale,
      distortion: l.distortion,
      opacity: l.opacity,
      blendMode: l.blendMode,
      depth: l.depth,
    })),
  };

  // Only include non-default values
  if (state.brightness !== 1.0) config.brightness = state.brightness;
  if (state.saturation !== 1.0) config.saturation = state.saturation;
  if (state.grain) config.grain = state.grain;
  if (state.vignette) config.vignette = state.vignette;
  if (state.chromaticAberration) config.chromaticAberration = state.chromaticAberration;
  if (state.hueShift) config.hueShift = state.hueShift;
  if (state.domainWarp) config.domainWarp = state.domainWarp;
  if (state.radialBlurAmount) config.radialBlur = state.radialBlurAmount;
  if (state.mouseReact !== 0.5) config.mouseReact = state.mouseReact;
  if (state.noiseEnabled) config.noise = { enabled: true, intensity: state.noiseIntensity, scale: state.noiseScale };
  if (state.bloomEnabled) config.bloom = { enabled: true, intensity: state.bloomIntensity };
  if (state.blurEnabled) config.blur = { enabled: true, amount: state.blurAmount };
  if (state.curlEnabled) config.curl = { enabled: true, intensity: state.curlIntensity, scale: state.curlScale };
  if (state.kaleidoscopeEnabled) config.kaleidoscope = { enabled: true, segments: state.kaleidoscopeSegments, rotation: state.kaleidoscopeRotation };
  if (state.reactionDiffEnabled) config.reactionDiffusion = { enabled: true, intensity: state.reactionDiffIntensity, scale: state.reactionDiffScale };
  if (state.pixelSortEnabled) config.pixelSort = { enabled: true, intensity: state.pixelSortIntensity, threshold: state.pixelSortThreshold };
  if (state.feedbackEnabled) config.feedback = { enabled: true, decay: state.feedbackDecay };
  if (state.asciiEnabled) config.ascii = { enabled: true, size: state.asciiSize };
  if (state.ditherEnabled) config.dither = { enabled: true, size: state.ditherSize };
  if (state.parallaxEnabled) config.parallax = { enabled: true, strength: state.parallaxStrength };
  if (state.threeDEnabled) config.shape3d = { enabled: true, shape: SHAPE_NAMES[state.threeDShape] ?? "sphere", perspective: state.threeDPerspective, rotationSpeed: state.threeDRotationSpeed, zoom: state.threeDZoom, lighting: state.threeDLighting };
  if (state.meshDistortionEnabled) config.meshDistortion = { enabled: true, displacement: state.meshDisplacement, frequency: state.meshFrequency, speed: state.meshSpeed };

  return config;
}
```

- [ ] **Step 2: Add exports to index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export { resolveConfig, stateToConfig } from "./config";
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/index.ts
git commit -m "feat(core): config mapping — resolveConfig() and stateToConfig()"
```

---

### Task 5: Create createGradient() Imperative API

**Files:**
- Create: `packages/core/src/create.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Create create.ts**

```typescript
import { GradientEngine } from "./engine";
import { GradientConfig, GradientHandle, CreateGradientOptions } from "./types";
import { resolveConfig } from "./config";

export function createGradient(
  canvas: HTMLCanvasElement,
  config: GradientConfig,
  options?: CreateGradientOptions,
): GradientHandle {
  let state = resolveConfig(config);
  let speedMultiplier = 1.0;
  let manualTime: number | null = null;
  let destroyed = false;

  const engine = new GradientEngine(canvas);

  // Context loss handling
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    options?.onContextLost?.();
    options?.onError?.(new Error("WebGL context lost"));
  });
  canvas.addEventListener("webglcontextrestored", () => {
    options?.onContextRestored?.();
    engine.initProgram();
  });

  // Start render loop
  engine.startLoop(() => {
    // Apply speed multiplier by modifying the state's layer speeds
    // This is handled in the engine via elapsedTime accumulation
    return state;
  });

  const handle: GradientHandle = {
    update(partial: Partial<GradientConfig>) {
      if (destroyed) return;
      const merged = { ...config, ...partial };
      if (partial.layers) merged.layers = partial.layers;
      state = resolveConfig(merged);
      Object.assign(config, partial);
    },

    play() {
      if (destroyed) return;
      state = { ...state, playing: true };
      manualTime = null;
    },

    pause() {
      if (destroyed) return;
      state = { ...state, playing: false };
    },

    setMouse(x: number, y: number) {
      if (destroyed) return;
      engine.setMouse(x, y);
    },

    setTime(t: number) {
      if (destroyed) return;
      manualTime = t;
      // The engine manages its own elapsed time internally.
      // For scroll-linked mode, we pause and let the engine's
      // elapsedTime be overridden. This requires a small engine
      // extension — add a public setElapsedTime() method.
      engine.setElapsedTime(t);
    },

    setSpeed(multiplier: number) {
      if (destroyed) return;
      speedMultiplier = multiplier;
      engine.setSpeedMultiplier(multiplier);
    },

    resize(width: number, height: number) {
      if (destroyed) return;
      engine.resize(width, height);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      engine.stopLoop();
      engine.destroy();
    },
  };

  return handle;
}
```

- [ ] **Step 2: Add setElapsedTime() and setSpeedMultiplier() to engine**

In `packages/core/src/engine.ts`, add two public methods to the `GradientEngine` class:

```typescript
  setElapsedTime(t: number) {
    this.elapsedTime = t;
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }
```

Also add the `speedMultiplier` private field (default 1.0) and use it in the animation loop where `this.elapsedTime += dt` becomes `this.elapsedTime += dt * this.speedMultiplier`.

In the class field declarations, add:

```typescript
  private speedMultiplier = 1.0;
```

In `startLoop()`, update the elapsed time line:

```typescript
      this.elapsedTime += dt * this.speedMultiplier;
```

- [ ] **Step 3: Add exports to index.ts**

Add to `packages/core/src/index.ts`:

```typescript
export { createGradient } from "./create";
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/create.ts packages/core/src/engine.ts packages/core/src/index.ts
git commit -m "feat(core): createGradient() imperative API with handle"
```

---

### Task 6: Convert Presets to GradientConfig Format

**Files:**
- Create: `packages/core/src/presets/classic.ts` (and all other preset files)
- Create: `packages/core/src/presets/index.ts`
- Create: `packages/core/src/presets/all.ts`

- [ ] **Step 1: Create preset files**

Each preset file exports individually named `GradientConfig` objects. Convert from the current `Partial<GradientState>` format.

Example — `packages/core/src/presets/classic.ts`:

```typescript
import { GradientConfig } from "../types";

export const aurora: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0.0, 0.9, 0.8], [0.2, 0.8, 0.3], [0.3, 0.2, 0.7], [0.2, 0.4, 1.0]],
    speed: 0.4,
    complexity: 4,
    scale: 1.2,
    distortion: 0.35,
  }],
  saturation: 1.2,
  vignette: 0.2,
};

export const sunset: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[1.0, 0.5, 0.31], [1.0, 0.84, 0.0], [1.0, 0.2, 0.4], [0.9, 0.4, 0.8]],
    speed: 0.3,
    complexity: 3,
    scale: 1.0,
    distortion: 0.3,
  }],
  brightness: 1.1,
  saturation: 1.3,
};

// ... convert all remaining classic presets following the same pattern
// Read lib/presets/classic.ts to get the exact values
```

Repeat for all 7 category files: `dither.ts`, `scanline.ts`, `glitch.ts`, `cinematic.ts`, `nature.ts`, `abstract.ts`. Read each original file in `lib/presets/` and convert using `stateToConfig()` logic (flat GradientState → nested GradientConfig).

**Key conversion rules:**
- `gradientType: "mesh"` → `type: "mesh"` (inside a layer)
- `colors: [...]` → stays same, inside layer
- `speed`, `complexity`, `scale`, `distortion` → inside layer
- `brightness`, `saturation` → top-level
- `noiseEnabled: true, noiseIntensity: 0.5, noiseScale: 1.0` → `noise: { enabled: true, intensity: 0.5, scale: 1.0 }`
- `bloomEnabled: true, bloomIntensity: 0.3` → `bloom: { enabled: true, intensity: 0.3 }`
- Other effects follow the same nesting pattern

- [ ] **Step 2: Create packages/core/src/presets/index.ts**

Tree-shakeable individual exports:

```typescript
export { aurora, sunset, midnight, candy, ocean, lava, cyber, monochrome } from "./classic";
export { ditherRetro, ditherPaper, ditherNeon, ditherFrost } from "./dither";
export { scanlineCrt, scanlineMatrix, scanlineArcade, scanlineAmber } from "./scanline";
export { glitchVhs, glitchCorrupt, glitchDigital, glitchStatic } from "./glitch";
// ... all cinematic, nature, abstract presets
```

Note: The exact export names need to be camelCase versions of the preset names. Read each original preset file to get the names and convert: "VHS Glitch" → `vhsGlitch`, "Retro Dither" → `retroDither`, etc.

- [ ] **Step 3: Create packages/core/src/presets/all.ts**

```typescript
import * as classic from "./classic";
import * as dither from "./dither";
import * as scanline from "./scanline";
import * as glitch from "./glitch";
import * as cinematic from "./cinematic";
import * as nature from "./nature";
import * as abstract from "./abstract";
import { GradientConfig } from "../types";

export const presets: Record<string, GradientConfig> = {
  ...classic,
  ...dither,
  ...scanline,
  ...glitch,
  ...cinematic,
  ...nature,
  ...abstract,
};
```

- [ ] **Step 4: Add preset exports to core index.ts**

The core index.ts doesn't re-export presets directly — they're available via `@wavr/core/presets` and `@wavr/core/presets/all` entry points (configured in package.json exports map).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/presets/
git commit -m "feat(core): presets in GradientConfig format — all ~40 presets"
```

---

### Task 7: Move Editor to apps/editor/ and Update Imports

**Files:**
- Move: all editor files to `apps/editor/`
- Create: `apps/editor/package.json`
- Modify: all files in `apps/editor/components/` and `apps/editor/app/` that import from `@/lib/engine`, `@/lib/layers`, `@/lib/math`
- Modify: `apps/editor/lib/store.ts` to import from `@wavr/core`

This is the largest task — moving the entire editor and updating imports.

- [ ] **Step 1: Create apps/editor directory and move files**

```bash
mkdir -p apps/editor
# Move all editor directories
mv app apps/editor/app
mv components apps/editor/components
mv public apps/editor/public
mv src apps/editor/src
# Move editor config files
mv next.config.ts apps/editor/next.config.ts
mv postcss.config.mjs apps/editor/postcss.config.mjs
mv eslint.config.mjs apps/editor/eslint.config.mjs
mv components.json apps/editor/components.json
mv tsconfig.json apps/editor/tsconfig.json
mv glsl.d.ts apps/editor/glsl.d.ts
mv next-env.d.ts apps/editor/next-env.d.ts
# Move editor-only lib files (not the ones in core)
mkdir -p apps/editor/lib
mv lib/store.ts apps/editor/lib/store.ts
mv lib/timeline.ts apps/editor/lib/timeline.ts
mv lib/export.ts apps/editor/lib/export.ts
mv lib/audio.ts apps/editor/lib/audio.ts
mv lib/projects.ts apps/editor/lib/projects.ts
mv lib/url.ts apps/editor/lib/url.ts
mv lib/types.ts apps/editor/lib/types.ts
mv lib/useTheme.ts apps/editor/lib/useTheme.ts
# Move remaining files
mv app.css apps/editor/ 2>/dev/null || true
mv globals.css apps/editor/ 2>/dev/null || true
```

- [ ] **Step 2: Create apps/editor/package.json**

```json
{
  "name": "editor",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@csstools/normalize.css": "^12.1.1",
    "@material/material-color-utilities": "^0.4.0",
    "@wavr/core": "workspace:*",
    "lucide-react": "^1.7.0",
    "next": "16.2.1",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@chainlift/liftkit": "^0.2.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.1",
    "raw-loader": "^4.0.2",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Update editor imports**

Update `apps/editor/lib/store.ts` — change:
```typescript
import { LayerParams, BlendMode, createLayer, MAX_LAYERS } from "./layers";
```
To:
```typescript
import { LayerParams, BlendMode, createLayer, MAX_LAYERS } from "@wavr/core";
```

Update `apps/editor/components/Canvas.tsx` — change engine import:
```typescript
import { GradientEngine } from "@/lib/engine";
```
To:
```typescript
import { GradientEngine } from "@wavr/core";
```

Update `apps/editor/components/GradientPanel.tsx` — change:
```typescript
import { LayerParams, MaskParams, TextMaskAlign } from "@/lib/layers";
```
To:
```typescript
import { LayerParams, MaskParams, TextMaskAlign } from "@wavr/core";
```

Update `apps/editor/components/LayerPanel.tsx` — change:
```typescript
import { MAX_LAYERS, BlendMode, LayerParams } from "@/lib/layers";
```
To:
```typescript
import { MAX_LAYERS, BlendMode, LayerParams } from "@wavr/core";
```

Scan all other files for `@/lib/engine`, `@/lib/layers`, or `@/lib/math` imports and update them to `@wavr/core`. Files that import from `@/lib/store`, `@/lib/timeline`, `@/lib/export`, `@/lib/audio`, `@/lib/projects`, `@/lib/url`, `@/lib/useTheme` keep their `@/lib/` imports (these stay in the editor).

Also update `apps/editor/lib/export.ts` which likely imports from layers and engine — update those to `@wavr/core`.

- [ ] **Step 4: Update apps/editor/tsconfig.json paths**

The `@/*` path alias needs to point to the editor root:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*", "./src/*"]
    }
  }
}
```

This should already be correct since we're keeping the same relative structure within the editor.

- [ ] **Step 5: Remove old lib/ directory**

```bash
rm -rf lib/
```

The files that moved to core are now in `packages/core/src/`. The files that stayed in the editor are in `apps/editor/lib/`.

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

- [ ] **Step 7: Verify editor builds**

```bash
cd apps/editor && pnpm build
```

Or from root:
```bash
pnpm build
```

Expected: Build succeeds. The editor imports engine/layers/math from `@wavr/core` (workspace link) and its own store/timeline/export from `@/lib/`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: move editor to apps/editor/, import core from @wavr/core"
```

---

## Phase B: React Package

### Task 8: Create WavrGradient React Component

**Files:**
- Create: `packages/react/src/WavrGradient.tsx`
- Create: `packages/react/src/index.ts`

- [ ] **Step 1: Create WavrGradient.tsx**

```tsx
"use client";

import { useRef, useEffect } from "react";
import { createGradient, GradientConfig, GradientHandle } from "@wavr/core";

export interface WavrGradientProps {
  config: GradientConfig;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  paused?: boolean;
  scrollLinked?: boolean;
  scrollDuration?: number;
  speed?: number;
  onError?: (error: Error) => void;
}

export function WavrGradient({
  config,
  className,
  style,
  interactive = true,
  paused = false,
  scrollLinked = false,
  scrollDuration = 10,
  speed = 1.0,
  onError,
}: WavrGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GradientHandle | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Mount: create canvas, init engine
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");

    // Set initial size synchronously to avoid 0×0 race
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    container.appendChild(canvas);

    const handle = createGradient(canvas, configRef.current, { onError });
    handleRef.current = handle;

    // Resize observer
    const ro = new ResizeObserver(([entry]) => {
      handle.resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      handle.destroy();
      handleRef.current = null;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []); // mount once

  // Sync config changes
  useEffect(() => {
    handleRef.current?.update(config);
  }, [config]);

  // Sync play/pause
  useEffect(() => {
    if (paused) {
      handleRef.current?.pause();
    } else if (!scrollLinked) {
      handleRef.current?.play();
    }
  }, [paused, scrollLinked]);

  // Sync speed
  useEffect(() => {
    handleRef.current?.setSpeed(speed);
  }, [speed]);

  // Mouse + touch interaction
  useEffect(() => {
    if (!interactive) return;
    const el = containerRef.current;
    if (!el) return;

    const handlePointer = (x: number, y: number) => {
      const rect = el.getBoundingClientRect();
      handleRef.current?.setMouse(
        (x - rect.left) / rect.width,
        1 - (y - rect.top) / rect.height,
      );
    };

    const onMouse = (e: MouseEvent) => handlePointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) handlePointer(t.clientX, t.clientY);
    };

    el.addEventListener("mousemove", onMouse);
    el.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      el.removeEventListener("mousemove", onMouse);
      el.removeEventListener("touchmove", onTouch);
    };
  }, [interactive]);

  // Scroll-linked mode
  useEffect(() => {
    if (!scrollLinked) return;
    handleRef.current?.pause();

    const onScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      handleRef.current?.setTime(progress * scrollDuration);
    };

    onScroll(); // set initial position
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollLinked, scrollDuration]);

  return <div ref={containerRef} className={className} style={style} />;
}
```

- [ ] **Step 2: Create packages/react/src/index.ts**

```typescript
export { WavrGradient } from "./WavrGradient";
export type { WavrGradientProps } from "./WavrGradient";
export type { GradientConfig, LayerConfig, RGBColor } from "@wavr/core";
```

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/WavrGradient.tsx packages/react/src/index.ts
git commit -m "feat(react): WavrGradient component with mouse, touch, scroll, pause"
```

---

### Task 9: Preset Re-exports in React Package

**Files:**
- Create: `packages/react/src/presets.ts`
- Create: `packages/react/src/presets-all.ts`

- [ ] **Step 1: Create presets.ts**

```typescript
export {
  aurora, sunset, midnight, candy, ocean, lava, cyber, monochrome,
  ditherRetro, ditherPaper, ditherNeon, ditherFrost,
  scanlineCrt, scanlineMatrix, scanlineArcade, scanlineAmber,
  glitchVhs, glitchCorrupt, glitchDigital, glitchStatic,
  // ... all cinematic, nature, abstract preset names
} from "@wavr/core/presets";
```

Note: The exact preset names must match what was exported from `packages/core/src/presets/index.ts` in Task 6.

- [ ] **Step 2: Create presets-all.ts**

```typescript
export { presets } from "@wavr/core/presets/all";
```

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/presets.ts packages/react/src/presets-all.ts
git commit -m "feat(react): preset re-exports — tree-shakeable and full map"
```

---

### Task 10: Build Pipeline (tsup, package.json, tsconfig)

**Files:**
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/tsup.config.ts`

- [ ] **Step 1: Create packages/react/package.json**

```json
{
  "name": "@wavr/gradient",
  "version": "0.1.0",
  "description": "Animated WebGL gradient React component",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./presets": {
      "import": "./dist/presets.mjs",
      "require": "./dist/presets.js",
      "types": "./dist/presets.d.ts"
    },
    "./presets/all": {
      "import": "./dist/presets-all.mjs",
      "require": "./dist/presets-all.js",
      "types": "./dist/presets-all.d.ts"
    }
  },
  "files": ["dist", "README.md"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "size": "bundlesize",
    "prepublishOnly": "pnpm build && pnpm size"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "dependencies": {
    "@wavr/core": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19",
    "bundlesize": "^0.18.0"
  },
  "bundlesize": [
    { "path": "./dist/index.mjs", "maxSize": "20 kB" }
  ]
}
```

- [ ] **Step 2: Create packages/react/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "declaration": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "references": [
    { "path": "../core" }
  ]
}
```

- [ ] **Step 3: Create packages/react/tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    presets: "src/presets.ts",
    "presets-all": "src/presets-all.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  external: ["react", "react-dom"],
  loader: { ".glsl": "text" },
  clean: true,
  treeshake: true,
  sourcemap: true,
});
```

- [ ] **Step 4: Install deps and build**

```bash
pnpm install
pnpm --filter @wavr/gradient build
```

Expected: tsup produces `dist/index.mjs`, `dist/index.js`, `dist/index.d.ts` (and same for presets, presets-all).

- [ ] **Step 5: Check bundle size**

```bash
pnpm --filter @wavr/gradient size
```

Expected: `dist/index.mjs` is under 20KB gzipped.

- [ ] **Step 6: Commit**

```bash
git add packages/react/package.json packages/react/tsconfig.json packages/react/tsup.config.ts
git commit -m "feat(react): build pipeline — tsup, package exports, bundle size check"
```

---

### Task 11: Changesets for Monorepo Versioning

**Files:**
- Create: `.changeset/config.json`

- [ ] **Step 1: Install Changesets**

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

- [ ] **Step 2: Configure Changesets**

Edit `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [["@wavr/core", "@wavr/gradient"]],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["editor"]
}
```

The `linked` array ensures core and react version together. The `ignore` array excludes the editor app from publishing.

- [ ] **Step 3: Commit**

```bash
git add .changeset/ package.json pnpm-lock.yaml
git commit -m "chore: add Changesets for monorepo versioning"
```

---

### Task 12: Final Integration — Full Build, Verify, Docs

**Files:**
- Modify: `ROADMAP.md`
- Modify: `.context/HANDOFF.md`

- [ ] **Step 1: Full monorepo build**

```bash
pnpm build
```

Expected: Both `@wavr/core` type-checks, `@wavr/gradient` builds via tsup, and `editor` builds via Next.js. All succeed.

- [ ] **Step 2: Verify editor works**

```bash
pnpm dev --filter=editor
```

Open http://localhost:3000/editor. Verify:
1. All gradient types render correctly
2. Effects work (bloom, vignette, etc.)
3. Layers composite correctly
4. 3D shapes and mesh distortion work
5. Presets load correctly
6. Export modal still generates code

- [ ] **Step 3: Verify package builds cleanly**

```bash
pnpm --filter @wavr/gradient build
ls packages/react/dist/
```

Expected: `index.mjs`, `index.js`, `index.d.ts`, `presets.mjs`, `presets.js`, `presets.d.ts`, `presets-all.mjs`, `presets-all.js`, `presets-all.d.ts`.

- [ ] **Step 4: Update ROADMAP.md**

Mark Phase 10.2 (npm package) as complete.

- [ ] **Step 5: Update HANDOFF.md**

Add monorepo structure and package details to the architecture section.

- [ ] **Step 6: Commit**

```bash
git add ROADMAP.md
git add -f .context/HANDOFF.md
git commit -m "docs: update ROADMAP.md and HANDOFF.md for @wavr/gradient package"
```
