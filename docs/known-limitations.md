# Known Limitations

Wavr is currently a capable shader editor, not yet a full shader factory.

## Export Fidelity

- PNG and WebM/GIF capture the visible canvas, including the 3D overlay when enabled.
- React, Web Component, standalone player, and config widget exports are simplified portable shader exports.
- Portable code exports do not preserve the full layer stack, masks, image textures, text masks, audio reactivity, timeline keyframes, custom GLSL, or the 3D overlay.
- Share/embed URLs use the compressed URL state, not a full scene document with assets.

## Rendering Architecture

- The main fragment shader is still monolithic.
- Effects are mostly global toggles, not a typed per-layer effect stack.
- There is no render-plan compiler or shader chunk compiler yet.
- Feedback and real bloom still have compatibility constraints.

## Performance

- The editor now shows basic FPS, CPU frame time, FBO count, and estimated GPU resource memory.
- GPU timer queries, pass-level timing, bundle budgets, and full scene complexity scoring are not implemented yet.
- Mobile Safari should use reduced quality expectations.

## State And Persistence

- The Zustand editor store remains the working state model.
- A canonical `WavrSceneDocument` schema has not been introduced yet.
- Assets are still stored in layer state as data URLs in some paths.

## Timeline

- Timeline playback is still based on a small fixed keyframe parameter set.
- There are no property-path tracks, easing editor, or auto-key workflow yet.
