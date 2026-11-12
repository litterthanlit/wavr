# GradientConfig

Colors are RGB floats in `0–1`. Keep one to four layers. Prefer a named preset, then patch fields.

```ts
import type { GradientConfig } from "@wavr/gradient";

export const wavrConfig: GradientConfig = {
  layers: [{
    type: "lightWall",
    colors: [[0.05, 0.12, 0.35], [0.1, 0.45, 0.95], [0.2, 0.85, 0.9], [0.55, 0.4, 1]],
    speed: 0.4,
    complexity: 4,
    scale: 1,
    distortion: 0.5,
    softness: 0.8,
  }],
  grain: 0.04,
  toneMapMode: 0,
  colorProfile: "display-p3",
  hdrHeadroom: 1,
  realBloomEnabled: true,
};
```

## Layer types

Every type but `image` is light. Earlier types (`mesh`, `aurora`, `silk` and the rest) were removed; a config that names one opens as `lightWall`, so don't write them.

Light modes: `liquidChrome` `horizonGlow` `inkSmoke` `plasmaOrb` `flow` `pulse` `iridescentFoil` `lightLeak`. `flow` is ribbons of light streaming across the frame like silk in a slow current (complexity the folds, distortion the turbulence, scale the ribbon width); `pulse` is a breathing light whose swells roll out from the centre on a beat of about 4.5 s at speed 1 (complexity how many swells show at once, scale their reach). They read the palette as light, darkest stop first and brightest last, so give them a dark-to-light palette (or start from their presets).

Light fields (coloured light in a space, after light installations; mixed in linear light, so the most saturated, gallery-like looks): `aperture` (a knife-edged opening of light in a wall: first colour the wall, the rest the light from the opening's core to its rim; complexity sets the proportions, from a tall slit at 1 to a wide band at 8, distortion the haze that spills it into the room), `cove` (light pouring in from every edge of the frame round a dark core, the look of a softly glowing card or button: first colour the dark core, the last the pale rim, the ones between the coloured lights that drift round the frame; its frame is the canvas, so it fits a banner, a square or a tall card alike; softness is how far the light reaches in, distortion how much it wanders, complexity the number of pools of colour, scale the size of the frame of light against the canvas), `vista` (a landscape made of light, after landscape photographs: mostly muted, tinted neutrals with one accent; the colours run from the ground at the bottom of the frame to the top of the sky, one band each; where the next colour up is lighter the band is land receding into haze, with a rolling crest and mist pooling under it, and where it is darker the bands melt into a sky; the brightest colour is a soft, low sun glow drifting along the horizon; softness is the mist, from crisp ridgelines to a pure gradient, distortion the relief, complexity the roughness of the ridgelines, scale the width of the forms; unlike the other light fields its presets are sRGB with no `hdrHeadroom`, so keep that when you adapt one), `halo` (a loop of light in a dark room; a dark-to-light palette like the light modes), `corona` (fine streamers of light pouring out round a dark eye, as in a long exposure through ribbed glass; a dark-to-light palette; its layer reads `focus`, 0 a burst of rays round a small eye to 1 curtains hanging either side of the dark, and `fill`, 0 a few streamers to 1 a bright wash, both 0–1 and 0.5 by default; scale sizes the streamers), `lightWall` (lights drifting behind frosted glass panels: first colour the glass's glow, the rest the lights). Their presets set `toneMapMode: 0`, `colorProfile: "display-p3"` and an `hdrHeadroom` (1–2 stops), and most turn on `realBloomEnabled`; keep them when you adapt one.

Skip `image` unless the user supplies a texture.

## Wide gamut

`colorProfile: "display-p3"` reads every colour value as Display P3 and renders to a P3 canvas: the same numbers come out more saturated on wide-gamut screens (recent Macs, iPhones, many phones), and browsers without P3 show them as sRGB. Default `"srgb"`. Use it for vivid light (the light fields) and pick colours with that in mind: `[0, 0.85, 0.9]` in P3 is an aqua sRGB can't reach.

`hdrHeadroom` (0–3 stops, default 0) lets light shine brighter than white on an HDR screen: at 2 the light fields' light is four times as bright, while their wall or room stays as it is. Give less where the light fills more of the frame (the light-field presets use 2 for a small light in a dark room, 1.5 for an opening in a wall, 1 when the whole frame is light). Standard screens and exports show the scene as at 0. Only the Wavr editor presents HDR so far; `@wavr/gradient` accepts the field and renders standard range.

## Presets (`@wavr/gradient/presets`)

Light fields: `aperture` `cobaltAperture` `duskAperture` `ganzfeld` `cove` `emberCove` `vista` `blueHourVista` `duskVista` `cloudSeaVista` `mistVista` `duneVista` `halo` `iceHalo` `corona` `iceVeil` `lightWall` `lagoonWall`

Light: `liquidChrome` `goldChrome` `horizonGlow` `iceHorizon` `inkSmoke` `roseSmoke` `plasmaOrb` `limeOrb` `flow` `pulse` `iridescentFoil` `midnightFoil` `lightLeak` `violetLeak`

## A card or button of light

`cove` is made for a container, not only a full-bleed hero. Give the container `position: relative`, `overflow: hidden` and its border radius, render the gradient first and the content over it:

```tsx
<div className="relative overflow-hidden rounded-3xl">
  <WavrGradient config={cove} className="absolute inset-0" />
  <div className="relative p-8 text-white">Autonomous demos</div>
</div>
```

On a light page, make the palette's last colour (the rim) close to the page colour and the card melts into it. Radii up to about a quarter of the shorter side need nothing more; for a pill, raise `softness` so the rim stays even round the ends.

## Overlay-editable fields

The compact preview editor edits: preset, type, four colors, speed, complexity, scale, distortion, bloom, vignette, grain.
