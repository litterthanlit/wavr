# Phase 8: Preset Library Expansion — Design Spec

## Overview

Expand from 8 presets to 32 across 7 categories. Add category grouping to the PresetsPanel UI. Some presets showcase effect combinations to demonstrate the engine's capabilities.

**Key decisions from brainstorming:**
- Category sections with collapsible headers in PresetsPanel (option B)
- Parameter values designed to look good per preset name/mood
- Effect-heavy presets for cinematic/glitch categories, clean presets for nature/abstract
- One file per category under `lib/presets/`

---

## 1. Data Model

### Updated `Preset` interface

```typescript
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
```

### PresetData type

Unchanged — stays as `Partial<Omit<GradientState, action keys>>`. Presets that use effects include the relevant effect fields (bloomEnabled, chromaticAberration, etc.).

---

## 2. File Structure

```
lib/presets/
  index.ts          — Preset/PresetCategory types, CATEGORY_LABELS, CATEGORY_ORDER, re-exports PRESETS array
  classic.ts        — 8 existing presets (Aurora, Sunset, Midnight, Candy, Ocean, Lava, Cyber, Monochrome)
  dither.ts         — 4 presets (Newspaper, Stipple, Dissolve, Morse)
  scanline.ts       — 4 presets (Retro CRT, Broadcast Signal, VHS, Neon Bars)
  glitch.ts         — 4 presets (Data Mosh, Slit Scan, Corruption, Signal Loss)
  cinematic.ts      — 4 presets (Film Noir, Blade Runner, Tron, Vaporwave)
  nature.ts         — 4 presets (Northern Lights, Deep Sea, Forest Canopy, Sandstorm)
  abstract.ts       — 4 presets (Liquid Metal, Oil Slick, Prism, Smoke)
```

The old `lib/presets.ts` file is deleted. `index.ts` imports all category files and exports a combined `PRESETS` array.

```typescript
// lib/presets/index.ts
import { CLASSIC_PRESETS } from "./classic";
import { DITHER_PRESETS } from "./dither";
// ... etc
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

Import path changes from `"@/lib/presets"` to `"@/lib/presets"` (same, since index.ts handles it). No consumer changes needed.

---

## 3. Preset Definitions

### Classic (8 existing — add `category: "classic"`, no parameter changes)

Aurora, Sunset, Midnight, Candy, Ocean, Lava, Cyber, Monochrome — unchanged except for the added `category` field.

### Dither (4 new)

| Name | Mode | Palette | Key params | Effects |
|---|---|---|---|---|
| Newspaper | dither | black on warm cream | complexity=2, scale=1.5, speed=0.1 | grain=0.05 |
| Stipple | dither | dark gray on white | complexity=4, scale=0.8, speed=0.2 | none |
| Dissolve | dither | warm magenta + teal on black | complexity=6, scale=1.0, speed=0.5, distortion=0.4 | none |
| Morse | dither | green on black (terminal) | complexity=3, scale=2.0, speed=0.3 | grain=0.1, vignette=0.3 |

### Scanline (4 new)

| Name | Mode | Palette | Key params | Effects |
|---|---|---|---|---|
| Retro CRT | scanline | warm RGB primaries | complexity=4, scale=1.2, speed=0.3, distortion=0.3 | vignette=0.4, grain=0.08 |
| Broadcast Signal | scanline | NTSC color bars (red, green, blue, cyan, magenta, yellow, white) | complexity=6, scale=1.0, speed=0.15 | chromaticAberration=0.3 |
| VHS | scanline | muted pastels (pink, blue, lavender) | complexity=3, scale=1.5, speed=0.4, distortion=0.5 | grain=0.12, chromaticAberration=0.5 |
| Neon Bars | scanline | neon pink, cyan, lime, yellow | complexity=5, scale=0.8, speed=0.6 | bloomEnabled=true, bloomIntensity=0.5, saturation=1.5 |

### Glitch (4 new)

| Name | Mode | Palette | Key params | Effects |
|---|---|---|---|---|
| Data Mosh | glitch | RGB with heavy red | complexity=7, scale=1.0, speed=0.5, distortion=0.7 | chromaticAberration=0.6 |
| Slit Scan | glitch | cool blues + purples | complexity=2, scale=1.2, speed=0.3, distortion=0.3 | none |
| Corruption | glitch | neon green + black + white | complexity=8, scale=0.8, speed=0.8, distortion=0.8 | pixelSortEnabled=true, pixelSortIntensity=0.6, pixelSortThreshold=0.4 |
| Signal Loss | glitch | desaturated gray + noise bursts | complexity=5, scale=1.5, speed=0.2, distortion=0.5 | grain=0.15, saturation=0.3 |

### Cinematic (4 new — effect-heavy)

| Name | Mode | Palette | Key params | Effects |
|---|---|---|---|---|
| Film Noir | mesh | black, dark gray, off-white | complexity=3, scale=1.3, speed=0.2 | saturation=0.0, grain=0.15, vignette=0.5, brightness=0.85 |
| Blade Runner | mesh | neon pink, deep blue, orange, teal | complexity=5, scale=1.0, speed=0.35, distortion=0.4 | bloomEnabled=true, bloomIntensity=0.5, chromaticAberration=0.3, vignette=0.3, grain=0.06 |
| Tron | radial | cyan, blue, black | complexity=4, scale=1.2, speed=0.4 | bloomEnabled=true, bloomIntensity=0.6, saturation=1.4, vignette=0.2 |
| Vaporwave | plasma | hot pink, cyan, purple, peach | complexity=3, scale=0.9, speed=0.5 | hueShift=30, saturation=1.6, chromaticAberration=0.2, bloomEnabled=true, bloomIntensity=0.3 |

### Nature (4 new — clean, no heavy effects)

| Name | Mode | Palette | Key params | Effects |
|---|---|---|---|---|
| Northern Lights | mesh | green, teal, purple, blue | complexity=5, scale=1.5, speed=0.25, distortion=0.35 | vignette=0.2, brightness=0.9 |
| Deep Sea | mesh | dark navy, midnight blue, bioluminescent teal, deep black | complexity=4, scale=1.3, speed=0.2, distortion=0.3 | vignette=0.35, brightness=0.7 |
| Forest Canopy | linear | forest green, olive, golden yellow, dark emerald | complexity=3, scale=1.4, speed=0.3, distortion=0.25 | brightness=0.95, saturation=1.1 |
| Sandstorm | mesh | sand, burnt sienna, dusty orange, warm brown | complexity=6, scale=1.1, speed=0.45, distortion=0.5 | grain=0.08, brightness=1.1 |

### Abstract (4 new)

| Name | Mode | Palette | Key params | Effects |
|---|---|---|---|---|
| Liquid Metal | mesh | silver, chrome blue, white, dark gray | complexity=5, scale=1.0, speed=0.4, distortion=0.4 | saturation=0.3, brightness=1.2, bloomEnabled=true, bloomIntensity=0.3 |
| Oil Slick | conic | rainbow iridescence (purple, teal, gold, magenta, green) | complexity=4, scale=1.2, speed=0.35, distortion=0.35 | saturation=1.3 |
| Prism | linear | rainbow spectrum (red, orange, yellow, green, blue, violet) | complexity=2, scale=1.0, speed=0.3, distortion=0.15 | saturation=1.5, brightness=1.1, bloomEnabled=true, bloomIntensity=0.2 |
| Smoke | mesh | dark gray, charcoal, light gray, white | complexity=6, scale=1.5, speed=0.2, distortion=0.35 | saturation=0.1, vignette=0.3 |

---

## 4. PresetsPanel UI

### Category sections with collapsible headers

The panel renders presets grouped by category with section headers. Each category section is collapsible (matching the existing collapsible pattern in EffectsPanel).

```
┌──────────────────────────────────┐
│ ▼ Classic                        │
│ ┌──────┐ ┌──────┐               │
│ │Aurora│ │Sunset│               │
│ └──────┘ └──────┘               │
│ ┌──────────┐ ┌─────┐           │
│ │Midnight  │ │Candy│           │
│ └──────────┘ └─────┘           │
│ ...                              │
│                                  │
│ ▼ Dither                         │
│ ┌──────────┐ ┌───────┐         │
│ │Newspaper │ │Stipple│         │
│ └──────────┘ └───────┘         │
│ ...                              │
│                                  │
│ ▶ Scanline (collapsed)           │
│ ▶ Glitch (collapsed)            │
│ ...                              │
└──────────────────────────────────┘
```

### Collapse behavior

- All categories start **expanded** on first load
- Clicking a category header toggles collapse
- Collapse state is local component state (not persisted)
- The 2-column grid layout stays the same within each category

### Category header style

Match existing `SectionHeader` pattern used in GradientPanel/EffectsPanel — small uppercase text with a chevron icon.

---

## 5. Files Changed

| File | Change |
|---|---|
| `lib/presets.ts` | **Delete** — replaced by `lib/presets/` directory |
| `lib/presets/index.ts` | **Create** — types, constants, re-export combined PRESETS array |
| `lib/presets/classic.ts` | **Create** — 8 existing presets with `category: "classic"` |
| `lib/presets/dither.ts` | **Create** — 4 dither presets |
| `lib/presets/scanline.ts` | **Create** — 4 scanline presets |
| `lib/presets/glitch.ts` | **Create** — 4 glitch presets |
| `lib/presets/cinematic.ts` | **Create** — 4 cinematic presets |
| `lib/presets/nature.ts` | **Create** — 4 nature presets |
| `lib/presets/abstract.ts` | **Create** — 4 abstract presets |
| `components/PresetsPanel.tsx` | **Modify** — grouped rendering with collapsible category headers |

### Import compatibility

The `PRESETS` array and `Preset` type are re-exported from `lib/presets/index.ts`. Since the old file was `lib/presets.ts` and the new is `lib/presets/index.ts`, the import path `"@/lib/presets"` resolves the same way. No changes needed in any consumer file.

---

## 6. Constraints

- Each preset file exports a typed `Preset[]` array — TypeScript catches missing required fields
- Preset `data` only includes fields that differ from defaults — keeps definitions concise
- Colors are RGB tuples `[number, number, number][]` in 0-1 range (same as existing)
- No new gradient modes or effects — presets only use what already exists (8 modes + image + all current effects)
- Presets don't include `imageData` (no image presets — those require user uploads)
