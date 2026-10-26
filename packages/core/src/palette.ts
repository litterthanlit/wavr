// Palette lookup table: `getGradientColor(t)` baked on the CPU into a 1D
// texture, one per layer. The shader used to evaluate the palette per pixel:
// up to 7 taps (colour blend / softness), each interpolating two stops through
// sRGB -> linear -> Oklab and back, i.e. dozens of pow/cbrt per call and
// several calls per pixel in the premium modes. A palette only changes when
// the user edits colours, so it is evaluated once instead and the shader does
// a single texture fetch (`getGradientColor` in common.glsl).
//
// The maths below is a port of the GLSL it replaced (sampleColorAt and the
// 7-tap blend), in float64; palette.test.ts checks it against a straight port
// of that GLSL.

type Rgb = readonly [number, number, number];

/**
 * Texels in the table: linear filtering between them must stay within one
 * 8-bit level of the exact function. Smooth palettes need far fewer (256 gives
 * 0.1/255 for the editor's defaults), but 8 saturated stops in Oklab clip at
 * the sRGB gamut edge, which leaves kinks in the curve: the worst case measured
 * (a rainbow, 8 stops) is 3.4/255 at 128 texels, 1.35/255 at 256 and 0.35/255
 * at 512. At 512 the table is 4 KB of half-float per layer and a bake is
 * 512 x 7 colour evaluations, a fraction of a millisecond.
 * Must match PALETTE_TEXELS in common.glsl.
 */
export const PALETTE_SIZE = 512;

/** Stops a layer's `u_colors[]` holds. */
export const MAX_PALETTE_COLORS = 8;

/** Below this blend, getGradientColor is the single, unblended lookup. */
const BLEND_THRESHOLD = 0.01;

/** A tap of the blur: offset in units of `spread` and weight (the weights sum to 1). */
const TAPS: readonly (readonly [number, number])[] = [
  [0, 0.4],
  [-1, 0.15],
  [1, 0.15],
  [-2, 0.1],
  [2, 0.1],
  [-0.5, 0.05],
  [0.5, 0.05],
];

/** How far the colours melt into each other: the global colour blend, or the layer's softness. */
export function effectiveBlend(colorBlend: number, softness: number): number {
  return Math.max(colorBlend, softness * 0.85);
}

/**
 * The part of t beyond [0, 1] that the blend still reaches. With blur taps
 * `spread` apart, t = 1.1 averages colours from t = 0.95 and up, so the
 * function keeps changing until every tap is clamped, 2 * spread out.
 */
export function paletteReach(blend: number): number {
  return blend < BLEND_THRESHOLD ? 0 : blend * 0.15 * 2;
}

/**
 * Maps t to a coordinate along the table, `t * scale + bias`: the table covers
 * t in [-reach, 1 + reach]; outside it the palette is constant.
 */
export function paletteDomain(blend: number): { scale: number; bias: number } {
  const reach = paletteReach(blend);
  const span = 1 + 2 * reach;
  return { scale: 1 / span, bias: reach / span };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function srgbToLinear(c: number): number {
  return c >= 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
}

function linearToSrgb(c: number): number {
  return c >= 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : c * 12.92;
}

// Display P3 shares sRGB's transfer curve (srgbToLinear / linearToSrgb serve
// both); the two differ in their primaries, by these matrices between their
// linear values (D65 white in both, CSS Color 4). Oklab is defined on linear
// sRGB, so a P3 stop goes through P3_TO_SRGB on the way in and SRGB_TO_P3 on
// the way out; linear sRGB outside 0..1 is just a colour sRGB can't show.
const P3_TO_SRGB = [
  [1.2249401, -0.2249404, 0],
  [-0.0420569, 1.0420571, 0],
  [-0.0196376, -0.0786361, 1.0982735],
] as const;
const SRGB_TO_P3 = [
  [0.8224621, 0.177538, 0],
  [0.0331941, 0.9668058, 0],
  [0.0170827, 0.0723974, 0.9105199],
] as const;

function applyMatrix(m: typeof P3_TO_SRGB | typeof SRGB_TO_P3, r: number, g: number, b: number): [number, number, number] {
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

/**
 * A Display P3 colour as the nearest sRGB one (channels clipped, as browsers
 * show P3 on an sRGB screen): for a fallback where P3 can't be shown.
 */
export function displayP3ToSrgb(color: Rgb): [number, number, number] {
  const lin = applyMatrix(P3_TO_SRGB, srgbToLinear(color[0]), srgbToLinear(color[1]), srgbToLinear(color[2]));
  return [
    linearToSrgb(Math.min(Math.max(lin[0], 0), 1)),
    linearToSrgb(Math.min(Math.max(lin[1], 0), 1)),
    linearToSrgb(Math.min(Math.max(lin[2], 0), 1)),
  ];
}

/** A stop's linear sRGB, from sRGB or (displayP3) Display P3 values. */
function stopToLinearSrgb(c: Rgb, displayP3: boolean): [number, number, number] {
  const r = srgbToLinear(c[0]);
  const g = srgbToLinear(c[1]);
  const b = srgbToLinear(c[2]);
  return displayP3 ? applyMatrix(P3_TO_SRGB, r, g, b) : [r, g, b];
}

/**
 * A stop in the space gradients blend raw stops in (`u_colorsMix`): Oklab when
 * `oklab` is on, else the stop itself. `displayP3`: the stop is Display P3
 * values. Shaders convert back with mixSpaceToRgb(), once per pixel instead of
 * once per stop.
 */
export function toMixSpace(color: Rgb, oklab: boolean, displayP3 = false): Rgb {
  if (!oklab) return color;
  return linearToOklab(...stopToLinearSrgb(color, displayP3));
}

function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/**
 * Colour at position `t` along the stops (smoothstep between neighbours); `t`
 * is clamped to [0, 1]. Out of Oklab, `displayP3` gives Display P3 values.
 */
function sampleStops(stops: readonly Rgb[], labs: readonly Rgb[] | null, t: number, out: number[], displayP3: boolean) {
  const last = stops.length - 1;
  const scaled = clamp01(t) * last;
  const index = Math.floor(scaled);
  const next = Math.min(index + 1, last);
  const f = scaled - index;
  const frac = f * f * (3 - 2 * f);

  if (labs) {
    const a = labs[index];
    const b = labs[next];
    const srgb = oklabToLinear(
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    );
    const lin = displayP3 ? applyMatrix(SRGB_TO_P3, srgb[0], srgb[1], srgb[2]) : srgb;
    out[0] = linearToSrgb(Math.max(lin[0], 0));
    out[1] = linearToSrgb(Math.max(lin[1], 0));
    out[2] = linearToSrgb(Math.max(lin[2], 0));
    return;
  }
  const a = stops[index];
  const b = stops[next];
  out[0] = a[0] + (b[0] - a[0]) * frac;
  out[1] = a[1] + (b[1] - a[1]) * frac;
  out[2] = a[2] + (b[2] - a[2]) * frac;
}

/**
 * Bakes a layer's palette: RGBA float texels (alpha 1), texel i at
 * t = -reach + (1 + 2 * reach) * i / (PALETTE_SIZE - 1), each the colour
 * getGradientColor(t) used to compute. `blend` is effectiveBlend(); `oklab`
 * interpolates the stops in Oklab instead of directly. Writes into `out` when
 * given (PALETTE_SIZE * 4 floats), so a caller can reuse one buffer.
 * `displayP3`: the stops are Display P3 values, and so is the table.
 */
export function bakePalette(
  colors: readonly Rgb[],
  oklab: boolean,
  blend: number,
  out: Float32Array = new Float32Array(PALETTE_SIZE * 4),
  displayP3 = false,
): Float32Array {
  const stops = colors.length === 0 ? [[0, 0, 0] as Rgb] : colors.slice(0, MAX_PALETTE_COLORS);
  const labs = oklab ? stops.map((c): Rgb => linearToOklab(...stopToLinearSrgb(c, displayP3))) : null;

  const reach = paletteReach(blend);
  const span = 1 + 2 * reach;
  const spread = blend * 0.15;
  const blended = blend >= BLEND_THRESHOLD;

  const tap: number[] = [0, 0, 0];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const t = -reach + (span * i) / (PALETTE_SIZE - 1);
    let r = 0;
    let g = 0;
    let b = 0;
    if (blended) {
      for (const [offset, weight] of TAPS) {
        sampleStops(stops, labs, t + offset * spread, tap, displayP3);
        r += tap[0] * weight;
        g += tap[1] * weight;
        b += tap[2] * weight;
      }
    } else {
      sampleStops(stops, labs, t, tap, displayP3);
      [r, g, b] = tap;
    }
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = 1;
  }
  return out;
}

/**
 * What a baked palette was made from, kept to tell whether a layer's palette
 * changed since. Compared field by field and updated in place, so checking
 * every frame allocates nothing.
 */
export interface PaletteKey {
  /** Stop colours, r g b per stop. */
  colors: number[];
  count: number;
  oklab: boolean;
  blend: number;
  displayP3: boolean;
}

export function createPaletteKey(): PaletteKey {
  return { colors: [], count: -1, oklab: false, blend: 0, displayP3: false };
}

/** Whether `key` describes exactly this palette. */
export function paletteKeyMatches(
  key: PaletteKey,
  colors: readonly Rgb[],
  oklab: boolean,
  blend: number,
  displayP3 = false,
): boolean {
  const count = Math.min(colors.length, MAX_PALETTE_COLORS);
  if (key.count !== count || key.oklab !== oklab || key.blend !== blend || key.displayP3 !== displayP3) return false;
  for (let i = 0; i < count; i++) {
    const c = colors[i];
    const k = i * 3;
    if (key.colors[k] !== c[0] || key.colors[k + 1] !== c[1] || key.colors[k + 2] !== c[2]) return false;
  }
  return true;
}

/** Makes `key` describe this palette. */
export function setPaletteKey(key: PaletteKey, colors: readonly Rgb[], oklab: boolean, blend: number, displayP3 = false) {
  const count = Math.min(colors.length, MAX_PALETTE_COLORS);
  key.count = count;
  key.oklab = oklab;
  key.blend = blend;
  key.displayP3 = displayP3;
  for (let i = 0; i < count; i++) {
    const c = colors[i];
    key.colors[i * 3] = c[0];
    key.colors[i * 3 + 1] = c[1];
    key.colors[i * 3 + 2] = c[2];
  }
}

/**
 * `color` with its hue turned by `degrees` in OkLCh, its lightness and chroma
 * kept. Where the turned colour falls outside the gamut (sRGB, or Display P3
 * with `displayP3`), it gives up only the chroma it must, so its hue and
 * lightness still hold.
 */
export function rotateHue(color: Rgb, degrees: number, displayP3 = false): [number, number, number] {
  const [L, a, b] = linearToOklab(...stopToLinearSrgb(color, displayP3));
  const turn = (degrees * Math.PI) / 180;
  const ta = a * Math.cos(turn) - b * Math.sin(turn);
  const tb = a * Math.sin(turn) + b * Math.cos(turn);
  const linearAt = (chroma: number) => {
    const lin = oklabToLinear(L, ta * chroma, tb * chroma);
    return displayP3 ? applyMatrix(SRGB_TO_P3, ...lin) : lin;
  };
  const inGamut = (c: readonly number[]) => c.every((v) => v >= -1e-7 && v <= 1 + 1e-7);
  let chroma = 1;
  if (!inGamut(linearAt(1))) {
    let lo = 0;
    for (let step = 0.5; step > 1e-6; step /= 2) if (inGamut(linearAt(lo + step))) lo += step;
    chroma = lo;
  }
  const lin = linearAt(chroma);
  return [linearToSrgb(clamp01(lin[0])), linearToSrgb(clamp01(lin[1])), linearToSrgb(clamp01(lin[2]))];
}
