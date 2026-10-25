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

Light modes: `liquidChrome` `horizonGlow` `inkSmoke` `plasmaOrb` `iridescentFoil` `lightLeak`. They read the palette as light, darkest stop first and brightest last, so give them a dark-to-light palette (or start from their presets).

Light fields (coloured light in a space, after light installations; mixed in linear light, so the most saturated, gallery-like looks): `aperture` (a knife-edged opening of light in a wall: first colour the wall, the rest the light from the opening's core to its rim; complexity sets the proportions, from a tall slit at 1 to a wide band at 8, distortion the haze that spills it into the room), `halo` (a loop of light in a dark room; a dark-to-light palette like the light modes), `lightWall` (lights drifting behind frosted glass panels: first colour the glass's glow, the rest the lights). Their presets set `toneMapMode: 0` and `colorProfile: "display-p3"`, and most turn on `realBloomEnabled`; keep them when you adapt one.

Skip `image` unless the user supplies a texture.

## Wide gamut

`colorProfile: "display-p3"` reads every colour value as Display P3 and renders to a P3 canvas: the same numbers come out more saturated on wide-gamut screens (recent Macs, iPhones, many phones), and browsers without P3 show them as sRGB. Default `"srgb"`. Use it for vivid light (the light fields) and pick colours with that in mind: `[0, 0.85, 0.9]` in P3 is an aqua sRGB can't reach.

## Presets (`@wavr/gradient/presets`)

Light fields: `aperture` `cobaltAperture` `duskAperture` `ganzfeld` `halo` `iceHalo` `lightWall` `lagoonWall`

Light: `liquidChrome` `goldChrome` `horizonGlow` `iceHorizon` `inkSmoke` `roseSmoke` `plasmaOrb` `limeOrb` `iridescentFoil` `midnightFoil` `lightLeak` `violetLeak`

Classic: `aurora` `sunset` `midnight` `candy` `ocean` `lava` `cyber` `monochrome`

Dither: `newspaper` `stipple` `dissolve` `morse`

Scanline: `retroCrt` `broadcastSignal` `vhs` `neonBars`

Glitch: `dataMosh` `slitScan` `corruption` `signalLoss`

Cinematic: `filmNoir` `bladeRunner` `tron` `vaporwave`

Nature: `northernLights` `deepSea` `forestCanopy` `sandstorm`

Abstract: `liquidMetal` `oilSlick` `prism` `smoke`

## Overlay-editable fields

The compact preview editor edits: preset, type, four colors, speed, complexity, scale, distortion, bloom, vignette, grain.
