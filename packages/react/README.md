# @wavr/gradient

Animated WebGL gradient React component.

```tsx
import { WavrGradient } from "@wavr/gradient";
import { aurora } from "@wavr/gradient/presets";

export function Hero() {
  return <WavrGradient config={aurora} className="absolute inset-0" />;
}
```

## Preview editor

While iterating in Cursor, Claude Code, or Codex, import the editor entry (or pass `editor` on the same component) so the compact overlay appears in the browser preview:

```tsx
import { WavrGradient } from "@wavr/gradient/editor";
import { wavrConfig } from "./wavr.config";

<WavrGradient
  config={wavrConfig}
  editor={process.env.NODE_ENV !== "production"}
  onConfigChange={setConfig}
  className="absolute inset-0 -z-10"
/>
```

Press **E** to toggle the panel. Production builds should keep `editor={false}` (or import from `@wavr/gradient` and omit the prop). Use `npx create-wavr` to scaffold a landing page with this wired up.
