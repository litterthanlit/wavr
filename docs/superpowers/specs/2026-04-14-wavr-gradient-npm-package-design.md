# @wavr/gradient npm Package — Design Spec

## Overview

Publish the Wavr gradient engine as `@wavr/gradient`, a standalone React component for embedding animated WebGL gradients. Zero-config usage with presets, full customization via config objects, <20KB gzipped.

**Architecture:** Monorepo with three packages — `@wavr/core` (internal engine + shader + presets), `@wavr/gradient` (published React wrapper), and the existing editor app. The React component is a thin lifecycle wrapper around a vanilla `createGradient()` imperative API (exposed publicly in v2).

---

## Monorepo Structure

```
wavr/
├── apps/
│   └── editor/                ← Current Next.js app (moved from root)
│       ├── app/
│       ├── components/
│       ├── lib/               ← Editor-only: store.ts, timeline.ts, export.ts
│       └── package.json
├── packages/
│   ├── core/                  ← Engine + shader + presets (internal, not published)
│   │   ├── src/
│   │   │   ├── engine.ts      ← GradientEngine class (from lib/engine.ts)
│   │   │   ├── shaders/
│   │   │   │   ├── fragment.glsl  ← Full 1281-line shader
│   │   │   │   └── vertex.glsl   ← Mesh distortion vertex shader
│   │   │   ├── layers.ts     ← LayerParams, defaults
│   │   │   ├── math.ts       ← mat4 utilities
│   │   │   ├── types.ts      ← Public types (GradientConfig, LayerConfig, RGBColor)
│   │   │   ├── config.ts     ← resolveConfig() + stateToConfig()
│   │   │   ├── create.ts     ← createGradient() imperative API
│   │   │   └── presets/
│   │   │       ├── index.ts   ← Individual named exports (tree-shakeable)
│   │   │       ├── all.ts     ← Full preset map (opt-in bundle)
│   │   │       ├── aurora.ts
│   │   │       ├── sunset.ts
│   │   │       └── ...        ← All ~40 presets
│   │   ├── package.json       ← Internal workspace package
│   │   └── tsconfig.json
│   └── react/                 ← Published as @wavr/gradient
│       ├── src/
│       │   ├── WavrGradient.tsx  ← React wrapper (~80 lines)
│       │   ├── index.ts      ← Main entry: WavrGradient + types
│       │   ├── presets.ts     ← Re-exports from @wavr/core/presets
│       │   └── presets-all.ts ← Re-exports from @wavr/core/presets/all
│       ├── package.json       ← Published to npm
│       ├── tsup.config.ts     ← Build config
│       └── tsconfig.json
├── turbo.json
├── pnpm-workspace.yaml
└── package.json               ← Workspace root
```

### Migration Sequence

1. Add workspace config (pnpm-workspace.yaml + turbo.json + root package.json)
2. Create `packages/core/` — extract engine, shaders, layers, math, presets from `lib/`
3. Create `packages/core/src/types.ts` — public-facing types
4. Create `packages/core/src/config.ts` — resolveConfig() + stateToConfig()
5. Create `packages/core/src/create.ts` — createGradient() imperative API
6. Move editor to `apps/editor/` — update imports to `@wavr/core`
7. Verify editor still works end-to-end
8. Create `packages/react/` — the published package
9. Add build pipeline, bundle size checks, Changesets

### What Stays in `apps/editor/`

- `store.ts` (Zustand store — editor needs interactive state management)
- `timeline.ts` (keyframes/playback — editor-only)
- `export.ts` (code generation for export modal — editor-only)
- All UI components (GradientPanel, EffectsPanel, LayerPanel, etc.)

---

## Public API

### Main Entry — `@wavr/gradient`

```typescript
export { WavrGradient } from './WavrGradient'
export type { WavrGradientProps, GradientConfig, LayerConfig, RGBColor } from '@wavr/core'
```

### Presets — `@wavr/gradient/presets`

```typescript
// Tree-shakeable individual exports
export { aurora } from '@wavr/core/presets'
export { sunset } from '@wavr/core/presets'
export { midnight } from '@wavr/core/presets'
// ... all ~40 presets
```

### All Presets — `@wavr/gradient/presets/all`

```typescript
// Full preset map (opt-in, bundles all ~5KB)
export { presets } from '@wavr/core/presets/all'
```

---

## Types

### RGBColor

```typescript
/** RGB color as normalized floats [0-1, 0-1, 0-1] */
type RGBColor = [number, number, number];
```

### LayerConfig

```typescript
interface LayerConfig {
  type: "mesh" | "radial" | "linear" | "conic" | "plasma"
      | "dither" | "scanline" | "glitch";
  colors: RGBColor[];
  speed?: number;           // default 0.4
  complexity?: number;      // default 3
  scale?: number;           // default 1.0
  distortion?: number;      // default 0.3
  opacity?: number;         // default 1.0
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "add";
  depth?: number;           // parallax depth, default 0
}
```

### GradientConfig

```typescript
interface GradientConfig {
  layers: LayerConfig[];

  // Global effects
  brightness?: number;              // default 1.0
  saturation?: number;              // default 1.0
  bloom?: { enabled: boolean; intensity: number };
  vignette?: number;                // default 0
  grain?: number;                   // default 0
  noise?: { enabled: boolean; intensity: number; scale: number };
  chromaticAberration?: number;     // default 0
  hueShift?: number;                // default 0
  domainWarp?: number;              // default 0
  mouseReact?: number;              // default 0.5
  curl?: { enabled: boolean; intensity: number; scale: number };
  kaleidoscope?: { enabled: boolean; segments: number; rotation: number };
  reactionDiffusion?: { enabled: boolean; intensity: number; scale: number };
  pixelSort?: { enabled: boolean; intensity: number; threshold: number };
  blur?: { enabled: boolean; amount: number };
  radialBlur?: number;              // default 0
  feedback?: { enabled: boolean; decay: number };
  ascii?: { enabled: boolean; size: number };
  dither?: { enabled: boolean; size: number };

  // Phase 7 — Parallax
  parallax?: { enabled: boolean; strength: number };

  // Phase 7 — 3D Shape Projection
  shape3d?: {
    enabled: boolean;
    shape: "sphere" | "torus" | "plane" | "cylinder" | "cube";
    perspective: number;      // 0.5-3.0
    rotationSpeed: number;    // 0-2
    zoom: number;             // 0.5-2.0
    lighting: number;         // 0-1
  };

  // Phase 7 — Mesh Distortion
  meshDistortion?: {
    enabled: boolean;
    displacement: number;     // 0-1
    frequency: number;        // 0.5-5.0
    speed: number;            // 0-2
  };
}
```

### WavrGradientProps

```typescript
interface WavrGradientProps {
  /** Gradient configuration — from a preset or custom */
  config: GradientConfig;
  /** CSS class for the container div */
  className?: string;
  /** Inline styles for the container div */
  style?: React.CSSProperties;
  /** Enable mouse/touch interaction (default: true) */
  interactive?: boolean;
  /** Pause animation without unmounting (default: false) */
  paused?: boolean;
  /** Link animation to scroll progress instead of time (default: false) */
  scrollLinked?: boolean;
  /** Duration in seconds when scroll-linked (default: 10) */
  scrollDuration?: number;
  /** Animation speed multiplier (default: 1.0) */
  speed?: number;
  /** Callback when WebGL context is lost or error occurs */
  onError?: (error: Error) => void;
}
```

---

## Core Imperative API

### createGradient()

```typescript
function createGradient(
  canvas: HTMLCanvasElement,
  config: GradientConfig,
  options?: {
    onError?: (error: Error) => void;
    onContextLost?: () => void;
    onContextRestored?: () => void;
  }
): GradientHandle;
```

### GradientHandle

```typescript
interface GradientHandle {
  /** Update configuration without recreating the engine */
  update(config: Partial<GradientConfig>): void;
  /** Start/resume animation */
  play(): void;
  /** Pause animation */
  pause(): void;
  /** Set mouse position (0-1 normalized) */
  setMouse(x: number, y: number): void;
  /** Set animation time directly (for scroll-linked mode) */
  setTime(t: number): void;
  /** Set animation speed multiplier */
  setSpeed(multiplier: number): void;
  /** Resize to fit container */
  resize(width: number, height: number): void;
  /** Clean up WebGL resources */
  destroy(): void;
}
```

### Config Mapping

Two mapping functions bridge the clean public API and the engine's flat internal state:

- **`resolveConfig(config: GradientConfig): GradientState`** — Expands nested effect objects into flat uniforms, fills defaults, converts `LayerConfig[]` to `LayerParams[]`.
- **`stateToConfig(state: GradientState): GradientConfig`** — Inverse mapping. Used by the editor's "Export as preset" flow to generate clean configs from editor state.

---

## React Wrapper Implementation

The `WavrGradient` component (~80 lines) wraps `createGradient()` with React lifecycle management:

**Mount:** Creates canvas, sets initial size synchronously from container bounds (avoids 0×0 race), calls `createGradient()`, starts ResizeObserver.

**Props sync via useEffect:**
- `config` → `handle.update(config)`
- `paused` → `handle.pause()` / `handle.play()`
- `speed` → `handle.setSpeed(speed)`

**Mouse/touch interaction:**
- `mousemove` + `touchmove` listeners on container div
- Gated by `interactive` prop (default true)
- Touch uses `e.touches[0]` coordinates
- Both `{ passive: true }`

**Scroll-linked mode:**
- Pauses time-based animation
- Maps `scrollY / (scrollHeight - innerHeight)` to `handle.setTime(progress * scrollDuration)`
- `scrollDuration` prop configurable (default 10s)
- Scroll listener with `{ passive: true }`

**Resize:** ResizeObserver passes logical pixel dimensions to `handle.resize()`. Engine handles DPR internally.

**Unmount:** Disconnects ResizeObserver, removes event listeners, calls `handle.destroy()`.

---

## Preset Structure

Presets live in `packages/core/src/presets/`. Each preset is a `GradientConfig` object:

```typescript
// packages/core/src/presets/aurora.ts
import { GradientConfig } from '../types';

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
```

The existing ~40 editor presets (classic, dither, scanline, glitch, cinematic, nature, abstract) are converted from `Partial<GradientState>` format to `GradientConfig` format using `stateToConfig()`.

**Tree-shaking:** Each preset is a separate file. `@wavr/gradient/presets` re-exports them individually. `@wavr/gradient/presets/all` exports the full map. Bundlers only include the presets you import.

---

## Build & Publish

### Bundler: tsup

```typescript
// packages/react/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    presets: 'src/presets.ts',
    'presets-all': 'src/presets-all.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  external: ['react', 'react-dom'],
  loader: { '.glsl': 'text' },
  clean: true,
});
```

### Package.json (published)

```json
{
  "name": "@wavr/gradient",
  "version": "0.1.0",
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
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "sideEffects": false
}
```

### Bundle Size Enforcement

```json
{
  "bundlesize": [
    { "path": "./dist/index.mjs", "maxSize": "20 KB" }
  ],
  "scripts": {
    "build": "tsup",
    "size": "bundlesize",
    "prepublishOnly": "pnpm build && pnpm size"
  }
}
```

### Monorepo Versioning: Changesets

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

Workflow: change core/react → `pnpm changeset` → describe changes → CI runs `changeset version` → `changeset publish`.

---

## Usage Examples

### Minimal — One Preset

```tsx
import { WavrGradient } from '@wavr/gradient'
import { aurora } from '@wavr/gradient/presets'

export default function Hero() {
  return <WavrGradient config={aurora} className="w-full h-screen" />
}
```

### Custom Config

```tsx
import { WavrGradient } from '@wavr/gradient'

<WavrGradient
  config={{
    layers: [{
      type: "mesh",
      colors: [[0.4, 0.2, 1.0], [1.0, 0.4, 0.4], [0.2, 0.9, 0.8]],
      speed: 0.3,
    }],
    bloom: { enabled: true, intensity: 0.4 },
    vignette: 0.3,
  }}
  interactive={false}
  className="absolute inset-0 -z-10"
/>
```

### Scroll-Linked Background

```tsx
import { WavrGradient } from '@wavr/gradient'
import { sunset } from '@wavr/gradient/presets'

<WavrGradient
  config={sunset}
  scrollLinked
  scrollDuration={15}
  className="fixed inset-0 -z-10"
/>
```

### Paused for Performance

```tsx
const [visible, setVisible] = useState(true);

// Pause when hero scrolls out of view
<WavrGradient config={ocean} paused={!visible} />
```

### Multiple Layers with Parallax

```tsx
<WavrGradient
  config={{
    layers: [
      { type: "mesh", colors: [[0.1, 0.1, 0.3], [0.3, 0.1, 0.5]], depth: -0.5 },
      { type: "radial", colors: [[1.0, 0.5, 0.2], [0.8, 0.2, 0.6]], opacity: 0.6, depth: 0.5 },
    ],
    parallax: { enabled: true, strength: 0.8 },
  }}
/>
```

### 3D Shape

```tsx
<WavrGradient
  config={{
    layers: [{ type: "plasma", colors: [[0.9, 0.2, 0.4], [0.2, 0.4, 0.9], [0.1, 0.8, 0.6]] }],
    shape3d: {
      enabled: true,
      shape: "torus",
      perspective: 1.5,
      rotationSpeed: 0.5,
      zoom: 1.2,
      lighting: 0.7,
    },
  }}
/>
```
