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

/** Colour at position `t` along the stops (smoothstep between neighbours); `t` is clamped to [0, 1]. */
function sampleStops(stops: readonly Rgb[], labs: readonly Rgb[] | null, t: number, out: number[]) {
  const last = stops.length - 1;
  const scaled = clamp01(t) * last;
  const index = Math.floor(scaled);
  const next = Math.min(index + 1, last);
  const f = scaled - index;
  const frac = f * f * (3 - 2 * f);

  if (labs) {
    const a = labs[index];
    const b = labs[next];
    const lin = oklabToLinear(
      a[0] + (b[0] - a[0]) * frac,
      a[1] + (b[1] - a[1]) * frac,
      a[2] + (b[2] - a[2]) * frac,
    );
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
 * interpolates the stops in Oklab instead of sRGB. Writes into `out` when
 * given (PALETTE_SIZE * 4 floats), so a caller can reuse one buffer.
 */
export function bakePalette(
  colors: readonly Rgb[],
  oklab: boolean,
  blend: number,
  out: Float32Array = new Float32Array(PALETTE_SIZE * 4),
): Float32Array {
  const stops = colors.length === 0 ? [[0, 0, 0] as Rgb] : colors.slice(0, MAX_PALETTE_COLORS);
  const labs = oklab
    ? stops.map((c): Rgb => linearToOklab(srgbToLinear(c[0]), srgbToLinear(c[1]), srgbToLinear(c[2])))
    : null;

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
        sampleStops(stops, labs, t + offset * spread, tap);
        r += tap[0] * weight;
        g += tap[1] * weight;
        b += tap[2] * weight;
      }
    } else {
      sampleStops(stops, labs, t, tap);
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
}

export function createPaletteKey(): PaletteKey {
  return { colors: [], count: -1, oklab: false, blend: 0 };
}

/** Whether `key` describes exactly this palette. */
export function paletteKeyMatches(key: PaletteKey, colors: readonly Rgb[], oklab: boolean, blend: number): boolean {
  const count = Math.min(colors.length, MAX_PALETTE_COLORS);
  if (key.count !== count || key.oklab !== oklab || key.blend !== blend) return false;
  for (let i = 0; i < count; i++) {
    const c = colors[i];
    const k = i * 3;
    if (key.colors[k] !== c[0] || key.colors[k + 1] !== c[1] || key.colors[k + 2] !== c[2]) return false;
  }
  return true;
}

/** Makes `key` describe this palette. */
export function setPaletteKey(key: PaletteKey, colors: readonly Rgb[], oklab: boolean, blend: number) {
  const count = Math.min(colors.length, MAX_PALETTE_COLORS);
  key.count = count;
  key.oklab = oklab;
  key.blend = blend;
  for (let i = 0; i < count; i++) {
    const c = colors[i];
    key.colors[i * 3] = c[0];
    key.colors[i * 3 + 1] = c[1];
    key.colors[i * 3 + 2] = c[2];
  }
}
