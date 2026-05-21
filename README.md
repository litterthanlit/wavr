# Wavr

Wavr is a WebGL shader editor and runtime for creating animated gradient scenes, layered effects, and production embeds.

## What Is Here

- `apps/editor`: Next.js editor with canvas preview, controls, timeline, presets, export modal, and optional 3D overlay.
- `packages/core`: WebGL2 rendering engine, shaders, layers, runtime config, animation, and instrumentation.
- `packages/schema`: versioned config schema, URL codec, migrations, and parity helpers.
- `packages/react`: React wrapper around the runtime.
- `tests/parity`: Playwright framebuffer parity harness.

## Current Direction

The product is moving from a broad shader prototype toward a designer-facing shader factory. The current priority is Phase 1 hardening:

- make performance visible,
- keep normal rendering lightweight,
- label simplified exports honestly,
- document current limits,
- preserve editor/runtime parity as the architecture evolves.

The full product/technical spec lives at [`docs/shader-factory-spec.md`](docs/shader-factory-spec.md).

## Develop

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/editor`.

## Validate

```bash
pnpm --filter editor test
pnpm --filter @wavr/core lint
pnpm build
```

Parity checks:

```bash
pnpm test:parity
```

## Known Limits

See [`docs/known-limitations.md`](docs/known-limitations.md).
