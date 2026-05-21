# Wavr Shader Factory Product/Technical Spec

Date: 2026-05-21  
Target path: `docs/shader-factory-spec.md`  
Repo: `litterthanlit/wavr`

## Assumptions and inspection limits

- This spec is based on public repository inspection through GitHub/web/API views. I could not run the app, tests, or bundle analysis in the sandbox because direct `git clone`/GitHub DNS resolution failed. Performance comments below are therefore code-risk findings, not measured benchmark results.
- Competitor notes are based on public Unicorn Studio and Basement Shader Lab pages/changelogs, not private product access.
- Proposed performance targets are product targets. They are not claims about the current repo.
- “Shader factory” is interpreted as a serious designer-facing shader creation, animation, export, and runtime platform, not just a gradient playground.

---

## 1. Executive Summary

### What the project is today

Wavr is a Next.js/Turbo monorepo with:

- `apps/editor`: a web editor with canvas preview, sidebar controls, timeline, layers, presets, projects modal, scene gallery, command palette, onboarding, export modal, and optional React Three Fiber scene overlay.
- `packages/core`: a WebGL2 gradient engine, monolithic fragment shader, layer model, config resolver, animation helper, and runtime creation API.
- `packages/schema`: a versioned Zod schema, URL codec, migration helpers, and parity hashing.
- `packages/react`: a React wrapper package around the core engine.
- `tests/parity`: a Playwright-based framebuffer parity harness.

This is not a toy. There is real rendering work here: 17 gradient types, layer compositing, masks, text masks, image textures, distortion maps, blend modes, Oklab blending, debanding, bloom paths, feedback, trails, audio reactivity, legacy shader 3D projection, mesh distortion, and a separate R3F overlay.

But the current product is still a prototype/editor, not a competitive shader factory. The implementation is broad but brittle. It has many features, but they are mostly hard-coded into one state object, one shader, one engine class, and a set of manual UI panels. That does not scale to a premium product.

### What it could become

Wavr could become a designer-first shader factory: a no-code/low-code system for creating premium WebGL/WebGPU backgrounds, animated shader scenes, interactive hero visuals, and exportable production embeds.

The strongest opportunity is not “another gradient generator.” The opportunity is:

- fast visual preset production,
- layer/effect composition,
- timeline and interaction authoring,
- shader/code escape hatches,
- production-grade runtime export,
- performance-aware publishing,
- smaller/faster embeds than heavier no-code competitors.

The repo already has enough rendering primitives to justify this direction. The missing piece is architecture and product discipline.

### Main blockers

1. **The shader pipeline is monolithic.** `packages/core/src/shaders/fragment.glsl` is a single giant shader containing almost every mode and effect. This kills extensibility, makes feature interactions hard to reason about, and prevents smart compile-time optimization.

2. **State is too flat and too duplicated.** The same conceptual properties are spread across Zustand state, `EngineState`, schema config, URL sync adapters, UI panels, export snippets, uniform setters, and GLSL uniforms. This creates drift.

3. **The current layer/effect model is not a factory.** Layers exist, but effects are mostly global toggles. There is no typed effect registry, no ordered per-layer stack, no plugin API, no graph, no reusable node model, and no pass compiler.

4. **Export is not honest enough.** Media export exists. Code export exists. Embed export exists. But exported React/Web Component snippets use simplified portable shader code and lose much of the editor’s actual scene/effect model. This is not competitive with serious production export.

5. **Performance is unmanaged.** There are adaptive caps and simple FPS degradation, but no GPU pass timings, memory budget, shader compile budget, bundle budget, or scene complexity advisor.

6. **Designer UX is not premium.** The editor is mostly a control sidebar. It needs direct manipulation, layer/effect hierarchy clarity, better timeline UX, preset workflows, live thumbnails, scene templates, and guided authoring.

7. **The public docs do not match the ambition.** The root `README.md` is still the default Next.js README. That is not acceptable for a product aiming at designers/developers.

---

## 2. Current Repo Assessment

### Architecture

Current structure:

```txt
apps/editor              Next.js editor app
packages/core            WebGL2 renderer, shader, config, animation
packages/react           React package wrapper
packages/schema          Zod schema, migration, URL codec, parity helpers
tests/parity             Playwright framebuffer hash tests
```

This is a good monorepo shape. The problem is internal coupling.

Current data path is roughly:

```txt
UI panel -> Zustand store -> Canvas.getFrameState() -> GradientEngine.render()
         -> hard-coded uniform setters -> monolithic fragment.glsl
```

For URL/share:

```txt
Zustand store -> url-sync storeToConfig() -> @wavr/schema -> compressed hash
```

For runtime:

```txt
React wrapper -> createGradient() -> resolveConfig() -> EngineState -> GradientEngine
```

For export:

```txt
Editor state -> export.ts -> simplified generated GLSL / CSS / snippets / iframe
```

The shape is logical, but it is not clean enough for a “factory.” There is no central canonical model. The store is the de facto source of truth for the editor, `@wavr/schema` is a partial source of truth for share URLs, and `packages/core/src/types.ts/config.ts` appear to be another source of truth for runtime. That split will become a maintenance tax immediately once more effects, plugins, or export targets are added.

### Rendering stack

Current stack:

- WebGL2 custom renderer in `packages/core/src/engine.ts`.
- GLSL shader sources loaded from `packages/core/src/shaders`.
- One main fragment shader assembled by string replacement to inject HSL and blend mode includes.
- FBO pipelines for compositing, feedback, trail, and bloom.
- React Three Fiber overlay for real 3D scene elements in `apps/editor/components/Scene3DCanvas.tsx`.

Strengths:

- WebGL2 is the right baseline for broad browser compatibility.
- The engine already supports multiple render targets/passes through manual FBOs.
- There is an actual React runtime wrapper in `packages/react`.
- There is a parity harness, which is rare and valuable.

Weaknesses:

- `GradientEngine` is doing too much: context creation, shader compile, pass management, FBO lifecycle, texture loading, text mask upload, custom GLSL compile, uniforms, render scheduling, mouse physics, feedback, bloom, trails, and cleanup.
- The render pipeline is implicit code, not data. There is no `RenderPlan` or pass graph.
- Pass compatibility is hard-coded. Example: real bloom is skipped when feedback is active. That may be pragmatic, but the product needs a visible compatibility system and a compiler that explains why combinations are disabled or degraded.
- `preserveDrawingBuffer: true` is set on the core WebGL context and the R3F overlay. That is useful for capture, but bad as a default because it can hurt performance and memory. It should be off during normal preview/runtime and enabled only in controlled export/capture paths.
- No FBO completeness checks are visible.
- GPU resources are not fully tracked as assets with budgets. Some resources are cleaned up, but VAOs/buffers/shaders are not consistently modeled as owned resources.

### Shader pipeline

Current shader facts:

- Main shader is `packages/core/src/shaders/fragment.glsl`.
- It contains uniforms for all current features.
- It includes 17 gradient modes:
  - `mesh`
  - `radial`
  - `linear`
  - `conic`
  - `plasma`
  - `dither`
  - `scanline`
  - `glitch`
  - `image`
  - `voronoi`
  - `silk`
  - `aurora`
  - `liquid`
  - `softCells`
  - `grainflow`
  - `prismGlass`
  - `neonTunnel`
- It also contains masks, Oklab conversion, 3D SDF raymarching, liquify, bloom approximation, glow, caustics, pixel sort, feedback, dither, ASCII, grain, debanding, and compositing logic.

This gives Wavr a wide visual palette, but it is also the biggest technical debt.

Problems:

- Every feature lives in the same shader. This increases compile cost and branch complexity.
- The shader always contains code for features that are disabled.
- There is no chunk registry or shader module system.
- There are no compile variants for common scenes.
- There is no formal uniform schema. Uniform names are manually cached in `engine.ts`.
- Adding one effect requires updates in many places: store state, UI panel, schema, config resolver, uniform cache, uniform setter, GLSL, export code, URL sync, presets, tests.
- Custom GLSL is injected by regex replacement into the monolithic fragment shader. That is fragile. It is useful as a hack, not as a product foundation.

Required direction:

- Split shader code into typed chunks.
- Define effect/layer plugins with GLSL chunks, uniforms, default values, UI schema, animation metadata, and cost metadata.
- Compile scene-specific shader variants or render passes from a `RenderPlan`.
- Keep a small fallback shader path for embeds and low-power devices.

### UI/UX

Current editor UI includes:

- top bar,
- main canvas,
- sidebar tabs: Gradient, Scene, Effects, Presets, Lab,
- always-visible layer panel,
- timeline strip,
- export modal,
- projects modal,
- scene gallery,
- command palette,
- onboarding,
- mobile drawer.

Strengths:

- The product shell is present.
- Keyboard shortcuts exist.
- Command palette exists.
- Mobile drawer exists.
- Timeline exists, even if limited.
- Export modal has a useful tab structure: Ship, Image/Video, Code, Embed.

Weaknesses:

- Most creative editing is through sliders and toggles. That is not enough for designer-grade shader authoring.
- There is no direct canvas manipulation for masks, text, image transforms, layer positions, or 3D objects.
- Property controls are hand-built and scattered across panels. The UI is not schema-driven.
- Effects are grouped in accordions, but they are not an actual editable/reorderable stack.
- The timeline is a thin strip, not a motion editor.
- There are no visible curve editors, easing controls per keyframe, property tracks, or auto-key UX comparable to serious motion tools.
- The layer panel always exists, but the model is capped at 4 layers and not advanced enough for composition-heavy workflows.
- Preset workflows are likely present, but the product needs preset metadata, categories, previews, favorites, search, quality scores, and export-readiness flags.

### State management

Current state is a large Zustand store in `apps/editor/lib/store.ts`.

Strengths:

- Simple mental model.
- Undo/redo exists.
- Continuous slider edits can be committed separately from discrete actions.
- URL sync is debounced and has migration awareness.
- Performance modes exist: `auto`, `quality`, `battery`.

Weaknesses:

- The store is too large and too flat.
- Top-level derived fields duplicate active layer fields (`gradientType`, `speed`, `complexity`, `scale`, `distortion`, `softness`, `colors`). This is backward-compatible but risky.
- Some update paths mutate full `layers` arrays through generic `set`, while others use `setLayerParam`. That makes derived-field sync fragile.
- Undo history is module-global, not part of store state. It works, but it is not robust enough for complex documents, collaboration, persistence, or multi-project editing.
- Timeline playback calls `setTimelinePosition` inside the render loop path. That means animation time can drive store writes. It should not. The renderer should sample time independently and only publish UI cursor updates at a throttled cadence.
- `customGLSL` is excluded from history. That is dangerous for a “Lab” feature.
- URL sync intentionally excludes many editor-only fields: timeline, audio, custom GLSL, images, masks, text, active layer. That is understandable for short URLs, but it means share links do not represent full scenes. A shader factory needs full scene persistence separate from short URL previews.

Required direction:

- Introduce a canonical `SceneDocument` schema.
- Treat Zustand as UI/runtime state, not the document model itself.
- Use property paths for all editable/animatable values.
- Make history document-operation based, not full snapshot based.
- Separate persisted scene, transient editor UI, runtime sampled state, and export profile.

### Asset/export flow

Current export features:

- PNG image export.
- WebM recording via `canvas.captureStream(30)` and `MediaRecorder`.
- GIF export through a custom in-browser encoder.
- CSS/Tailwind snippets.
- React component snippet.
- Web Component snippet.
- Standalone player snippet.
- iframe embed code using `/embed#<stateHash>`.
- Framer/Webflow snippets.
- Share remix link.

This is a strong start. It is also misleading in its current shape.

Problems:

- Code export uses a simplified portable shader generated in `apps/editor/lib/export.ts`. It does not preserve the full editor scene: layers, many effects, masks, images, text masks, 3D overlay, audio, timeline, custom GLSL, and complex pass behavior are not faithfully exported.
- The export modal warns that 3D scene is included in image/video exports, but code embeds are gradient-only. That gap is product-critical.
- Export state only includes a small subset of store state in many paths.
- Images are stored as data URLs in layer state. This is bad for memory, URL sync, persistence, and asset management.
- GIF encoder is custom and likely low quality. It may be acceptable as a fallback, not as a premium export path.
- No MP4 export path is visible. WebM is not enough for designers shipping social/video assets.
- No deterministic offline render/export worker is visible.
- No export validation step tells the user what will be lost.

Required direction:

- Separate “approximate CSS fallback,” “portable lightweight shader,” and “full-fidelity runtime export.” Do not imply they are equivalent.
- Export full scenes as JSON + runtime, with asset manifest.
- Add export compatibility reports.
- Add hosted embed publishing with versioned scene IDs.
- Add React/Web Component packages that run the same compiled render plan as the editor, not a reduced approximation.

### Extensibility

Current extensibility:

- New gradient types can be added manually.
- New effects can be added manually.
- Custom GLSL exists.
- React wrapper exists.
- Schema package exists.

Missing:

- Plugin registry.
- Effect definitions.
- Shader chunk system.
- Uniform/property schemas.
- Per-effect cost model.
- Compatibility flags.
- Preset schema with dependencies.
- Runtime plugin loading.
- Stable public SDK contract.
- Versioned scene format that includes assets, timelines, interactions, and export profiles.

Today, extensibility means editing core code in multiple places. A shader factory needs effects and layers to be data-driven.

### Testing

Current positives:

- There is a Playwright parity harness rendering fixture configs at fixed timesteps and comparing framebuffer hashes.
- `@wavr/schema` has parity helpers.
- Packages have TypeScript lint scripts.
- Editor has Vitest configured.

Current gaps:

- No visible performance benchmark suite.
- No shader compile matrix across all gradient/effect combinations.
- No FBO allocation/memory tests.
- No export fidelity tests.
- No browser matrix tests.
- No mobile tests.
- No accessibility tests for the editor.
- No Playwright UI workflow tests for key product flows.
- No bundle size budgets.
- No regression screenshots for UI/preset outputs beyond parity hashes.

Required direction:

- Keep parity tests, but expand them into a full quality gate.
- Add compile tests for shader variants.
- Add export tests that compare editor output vs runtime export output.
- Add performance smoke tests on representative scenes.
- Add CI budgets for bundle, first frame, shader compile time, and memory estimate.

### Build/deploy setup

Current setup:

- Root Turbo/pnpm monorepo.
- `apps/editor` is Next.js.
- `packages/react` builds with `tsup` to dist.
- `packages/schema` builds with `tsup`.
- `packages/core` currently points `main`/`types` to `src/index.ts` and only has `lint`; it is private.
- `vercel.json` exists.

Problems:

- `packages/core` is not packaged like a real runtime library.
- The public docs do not explain how to consume the runtime.
- The root `README.md` is not product documentation.
- Build scripts exist, but there is no visible release pipeline, SDK versioning policy, bundle analyzer, or deployment smoke test.

Required direction:

- Make runtime packages real build artifacts.
- Split editor-only dependencies from runtime dependencies.
- Add bundle budgets and export package tests.
- Add docs for runtime usage and export behavior.

### Code quality

Good:

- TypeScript is used broadly.
- The code is organized into app/core/schema/react packages.
- Some comments explain design intent.
- URL sync has thoughtful migration notes.
- The parity harness is deliberate.

Bad:

- The engine class is too large.
- The shader is too large.
- Feature flags are hard-coded across too many layers.
- Manual mappings are duplicated everywhere.
- Some exports are simplified copies of shader logic instead of using the runtime engine.
- Resource lifecycle is not rigorous enough.
- Documentation is not at product level.

### Missing primitives

To compete, Wavr needs these primitives:

- Scene document model.
- Asset model.
- Layer node model.
- Ordered effect stack.
- Pass graph / render plan.
- Shader chunk compiler.
- Uniform/property schema.
- Property path system.
- Timeline tracks and curves.
- Interaction drivers.
- Preset schema with thumbnails and compatibility.
- Runtime export compiler.
- Performance instrumentation.
- Quality/fallback profiles.
- Plugin API.

### Performance bottlenecks and risks

High-risk items:

- `preserveDrawingBuffer: true` as default in WebGL contexts.
- Monolithic shader with many dynamic branches.
- Heavy post effects that resample `computeGradient` many times: bloom, glow, radial blur, blur, chromatic aberration, pixel sort.
- Full-resolution FBO chains for compositing and feedback.
- Bloom path copies the default framebuffer into a scene FBO, then extracts and blurs.
- Layer compositing requires one pass per visible layer.
- Texture cache keys are full data URLs. This is memory-heavy and awkward.
- Text mask uses a single text mask texture updated from the active layer. Multi-layer text masks with different content will not scale correctly.
- Timeline writes state during playback.
- R3F overlay uses a separate canvas and separate render loop; composite export has to stitch canvases with 2D canvas.
- GIF export captures frames into memory before encoding.
- No GPU timer or memory estimate exists, so the editor cannot explain why a scene is slow.

### UX/product gaps

The biggest UX gap is not visual quality. It is workflow quality.

Wavr currently feels like “a lot of controls attached to a renderer.” A premium shader factory must feel like “a visual production tool.”

Missing product capabilities:

- Direct canvas handles.
- Real layer/effect stack.
- Per-layer effects.
- Multi-scene/infinite canvas/project organization.
- Real timeline tracks and auto-keying.
- Easing editor.
- Trigger/event authoring UI.
- Responsive/breakpoint authoring.
- Preset browser with previews, categories, search, remixing.
- Export readiness checks.
- Performance advisor.
- Hosted scene publishing/versioning.
- Team/library workflows if SaaS is the goal.
- Better tutorials/onboarding for non-technical designers.

---

## 3. Competitive Benchmark

### Benchmark summary

Unicorn Studio is ahead as a full no-code WebGL production platform: no-code authoring, embeddable motion assets, multi-scene projects, timeline workflows, SDK/runtime, shader editor improvements, multi-pass support, and a flatten compiler.

Basement Shader Lab is a tighter design reference for the editor surface itself. Its public page exposes a layered shader composition UI with timeline/auto-key behavior and a dense property panel around stacked effects like CRT, dithering, text, pattern, and gradient.

Wavr has impressive raw shader breadth, but competitors are ahead in productization, publishing, and workflow polish.

### Capability comparison

| Capability | Wavr today | Unicorn Studio reference | Basement Shader Lab reference | Required Wavr move |
|---|---|---|---|---|
| Layer-based shader composition | Has layers, blend modes, opacity, visibility, max 4 layers. Layers are shader-gradient layers, not a full object/effect composition graph. | Mature layer/object model, multi-scene projects, responsive layer visibility, flattening/optimization. | Public page shows layers such as CRT, Dithering, Text, Pattern, Gradient. | Move from “gradient layers” to a general layer/effect node stack with typed layer kinds. Raise or virtualize layer cap. |
| Live visual editing | Live canvas preview with sliders/toggles. Good base. | No-code live editor. | Live property panel style reference. | Add direct manipulation, live thumbnails, scrub handles, draggable masks/text/images/objects. |
| Timeline/keyframes | Minimal timeline. Keyframes only a small fixed numeric param set. No track editor. No per-keyframe easing. Store writes happen during playback. | Public changelog shows timeline/keyframe investment, multi-select, drag/resize events, position handles, copy/paste property workflows. | Public page shows Auto-Key, duration, playhead readout, keyframe prompt. | Build property-path timeline with auto-key, tracks, curves, easing, events, and non-store sampled playback. |
| Property panels | Hand-built panels. Many controls exist. | Mature no-code property panels. | Strong reference: specific effect panels with grouped parameters. | Generate panels from property schema. Add search, favorites, compact mode, numeric input, reset/default, animation dots. |
| Effects stack | Effects exist but are mostly global toggles. Some layer-specific image/mask controls. | Effects are productized and optimized through flattening/runtime workflows. | Layers/effects are visibly stack-like. | Make effects reorderable, per-layer, nestable where useful, and compiler-aware. |
| Presets | Preset panel and scene gallery exist. Unknown quality/depth from current inspection. | Templates/remix/publishing ecosystem. | Reference appears preset/demo-like. | Build curated preset system with thumbnails, tags, complexity score, export compatibility, and remix lineage. |
| Export/embed workflow | PNG/WebM/GIF, CSS/Tailwind, React/Web Component, standalone player, iframe snippets. But full-fidelity export is not solved. | Strong embed positioning across website builders and SDK/runtime path. | Public page is more editor/demo than publishing platform. | Export the same compiled scene model used by editor. Add hosted scenes, versioned embeds, React/Web Component packages, fallback assets. |
| Performance | Has FPS display, frame cap, performance modes, simple auto-degrade. No pass timings or budgets. | Public changelog mentions flatten compiler, layer merging, culling, shader editor with downsampling/frame cache. | Public UI suggests focused shader stack, not enough public data for performance claims. | Build pass compiler, flatten compatible layers, GPU timing, scene complexity score, and automatic fallback profiles. |
| Designer usability | Functional but slider-heavy. | Mature no-code positioning. | Strong visual property/layer/timeline reference. | Reduce technical sliders, add semantic controls, premium presets, direct manipulation, guided export. |
| Developer extensibility | React package and core API exist. Custom GLSL exists. No plugin API. | SDK exists. | Unknown public SDK posture. | Stable runtime SDK, plugin/effect API, typed scene schema, generated controls, shader chunk authoring. |

### Blunt position

Wavr can compete visually sooner than it can compete product-wise. The shader palette is broad, but a designer does not buy a palette; they buy workflow, confidence, speed, export reliability, and polish.

To compete with Unicorn Studio, Wavr needs publishing/runtime/export discipline. To compete with Shader Lab as an editing surface, Wavr needs layer/effect/timeline UX discipline.

---

## 4. Target Product Vision

### Definition

The shader factory is a browser-based tool for designing, animating, optimizing, and shipping premium shader visuals.

It should support both:

1. **No-code designers** who want polished WebGL visuals without writing shaders.
2. **Creative developers/design engineers** who want a fast visual workflow plus code-level escape hatches.

### Primary users

- Brand/web designers creating hero backgrounds and interactive visual systems.
- Design engineers shipping WebGL visuals inside React/Next/Webflow/Framer sites.
- Agencies producing campaign visuals quickly.
- Creative developers prototyping shaders and packaging them as reusable components.
- Product teams needing animated visual assets with safe fallbacks.

### Core workflows

#### Workflow 1: Preset to production visual

1. Pick a preset or scene template.
2. Adjust brand colors.
3. Tune motion and interaction.
4. Check performance score.
5. Export to Framer/Webflow/React/Web Component.
6. Save version and fallback PNG/WebM.

#### Workflow 2: Layer/effect composition

1. Add base gradient/noise/image/text layer.
2. Stack effects: blur, bloom, CRT, dither, mask, displacement, feedback.
3. Reorder effects and preview cost.
4. Animate effect properties.
5. Flatten/compile for runtime.

#### Workflow 3: Motion authoring

1. Enable timeline.
2. Auto-key properties.
3. Edit tracks/curves.
4. Add scroll/hover/click/audio drivers.
5. Preview loop and responsive behavior.
6. Export interactive runtime.

#### Workflow 4: Developer shader lab

1. Start from visual stack or custom GLSL.
2. Define uniforms with schema metadata.
3. Preview with controls auto-generated.
4. Save as plugin/preset.
5. Export as runtime-compatible effect.

### What makes it premium

- Curated visual defaults, not random sliders.
- Smooth gradients with Oklab/debanding/tone mapping enabled correctly.
- High-quality presets with thumbnails and named intent.
- Direct manipulation instead of only sidebar controls.
- Real timeline with auto-key and easing.
- Export confidence: “this scene will look the same in production.”
- Runtime performance advisor.
- Designer language: “soft glass,” “CRT glow,” “silk flow,” “liquid displacement,” not only raw shader terms.
- Developer bridge: every visual can become code without losing fidelity.

### What makes it faster/better than competitors

Wavr should not try to beat Unicorn by cloning every no-code website-builder feature first. It should win on shader specialization:

- Smaller runtime embeds.
- Faster first frame.
- Better visual fidelity per byte.
- Shader-specific layer/effect compiler.
- Live scene complexity score.
- Full-fidelity React/Web Component export.
- Code/custom GLSL workflow that still generates designer controls.
- Preset-to-export workflow optimized for hero visuals and brand systems.

---

## 5. Ideal Architecture

### Architecture goals

- Make the scene document canonical.
- Make effects/layers data-driven.
- Compile a scene into a render plan.
- Separate editor UI from runtime engine.
- Export the same render plan used by preview.
- Track performance and compatibility as first-class data.

### Proposed package structure

```txt
apps/editor
  app/
  components/
  features/
    canvas/
    inspector/
    timeline/
    assets/
    export/
    presets/
  state/
  styles/

packages/schema
  scene-document.ts
  property-schema.ts
  timeline-schema.ts
  asset-schema.ts
  migrations/

packages/runtime
  renderer/
  compiler/
  effects/
  assets/
  instrumentation/
  exports/

packages/react
  WavrScene.tsx
  hooks/

packages/presets
  scenes/
  effects/
  thumbnails/

tests
  parity/
  export/
  performance/
  ui/
```

`packages/core` can either become `packages/runtime` or remain as the low-level rendering package. The important change is conceptual: runtime and editor must be separate.

### Canonical scene document

Current `GradientConfig` is useful but too narrow. It excludes many editor-only fields and does not represent full production scenes.

Proposed document:

```ts
type WavrSceneDocument = {
  version: "wavr.scene.v1";
  meta: {
    id?: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
  };
  canvas: {
    width: number;
    height: number;
    colorSpace: "srgb" | "linear" | "display-p3";
    background: "transparent" | string;
  };
  assets: Record<string, WavrAsset>;
  layers: WavrLayerNode[];
  timeline: WavrTimeline;
  interactions: WavrInteractionDriver[];
  exportProfiles: WavrExportProfile[];
  performanceProfile: "auto" | "quality" | "battery" | "custom";
};
```

Layer node:

```ts
type WavrLayerNode = {
  id: string;
  name: string;
  kind: "shader" | "image" | "text" | "shape" | "scene3d" | "group";
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: Transform2D | Transform3D;
  mask?: MaskStack;
  source: LayerSource;
  effects: WavrEffectNode[];
};
```

Effect node:

```ts
type WavrEffectNode = {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, unknown>;
};
```

This gives the editor and runtime one shared truth.

### Renderer abstraction

Define a renderer interface:

```ts
interface WavrRenderer {
  capabilities: RendererCapabilities;
  initialize(canvas: HTMLCanvasElement, options: RendererOptions): Promise<void>;
  compile(document: WavrSceneDocument): Promise<CompiledScene>;
  render(frame: FrameContext): void;
  resize(width: number, height: number, dpr: number): void;
  readback?(target: ExportTarget): Promise<ImageBitmap | Blob>;
  destroy(): void;
}
```

Implementations:

- `WebGL2Renderer`: production baseline.
- `WebGPURenderer`: future premium path.
- `StaticFallbackRenderer`: CSS/PNG fallback.
- `ExportRenderer`: deterministic capture path, can enable `preserveDrawingBuffer` or offscreen readback only when needed.

Do not bind editor behavior directly to `GradientEngine`. The editor should talk to a preview controller that owns a renderer.

### Shader graph or layer pipeline

Use a hybrid model:

- Designer-facing UI uses layers and effect stacks.
- Runtime compiler converts layers/effects into a pass graph.
- Advanced users can inspect/use node graph later, but the first product should not expose a complex node editor by default.

Render graph model:

```ts
type RenderPlan = {
  passes: RenderPass[];
  resources: RenderResource[];
  uniforms: UniformBinding[];
  estimatedCost: SceneCost;
  compatibilityWarnings: CompatibilityWarning[];
};
```

Render pass:

```ts
type RenderPass = {
  id: string;
  kind: "draw" | "post" | "feedback" | "composite" | "copy" | "downsample" | "upsample";
  shader: CompiledShader;
  inputTextures: string[];
  outputTarget: string;
  resolutionScale: number;
  clear: boolean;
};
```

Compiler decisions:

- Inline cheap effects into layer shader.
- Split expensive effects into downsampled passes.
- Flatten compatible layers when possible.
- Keep feedback/ping-pong effects isolated.
- Disable or degrade effects based on target profile.
- Generate a compatibility report before export.

### Effect/plugin system

Every effect should be declared once.

```ts
interface EffectDefinition<TParams> {
  id: string;
  label: string;
  category: "color" | "blur" | "distort" | "stylize" | "light" | "interaction" | "utility";
  defaultParams: TParams;
  propertySchema: PropertySchema<TParams>;
  animatable: PropertyPath[];
  passType: "inline" | "single-pass" | "multi-pass" | "feedback";
  glsl?: ShaderChunkDefinition;
  compile: EffectCompileFn<TParams>;
  estimateCost: CostEstimateFn<TParams>;
  compatibility: CompatibilityRule[];
}
```

This unlocks:

- generated property panels,
- timeline animation dots,
- presets,
- export validation,
- shader compilation,
- plugin authoring,
- performance scoring.

### Uniform/property schema

Each property needs metadata:

```ts
type PropertySchema = {
  path: string;
  label: string;
  type: "number" | "boolean" | "color" | "select" | "vec2" | "asset" | "text";
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  animatable: boolean;
  exposedInExport: boolean;
  affectsCompile: boolean;
  affectsLayout: boolean;
  costHint?: "low" | "medium" | "high";
};
```

This replaces duplicated UI/store/shader/export definitions.

### Timeline animation model

Current timeline is too limited. Replace it with property tracks.

```ts
type WavrTimeline = {
  duration: number;
  playback: "loop" | "once" | "bounce";
  tracks: TimelineTrack[];
};

type TimelineTrack = {
  id: string;
  targetPath: string; // e.g. layers.hero.effects.bloom.intensity
  valueType: "number" | "color" | "vec2" | "boolean" | "select";
  keyframes: TimelineKeyframe[];
};

type TimelineKeyframe = {
  time: number;
  value: unknown;
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "spring" | CubicBezier;
};
```

Rules:

- Playback sampling must not write to Zustand every frame.
- Timeline cursor UI can update at 15-30 Hz.
- The renderer receives sampled frame state.
- Auto-key should create/update a keyframe whenever an animatable property changes while auto-key is enabled.

### Preview/render loop

Current render loop lives inside `GradientEngine.startLoop`. It should be split.

Proposed:

```txt
Editor state/document -> PreviewController -> RuntimeSampler -> RenderPlan -> Renderer
```

Preview controller responsibilities:

- Track dirty document changes.
- Compile render plan only when structure changes.
- Update uniforms when property values change.
- Sample timeline/interactions/audio without mutating document state.
- Throttle UI telemetry updates.
- Switch performance profiles.
- Handle context loss and recovery.

### Asset pipeline

Current data URLs must be replaced.

Asset model:

```ts
type WavrAsset = {
  id: string;
  kind: "image" | "video" | "audio" | "font" | "lut" | "texture";
  name: string;
  mimeType: string;
  source: "local" | "remote" | "uploaded" | "generated";
  url?: string;
  blobRef?: string;
  width?: number;
  height?: number;
  colorSpace?: string;
  maxTextureSize?: number;
};
```

Pipeline requirements:

- Store assets by ID, not base64 strings in layer state.
- Use `Blob`/Object URLs locally.
- Generate thumbnails.
- Downsample according to target profile.
- Track texture memory estimate.
- Support font loading for text masks/text layers.
- Include asset manifest in full-fidelity export.

### Export targets

Required export tiers:

1. **Static fallback**
   - PNG, WebP, poster frame.
   - CSS fallback only when scene is simple enough.

2. **Video export**
   - WebM.
   - MP4 if browser/server path supports it.
   - GIF as low-quality fallback only.

3. **Interactive runtime**
   - React component.
   - Web Component.
   - Vanilla JS embed.
   - iframe hosted embed.
   - Framer/Webflow snippets.

4. **Developer package**
   - Scene JSON.
   - Asset manifest.
   - Runtime package version.
   - TypeScript types.

5. **Hosted publishing**
   - Scene ID.
   - Versioned embed URL.
   - Fallback asset URL.
   - Rollback/version history.

Export must show fidelity levels:

```txt
Full fidelity: yes/no
Interactive: yes/no
Assets included: yes/no
3D included: yes/no
Timeline included: yes/no
Fallback generated: yes/no
Performance profile: quality/auto/battery
```

### Persistence format

The current URL hash config should become a lightweight share shortcut, not the full persistence model.

Persistence layers:

- `wavr.scene.v1`: full document.
- `wavr.preset.v1`: reusable layer/effect/palette preset.
- `wavr.export.v1`: export profile.
- `wavr.url.v2`: compressed short config for lightweight previews.

Migration rules:

- Every persisted document has a version.
- Migration is pure and tested.
- Unknown future fields are either preserved in an `extensions` bucket or rejected with a clear warning.
- URL hash never silently pretends to preserve assets/timeline/custom GLSL if it does not.

### Performance instrumentation

Add `PerformanceHUD` in editor:

- CPU frame time.
- GPU frame time using `EXT_disjoint_timer_query_webgl2` where available.
- FPS current/average/1% low.
- Shader compile time.
- Render pass timings.
- FBO count and estimated memory.
- Texture count and estimated memory.
- Scene complexity score.
- Active fallback/degradation state.
- Bundle/runtime size for export profile.

Add scene advisor:

```txt
This scene is heavy because:
- 4 full-resolution layer passes
- bloom + feedback cannot be flattened
- glow samples 16 times per pixel
- 2048px texture consumes ~16 MB
Suggested fixes:
- Downsample bloom to 0.25x
- Bake layer 2 into layer 1
- Disable feedback on mobile
```

---

## 6. Feature Roadmap

### Phase 1 — MVP hardening

Goal: make the current product honest, stable, measurable, and exportable enough to trust.

Engineering tasks:

- Replace root template README with real project documentation.
- Document current architecture and supported feature matrix.
- Add a `docs/known-limitations.md` page.
- Stop using `preserveDrawingBuffer: true` by default. Enable only during explicit capture/export.
- Add FBO completeness checks and render resource logging.
- Add basic `PerformanceHUD` with FPS, CPU frame time, DPR, render resolution, active profile, FBO count, texture count.
- Add shader compile timing around all shader/program creation.
- Add memory estimates for render targets and textures.
- Fix timeline playback so it does not write to Zustand every frame.
- Replace window resize debounce with `ResizeObserver` for the main canvas.
- Add texture asset IDs for image uploads, even before full asset manager exists.
- Make export modal explicitly label simplified exports vs full-fidelity exports.
- Add export tests for PNG/WebM/code snippets.
- Add shader compile tests for all gradient types and major effect combinations.
- Expand parity fixtures to cover premium shaders, layers, masks, bloom, feedback, and export states.
- Build `packages/core` as a real package or rename/split runtime intentionally.
- Add bundle analyzer and size budgets.

Files likely involved:

- `packages/core/src/engine.ts`
- `packages/core/src/shaders/fragment.glsl`
- `apps/editor/components/Canvas.tsx`
- `apps/editor/components/Scene3DCanvas.tsx`
- `apps/editor/lib/store.ts`
- `apps/editor/lib/export.ts`
- `apps/editor/components/ExportModal.tsx`
- `apps/editor/lib/timeline.ts`
- `apps/editor/components/Timeline.tsx`
- `packages/schema/src/*`
- `tests/parity/*`

Exit criteria:

- Current editor is stable under common scenes.
- Export behavior is honest.
- Performance is visible.
- Tests catch shader and export regressions.
- Docs explain how to run and ship the project.

### Phase 2 — Competitive parity

Goal: match the baseline workflows users expect from Unicorn Studio/Shader Lab-style tools.

Engineering tasks:

- Introduce full `SceneDocument` schema.
- Add asset manager with image/audio/font assets by ID.
- Replace flat global effects with layer-level ordered effects.
- Keep a global post-processing stack, but make it explicit and reorderable.
- Create an effect registry with property schemas.
- Generate inspector controls from property schemas.
- Add animation indicators next to animatable properties.
- Rebuild timeline as property tracks with auto-key.
- Add easing per keyframe.
- Add draggable/resizeable keyframes.
- Add timeline zoom and snapping.
- Add direct canvas handles for masks, image transforms, text transforms, and selected layer bounds.
- Add layer thumbnails.
- Add layer groups.
- Add preset browser with thumbnails, tags, categories, favorites, search, and remix/open actions.
- Add responsive/breakpoint visibility and performance profile controls.
- Add hosted/iframe embed flow if SaaS is intended.
- Make `packages/react` render the same scene model as the editor.
- Add Web Component runtime using the same compiled render plan.

Exit criteria:

- A designer can create a layered scene, animate it, preview it, and ship it without writing code.
- Runtime output matches editor output for supported features.
- Timeline is not a toy.
- Effects are stack-based and schema-driven.

### Phase 3 — Premium differentiators

Goal: make Wavr better specifically for shader-heavy production.

Engineering tasks:

- Build render plan compiler.
- Split monolithic shader into chunks.
- Compile shader variants based on active layers/effects.
- Add flatten compiler for compatible layers/effects.
- Add automatic pass downsampling for blur/bloom/glow.
- Add scene complexity score and optimization suggestions.
- Add export compatibility report.
- Add motion recipes: scroll shimmer, cursor liquid, hover bloom, audio pulse, loading loop.
- Add brand kit ingestion: colors, type, logo masks, common layout ratios.
- Add preset quality tags: “safe mobile,” “heavy,” “hero,” “background,” “text-safe,” “dark-mode.”
- Add visual diffing between editor preview and runtime export.
- Add custom GLSL module format with declared uniforms and generated controls.
- Add shader linting and friendly compile errors.
- Add sandboxed custom shader previews.

Exit criteria:

- Wavr can create high-quality visuals faster than competitors for shader-specific web hero work.
- Export is smaller and more predictable than generic no-code embeds.
- Advanced users can create reusable shader effects without forking core code.

### Phase 4 — State-of-the-art capabilities

Goal: push beyond parity.

Engineering tasks:

- Add optional WebGPU renderer.
- Add compute/ping-pong simulation nodes.
- Add multipass graph editor for advanced users.
- Add real 3D scene/layer integration instead of a separate overlay canvas.
- Add SDF/text/path layers with GPU masks.
- Add collaborative scene editing if product direction supports SaaS.
- Add versioned cloud scene publishing.
- Add AI-assisted preset generation only after the schema/effect system is mature.
- Add marketplace/library for effects and presets.
- Add automated device-lab performance certification for presets.

Exit criteria:

- Wavr is not just comparable. It has a clear technical moat: a shader compiler, runtime optimizer, and designer-friendly motion system.

---

## 7. Performance Spec

### Preview FPS targets

| Target | Requirement |
|---|---|
| Desktop default scene | 60 FPS at 1440×900 on modern integrated GPUs. |
| Desktop heavy scene | Minimum 45 FPS in auto mode after adaptive quality. |
| Mobile default scene | 30 FPS at DPR 1.0-1.25. |
| Battery mode | Fixed 30 FPS cap, DPR 1.0, expensive passes disabled/downsampled. |
| Editor UI while rendering | UI interactions should respond within 50 ms. Slider drag should feel immediate. |

### Runtime/embed targets

| Target | Requirement |
|---|---|
| First frame | Under 500 ms after runtime script loaded for default scene. |
| Runtime JS bundle, basic | Under 120 KB gzip excluding assets. |
| Runtime JS bundle, full WebGL2 | Under 250 KB gzip excluding assets. |
| Editor initial JS | Under 800 KB gzip initial route target, with code editor/3D/export lazy-loaded. |
| Scene JSON | Under 25 KB for typical no-asset scene. |
| Hosted embed | Should lazy load below fold and pause when offscreen. |

### Load time targets

| Target | Requirement |
|---|---|
| Editor first interactive | Under 2.5 s on fast broadband for initial editor shell. |
| Preset thumbnail grid | First visible thumbnails under 1 s, lazy load rest. |
| Runtime shader compile | Default scene under 80 ms desktop, under 200 ms mobile. |
| Custom shader compile feedback | Error/success result under 300 ms for typical shader snippets. |

### Memory targets

| Target | Requirement |
|---|---|
| Default 1080p scene | Under 64 MB estimated GPU memory. |
| 4 layers + bloom/trail | Under 128-160 MB at 1080p. |
| Mobile profile | Under 96 MB estimated GPU memory. |
| 4K export profile | Under 256 MB estimated GPU memory unless user explicitly chooses high quality. |
| Texture uploads | Downsample above target max size; use mipmaps only when needed. |

### Shader compile targets

- No property slider movement should trigger shader recompilation unless the property changes shader structure.
- Compile only on structural changes: layer kind, effect add/remove/reorder, shader code edits, major feature variant toggles.
- Compile variants should be cached by shader key.
- Failed custom shader compilation should not destroy the current working scene.

### Mobile behavior

Mobile profile should:

- cap DPR to 1.0 or 1.25,
- cap FPS to 30,
- downsample bloom/glow/blur,
- limit feedback/trail resolution,
- disable real bloom if memory pressure is high,
- pause offscreen scenes,
- respect reduced motion,
- offer static fallback.

### Fallback modes

Required fallback modes:

1. **Static PNG/WebP fallback** when WebGL2 is unavailable.
2. **CSS gradient fallback** for simple gradient-only scenes.
3. **Reduced-motion fallback**: freeze at deterministic poster frame or use slow non-reactive animation.
4. **Low-power runtime fallback**: lower DPR, lower FPS, disable expensive effects.
5. **Export fallback**: if MP4/GIF/WebM fails, produce image sequence or PNG poster.

### Profiling tools

Add:

- `PerformanceHUD` in editor.
- GPU timer queries where available.
- CPU frame timing.
- Shader compile timing.
- Render pass table.
- Resource memory estimator.
- Bundle analyzer in CI.
- Spector.js-friendly debug mode.
- Chrome trace export for render loop profiling.
- Scene complexity score visible before export.

---

## 8. Quality Bar

### Visual fidelity

High quality means:

- no obvious gradient banding in default output,
- Oklab/linear color behavior where appropriate,
- stable tone mapping,
- no unintended clipping or muddy color shifts,
- smooth animation loops,
- no black frames during shader compile/recompile,
- no visible seams from FBO resize/reallocation,
- consistent output between editor and runtime export,
- good-looking presets at first load, not only after tuning.

### Interaction polish

High quality means:

- slider drag is responsive,
- canvas direct manipulation exists for visual properties,
- undo/redo is reliable across sliders, layers, timeline, assets, and shader code,
- keyboard shortcuts are discoverable and stable,
- command palette can find actions and presets,
- timeline scrubbing feels immediate,
- export modal clearly states what will be exported,
- no hidden destructive actions.

### Shader correctness

High quality means:

- every shader variant compiles on supported browsers,
- FBO completeness is checked,
- texture unit usage is bounded and validated,
- shader compile failures are recoverable,
- custom GLSL cannot corrupt the current working scene,
- no NaN/Inf propagation in common effect combinations,
- parity tests cover core visual outputs.

### Responsive UI

High quality means:

- editor works at laptop sizes without clipped controls,
- mobile drawer is usable for quick edits,
- canvas resize is exact and stable,
- DPR changes are handled,
- timeline remains usable at smaller widths,
- property panels are searchable/collapsible and do not become endless scroll dumps.

### Stability

High quality means:

- context loss recovery works,
- resources are cleaned up on scene changes/unmount,
- export cannot permanently stall the preview,
- large assets are handled gracefully,
- bad URL hashes fail safely,
- project loads validate and migrate,
- autosave/version restore exists for serious use.

### Browser/device support

Minimum support:

- Chrome/Edge latest.
- Firefox latest.
- Safari latest desktop.
- iOS Safari with reduced profile.
- WebGL2 required for full runtime.
- Static/CSS fallback when WebGL2 is unavailable.

Do not pretend all effects are equal on mobile Safari. Make quality profiles explicit.

---

## 9. Implementation Plan

### Step 1 — Make the current system measurable

Highest-impact first step: add instrumentation before large refactors.

Tasks:

- Add a performance module under `packages/core/src/instrumentation`.
- Measure CPU frame time in `GradientEngine.startLoop`.
- Measure shader compile/link time in `initProgram`, `initBloomPrograms`, `initTrailProgram`, and `setCustomShader`.
- Add resource accounting for FBO textures, composite textures, trail textures, feedback textures, bloom textures, image textures, and text mask texture.
- Show metrics in `apps/editor/components/Canvas.tsx` as an expanded debug HUD.

Likely files:

- `packages/core/src/engine.ts`
- `apps/editor/components/Canvas.tsx`
- `apps/editor/components/Scene3DCanvas.tsx`

Risks:

- Timer queries are not universally available.
- Instrumentation can itself add overhead.

Validation:

- Add tests around memory estimate functions.
- Manually validate metrics against known FBO sizes.

### Step 2 — Fix obvious performance mistakes

Tasks:

- Set `preserveDrawingBuffer: false` for normal preview/runtime.
- Add explicit export/capture path that enables readback safely.
- Replace main canvas window resize debounce with `ResizeObserver`.
- Add FBO completeness assertions in development.
- Delete shaders after program link where safe.
- Track/delete VAOs and buffers consistently.
- Avoid timeline store writes on every animation frame.
- Add texture upload error handling and max-size policy.

Likely files:

- `packages/core/src/engine.ts`
- `apps/editor/components/Canvas.tsx`
- `apps/editor/components/Scene3DCanvas.tsx`
- `apps/editor/lib/timeline.ts`
- `apps/editor/lib/store.ts`

Risks:

- Export PNG may rely on current preserved buffer behavior.
- Some browsers behave differently on default framebuffer readback.

Validation:

- PNG/WebM export tests.
- Before/after FPS comparison.
- Context loss smoke test.

### Step 3 — Make export honest and split fidelity tiers

Tasks:

- Update `ExportModal` to label simplified exports clearly.
- Add “Full-fidelity scene JSON” export.
- Add “Runtime embed fidelity report.”
- Add unsupported-feature warnings for simplified CSS/portable shader export.
- Stop generating fake-complete Next.js starter code that omits the actual config.
- Make React/Web Component exports accept serialized config/document.

Likely files:

- `apps/editor/components/ExportModal.tsx`
- `apps/editor/lib/export.ts`
- `packages/react/src/WavrGradient.tsx`
- `packages/core/src/create.ts`
- `packages/schema/src/*`

Risks:

- Product will feel less magical when export limitations are explicit. That is better than lying.

Validation:

- Export fixture scenes and verify editor/runtime visual parity.

### Step 4 — Introduce the canonical scene document

Tasks:

- Add `WavrSceneDocument` to `packages/schema`.
- Add migration from current `GradientConfig` to scene document.
- Split document state from editor UI state.
- Keep current Zustand store temporarily as a compatibility adapter.
- Add property path helpers.
- Move active layer/selection/timeline UI state into editor state, not scene document.

Likely files:

- `packages/schema/src/schema.ts`
- `packages/schema/src/layer.ts`
- `packages/schema/src/effects/*`
- `apps/editor/lib/store.ts`
- `apps/editor/lib/url-sync.ts`
- `packages/core/src/config.ts`

Risks:

- This touches everything.
- Migration can break existing presets/share links.

Validation:

- Round-trip tests.
- Migration tests.
- Parity tests before/after document migration.

### Step 5 — Create effect registry and property schemas

Tasks:

- Define `EffectDefinition` type.
- Move existing global effects into definitions.
- Generate UI controls from property schemas.
- Generate timeline animatable paths from property schemas.
- Generate default state from definitions.
- Replace manual effect control duplication gradually.

Likely files:

- `packages/runtime/effects/*` or `packages/core/src/effects/*`
- `packages/schema/src/effects/*`
- `apps/editor/components/EffectsPanel.tsx`
- `apps/editor/components/GradientPanel.tsx`

Risks:

- Partial migration can create temporary duplication.

Validation:

- Snapshot tests for generated control schemas.
- Compile tests for each effect definition.

### Step 6 — Build render plan compiler

Tasks:

- Define `RenderPlan`, `RenderPass`, and `RenderResource`.
- Convert current direct render logic into a pass list.
- Start with current behavior: single-layer, multi-layer composite, feedback, trail, bloom.
- Add pass-level cost estimates.
- Add compatibility warnings.
- Add pass-level debug view.

Likely files:

- `packages/core/src/engine.ts`
- new `packages/core/src/compiler/*`
- new `packages/core/src/render-plan/*`

Risks:

- Large refactor can regress visuals.

Validation:

- Existing parity tests must pass.
- Add render-plan snapshots for fixture scenes.

### Step 7 — Split shader into chunks

Tasks:

- Extract common GLSL utilities: noise, color, masks, blend modes, tone mapping.
- Extract gradient generators.
- Extract effects.
- Build shader preprocessor/compiler that assembles only needed chunks.
- Cache compiled programs by shader key.
- Keep monolithic shader as fallback during transition.

Likely files:

- `packages/core/src/shaders/fragment.glsl`
- `packages/core/src/shaders/*.glsl`
- `packages/core/src/engine.ts`
- `packages/core/src/compiler/*`

Risks:

- GLSL include ordering bugs.
- Shader compile regressions.

Validation:

- Compile matrix.
- Parity tests.
- Runtime export parity.

### Step 8 — Rebuild timeline

Tasks:

- Replace fixed `KEYFRAMEABLE_PARAMS` with property schema-derived animatable paths.
- Add track list UI.
- Add auto-key.
- Add easing.
- Add draggable keyframes.
- Add copy/paste keyframes.
- Add playback sampling independent from store mutation.

Likely files:

- `apps/editor/lib/timeline.ts`
- `apps/editor/components/Timeline.tsx`
- `apps/editor/lib/store.ts`
- property schema modules

Risks:

- Timeline can become overbuilt. Start with property tracks and auto-key only.

Validation:

- Timeline interpolation tests.
- UI workflow tests.
- Exported timeline parity.

### Step 9 — Upgrade designer UX

Tasks:

- Add canvas selection overlay.
- Add handles for masks, text, image transforms.
- Add layer thumbnails.
- Add effect stack UI.
- Add inspector search.
- Add preset browser quality.
- Add command palette actions for presets, effects, export, performance profile.

Likely files:

- `apps/editor/components/Canvas.tsx`
- `apps/editor/components/LayerPanel.tsx`
- `apps/editor/components/GradientPanel.tsx`
- `apps/editor/components/EffectsPanel.tsx`
- `apps/editor/components/PresetsPanel.tsx`
- `apps/editor/components/CommandPalette.tsx`

Risks:

- UI complexity can grow fast. Keep the mental model: canvas, layer stack, inspector, timeline.

Validation:

- Designer workflow tests.
- Usability sessions.
- Time-to-export benchmark.

### Step 10 — Build real export/runtime parity

Tasks:

- Make runtime consume `WavrSceneDocument`.
- Make React/Web Component render the same compiled render plan.
- Add full-fidelity hosted/iframe embed.
- Add fallback generation.
- Add export validation report.
- Add visual diff tests between editor and exported runtime.

Likely files:

- `packages/react/src/WavrGradient.tsx`
- `packages/core/src/create.ts`
- `apps/editor/lib/export.ts`
- `apps/editor/components/ExportModal.tsx`
- new runtime compiler modules

Risks:

- Full-fidelity export is the real product hard part.
- 3D overlay currently uses separate R3F canvas, which complicates unified runtime export.

Validation:

- For every fixture scene, compare editor frame vs exported runtime frame at multiple timesteps.

---

## 10. Open Questions

1. Is Wavr primarily a hosted SaaS editor, an open-source SDK, or both?
2. Which user wins first: no-code designer, design engineer, or shader developer?
3. Which export target matters most for v1: Framer, Webflow, React/Next, Web Component, iframe, or video?
4. Should full-fidelity export include the R3F 3D overlay, or should 3D be rebuilt as part of the shader/runtime layer system?
5. Is WebGPU a near-term differentiator or a later premium backend?
6. What are the target devices for performance certification?
7. Should custom GLSL be a casual code panel or a real plugin authoring system?
8. Should presets be local/static, cloud-synced, or marketplace-ready?
9. Should projects support versions/backups/remix lineage?
10. Should scene assets be stored locally, uploaded to a backend, or embedded only for exports?
11. How much visual compatibility must CSS fallback preserve?
12. Should the product optimize for background hero visuals only, or broader shader art/composition?
13. What is the acceptable max runtime embed size?
14. Are mobile exports required, or only mobile playback?
15. What browser support is non-negotiable for paying users?
16. Should audio-reactive scenes be exportable, and if so, how should permissions and audio sources work in embeds?
17. Are team/collaboration workflows in scope?
18. What licensing model is intended for generated shader/runtime exports?

---

## Bottom line

Wavr has enough visual code to be interesting. It does not yet have the architecture or product workflow to be competitive with mature shader/no-code tools.

The shortest path to a serious shader factory is:

1. Measure performance.
2. Fix obvious rendering/export debt.
3. Introduce a canonical scene document.
4. Turn effects into schema-driven plugins.
5. Compile scenes into render plans.
6. Rebuild timeline and layer/effect UX around property paths.
7. Make exports full-fidelity and honest.

Do not add more random shader modes until the factory architecture exists. More modes will make the current debt worse.
