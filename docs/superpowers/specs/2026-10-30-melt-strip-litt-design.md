# Melt, strip, litt: design

Three changes to Wavr, built in this order: the orb melts, the dials go, the UI and landing move to litt.md.

## Why

Wavr's looks should read like light seen through a diffuser: colour fields that melt into each other and into the dark, as in large diffused light-wall installations and as Light Leak already does. The orb is the one look that doesn't. It is a glass marble with a hard rim, a specular highlight and a streaky swirl.

The editor has about 60 sliders across five tabs, and it feels overwhelming. The owner works almost entirely in the Gradient tab.

The UI and the landing page should follow the owner's own design system, litt.md (`litterthanlit/litt.md`), rather than Wavr's ad-hoc tokens.

## Goals

1. **The orb melts.** `plasmaOrb` becomes a soft round glow. It is still one round thing you can point at, with colours that drift and melt inside it and an edge that fades into the room. It has no rim, highlight, fresnel line, glint or marble swirl. The reference is sketch A (`assets/orb-sketch-a-1.png`, `assets/orb-sketch-a-2.png`, source `assets/orb-sketch.html`, variant `V==0`). It renders 7 drifting gaussians of the palette's stops 1–4, mixed by weight so they melt instead of stacking. That field sits inside a round body of `exp(-1.2 (r / 0.33)²)` in canvas heights, with a faint `exp(-3r)` core glow in the third stop. The owner chose it over a light wall, a full-frame field and bokeh discs.
2. **Fewer dials.** The Gradient tab stays whole, and everything else shrinks around it.
3. **litt.md everywhere a person looks.** The editor's controls and chrome use litt's tokens and components. The landing page is rebuilt to litt's rules, and it is simple.

## Non-goals

- No other look changes. The other 19 presets stay as they are.
- No engine, schema or export-format changes beyond what the orb shader needs.
- No new features.

## Anti-goals (failure even if it "works")

- An old share link, embed or saved project renders differently, except the orb, which is meant to. Hidden controls must never silently change a scene.
- The orb still has any crisp edge or glassy highlight.
- The landing page is a feature tour again, or advertises something the editor no longer shows.
- litt's look is half-applied: old greys next to litt stone, two slider styles, mixed radii.

## 1. The orb

- Keep the type id `plasmaOrb` and its shader id, because code exports and embeds compile it in (`gradient-types.test.ts` guards this). The tile label may become "Orb".
- Rewrite `plasmaOrbGradient` in `packages/core/src/shaders/gradients.glsl` to follow the house rules at the top of that file. Use a few broad, slow forms on aspect-corrected coordinates, and map the field to the palette with `pingPong` or a sine. Keep the palette reading as light, darkest stop first, with highlights that may burn toward white. Keep `u_scale` as the orb's size, `u_speed` for drift, and Softness for how far the edge fades. The room outside stays near the palette's first stop, as now.
- The curated palette in `LIGHT_GRADIENT_PALETTES` and the presets `plasmaOrb` and `limeOrb` stay. Run `pnpm thumbnails` after the change.
- Verify with `pnpm snapshots --only plasmaOrb` against the current commit, `pnpm export-parity --only plasmaOrb`, and a look at the PNGs. The other looks must diff at 0.

## 2. Fewer dials

**Sidebar.** Three tabs: Gradient, Effects, Presets (keys 1–3, `SIDEBAR_TABS`). The 3D and Shader panels leave the sidebar. They open from the command palette, with their code kept and lazy-loaded as now. Opening one shows it as a temporary fourth tab, which stays until closed or until another tab is picked. The Shader editor's live errors and the 3D overlay both need the canvas visible, so a modal would not work. (Builder's call.) A scene that uses 3D or Custom GLSL still renders.

**Gradient tab.**
- Look (tiles): unchanged.
- Colors (gradient bar, Randomize, Reset): unchanged.
- Motion: unchanged, with all five sliders (Speed, Scale, Complexity, Distortion, Softness).
- Mask: one switch and a shape picker. The fine controls (position, scale X/Y, rotation, feather, corner radius, sides, inner radius, noise edge, and the text mask's size, weight, spacing and align) sit behind a "More" disclosure inside the section. The section itself stays open, per the always-open rule.
- Image Source (image look only) and "Also on this layer": unchanged.

**Effects tab.** Three controls:
- Bloom: a switch only (`realBloomEnabled`). Cinematic bloom has no strength field, and adding one would mean schema work. (Builder's call.)
- Grain: a switch, plus its Amount slider while on.
- Pointer: a switch, plus its strength slider (`mouseReact`) while on.

Grain and Pointer are numbers, not flags. The switch reads "on" when the value is above 0. Turning it off writes 0. Turning it back on writes the core default. Each flip is one `setDiscrete` undo step, so undo restores a scene's own earlier value. (Builder's call.)

Everything else the tab shows today goes: Brightness, Saturation, Hue Shift, Tone Mapping, Vignette, Chromatic Aberration, Blur, Anti-banding, Click Ripple, Mouse Trail, Color Profile, HDR Headroom and Performance. While a scene has one of these on or away from its default, the tab lists it under "Also in this scene" with a switch to turn it off. This is the existing `SCENE_EXTRAS` mechanism, extended to cover them. Exceptions:
- **Colour profile, HDR headroom, tone mapping and anti-banding** are part of a look, since presets and the opening scene set them, so they are never listed as extras. Picking a look or preset still sets them. (Builder's call for tone mapping and anti-banding.) The rest (Brightness, Saturation, Hue Shift, Vignette, Chromatic Aberration, Blur, Click Ripple, Mouse Trail) are listed when away from the core default, and their switch writes that default. If a shipped preset sets one of them, add it to this exempt list rather than show an extra on a fresh preset.
- **Performance** moves to the command palette.

**Tests and docs.** Update the tests that pin tab order, panel contents or extras. Update CLAUDE.md's Sidebar and Controls notes.

## 3. litt.md

The source is `litterthanlit/litt.md` (read-only clone at `/home/user/litterthanlit/litt.md`; components install from the shadcn registry `https://littmd.vercel.app/r/{name}.json`). Its rules are in `skills/litt-md/` (`taste/profile.md`, `system/foundations.md`, `system/material.md`, `system/components.md`, `workflows/build.md`). Follow them, and score the result with its `scripts/litt-check.mjs`.

**Tokens.** Adopt litt's `tokens.css` and `tailwind.css` (Tailwind v4) in `apps/editor`. Map Wavr's existing `--color-*` theme names onto litt tokens, or replace their uses, so that one palette remains. The accent is litt's `--accent` (cobalt), since the owner said to follow litt's rules. It stays the only accent, exposed as `--color-accent` per CLAUDE.md. Keep both themes. Keep WCAG AA text contrast.

**Editor components.** Replace Wavr's `components/ui` Slider, Toggle (as Switch), Segmented, Select, Section, Toast and ColorInput, plus the dialogs, tabs, tooltip and command palette, with litt's. Keep what CLAUDE.md requires of them:
- Slider stays a WAI-ARIA slider with Page Up/Down, Home/End, held-key-as-one-undo-step and the `format` units.
- Undo semantics stay: `set` while dragging, `commitSet` on release, and `setDiscrete` for switches and selects.
- The GradientBar stays Wavr's own, restyled with litt tokens.

**Landing page (`app/page.tsx`).** Simple, and to litt's rules:
- A live Wavr gradient as the hero.
- One short headline and one line of copy in litt's voice: quiet and exact, with no feature lists.
- One primary action into the editor.
- A few looks to click into, each opening the editor on that preset.
- A footer.

Everything else (feature grid, Create → Effect → Export strip, copy about retired effects) goes.

## Left to the builder

- The orb's exact field, falloff and drift constants, judged by eye against sketch A and the Light Leak preset.
- Which litt components need small adaptations to meet Wavr's control contracts, and whether to vendor them or install them via the shadcn CLI.
- The landing's exact copy and which looks it shows, within litt's rules.
- Commit and PR structure. Each of the three parts should land and verify on its own.
