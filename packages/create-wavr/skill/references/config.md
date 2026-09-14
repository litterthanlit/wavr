# GradientConfig

Colors are RGB floats in `0–1`. Keep one to four layers. Prefer a named preset, then patch fields.

```ts
import type { GradientConfig } from "@wavr/gradient";

export const wavrConfig: GradientConfig = {
  layers: [{
    type: "mesh",
    colors: [[0, 0.9, 0.8], [0.2, 0.8, 0.3], [0.3, 0.2, 0.7], [0.2, 0.4, 1]],
    speed: 0.4,
    complexity: 4,
    scale: 1.2,
    distortion: 0.35,
  }],
  bloom: { enabled: true, intensity: 0.3 },
  vignette: 0.2,
  grain: 0.05,
};
```

## Layer types

`mesh` `radial` `linear` `conic` `plasma` `dither` `scanline` `glitch` `voronoi` `silk` `aurora` `liquid` `softCells` `grainflow` `prismGlass` `neonTunnel`

Skip `image` unless the user supplies a texture.

## Presets (`@wavr/gradient/presets`)

Classic: `aurora` `sunset` `midnight` `candy` `ocean` `lava` `cyber` `monochrome`

Dither: `newspaper` `stipple` `dissolve` `morse`

Scanline: `retroCrt` `broadcastSignal` `vhs` `neonBars`

Glitch: `dataMosh` `slitScan` `corruption` `signalLoss`

Cinematic: `filmNoir` `bladeRunner` `tron` `vaporwave`

Nature: `northernLights` `deepSea` `forestCanopy` `sandstorm`

Abstract: `liquidMetal` `oilSlick` `prism` `smoke`

## Overlay-editable fields

The compact preview editor edits: preset, type, four colors, speed, complexity, scale, distortion, bloom, vignette, grain.
