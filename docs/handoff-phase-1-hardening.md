# Phase 1 Hardening Handoff

Date: 2026-05-21

## Summary

Implemented the first shader-factory hardening slice from `docs/shader-factory-spec.md`.

## What Changed

- Added runtime instrumentation helpers for texture memory/resource summaries.
- Added `GradientEngine.getMetrics()` with CPU frame timing, shader compile timing, FBO count, texture count, and estimated GPU memory.
- Disabled `preserveDrawingBuffer` by default for normal WebGL and R3F preview rendering.
- Replaced the editor canvas window resize debounce with `ResizeObserver`.
- Reduced timeline playback store writes by sampling locally and syncing the cursor at 15 Hz.
- Added portable export fidelity warnings and updated export copy to say when code exports are simplified.
- Replaced the template README and added `docs/known-limitations.md`.

## Validation

- `pnpm --filter editor test`
- `pnpm --filter @wavr/core lint`
- `pnpm --filter editor lint`
- `pnpm build`
- Browser smoke test: `/editor` loaded, Export modal opened, Code tab showed simplified export labels, no console warnings/errors.

## Notes

- `figma-plugin/` was already untracked and was not included.
- `gh` is installed but not authenticated, so PR creation through GitHub CLI is unavailable in this workspace.
- This is not the full shader factory architecture. Next slices should focus on `SceneDocument`, effect schemas, and a render-plan compiler.
