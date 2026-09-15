# @wavr/preview

Vanilla compact editor overlay for Wavr shader previews. Use this in HTML landings or via `@wavr/gradient/editor`.

```ts
import { mountWavrPreview, mountWavrEditor } from "@wavr/preview";
import { aurora } from "@wavr/gradient/presets";

const root = document.getElementById("hero");
if (root) {
  mountWavrPreview(root, {
    config: aurora,
    editor: true,
    onApply(config) {
      console.log(config);
    },
  });
}
```

- Press **E** to toggle the panel. The Wavr chip stays visible.
- `?editor=1` forces the overlay on; `?editor=0` hides it.
- Production landings should pass `editor: false`.
