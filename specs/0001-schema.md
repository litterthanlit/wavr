# Spec 0001 — `@wavr/schema`

> **Status:** Draft v2 — addressing review feedback
> **Owner:** Wavr core
> **Target version:** `@wavr/schema@2.0.0`
> **Blocks:** Steps 1–6 of `HANDOFF.md`

---

## 1. Goal

Create a single, versioned, Zod-backed source of truth for `GradientConfig` that:

1. Drives the editor store, the npm runtime, the headless renderer, the URL codec, and the MCP agent tools from one schema definition.
2. Produces a full TypeScript type via `z.infer` — no hand-maintained parallel types.
3. Is self-describing (IDE hover + LLM introspection use the same `.describe()` metadata).
4. Is versioned and forward/backward migratable.
5. Round-trips losslessly: `config → URL → config → framebuffer-hash` is stable across editor and runtime **within a documented ULP tolerance**.

Non-goals: new effects, new gradient modes, UI changes, runtime refactors. This spec is pure contract.

---

## 2. Package layout

```
packages/schema/
├── package.json              # name: @wavr/schema, type: module, exports: { ".", "./migrate", "./url", "./agent" }
├── tsconfig.json
├── tsup.config.ts            # dual CJS/ESM, d.ts
├── src/
│   ├── index.ts              # re-exports schema, types, defaults
│   ├── schema.ts             # root GradientConfig + all sub-schemas
│   ├── effects/              # one file per effect group (see §3.2)
│   ├── descriptions.md       # authored prose, compiled into .describe() at build
│   ├── descriptions.gen.ts   # generated from descriptions.md, imported by schema.ts
│   ├── defaults.ts           # DEFAULT_CONFIG used by coerce/migrate
│   ├── migrate.ts            # migrate(input, { from?, to? }) + registry
│   ├── url.ts                # encodeUrl / decodeUrl / tryDecodeUrl
│   ├── agent.ts              # tool request/response schemas for MCP
│   ├── parity.ts             # tolerance-bucketed framebuffer hash helper
│   └── version.ts            # SCHEMA_VERSION = "2.0.0"
└── test/
    ├── schema.test.ts
    ├── migrate.test.ts
    ├── url.test.ts
    ├── parity.test.ts        # runs renderer-node goldens
    └── fixtures/
        ├── v1-minimal.json        # legacy ProjectState hash from URL
        ├── v1-full.json           # legacy ProjectState with every field set
        ├── v1-types-full.json     # legacy packages/core/src/types.ts GradientConfig
        ├── v2-minimal.json
        ├── v2-full.json
        └── parity/                # configs + golden hashes for render parity
```

**Dependencies:** `zod@^3.23`, `lz-string@^1.5`. Isomorphic only — no Node or browser-only imports.

---

## 3. The schema

### 3.1 Principles

- **Every field closed.** Enums use `z.enum([...])`, never `z.string()`.
- **Every numeric field has `.min()` and `.max()`** equal to the runtime's actual support range.
- **Every field has `.describe()`**, sourced from `descriptions.md` (see §3.3). This is what the MCP tool surface, LLM prompts, and IDE hover read.
- **Effect groups are `{ enabled: boolean, ...params }` objects**, matching the existing shape in `packages/core/src/types.ts`. Migration is additive; no restructuring.
- **`.strict()` on every object.** Unknown keys throw on `parse`, so typos in LLM output fail loud.
- **`version: "2.0.0"` is required on the root.** `migrate()` is the only way to change it.
- **Each effect group lives in its own file** under `src/effects/` and is exported individually. Reused directly by `agent.ts` for tool descriptions and by future migration steps.

### 3.2 Full schema — no ellipses

#### 3.2.1 Primitives

```ts
// src/schema.ts
export const RGBColor = z
  .tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)])
  .describe("Linear RGB color, each channel 0–1.");

export const ColorSpace = z
  .enum(["linear", "oklab"])
  .describe("Color space the RGBColor values are authored in. 'linear' is the current convention.");

export const GradientType = z
  .enum([
    "mesh", "radial", "linear", "conic", "plasma",
    "dither", "scanline", "glitch", "voronoi", "image",
  ])
  .describe("Base shader that generates this layer. `image` requires layer.image.data.");

export const BlendMode = z
  .enum([
    "normal",
    "darken", "multiply", "colorBurn", "linearBurn", "darkerColor",
    "lighten", "screen", "colorDodge", "add", "lighterColor",
    "overlay", "softLight", "hardLight", "vividLight", "linearLight", "pinLight", "hardMix",
    "difference", "exclusion", "subtract", "divide",
    "hue", "saturation", "color", "luminosity",
  ])
  .describe("Photoshop-compatible layer blend mode. Ports 1:1 from packages/core/src/layers.ts.");

export const Shape3DKind = z
  .enum(["sphere", "torus", "plane", "cylinder", "cube"])
  .describe("Projection surface for the 3D-shape effect.");
```

#### 3.2.2 Layer

```ts
export const LayerConfig = z
  .object({
    type: GradientType,
    colors: z.array(RGBColor).min(2).max(8).describe("2–8 colors sampled across the gradient."),
    speed: z.number().min(0).max(2).default(0.4).describe("Animation speed multiplier. 0 = frozen."),
    complexity: z.number().int().min(1).max(8).default(3).describe("Shape detail / fBm octaves."),
    scale: z.number().min(0.2).max(4).default(1).describe("Pattern zoom. <1 = larger features."),
    distortion: z.number().min(0).max(1).default(0.3).describe("Noise displacement of UVs."),
    opacity: z.number().min(0).max(1).default(1),
    blendMode: BlendMode.default("normal"),
    depth: z.number().min(-1).max(1).default(0).describe("Parallax depth. Negative = behind."),
  })
  .strict();
```

**Not in V2 layer schema (see §11 OQ-L):** `visible`, `imageData`, `imageScale`, `imageOffset`, `distortionMapData`, `distortionMapEnabled`, `distortionMapIntensity`, `imageBlendMode`, `imageBlendOpacity`, `mask1`, `mask2`, `maskBlendMode`, `maskSmoothness`, `maskEnabled`, `textMask*`. These live on `LayerParams` in `packages/core/src/layers.ts` today but are not part of the render contract yet — they get their own spec (`0002-layer-extensions.md`) before Step 2 ships.

**Layer count:** `layers: z.array(LayerConfig).min(1).max(4)`. Matches `MAX_LAYERS = 4` in `packages/core/src/layers.ts`. Raising the cap later is a migration, not a silent change.

#### 3.2.3 Root — globals

```ts
export const GradientConfig = z
  .object({
    version: z.literal("2.0.0"),
    colorSpace: ColorSpace.default("linear"),
    layers: z.array(LayerConfig).min(1).max(4),

    // Global post
    brightness: z.number().min(0.1).max(2).default(1),
    saturation: z.number().min(0).max(2).default(1),
    grain: z.number().min(0).max(1).default(0),
    vignette: z.number().min(0).max(1).default(0),
    chromaticAberration: z.number().min(0).max(1).default(0),
    hueShift: z.number().min(-180).max(180).default(0),
    domainWarp: z.number().min(0).max(1).default(0),
    radialBlur: z.number().min(0).max(1).default(0),
    mouseReact: z.number().min(0).max(1).default(0.5),
    oklabEnabled: z.boolean().default(true),
    toneMapMode: z.number().int().min(0).max(3).default(1).describe("0=none, 1=ACES, 2=Reinhard, 3=Filmic."),

    // Effect groups (see §3.2.4)
    noise: NoiseEffect.optional(),
    bloom: BloomEffect.optional(),
    blur: BlurEffect.optional(),
    curl: CurlEffect.optional(),
    kaleidoscope: KaleidoscopeEffect.optional(),
    reactionDiffusion: ReactionDiffusionEffect.optional(),
    pixelSort: PixelSortEffect.optional(),
    feedback: FeedbackEffect.optional(),
    ascii: AsciiEffect.optional(),
    dither: DitherEffect.optional(),
    parallax: ParallaxEffect.optional(),
    shape3d: Shape3DEffect.optional(),
    meshDistortion: MeshDistortionEffect.optional(),
    ripple: RippleEffect.optional(),
    glow: GlowEffect.optional(),
    caustic: CausticEffect.optional(),
    liquify: LiquifyEffect.optional(),
    trail: TrailEffect.optional(),
    realBloom: RealBloomEffect.optional(),
  })
  .strict();

export type GradientConfig = z.infer<typeof GradientConfig>;
export type LayerConfig = z.infer<typeof LayerConfig>;
export type RGBColor = z.infer<typeof RGBColor>;
```

#### 3.2.4 Effect groups — all 18, full definitions

Every group below lives in its own file (`src/effects/<name>.ts`), exported by name, and re-exported from `src/effects/index.ts`. Bounds below track `packages/core/src/config.ts::resolveConfig` and `apps/editor/lib/store.ts` defaults exactly.

```ts
// src/effects/noise.ts
export const NoiseEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.3),
  scale: z.number().min(0.1).max(10).default(1),
}).strict().describe("Fractal-noise overlay added to the composited gradient.");

// src/effects/bloom.ts
export const BloomEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(2).default(0.3),
}).strict().describe("Gaussian-approx bloom on highlights.");

// src/effects/blur.ts
export const BlurEffect = z.object({
  enabled: z.boolean(),
  amount: z.number().min(0).max(1).default(0),
}).strict().describe("Full-frame separable Gaussian blur.");

// src/effects/curl.ts
export const CurlEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(0.1).max(10).default(1),
}).strict().describe("Curl-noise UV distortion.");

// src/effects/kaleidoscope.ts
export const KaleidoscopeEffect = z.object({
  enabled: z.boolean(),
  segments: z.number().int().min(2).max(16).default(6),
  rotation: z.number().min(-180).max(180).default(0),
}).strict();

// src/effects/reactionDiffusion.ts
export const ReactionDiffusionEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.5),
  scale: z.number().min(0.1).max(10).default(1),
}).strict();

// src/effects/pixelSort.ts
export const PixelSortEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.5),
  threshold: z.number().min(0).max(1).default(0.5),
}).strict();

// src/effects/feedback.ts
export const FeedbackEffect = z.object({
  enabled: z.boolean(),
  decay: z.number().min(0).max(1).default(0.5),
}).strict();

// src/effects/ascii.ts
export const AsciiEffect = z.object({
  enabled: z.boolean(),
  size: z.number().int().min(2).max(32).default(8),
}).strict();

// src/effects/dither.ts
export const DitherEffect = z.object({
  enabled: z.boolean(),
  size: z.number().int().min(1).max(16).default(4),
}).strict().describe("Ordered-Bayer dither post-pass; different from the Step 1 blue-noise anti-banding pass.");

// src/effects/parallax.ts
export const ParallaxEffect = z.object({
  enabled: z.boolean(),
  strength: z.number().min(0).max(1).default(0.5),
}).strict();

// src/effects/shape3d.ts
export const Shape3DEffect = z.object({
  enabled: z.boolean(),
  shape: Shape3DKind.default("sphere"),
  perspective: z.number().min(0.1).max(5).default(1.5),
  rotationSpeed: z.number().min(0).max(2).default(0.3),
  zoom: z.number().min(0.1).max(5).default(1),
  lighting: z.number().min(0).max(1).default(0.5),
}).strict();

// src/effects/meshDistortion.ts
export const MeshDistortionEffect = z.object({
  enabled: z.boolean(),
  displacement: z.number().min(0).max(1).default(0.3),
  frequency: z.number().min(0).max(10).default(2),
  speed: z.number().min(0).max(2).default(0.5),
}).strict();

// src/effects/ripple.ts
export const RippleEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.5),
}).strict();

// src/effects/glow.ts
export const GlowEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.5),
  radius: z.number().min(0).max(0.5).default(0.05),
}).strict();

// src/effects/caustic.ts
export const CausticEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.5),
}).strict();

// src/effects/liquify.ts
export const LiquifyEffect = z.object({
  enabled: z.boolean(),
  intensity: z.number().min(0).max(1).default(0.3),
  scale: z.number().min(0.1).max(10).default(2),
}).strict();

// src/effects/trail.ts
export const TrailEffect = z.object({
  enabled: z.boolean(),
  length: z.number().min(0).max(1).default(0.96),
  width: z.number().min(0).max(1).default(0.05),
}).strict();

// src/effects/realBloom.ts
export const RealBloomEffect = z.object({
  enabled: z.boolean(),
}).strict().describe(
  "Physically-correct bloom pass. Grouped in V2; was top-level realBloomEnabled in V1. " +
  "Migration step renames the flag and wraps it in this object."
);
```

### 3.3 `.describe()` authoring

All `.describe()` strings are compiled from a single source:

```
packages/schema/src/descriptions.md
```

Format: one section per schema symbol, heading syntax `## GradientConfig.brightness`. Build step (`pnpm --filter @wavr/schema gen`) parses that markdown into `descriptions.gen.ts`:

```ts
export const DESCRIPTIONS = {
  "GradientConfig.brightness": "Linear luminance multiplier applied after tone mapping.",
  "LayerConfig.speed": "Animation speed multiplier. 0 = frozen.",
  // …
} as const;
```

`schema.ts` imports `DESCRIPTIONS` and applies them via a helper: `d("GradientConfig.brightness", z.number().min(0.1).max(2))`. A missing key is a build error.

Rationale: non-engineers can PR copy changes, LLM-facing language stays consistent across tools, and a single `git log` on `descriptions.md` tells the story of how Wavr talks about its own parameters.

### 3.4 Editor store vs `GradientConfig`

The editor store (`apps/editor/lib/store.ts::GradientState`) is **not** the same shape as `GradientConfig`. This section is normative — it tells the wire-up step (§12.6) exactly what to do with each store field.

**Three buckets:**

#### A. Schema-owned — moves into `store.config: GradientConfig`

These are the rendered-output parameters. After Step 0, the store holds a validated `GradientConfig` under `state.config` and exposes selectors (`useLayer(i)`, `useEffect("bloom")`). All reads/writes go through `set`/`setDiscrete`/`commitSet` applied to `config`, which re-runs `GradientConfig.parse` on commit in dev (strip in prod).

- `layers` (but mapped: see §3.4.1)
- `brightness`, `saturation`, `grain`, `vignette`, `mouseReact`
- `bloom{Enabled,Intensity}` → `config.bloom`
- `blur{Enabled,Amount}` → `config.blur`
- `noise{Enabled,Intensity,Scale}` → `config.noise`
- `ascii{Enabled,Size}` → `config.ascii`
- `dither{Enabled,Size}` → `config.dither`
- `curl{Enabled,Intensity,Scale}` → `config.curl`
- `kaleidoscope{Enabled,Segments,Rotation}` → `config.kaleidoscope`
- `reactionDiff{Enabled,Intensity,Scale}` → `config.reactionDiffusion`
- `pixelSort{Enabled,Intensity,Threshold}` → `config.pixelSort`
- `feedback{Enabled,Decay}` → `config.feedback`
- `parallax{Enabled,Strength}` → `config.parallax`
- `threeD{Enabled,Shape,Perspective,RotationSpeed,Zoom,Lighting}` → `config.shape3d`
  - `threeDShape` is a number index today (0..4); schema uses the string enum; converter lives in `migrate.ts` under `shape3dIndexToName`.
- `meshDistortion{Enabled,Displacement,Frequency,Speed}` → `config.meshDistortion`
- `ripple{Enabled,Intensity}` → `config.ripple`
- `glow{Enabled,Intensity,Radius}` → `config.glow`
- `caustic{Enabled,Intensity}` → `config.caustic`
- `liquify{Enabled,Intensity,Scale}` → `config.liquify`
- `trail{Enabled,Length,Width}` → `config.trail`
- `radialBlurAmount` → `config.radialBlur`
- `chromaticAberration`, `hueShift`, `domainWarp`
- `oklabEnabled`, `toneMapMode`
- `realBloomEnabled` → `config.realBloom.enabled` (top-level flag → grouped; see §4.3)

#### B. Ephemeral UI state — stays on store root, not serialized

Never persisted, never in URLs.

- `playing`
- Derived active-layer fields: `gradientType`, `speed`, `complexity`, `scale`, `distortion`, `colors` (these are a back-compat mirror of `layers[activeLayerIndex]`; keep the selector, delete the mirror once consumers migrate).
- Action functions: `set`, `setDiscrete`, `commitSet`, `setColor`, `addColor`, `removeColor`, `loadPreset`, `randomize`, `undo`, `redo`, layer/image/timeline actions.
- Internal: undo/redo `past`, `future`, `pendingSnapshot`.

#### C. Editor-only persistent state — out of scope for this spec

These get an `EditorState` schema in a **separate spec (`0002-editor-state.md`)**. They are persisted in saved projects and, where useful, in URLs — but through a companion envelope, not inside `GradientConfig`.

- `activeLayerIndex` — UI focus, not render state.
- `colorBlend` — currently unused by the renderer (`engine.ts` hard-codes `colorBlend: 0`). Flag for removal.
- `customGLSL` — per-user GLSL source for the Code tab.
- Timeline block: `timelineEnabled`, `timelineDuration`, `timelinePlaybackMode`, `keyframes`, `timelinePosition`.
- Audio block: `audioEnabled`, `audioSource`, `audioBassTarget`, `audioTrebleTarget`, `audioEnergyTarget`, `audioSensitivity`. (Also explicitly out of V2 per PRD V2 §14.4.)
- Layer-level extensions listed in §3.2.2 (visibility, image, masks, text-mask).

#### 3.4.1 Layer mapping note

`store.layers` holds `LayerParams`, which is a superset of `LayerConfig`. During wire-up:

1. The store gains a `state.config.layers: LayerConfig[]` (schema-owned).
2. Image/mask/text-mask extensions live on a parallel `state.layerExtensions: LayerExtension[]` keyed by index (typed in `EditorState`, spec 0002).
3. The `GradientConfig` → `EngineState` path in `packages/core/src/config.ts::resolveConfig` stays responsible for combining both into what the shader sees.

**Pre-spec behavior note.** `packages/core/src/config.ts::stateToConfig` (lines 108–118) already drops `visible`, `imageData`, `imageScale`, `imageOffset`, `distortionMapData`, `distortionMapEnabled`, `distortionMapIntensity`, `imageBlendMode`, `imageBlendOpacity`, `mask1`, `mask2`, `maskBlendMode`, `maskSmoothness`, `maskEnabled`, and all `textMask*` fields on save. Today's URL → load → save → URL cycle silently loses them. V2 preserves that exact behavior — layer extensions move to `EditorState.layerExtensions` in Spec 0002 without changing round-trip fidelity. Migration is not losing data that previously round-tripped.

---

## 4. Versioning & migration

### 4.1 Legacy shapes — three, not one

Three distinct shapes pre-date this spec:

1. **`packages/core/src/types.ts::GradientConfig`** — the de-facto "V1 types" shape. Nested effect groups, no `version`, no layer-extension fields. Used by `resolveConfig`.
2. **`apps/editor/lib/store.ts::GradientState`** — flat editor state, richest set of fields (Phase 11 additions, audio, timeline, active layer).
3. **`apps/editor/lib/projects.ts::ProjectState`** — the URL payload + localStorage save format. A narrower flat shape that omits Phase 11 fields (ripple/glow/caustic/liquify/trail/realBloom/oklab/toneMap), curl, kaleidoscope, reaction-diffusion, pixel-sort, feedback, parallax, 3D shape, mesh-distortion, audio. Includes `activeLayerIndex`, `colorBlend`, timeline. Strips `imageData`/`distortionMapData` before serialization.

The migrate step must handle all three inputs. A V1 tag alone is insufficient — we disambiguate by field detection.

### 4.2 Migration API

```ts
// packages/schema/src/migrate.ts
export type SchemaVersion = "1.0.0" | "2.0.0";
export type LegacyShape = "types-v1" | "project-state-v1";

export interface MigrateResult {
  config: GradientConfig;
  droppedKeys: string[];
  warnings: Array<{ path: string; message: string }>;
  detectedShape: LegacyShape | "v2";
}

export function detectVersion(input: unknown): SchemaVersion;
export function detectShape(input: unknown): MigrateResult["detectedShape"];

export function migrate(
  input: unknown,
  opts?: { from?: SchemaVersion; to?: SchemaVersion; onWarning?: (w: { path: string; message: string }) => void }
): MigrateResult;
```

### 4.3 Rules

#### From `types-v1` (nested)

1. Inject `version: "2.0.0"`, `colorSpace: "linear"`.
2. Fill missing globals from `DEFAULT_CONFIG`.
3. Port every effect group 1:1 (keys already match).
4. Rename `realBloomEnabled: boolean` → `realBloom: { enabled: boolean }`. If absent, leave `realBloom` undefined.
5. Clamp out-of-range numerics; emit warning, never throw.
6. Drop unknown keys; collect in `droppedKeys`.

#### From `project-state-v1` (flat)

1. Unflatten `noiseEnabled/noiseIntensity/noiseScale` → `noise: {...}`, and analogous for every flat triple/pair. Mapping table lives in `migrate.ts` as `FLAT_TO_NESTED`.
2. Drop editor-only fields (`activeLayerIndex`, `colorBlend`, `timeline*`, `keyframes`) — collect in `droppedKeys` so Spec 0002 can pick them up into `EditorState` during the wire-up.
3. Convert `threeDShape` number → `Shape3DKind` string via `SHAPE_NAMES[i]` (matches `packages/core/src/config.ts::SHAPE_NAMES`).
4. `layers[*].imageData` and `layers[*].distortionMapData` are already `null` in `exportProjectStateForUrl`; pass through. In full `ProjectState` from saved projects, drop them with a warning (they move to `EditorState.layerExtensions` per Spec 0002).
5. Fill Phase 11 globals (`oklabEnabled`, `toneMapMode`, `realBloom`) from defaults since they're not in `ProjectState`. `realBloom` stays undefined; renderer treats that as disabled.
6. Everything else as in `types-v1` rules.

#### Color-space handling

- V1 legacy configs are tagged `colorSpace: "linear"` — matches existing presets (`packages/core/src/presets/*` all use linear RGB floats today).
- Future sRGB-hex inputs are converted to linear **before** `GradientConfig.parse`. The conversion is never done inside the schema.
- Flagging `colorSpace: "oklab"` is reserved for OKLab-authored presets; renderer treats it as a hint to skip the sRGB→linear tone-map step. Implementation tracked in Spec 0002.

### 4.4 Idempotence

`migrate(migrate(x).config).config` must deep-equal `migrate(x).config`. Test: re-run migration on every fixture and assert equality.

---

## 5. URL-state codec

### 5.1 Target

Typical config (2 layers, 3 effects enabled) under **2KB** after encoding. Hard ceiling 6KB — beyond that, `encodeUrl` throws and the editor prompts the user to save as a preset.

### 5.2 Algorithm

1. `GradientConfig.parse(config)` — throws on invalid.
2. Strip defaults: walk schema, omit fields equal to declared default. Resilient to future default changes.
3. `JSON.stringify` → `LZString.compressToEncodedURIComponent` (base64url-safe).
4. Prefix with `s2.`.

### 5.3 API

```ts
// packages/schema/src/url.ts
export function encodeUrl(config: GradientConfig): string;        // "s2.XXXXX"
export function decodeUrl(encoded: string): GradientConfig;        // throws on invalid
export function tryDecodeUrl(encoded: string):
  | { ok: true; config: GradientConfig; migrated: boolean; droppedKeys: string[] }
  | { ok: false; error: string; detectedShape?: "v1-legacy" | "unknown" };
```

### 5.4 V1 backwards-compat (the real path)

Based on `apps/editor/lib/url.ts` + `apps/editor/lib/projects.ts::exportProjectStateForUrl`, a V1 URL hash decodes to a `ProjectState`:

```
V1 URL:  #s=<base64url(JSON.stringify(ProjectState))>
         └─ no prefix other than "s="
         └─ no LZ compression
         └─ payload has activeLayerIndex, colorBlend, timeline*, keyframes
         └─ layers is LayerParams[] with imageData: null, distortionMapData: null
```

Decoder rules:

1. If `encoded` starts with `s2.` → LZ path, parse as V2 directly.
2. If `encoded` starts with `s=` or is plain base64url → V1 path:
   a. Base64url-decode → JSON.parse → `ProjectState`.
   b. `migrate(projectState)` — routes to `project-state-v1` rules (§4.3).
   c. Side-band return: `droppedKeys` includes editor-only fields so the caller (editor boot) can optionally feed them into `EditorState`.
3. Anything else → `{ ok: false, detectedShape: "unknown" }`.

On write, editor always uses `s2.` — one round-trip silently upgrades the URL.

### 5.5 Tests

- Round-trip 100 random valid V2 configs: `decode(encode(c))` deep-equals `c` after default-fill.
- Every `v1-*` fixture decodes via the legacy path and produces a valid V2 config.
- A V2.0.0 encoded string decodes under a future V2.1.0 build (forward compat).
- Fuzz 1000 random byte strings through `tryDecodeUrl`: zero unhandled exceptions **and zero `{ ok: true }` results**. Random bytes must never produce a valid config (catches LZ + JSON + lenient-parse codec bugs).
- Size budget: `v2-typical.json` encodes under 2KB; assert in test.

---

## 6. Deterministic render parity

### 6.1 Why

The positioning promise is "editor and npm package produce pixel-identical output from the same `GradientConfig`." Test it on every PR.

### 6.2 Harness

```
packages/renderer-node/              # new package
  src/renderToFramebuffer.ts         # (config, { time, width, height }) → Uint8Array RGBA
  src/hash.ts                        # tolerance-bucketed SHA-256 (see §6.3)

packages/schema/src/parity.ts
  export function hashFramebuffer(pixels: Uint8Array, bucket = 2): string;
  export function compareHash(a: string, b: string): { equal: boolean };

packages/schema/test/parity.test.ts
  - load test/fixtures/parity/*.json
  - render via renderer-node at t ∈ {0, 0.5, 1.0}
  - compare to goldens at test/fixtures/parity/<name>.<t>.hash
```

Editor side (Playwright job):

- `apps/editor` in dev, load fixture via `#s=…`.
- Freeze rAF (`handle.setTime(t)`), read canvas pixels.
- Same `hashFramebuffer(pixels)`; compare to the same golden.

### 6.3 Tolerance-bucketed hash — replaces strict equality

Strict byte-equality breaks across GPUs (including software vs hardware swiftshader). We hash a **quantized** framebuffer instead:

```ts
// Round each channel to the nearest multiple of `bucket`.
// bucket=2 tolerates ±1 LSB per channel, which is the observed ULP band
// between software and hardware GL on identical shaders.
export function hashFramebuffer(pixels: Uint8Array, bucket = 2): string {
  const quantized = new Uint8Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    quantized[i] = Math.round(pixels[i] / bucket) * bucket;
  }
  return sha256(quantized);
}
```

The harness is still deterministic and commit-friendly; goldens survive a CI runner change. CI is the source of truth.

Tradeoff: any regression smaller than ±1 LSB/channel is invisible to parity. That's acceptable for a shader pipeline with an 8-bit output target. If we later need tighter bounds, revisit with 10-bit HDR and a smaller bucket.

### 6.4 Fixtures

Minimum set committed at spec approval time:

- `solid.json` — one linear layer, no effects. Smoke test.
- `mesh-3layer.json` — three mesh layers, mixed blend modes.
- `full-effects.json` — every effect group enabled at mid value.
- `animated-plasma.json` — plasma, speed=1. Tests time determinism at t=0.5 and t=1.0.
- `dither-bayer.json` — exercises the `dither` effect group (distinct from the Step 1 anti-banding pass).
- `voronoi-classic.json` — exercises the voronoi gradient type.
- `shape3d-sphere.json` — exercises Shape3D projection.

---

## 7. Agent contract (MCP surface)

The MCP server in Step 3 (`@wavr/mcp`) is a thin layer over the schema. Request/response types live here so both packages land compatible.

```ts
// packages/schema/src/agent.ts

export const ListPresetsRequest = z.object({}).strict();
export const ListPresetsResponse = z.object({
  presets: z.array(z.object({
    id: z.string(),
    name: z.string(),
    tags: z.array(z.string()),
    previewUrl: z.string().url(),
  })),
}).strict();

export const GetPresetRequest = z.object({ id: z.string() }).strict();
export const GetPresetResponse = z.object({ config: GradientConfig }).strict();

export const PreviewConfigRequest = z.object({
  config: GradientConfig,
  time: z.number().min(0).max(60).default(0),
  size: z.enum(["256", "512", "1024"]).default("512"),
}).strict();
export const PreviewConfigResponse = z.object({
  pngDataUrl: z.string().startsWith("data:image/png;base64,"),
}).strict();

// NOTE: validate_config accepts `unknown` so callers can pass anything.
// Validation runs `GradientConfig.safeParse(input)` internally — the root
// schema's .strict() still fires. Errors are flattened to a stable agent shape.
export const ValidateConfigRequest = z.object({ config: z.unknown() }).strict();
export const ValidateConfigResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), config: GradientConfig }),
  z.object({
    ok: z.literal(false),
    errors: z.array(z.object({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    })),
  }),
]);

export const ExportConfigRequest = z.object({
  config: GradientConfig,
  format: z.enum(["react", "vanilla", "css", "iframe", "tokens", "lottie", "webm"]),
}).strict();
export const ExportConfigResponse = z.object({
  format: z.enum(["react", "vanilla", "css", "iframe", "tokens", "lottie", "webm"]),
  output: z.string(),
  mimeType: z.string(),
}).strict();
```

**Error shape:** agent API flattens Zod errors to `{ path: (string|number)[], message: string }` per OQ3. In-editor validation still uses Zod-native `ZodError.issues`.

Tool descriptions (for LLM prompting) are generated by `zod-to-json-schema` over these schemas; `.describe()` strings become each field's `description` in the JSON Schema output.

---

## 8. Public API surface

§8 is the **final** surface shipped when Spec 0001 is fully landed. The skeleton PR (step 1–4 of §12) exports only what's implemented so far (`GradientConfig`, `LayerConfig`, primitives, effects, `DEFAULT_CONFIG`, `SCHEMA_VERSION`). Each subsequent step in §12 grows the surface: step 5 adds `encodeUrl/decodeUrl/tryDecodeUrl`, step 6 adds `migrate/detectVersion/detectShape`, step 7 adds `agent.*`, step 8 adds `hashFramebuffer/compareHash`. Reviewers: match exports against §12 progress, not against this final list.

```ts
// packages/schema/src/index.ts
export {
  GradientConfig, LayerConfig, RGBColor, GradientType, BlendMode,
  Shape3DKind, ColorSpace,
} from "./schema";
export * as effects from "./effects";
export { DEFAULT_CONFIG } from "./defaults";
export { SCHEMA_VERSION } from "./version";
export {
  migrate, detectVersion, detectShape,
  type SchemaVersion, type LegacyShape, type MigrateResult,
} from "./migrate";
export { encodeUrl, decodeUrl, tryDecodeUrl } from "./url";
export { hashFramebuffer, compareHash } from "./parity";
export * as agent from "./agent";
```

Consumers:

- `apps/editor` — imports `GradientConfig`, `DEFAULT_CONFIG`, `encodeUrl`, `decodeUrl`, `migrate`. Store holds `state.config: GradientConfig` + editor-only fields per §3.4.
- `packages/core` — imports `GradientConfig`, deletes its own `types.ts::GradientConfig` declaration. Internal `EngineState` stays local.
- `packages/react` (Step 2) — re-exports `GradientConfig` for DX.
- `packages/mcp` (Step 3) — imports `agent.*` + `GradientConfig`.
- `packages/renderer-node` (this spec) — imports `GradientConfig`, `hashFramebuffer`.

---

## 9. Acceptance criteria

Copy into the implementation PR description.

- [ ] `pnpm --filter @wavr/schema build` produces CJS, ESM, and `.d.ts`.
- [ ] `pnpm --filter @wavr/schema test` green. Coverage ≥ 95% on `schema.ts`, `migrate.ts`, `url.ts`.
- [ ] `GradientConfig` inferred from Zod. No hand-written parallel types in the repo.
- [ ] **`grep -rE "(interface|type)\s+GradientConfig" packages/ apps/`** returns exactly one hit — the Zod-inferred export in `@wavr/schema`. CI script, not a doc note.
- [ ] Every field has `.describe()` — test walks the schema and asserts each leaf has a non-empty description; build fails if `descriptions.md` is missing a key.
- [ ] Every numeric has `.min()` and `.max()` — schema-walker test asserts this.
- [ ] `.strict()` on every object — schema-walker test asserts this.
- [ ] `migrate()` produces a valid V2 config from every fixture in `test/fixtures/v1-*`. Idempotent on V2 input. `droppedKeys` non-empty for `project-state-v1` fixtures.
- [ ] `encodeUrl` + `decodeUrl` round-trip every parity fixture. `v2-typical.json` encodes under 2KB.
- [ ] Editor boots from a real production `#s=<v1-legacy-hash>` (sample captured from current deploy, committed as `v1-live-sample.txt`) and re-serializes to `s2.` format. Framebuffer hash matches the pre-migration editor's framebuffer hash at t=0 (via the parity harness) within the tolerance bucket.
- [ ] Parity harness passes on all fixtures in CI. Goldens committed. Editor-side Playwright parity job green.
- [ ] `CHANGELOG.md` entry under `@wavr/schema@2.0.0`.

---

## 10. Out of scope

- Timeline / keyframe schema (Step 6.8; goes in Spec 0003 `editor-state` or its own).
- Event-system schema (Step 6.6).
- LUT file format (Step 6.2).
- Layer-level extensions: visibility, image, masks, text-mask (Spec 0002 `layer-extensions`).
- Audio reactivity (PRD V2 §14.4, explicit non-goal).
- Custom GLSL contents (out-of-schema, lives on `EditorState`).

---

## 11. Resolved decisions

Review round 1 closed these. No blocking questions remain.

- **OQ1 (parity tolerance):** Tolerance-bucketed SHA-256 with `bucket = 2` (±1 LSB per channel). Hash is still deterministic and commit-friendly. See §6.3.
- **OQ2 (`.describe()` authoring):** Single `descriptions.md` compiled into `descriptions.gen.ts` at build. See §3.3.
- **OQ3 (error format):** Agent API flattens to `{ path: (string|number)[], message: string }`. In-editor validation keeps Zod-native `ZodError.issues`. See §7.
- **OQ4 (color space):** Optional root `colorSpace: "linear" | "oklab"`, default `"linear"`. V1 migrate sets `"linear"`. Any sRGB→linear conversion happens **before** schema parse, never inside. See §3.2.3, §4.3.
- **OQ-voronoi:** Voronoi ships. Also `image`. See §3.2.1 (10 gradient types).
- **OQ-L (layer extensions):** Image/mask/text-mask fields move to a parallel `LayerExtension` type in Spec 0002 `layer-extensions`. Not in V2 core schema. See §3.2.2.

---

## 12. Implementation order

1. `packages/schema` skeleton: `package.json`, tsconfig, tsup, empty `src/index.ts`.
2. `src/schema.ts` + `src/effects/*` (all 18 files) + primitives. Unit tests asserting walker invariants (`.describe`, `.min/.max`, `.strict`).
3. `src/descriptions.md` + build step → `descriptions.gen.ts`. Wire into schema.
4. `src/defaults.ts` — `DEFAULT_CONFIG`. Round-trip test `parse(DEFAULT_CONFIG)`.
5. `src/url.ts` + `tryDecodeUrl`. Tests: round-trip, size budget, fuzz.
6. `src/migrate.ts` — `types-v1` and `project-state-v1` paths. V1 fixtures captured from:
   - Current `apps/editor/lib/projects.ts::exportProjectStateForUrl(defaultState)` → `v1-minimal.json`.
   - Same, with every effect toggled on → `v1-full.json`.
   - `packages/core/src/types.ts::GradientConfig` instances from `presets/*` → `v1-types-full.json`.
7. `src/agent.ts` request/response schemas. Smoke test with `zod-to-json-schema`.
8. `packages/renderer-node` + parity harness. Goldens committed after first green run on CI swiftshader.
9. Wire `apps/editor/lib/store.ts` and `packages/core` to import `GradientConfig` from `@wavr/schema`. Delete duplicate types. Grep assertion in CI.
10. Swap `apps/editor/lib/url.ts` to call `@wavr/schema`. Live `v1-live-sample.txt` round-trip test.
11. CI gates: test, size-limit, parity harness, grep assertion.

Do not start Step 1 of HANDOFF until 1–11 are green.
