# Phase 2 Architecture Handoff

Date: 2026-05-21

## Summary

Implemented the first Phase 2 architecture slice from `docs/shader-factory-spec.md`.

This does not replace the renderer yet. It adds the canonical scene/effect/render-plan foundation that future editor, runtime, export, and timeline work can build on.

## What Changed

- Added `WavrSceneDocument` schema in `packages/schema`.
- Added adapters:
  - `sceneDocumentFromGradientConfig()`
  - `gradientConfigFromSceneDocument()`
- Added typed scene primitives for assets, layers, transforms, effect nodes, timeline tracks, interactions, export profiles, globals, and performance profile.
- Added effect registry and property metadata for current global effects.
- Added helpers for effect defaults and animatable effect paths.
- Added a first render-plan compiler that converts scene documents into explicit passes/resources.
- Preserved current renderer compatibility behavior:
  - Real bloom expands into extract/blur/composite passes.
  - Real bloom is skipped with a warning when feedback/trail-style feedback is active.
  - Unknown plugin effect nodes are ignored until a plugin registry owns them.
- Exported the new schema APIs through `@wavr/schema`.
- Added package subpath exports for:
  - `@wavr/schema/effect-registry`
  - `@wavr/schema/scene-document`
  - `@wavr/schema/render-plan`

## Files Added

- `packages/schema/src/property-schema.ts`
- `packages/schema/src/effect-registry.ts`
- `packages/schema/src/scene-document.ts`
- `packages/schema/src/render-plan.ts`
- `packages/schema/test/effect-registry.test.ts`
- `packages/schema/test/scene-document.test.ts`
- `packages/schema/test/render-plan.test.ts`

## Files Modified

- `packages/schema/src/index.ts`
- `packages/schema/package.json`

## Validation

- `pnpm --filter @wavr/schema test`
- `pnpm --filter @wavr/schema lint`
- `pnpm --filter @wavr/core lint`
- `pnpm build`

## Current State

The project now has the first canonical architecture layer:

```txt
GradientConfig -> WavrSceneDocument -> RenderPlan
                  Effect registry
                  Property schemas
```

The editor still uses the existing Zustand/store and `GradientConfig` flow. The renderer still uses the current engine path. The new scene document and render-plan compiler are ready to be integrated incrementally.

## Notes

- This is intentionally schema-first. It avoids a risky renderer rewrite in the same slice.
- The render-plan compiler is a planning/data model right now, not the active renderer execution path.
- Existing URL, migration, and parity tests still pass.
- `figma-plugin/` and root `shader-factory-spec.md` were already untracked and were not included.

## Recommended Next Slice

1. Start using `WavrSceneDocument` in editor save/load/export paths.
2. Add `SceneDocument` export in the Export modal as the first full-fidelity export target.
3. Replace manual effect UI metadata gradually with `EFFECT_REGISTRY` property schemas.
4. Add render-plan snapshots for more fixture scenes.
5. Move the runtime/editor preview toward consuming `RenderPlan` without changing visual output first.
