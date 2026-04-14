# Phase 8: Preset Library Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand from 8 to 32 presets across 7 categories with grouped UI.

**Architecture:** Split `lib/presets.ts` into `lib/presets/` directory with one file per category. Each file exports a typed array. `index.ts` re-exports combined array with category metadata. PresetsPanel gets collapsible category sections.

**Tech Stack:** TypeScript, React, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-13-phase8-preset-expansion-design.md`

---

## File Structure

| File | Role |
|---|---|
| `lib/presets/index.ts` | Types (`Preset`, `PresetCategory`), constants (`CATEGORY_LABELS`, `CATEGORY_ORDER`), combined `PRESETS` export |
| `lib/presets/classic.ts` | 8 existing presets with `category: "classic"` |
| `lib/presets/dither.ts` | 4 dither mode presets |
| `lib/presets/scanline.ts` | 4 scanline mode presets |
| `lib/presets/glitch.ts` | 4 glitch mode presets |
| `lib/presets/cinematic.ts` | 4 cinematic presets (effect-heavy) |
| `lib/presets/nature.ts` | 4 nature presets (clean) |
| `lib/presets/abstract.ts` | 4 abstract presets |
| `lib/presets.ts` | **Delete** (replaced by directory) |
| `components/PresetsPanel.tsx` | Grouped rendering with collapsible category headers |

---

## Task 1: Create Preset Types and Index

**Files:**
- Create: `lib/presets/index.ts`

- [ ] **Step 1: Create the index file with types, constants, and placeholder imports**

```typescript
// lib/presets/index.ts
import { GradientState } from "../store";

type PresetData = Partial<Omit<GradientState, "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize">>;

export interface Preset {
  name: string;
  category: PresetCategory;
  data: PresetData;
}

export type PresetCategory = "classic" | "dither" | "scanline" | "glitch" | "cinematic" | "nature" | "abstract";

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  classic: "Classic",
  dither: "Dither",
  scanline: "Scanline",
  glitch: "Glitch",
  cinematic: "Cinematic",
  nature: "Nature",
  abstract: "Abstract",
};

export const CATEGORY_ORDER: PresetCategory[] = [
  "classic", "dither", "scanline", "glitch", "cinematic", "nature", "abstract",
];

// Category imports will be added as each category file is created.
// For now, export an empty array so the build doesn't break.
export const PRESETS: Preset[] = [];
```

- [ ] **Step 2: Delete the old `lib/presets.ts` and update imports**

Delete `lib/presets.ts`. Then check that `components/PresetsPanel.tsx` imports from `"@/lib/presets"` — this path resolves to `lib/presets/index.ts` automatically, so no import change is needed.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS (PresetsPanel will render an empty grid, which is fine temporarily).

- [ ] **Step 4: Commit**

```bash
git add lib/presets/index.ts
git rm lib/presets.ts
git commit -m "feat(phase8): preset types, category constants, and index module"
```

---

## Task 2: Classic Presets (migrate existing 8)

**Files:**
- Create: `lib/presets/classic.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create classic.ts with all 8 existing presets**

```typescript
// lib/presets/classic.ts
import { Preset } from "./index";

export const CLASSIC_PRESETS: Preset[] = [
  {
    name: "Aurora",
    category: "classic",
    data: {
      gradientType: "mesh",
      speed: 0.4,
      complexity: 4,
      scale: 1.2,
      distortion: 0.35,
      brightness: 1.0,
      saturation: 1.2,
      colors: [
        [0.0, 0.9, 0.8],
        [0.2, 0.8, 0.3],
        [0.3, 0.2, 0.7],
        [0.2, 0.4, 1.0],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.2,
    },
  },
  {
    name: "Sunset",
    category: "classic",
    data: {
      gradientType: "mesh",
      speed: 0.3,
      complexity: 3,
      scale: 1.0,
      distortion: 0.3,
      brightness: 1.1,
      saturation: 1.3,
      colors: [
        [1.0, 0.5, 0.31],
        [1.0, 0.84, 0.0],
        [1.0, 0.65, 0.0],
        [0.94, 0.33, 0.48],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.3,
    },
  },
  {
    name: "Midnight",
    category: "classic",
    data: {
      gradientType: "mesh",
      speed: 0.25,
      complexity: 4,
      scale: 1.3,
      distortion: 0.25,
      brightness: 0.8,
      saturation: 1.0,
      colors: [
        [0.0, 0.0, 0.5],
        [0.29, 0.0, 0.51],
        [0.0, 0.8, 0.8],
        [0.0, 0.1, 0.4],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0.08,
      vignette: 0.4,
    },
  },
  {
    name: "Candy",
    category: "classic",
    data: {
      gradientType: "plasma",
      speed: 0.6,
      complexity: 3,
      scale: 0.8,
      distortion: 0.2,
      brightness: 1.1,
      saturation: 1.4,
      colors: [
        [1.0, 0.41, 0.71],
        [0.58, 0.0, 0.83],
        [0.0, 1.0, 1.0],
        [1.0, 1.0, 0.0],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0,
    },
  },
  {
    name: "Ocean",
    category: "classic",
    data: {
      gradientType: "linear",
      speed: 0.35,
      complexity: 4,
      scale: 1.5,
      distortion: 0.4,
      brightness: 0.9,
      saturation: 1.2,
      colors: [
        [0.0, 0.0, 1.0],
        [0.25, 0.41, 0.88],
        [0.53, 0.81, 0.92],
        [0.0, 0.5, 0.5],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.2,
    },
  },
  {
    name: "Lava",
    category: "classic",
    data: {
      gradientType: "mesh",
      speed: 0.5,
      complexity: 5,
      scale: 1.0,
      distortion: 0.45,
      brightness: 1.2,
      saturation: 1.4,
      colors: [
        [1.0, 0.0, 0.0],
        [1.0, 0.65, 0.0],
        [1.0, 0.84, 0.0],
        [0.55, 0.0, 0.0],
      ],
      noiseEnabled: false,
      bloomEnabled: true,
      bloomIntensity: 0.4,
      grain: 0.06,
      vignette: 0.3,
    },
  },
  {
    name: "Cyber",
    category: "classic",
    data: {
      gradientType: "conic",
      speed: 0.4,
      complexity: 3,
      scale: 1.2,
      distortion: 0.3,
      brightness: 1.0,
      saturation: 1.3,
      colors: [
        [0.0, 1.0, 0.0],
        [0.0, 1.0, 1.0],
        [0.29, 0.0, 0.51],
        [0.2, 0.8, 0.4],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0,
      vignette: 0.15,
    },
  },
  {
    name: "Monochrome",
    category: "classic",
    data: {
      gradientType: "mesh",
      speed: 0.3,
      complexity: 4,
      scale: 1.0,
      distortion: 0.3,
      brightness: 1.0,
      saturation: 0.1,
      colors: [
        [0.2, 0.2, 0.2],
        [0.5, 0.5, 0.5],
        [0.95, 0.95, 0.95],
        [0.44, 0.5, 0.56],
      ],
      noiseEnabled: false,
      bloomEnabled: false,
      grain: 0.1,
      vignette: 0.25,
    },
  },
];
```

- [ ] **Step 2: Update index.ts to import and re-export classic presets**

Replace the placeholder `PRESETS` export in `lib/presets/index.ts`:

```typescript
import { CLASSIC_PRESETS } from "./classic";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS. The 8 classic presets render in PresetsPanel exactly as before.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/classic.ts lib/presets/index.ts
git commit -m "feat(phase8): migrate 8 classic presets to lib/presets/classic.ts"
```

---

## Task 3: Dither Presets

**Files:**
- Create: `lib/presets/dither.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create dither.ts**

```typescript
// lib/presets/dither.ts
import { Preset } from "./index";

export const DITHER_PRESETS: Preset[] = [
  {
    name: "Newspaper",
    category: "dither",
    data: {
      gradientType: "dither",
      speed: 0.1,
      complexity: 2,
      scale: 1.5,
      distortion: 0.1,
      brightness: 1.05,
      saturation: 0.9,
      colors: [
        [0.15, 0.12, 0.1],
        [0.96, 0.94, 0.88],
      ],
      grain: 0.05,
      vignette: 0,
    },
  },
  {
    name: "Stipple",
    category: "dither",
    data: {
      gradientType: "dither",
      speed: 0.2,
      complexity: 4,
      scale: 0.8,
      distortion: 0.15,
      brightness: 1.0,
      saturation: 0.8,
      colors: [
        [0.25, 0.25, 0.28],
        [0.98, 0.98, 0.98],
      ],
      vignette: 0,
    },
  },
  {
    name: "Dissolve",
    category: "dither",
    data: {
      gradientType: "dither",
      speed: 0.5,
      complexity: 6,
      scale: 1.0,
      distortion: 0.4,
      brightness: 1.0,
      saturation: 1.2,
      colors: [
        [0.85, 0.15, 0.55],
        [0.0, 0.8, 0.75],
        [0.05, 0.05, 0.05],
      ],
      vignette: 0,
    },
  },
  {
    name: "Morse",
    category: "dither",
    data: {
      gradientType: "dither",
      speed: 0.3,
      complexity: 3,
      scale: 2.0,
      distortion: 0.2,
      brightness: 1.0,
      saturation: 1.0,
      colors: [
        [0.0, 0.85, 0.3],
        [0.02, 0.05, 0.02],
      ],
      grain: 0.1,
      vignette: 0.3,
    },
  },
];
```

- [ ] **Step 2: Update index.ts**

Add import and spread:

```typescript
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/dither.ts lib/presets/index.ts
git commit -m "feat(phase8): add 4 dither presets (Newspaper, Stipple, Dissolve, Morse)"
```

---

## Task 4: Scanline Presets

**Files:**
- Create: `lib/presets/scanline.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create scanline.ts**

```typescript
// lib/presets/scanline.ts
import { Preset } from "./index";

export const SCANLINE_PRESETS: Preset[] = [
  {
    name: "Retro CRT",
    category: "scanline",
    data: {
      gradientType: "scanline",
      speed: 0.3,
      complexity: 4,
      scale: 1.2,
      distortion: 0.3,
      brightness: 1.0,
      saturation: 1.1,
      colors: [
        [0.9, 0.15, 0.15],
        [0.15, 0.85, 0.15],
        [0.2, 0.3, 0.95],
        [0.95, 0.85, 0.2],
      ],
      grain: 0.08,
      vignette: 0.4,
    },
  },
  {
    name: "Broadcast Signal",
    category: "scanline",
    data: {
      gradientType: "scanline",
      speed: 0.15,
      complexity: 6,
      scale: 1.0,
      distortion: 0.15,
      brightness: 1.0,
      saturation: 1.2,
      colors: [
        [0.95, 0.95, 0.95],
        [0.95, 0.95, 0.0],
        [0.0, 0.95, 0.95],
        [0.0, 0.95, 0.0],
        [0.95, 0.0, 0.95],
        [0.95, 0.0, 0.0],
        [0.0, 0.0, 0.95],
      ],
      chromaticAberration: 0.3,
      vignette: 0,
    },
  },
  {
    name: "VHS",
    category: "scanline",
    data: {
      gradientType: "scanline",
      speed: 0.4,
      complexity: 3,
      scale: 1.5,
      distortion: 0.5,
      brightness: 0.95,
      saturation: 0.9,
      colors: [
        [0.85, 0.55, 0.7],
        [0.5, 0.6, 0.9],
        [0.75, 0.65, 0.85],
      ],
      grain: 0.12,
      chromaticAberration: 0.5,
      vignette: 0,
    },
  },
  {
    name: "Neon Bars",
    category: "scanline",
    data: {
      gradientType: "scanline",
      speed: 0.6,
      complexity: 5,
      scale: 0.8,
      distortion: 0.25,
      brightness: 1.1,
      saturation: 1.5,
      colors: [
        [1.0, 0.2, 0.6],
        [0.0, 1.0, 1.0],
        [0.5, 1.0, 0.0],
        [1.0, 1.0, 0.0],
      ],
      bloomEnabled: true,
      bloomIntensity: 0.5,
      vignette: 0,
    },
  },
];
```

- [ ] **Step 2: Update index.ts**

Add import and spread:

```typescript
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
import { SCANLINE_PRESETS } from "./scanline";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
  ...SCANLINE_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/scanline.ts lib/presets/index.ts
git commit -m "feat(phase8): add 4 scanline presets (Retro CRT, Broadcast Signal, VHS, Neon Bars)"
```

---

## Task 5: Glitch Presets

**Files:**
- Create: `lib/presets/glitch.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create glitch.ts**

```typescript
// lib/presets/glitch.ts
import { Preset } from "./index";

export const GLITCH_PRESETS: Preset[] = [
  {
    name: "Data Mosh",
    category: "glitch",
    data: {
      gradientType: "glitch",
      speed: 0.5,
      complexity: 7,
      scale: 1.0,
      distortion: 0.7,
      brightness: 1.0,
      saturation: 1.2,
      colors: [
        [0.95, 0.1, 0.15],
        [0.1, 0.3, 0.95],
        [0.0, 0.95, 0.4],
        [0.95, 0.95, 0.95],
      ],
      chromaticAberration: 0.6,
      vignette: 0,
    },
  },
  {
    name: "Slit Scan",
    category: "glitch",
    data: {
      gradientType: "glitch",
      speed: 0.3,
      complexity: 2,
      scale: 1.2,
      distortion: 0.3,
      brightness: 0.95,
      saturation: 1.1,
      colors: [
        [0.3, 0.35, 0.9],
        [0.55, 0.25, 0.85],
        [0.2, 0.5, 0.95],
        [0.15, 0.2, 0.5],
      ],
      vignette: 0.15,
    },
  },
  {
    name: "Corruption",
    category: "glitch",
    data: {
      gradientType: "glitch",
      speed: 0.8,
      complexity: 8,
      scale: 0.8,
      distortion: 0.8,
      brightness: 1.1,
      saturation: 1.3,
      colors: [
        [0.0, 0.95, 0.2],
        [0.0, 0.0, 0.0],
        [0.95, 0.95, 0.95],
      ],
      pixelSortEnabled: true,
      pixelSortIntensity: 0.6,
      pixelSortThreshold: 0.4,
      vignette: 0,
    },
  },
  {
    name: "Signal Loss",
    category: "glitch",
    data: {
      gradientType: "glitch",
      speed: 0.2,
      complexity: 5,
      scale: 1.5,
      distortion: 0.5,
      brightness: 0.9,
      saturation: 0.3,
      colors: [
        [0.5, 0.5, 0.52],
        [0.3, 0.3, 0.32],
        [0.75, 0.75, 0.77],
        [0.15, 0.15, 0.18],
      ],
      grain: 0.15,
      vignette: 0,
    },
  },
];
```

- [ ] **Step 2: Update index.ts**

Add import and spread:

```typescript
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
import { SCANLINE_PRESETS } from "./scanline";
import { GLITCH_PRESETS } from "./glitch";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
  ...SCANLINE_PRESETS,
  ...GLITCH_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/glitch.ts lib/presets/index.ts
git commit -m "feat(phase8): add 4 glitch presets (Data Mosh, Slit Scan, Corruption, Signal Loss)"
```

---

## Task 6: Cinematic Presets

**Files:**
- Create: `lib/presets/cinematic.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create cinematic.ts**

```typescript
// lib/presets/cinematic.ts
import { Preset } from "./index";

export const CINEMATIC_PRESETS: Preset[] = [
  {
    name: "Film Noir",
    category: "cinematic",
    data: {
      gradientType: "mesh",
      speed: 0.2,
      complexity: 3,
      scale: 1.3,
      distortion: 0.25,
      brightness: 0.85,
      saturation: 0.0,
      colors: [
        [0.05, 0.05, 0.05],
        [0.25, 0.25, 0.25],
        [0.92, 0.9, 0.85],
        [0.12, 0.12, 0.14],
      ],
      grain: 0.15,
      vignette: 0.5,
    },
  },
  {
    name: "Blade Runner",
    category: "cinematic",
    data: {
      gradientType: "mesh",
      speed: 0.35,
      complexity: 5,
      scale: 1.0,
      distortion: 0.4,
      brightness: 1.0,
      saturation: 1.2,
      colors: [
        [1.0, 0.2, 0.55],
        [0.05, 0.1, 0.45],
        [1.0, 0.55, 0.1],
        [0.0, 0.7, 0.7],
      ],
      bloomEnabled: true,
      bloomIntensity: 0.5,
      chromaticAberration: 0.3,
      grain: 0.06,
      vignette: 0.3,
    },
  },
  {
    name: "Tron",
    category: "cinematic",
    data: {
      gradientType: "radial",
      speed: 0.4,
      complexity: 4,
      scale: 1.2,
      distortion: 0.3,
      brightness: 1.0,
      saturation: 1.4,
      colors: [
        [0.0, 0.9, 1.0],
        [0.1, 0.3, 0.95],
        [0.02, 0.02, 0.05],
      ],
      bloomEnabled: true,
      bloomIntensity: 0.6,
      vignette: 0.2,
    },
  },
  {
    name: "Vaporwave",
    category: "cinematic",
    data: {
      gradientType: "plasma",
      speed: 0.5,
      complexity: 3,
      scale: 0.9,
      distortion: 0.2,
      brightness: 1.05,
      saturation: 1.6,
      colors: [
        [1.0, 0.25, 0.65],
        [0.0, 0.95, 0.95],
        [0.55, 0.15, 0.9],
        [1.0, 0.75, 0.6],
      ],
      hueShift: 30,
      chromaticAberration: 0.2,
      bloomEnabled: true,
      bloomIntensity: 0.3,
      vignette: 0,
    },
  },
];
```

- [ ] **Step 2: Update index.ts**

Add import and spread:

```typescript
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
import { SCANLINE_PRESETS } from "./scanline";
import { GLITCH_PRESETS } from "./glitch";
import { CINEMATIC_PRESETS } from "./cinematic";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
  ...SCANLINE_PRESETS,
  ...GLITCH_PRESETS,
  ...CINEMATIC_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/cinematic.ts lib/presets/index.ts
git commit -m "feat(phase8): add 4 cinematic presets (Film Noir, Blade Runner, Tron, Vaporwave)"
```

---

## Task 7: Nature Presets

**Files:**
- Create: `lib/presets/nature.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create nature.ts**

```typescript
// lib/presets/nature.ts
import { Preset } from "./index";

export const NATURE_PRESETS: Preset[] = [
  {
    name: "Northern Lights",
    category: "nature",
    data: {
      gradientType: "mesh",
      speed: 0.25,
      complexity: 5,
      scale: 1.5,
      distortion: 0.35,
      brightness: 0.9,
      saturation: 1.2,
      colors: [
        [0.1, 0.85, 0.4],
        [0.0, 0.75, 0.7],
        [0.4, 0.15, 0.7],
        [0.15, 0.35, 0.9],
      ],
      vignette: 0.2,
    },
  },
  {
    name: "Deep Sea",
    category: "nature",
    data: {
      gradientType: "mesh",
      speed: 0.2,
      complexity: 4,
      scale: 1.3,
      distortion: 0.3,
      brightness: 0.7,
      saturation: 1.1,
      colors: [
        [0.02, 0.05, 0.2],
        [0.05, 0.1, 0.35],
        [0.0, 0.65, 0.6],
        [0.01, 0.02, 0.08],
      ],
      vignette: 0.35,
    },
  },
  {
    name: "Forest Canopy",
    category: "nature",
    data: {
      gradientType: "linear",
      speed: 0.3,
      complexity: 3,
      scale: 1.4,
      distortion: 0.25,
      brightness: 0.95,
      saturation: 1.1,
      colors: [
        [0.13, 0.55, 0.13],
        [0.42, 0.56, 0.14],
        [0.85, 0.75, 0.2],
        [0.0, 0.39, 0.15],
      ],
      vignette: 0,
    },
  },
  {
    name: "Sandstorm",
    category: "nature",
    data: {
      gradientType: "mesh",
      speed: 0.45,
      complexity: 6,
      scale: 1.1,
      distortion: 0.5,
      brightness: 1.1,
      saturation: 1.0,
      colors: [
        [0.87, 0.77, 0.55],
        [0.7, 0.4, 0.2],
        [0.9, 0.6, 0.3],
        [0.55, 0.35, 0.2],
      ],
      grain: 0.08,
      vignette: 0,
    },
  },
];
```

- [ ] **Step 2: Update index.ts**

Add import and spread:

```typescript
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
import { SCANLINE_PRESETS } from "./scanline";
import { GLITCH_PRESETS } from "./glitch";
import { CINEMATIC_PRESETS } from "./cinematic";
import { NATURE_PRESETS } from "./nature";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
  ...SCANLINE_PRESETS,
  ...GLITCH_PRESETS,
  ...CINEMATIC_PRESETS,
  ...NATURE_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/nature.ts lib/presets/index.ts
git commit -m "feat(phase8): add 4 nature presets (Northern Lights, Deep Sea, Forest Canopy, Sandstorm)"
```

---

## Task 8: Abstract Presets

**Files:**
- Create: `lib/presets/abstract.ts`
- Modify: `lib/presets/index.ts`

- [ ] **Step 1: Create abstract.ts**

```typescript
// lib/presets/abstract.ts
import { Preset } from "./index";

export const ABSTRACT_PRESETS: Preset[] = [
  {
    name: "Liquid Metal",
    category: "abstract",
    data: {
      gradientType: "mesh",
      speed: 0.4,
      complexity: 5,
      scale: 1.0,
      distortion: 0.4,
      brightness: 1.2,
      saturation: 0.3,
      colors: [
        [0.78, 0.78, 0.8],
        [0.55, 0.62, 0.75],
        [0.95, 0.95, 0.97],
        [0.3, 0.3, 0.35],
      ],
      bloomEnabled: true,
      bloomIntensity: 0.3,
      vignette: 0,
    },
  },
  {
    name: "Oil Slick",
    category: "abstract",
    data: {
      gradientType: "conic",
      speed: 0.35,
      complexity: 4,
      scale: 1.2,
      distortion: 0.35,
      brightness: 1.0,
      saturation: 1.3,
      colors: [
        [0.5, 0.1, 0.7],
        [0.0, 0.7, 0.65],
        [0.85, 0.7, 0.1],
        [0.9, 0.15, 0.55],
        [0.15, 0.75, 0.3],
      ],
      vignette: 0,
    },
  },
  {
    name: "Prism",
    category: "abstract",
    data: {
      gradientType: "linear",
      speed: 0.3,
      complexity: 2,
      scale: 1.0,
      distortion: 0.15,
      brightness: 1.1,
      saturation: 1.5,
      colors: [
        [0.95, 0.1, 0.1],
        [1.0, 0.55, 0.0],
        [1.0, 1.0, 0.0],
        [0.0, 0.85, 0.2],
        [0.1, 0.3, 0.95],
        [0.5, 0.0, 0.8],
      ],
      bloomEnabled: true,
      bloomIntensity: 0.2,
      vignette: 0,
    },
  },
  {
    name: "Smoke",
    category: "abstract",
    data: {
      gradientType: "mesh",
      speed: 0.2,
      complexity: 6,
      scale: 1.5,
      distortion: 0.35,
      brightness: 1.0,
      saturation: 0.1,
      colors: [
        [0.3, 0.3, 0.32],
        [0.15, 0.15, 0.17],
        [0.7, 0.7, 0.72],
        [0.95, 0.95, 0.95],
      ],
      vignette: 0.3,
    },
  },
];
```

- [ ] **Step 2: Update index.ts — final version with all 7 imports**

```typescript
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
import { SCANLINE_PRESETS } from "./scanline";
import { GLITCH_PRESETS } from "./glitch";
import { CINEMATIC_PRESETS } from "./cinematic";
import { NATURE_PRESETS } from "./nature";
import { ABSTRACT_PRESETS } from "./abstract";

export const PRESETS: Preset[] = [
  ...CLASSIC_PRESETS,
  ...DITHER_PRESETS,
  ...SCANLINE_PRESETS,
  ...GLITCH_PRESETS,
  ...CINEMATIC_PRESETS,
  ...NATURE_PRESETS,
  ...ABSTRACT_PRESETS,
];
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: PASS. All 32 presets now in the PRESETS array.

- [ ] **Step 4: Commit**

```bash
git add lib/presets/abstract.ts lib/presets/index.ts
git commit -m "feat(phase8): add 4 abstract presets (Liquid Metal, Oil Slick, Prism, Smoke)"
```

---

## Task 9: PresetsPanel — Grouped Categories with Collapsible Headers

**Files:**
- Modify: `components/PresetsPanel.tsx`

- [ ] **Step 1: Rewrite PresetsPanel with category grouping**

Replace the entire file:

```typescript
"use client";

import { useState } from "react";
import { useGradientStore, GradientState } from "@/lib/store";
import { PRESETS, CATEGORY_ORDER, CATEGORY_LABELS, PresetCategory } from "@/lib/presets";

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function PresetsPanel() {
  const loadPreset = useGradientStore((s: GradientState) => s.loadPreset);
  const [collapsed, setCollapsed] = useState<Set<PresetCategory>>(new Set());

  const toggleCategory = (cat: PresetCategory) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1 p-4">
      {CATEGORY_ORDER.map((cat) => {
        const catPresets = PRESETS.filter((p) => p.category === cat);
        if (catPresets.length === 0) return null;
        const isCollapsed = collapsed.has(cat);

        return (
          <div key={cat}>
            <button
              onClick={() => toggleCategory(cat)}
              className="flex items-center gap-1.5 w-full py-2 text-left"
            >
              <svg
                className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                viewBox="0 0 12 12"
                fill="currentColor"
              >
                <path d="M4 2l4 4-4 4z" />
              </svg>
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                {CATEGORY_LABELS[cat]}
              </span>
              <span className="text-[10px] text-text-tertiary ml-auto">
                {catPresets.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="grid grid-cols-2 gap-2 pb-3">
                {catPresets.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => loadPreset(preset.data)}
                    className="flex flex-col rounded-lg border border-border hover:border-border-active overflow-hidden
                      transition-all duration-150 hover:scale-[1.02] group"
                  >
                    <div
                      className="h-16 w-full"
                      style={{
                        background: `linear-gradient(135deg, ${preset.data.colors!
                          .map((c) => rgbToHex(...c))
                          .join(", ")})`,
                      }}
                    />
                    <div className="py-1.5 px-2 bg-surface w-full">
                      <span className="text-[11px] text-text-secondary group-hover:text-text-primary transition-colors">
                        {preset.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

Key changes from original:
- Imports `CATEGORY_ORDER`, `CATEGORY_LABELS`, `PresetCategory` from presets index
- Local `collapsed` state tracks which categories are collapsed (starts all expanded)
- Groups presets by category with clickable header (chevron + label + count)
- Card height reduced from `h-20` to `h-16` to fit more presets on screen
- Font size on preset name reduced to `text-[11px]` for density

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/PresetsPanel.tsx
git commit -m "feat(phase8): grouped presets panel with collapsible category sections"
```

---

## Task 10: Integration Verification

**Files:**
- No file changes

- [ ] **Step 1: Clean build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: No new errors (pre-existing warnings are OK).

- [ ] **Step 3: Run dev server and verify**

Run: `npm run dev`

Manual checks:
1. Open `/editor`, click Presets tab
2. 7 category headers visible (Classic, Dither, Scanline, Glitch, Cinematic, Nature, Abstract)
3. All categories start expanded
4. Click a category header — it collapses, click again — it expands
5. Count: 8 Classic + 4×6 new = 32 total presets
6. Click "Newspaper" preset — dither mode renders with black dots on cream
7. Click "Blade Runner" — mesh mode with bloom and chromatic aberration visible
8. Click "Data Mosh" — glitch mode with heavy distortion
9. Click "Film Noir" — desaturated mesh with heavy grain and vignette
10. Click "Aurora" — still works exactly as before (regression check)
11. Randomize button still works (doesn't crash)
12. Undo after loading a preset reverts to previous state

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(phase8): preset expansion complete — 32 presets across 7 categories"
```
