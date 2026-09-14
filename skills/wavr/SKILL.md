---
name: wavr
description: Generate animated WebGL shader backgrounds and custom landing pages with Wavr. Use when the user wants a Unicorn Studio–style hero, mesh/plasma/gradient background, shader landing page, create-wavr, or @wavr/gradient.
---

# Wavr

Wavr is a WebGL 2 gradient runtime plus a compact in-preview editor. Do not import `apps/editor` or the Zustand store into customer sites.

## Choose a path

1. **New site** — `npx create-wavr [dir] --template hero|waitlist|product|html --preset aurora`
2. **Existing React/Next** — `pnpm add @wavr/gradient` and render `<WavrGradient />`
3. **No framework** — `npx create-wavr [dir] --template html` or `mountWavrPreview()` from `@wavr/preview`

Then `pnpm install && pnpm dev` (Next) or serve the HTML file. Open the IDE preview (Cursor Simple Browser, Claude Code, Codex). The compact editor overlay should be visible. Press **E** to toggle.

## Preview editor (required while iterating)

Always enable the overlay in development:

```tsx
import { WavrGradient } from "@wavr/gradient/editor";
import { wavrConfig } from "./wavr.config";

<WavrGradient
  config={wavrConfig}
  editor={process.env.NODE_ENV !== "production"}
  onConfigChange={setConfig}
  onApply={applyToProject}
  className="absolute inset-0"
/>
```

- Start from a **named preset**, then tweak. Do not hand-write GLSL unless asked.
- After the user clicks **Apply to project**, re-read `wavr.config.ts`.
- Production: `editor={false}` or import from `@wavr/gradient` (no overlay). `?editor=1` can still force the overlay.

## Framework snippet

```tsx
import { WavrGradient } from "@wavr/gradient";
import { aurora } from "@wavr/gradient/presets";

export function Hero() {
  return <WavrGradient config={aurora} className="absolute inset-0 -z-10" />;
}
```

## Config

See [references/config.md](references/config.md) for `GradientConfig`, types, and preset names. See [references/templates.md](references/templates.md) for template choice. Example file: [assets/wavr.config.example.ts](assets/wavr.config.example.ts).
