import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_PALETTE_COLORS,
  PALETTE_SIZE,
  bakePalette,
  displayP3ToSrgb,
  effectiveBlend,
  paletteDomain,
  paletteReach,
} from "@wavr/core";
import {
  createPaletteKey,
  paletteKeyMatches,
  setPaletteKey,
  stopCurve,
} from "../../../packages/core/src/palette";

type V3 = [number, number, number];

// ---------------------------------------------------------------------------
// A straight port of the GLSL the palette texture replaced (sampleColorAt and
// getGradientColor, common.glsl before the palette bake), written the way the
// GLSL reads: vec3 maths, mix/step/pow/clamp, one function per GLSL function.
// It walked a smoothstep from stop to stop. Between two stops the curve still
// is that smoothstep, so a two-stop palette must bake to exactly these colours.
// ---------------------------------------------------------------------------
const map3 = (a: V3, f: (x: number) => number): V3 => [f(a[0]), f(a[1]), f(a[2])];
const mix1 = (x: number, y: number, a: number) => x * (1 - a) + y * a;
const mix3 = (x: V3, y: V3, a: number): V3 => [mix1(x[0], y[0], a), mix1(x[1], y[1], a), mix1(x[2], y[2], a)];
const step = (edge: number, x: number) => (x < edge ? 0 : 1);
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

function glslSrgbToLinear(c: V3): V3 {
  return [0, 1, 2].map((i) =>
    mix1(c[i] / 12.92, Math.pow((c[i] + 0.055) / 1.055, 2.4), step(0.04045, c[i])),
  ) as V3;
}

function glslLinearToSrgb(c: V3): V3 {
  return [0, 1, 2].map((i) =>
    mix1(c[i] * 12.92, 1.055 * Math.pow(c[i], 1 / 2.4) - 0.055, step(0.0031308, c[i])),
  ) as V3;
}

function glslLinearToOklab(c: V3): V3 {
  const l = 0.4122214708 * c[0] + 0.5363325363 * c[1] + 0.0514459929 * c[2];
  const m = 0.2119034982 * c[0] + 0.6806995451 * c[1] + 0.1073969566 * c[2];
  const s = 0.0883024619 * c[0] + 0.2817188376 * c[1] + 0.6299787005 * c[2];
  const l_ = Math.pow(l, 1 / 3);
  const m_ = Math.pow(m, 1 / 3);
  const s_ = Math.pow(s, 1 / 3);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

function glslOklabToLinear(c: V3): V3 {
  const l_ = c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2];
  const m_ = c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2];
  const s_ = c[0] - 0.0894841775 * c[1] - 1.291485548 * c[2];
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

interface Uniforms {
  colors: V3[];
  oklab: boolean;
  colorBlend: number;
  softness: number;
}

function glslSampleColorAt(u: Uniforms, t: number): V3 {
  const count = u.colors.length;
  t = clamp(t, 0, 1);
  const scaledT = t * (count - 1);
  const idx = Math.floor(scaledT);
  let frac = scaledT - Math.floor(scaledT);
  frac = frac * frac * (3 - 2 * frac);

  let nextIdx = idx + 1;
  if (nextIdx >= count) nextIdx = count - 1;

  if (u.oklab) {
    const lab1 = glslLinearToOklab(glslSrgbToLinear(u.colors[idx]));
    const lab2 = glslLinearToOklab(glslSrgbToLinear(u.colors[nextIdx]));
    const blended = mix3(lab1, lab2, frac);
    return glslLinearToSrgb(map3(glslOklabToLinear(blended), (x) => Math.max(x, 0)));
  }
  return mix3(u.colors[idx], u.colors[nextIdx], frac);
}

function glslGetGradientColor(u: Uniforms, t: number): V3 {
  const blend = Math.max(u.colorBlend, u.softness * 0.85);
  if (blend < 0.01) return glslSampleColorAt(u, t);

  const spread = blend * 0.15;
  const add = (acc: V3, c: V3, w: number): V3 => [acc[0] + c[0] * w, acc[1] + c[1] * w, acc[2] + c[2] * w];
  let color = map3(glslSampleColorAt(u, t), (x) => x * 0.4);
  color = add(color, glslSampleColorAt(u, t - spread), 0.15);
  color = add(color, glslSampleColorAt(u, t + spread), 0.15);
  color = add(color, glslSampleColorAt(u, t - spread * 2), 0.1);
  color = add(color, glslSampleColorAt(u, t + spread * 2), 0.1);
  color = add(color, glslSampleColorAt(u, t - spread * 0.5), 0.05);
  color = add(color, glslSampleColorAt(u, t + spread * 0.5), 0.05);
  return color;
}

// ---------------------------------------------------------------------------

const PALETTES: Record<string, V3[]> = {
  "two stops": [[0.9, 0.2, 0.3], [0.1, 0.3, 0.95]],
  "two stops, dark to light": [[0.1, 0.1, 0.4], [1, 0.6, 0.3]],
  "editor default": [[0.388, 0.357, 1.0], [1.0, 0.42, 0.42], [0.251, 0.878, 0.816], [0.98, 0.82, 0.2]],
  "black and white, 8 stops": [[0, 0, 0], [1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0], [1, 1, 1], [0, 0, 0], [1, 1, 1]],
  "saturated primaries": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  "rainbow, 8 stops": [[1, 0, 0], [1, 0.6, 0], [1, 1, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1], [0.6, 0, 1], [1, 0, 0.6]],
  "light leak": [[0.008, 0.004, 0.008], [0.173, 0.031, 0.098], [0.584, 0.086, 0.161], [1, 0.29, 0.11], [1, 0.647, 0.18], [1, 0.945, 0.824]],
  "near black": [[0.001, 0.002, 0.003], [0.02, 0.01, 0.03], [0.035, 0.04, 0.03]],
  "one stop": [[0.8, 0.3, 0.5]],
  "repeated stop": [[0.2, 0.4, 0.6], [0.2, 0.4, 0.6], [0.9, 0.9, 0.1]],
};

const TWO_STOP_PALETTES = Object.entries(PALETTES).filter(([, colors]) => colors.length === 2);

/** The spaces a palette can mix in: Oklab from sRGB or Display P3 stops, or the stop values themselves. */
const MODES: { name: string; oklab: boolean; displayP3: boolean }[] = [
  { name: "Oklab", oklab: true, displayP3: false },
  { name: "Oklab, Display P3", oklab: true, displayP3: true },
  { name: "sRGB", oklab: false, displayP3: false },
];

// colorBlend / softness pairs; the effective blend is max(colorBlend, softness * 0.85).
const BLENDS: [string, number, number][] = [
  ["no blend", 0, 0],
  ["blend just under the threshold", 0.009, 0],
  ["blend just over the threshold", 0.011, 0],
  ["colour blend 0.2", 0.2, 0],
  ["colour blend 1", 1, 0],
  ["softness 0.5", 0, 0.5],
  ["softness 1", 0, 1],
  ["both, softness wins", 0.3, 0.9],
];

const to8bit = (x: number) => Math.round(clamp(x, 0, 1) * 255);

/** The table as the shader reads it: linear filtering between texel centres, edges clamped. */
function sampleTable(table: Float32Array, blend: number, t: number): V3 {
  const { scale, bias } = paletteDomain(blend);
  const u = clamp(t * scale + bias, 0, 1);
  const x = u * (PALETTE_SIZE - 1); // texel-centre coordinate: 0 is the first texel's middle
  const i0 = Math.min(Math.floor(x), PALETTE_SIZE - 1);
  const i1 = Math.min(i0 + 1, PALETTE_SIZE - 1);
  const f = x - i0;
  return [0, 1, 2].map((c) => table[i0 * 4 + c] * (1 - f) + table[i1 * 4 + c] * f) as V3;
}

/** The unblended palette, exactly: the function the table holds samples of. */
function exactPalette(colors: V3[], oklab: boolean, displayP3 = false): (t: number) => V3 {
  const curve = stopCurve(colors, oklab, displayP3);
  return (t) => {
    const out: V3 = [0, 0, 0];
    curve(t, out);
    return out;
  };
}

// Display P3 to linear sRGB (CSS Color 4), for stops read in a P3 scene.
const P3_TO_SRGB: V3[] = [
  [1.2249401, -0.2249404, 0],
  [-0.0420569, 1.0420571, 0],
  [-0.0196376, -0.0786361, 1.0982735],
];

/** A stop in the space the curve runs in: Oklab, or the stop's own values. */
function mixPoint(c: V3, oklab: boolean, displayP3: boolean): V3 {
  if (!oklab) return c;
  const lin = glslSrgbToLinear(c);
  const [r, g, b] = displayP3 ? (P3_TO_SRGB.map((row) => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]) as V3) : lin;
  // cbrt, not pow: a P3 stop can be negative in linear sRGB.
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** How far the colour travels per unit of t, on average: the palette's length. */
function meanSpeed(palette: (t: number) => V3): number {
  let length = 0;
  let previous = palette(0);
  for (let k = 1; k <= 4000; k++) {
    const colour = palette(k / 4000);
    length += distance(colour, previous);
    previous = colour;
  }
  return length;
}

describe("the curve through the stops", () => {
  for (const [name, colors] of Object.entries(PALETTES)) {
    for (const mode of MODES) {
      it(`${name}, ${mode.name}: passes through every stop at t = j / (n - 1)`, () => {
        const palette = exactPalette(colors, mode.oklab, mode.displayP3);
        colors.forEach((stop, j) => {
          const colour = palette(colors.length === 1 ? 0 : j / (colors.length - 1));
          // To the precision of the Oklab matrices, which invert each other to about 1e-6.
          colour.forEach((c, i) => expect(c).toBeCloseTo(stop[i], 5));
        });
      });
    }
  }

  // The defect this curve fixes: a smoothstep from stop to stop brings the
  // colour to rest at every stop, so each stop shows as a flat band. It may
  // rest only where no channel (in the space the stops mix in) carries on
  // through the stop: a repeated stop holds, a peak or dip doesn't overshoot.
  for (const [name, colors] of Object.entries(PALETTES).filter(([, colors]) => colors.length > 2)) {
    for (const mode of MODES) {
      it(`${name}, ${mode.name}: keeps moving through every inner stop a channel carries on through, and rests at the others`, () => {
        const palette = exactPalette(colors, mode.oklab, mode.displayP3);
        const points = colors.map((c) => mixPoint(c, mode.oklab, mode.displayP3));
        const mean = meanSpeed(palette);
        const h = 1e-5;
        for (let j = 1; j < colors.length - 1; j++) {
          const carriesOn = [0, 1, 2].some((c) => (points[j][c] - points[j - 1][c]) * (points[j + 1][c] - points[j][c]) > 0);
          const t = j / (colors.length - 1);
          const speed = distance(palette(t + h), palette(t - h)) / (2 * h);
          if (carriesOn) expect(speed / mean, `stop ${j} moves`).toBeGreaterThan(0.1);
          else expect(speed / mean, `stop ${j} rests`).toBeLessThan(1e-3);
        }
      });
    }
  }

  it("holds a repeated stop's colour across the whole run", () => {
    // Stops have no positions, so repeating one is how a colour is held longer.
    const navy: V3 = [0.1, 0.12, 0.35];
    const colors: V3[] = [navy, navy, navy, [1, 0.45, 0.4]];
    for (const mode of MODES) {
      const table = bakePalette(colors, mode.oklab, 0, undefined, mode.displayP3);
      // Texels 0 to 340 are t = 0 to 2/3, the three navy stops.
      for (let i = 0; i <= Math.floor((2 / 3) * (PALETTE_SIZE - 1)); i++) {
        expect([table[i * 4], table[i * 4 + 1], table[i * 4 + 2]], `${mode.name}, texel ${i}`).toEqual([table[0], table[1], table[2]]);
      }
    }
  });

  // pingPong() folds the palette at both ends; a slope there would leave a crease.
  for (const [name, colors] of Object.entries(PALETTES).filter(([, colors]) => colors.length > 1)) {
    for (const mode of MODES) {
      it(`${name}, ${mode.name}: is flat at both ends`, () => {
        const palette = exactPalette(colors, mode.oklab, mode.displayP3);
        const mean = meanSpeed(palette);
        const h = 1e-6;
        expect(distance(palette(h), palette(0)) / h / mean).toBeLessThan(1e-3);
        expect(distance(palette(1), palette(1 - h)) / h / mean).toBeLessThan(1e-3);
      });
    }
  }

  it("is never negative", () => {
    // A dark ramp that brightens fast after its middle stop: the curve arrives
    // there on that steep tangent, which first pulls it below black.
    const ramp: V3[] = [[0, 0, 0], [0.1, 0.1, 0.1], [1, 1, 1]];
    for (const mode of MODES) {
      const table = bakePalette(ramp, mode.oklab, 0, undefined, mode.displayP3);
      for (let i = 0; i < table.length; i++) expect(table[i]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("bakePalette", () => {
  for (const [name, colors] of TWO_STOP_PALETTES) {
    for (const oklab of [true, false]) {
      for (const [blendName, colorBlend, softness] of BLENDS) {
        it(`${name}, ${oklab ? "Oklab" : "sRGB"}, ${blendName}: every texel is the old shader's colour`, () => {
          const blend = effectiveBlend(colorBlend, softness);
          const table = bakePalette(colors, oklab, blend);
          const reach = paletteReach(blend);
          const uniforms: Uniforms = { colors, oklab, colorBlend, softness };

          let worstFloat = 0;
          let worst8bit = 0;
          for (let i = 0; i < PALETTE_SIZE; i++) {
            const t = -reach + ((1 + 2 * reach) * i) / (PALETTE_SIZE - 1);
            const expected = glslGetGradientColor(uniforms, t);
            for (let c = 0; c < 3; c++) {
              worstFloat = Math.max(worstFloat, Math.abs(table[i * 4 + c] - expected[c]));
              worst8bit = Math.max(worst8bit, Math.abs(to8bit(table[i * 4 + c]) - to8bit(expected[c])));
            }
            expect(table[i * 4 + 3]).toBe(1);
          }
          // The table is Float32; the reference is float64 maths on the same formulas.
          expect(worstFloat).toBeLessThan(1e-6);
          expect(worst8bit).toBeLessThanOrEqual(1);
        });

        it(`${name}, ${oklab ? "Oklab" : "sRGB"}, ${blendName}: filtering between texels stays within 1/255`, () => {
          const blend = effectiveBlend(colorBlend, softness);
          const table = bakePalette(colors, oklab, blend);
          const uniforms: Uniforms = { colors, oklab, colorBlend, softness };

          // Past both ends too: with a blend the function keeps changing beyond [0, 1].
          let worst = 0;
          const steps = 1999;
          for (let i = 0; i <= steps; i++) {
            const t = -0.4 + (1.8 * i) / steps;
            const expected = glslGetGradientColor(uniforms, t);
            const got = sampleTable(table, blend, t);
            for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(got[c] - expected[c]));
          }
          expect(worst * 255).toBeLessThanOrEqual(1);
        });
      }
    }
  }

  for (const [name, colors] of Object.entries(PALETTES)) {
    for (const mode of MODES) {
      it(`${name}, ${mode.name}: filtering between texels stays close to the exact palette`, () => {
        const table = bakePalette(colors, mode.oklab, 0, undefined, mode.displayP3);
        const palette = exactPalette(colors, mode.oklab, mode.displayP3);
        let worst = 0;
        const steps = 20000;
        for (let i = 0; i <= steps; i++) {
          const expected = palette(i / steps);
          const got = sampleTable(table, 0, i / steps);
          for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(got[c] - expected[c]));
        }
        expect(worst * 255).toBeLessThanOrEqual(1);
      });
    }
  }

  it("covers the stretch past [0, 1] that a blend still reaches", () => {
    const colors = PALETTES["two stops"];
    const blend = effectiveBlend(1, 0);
    const uniforms: Uniforms = { colors, oklab: true, colorBlend: 1, softness: 0 };
    const reach = paletteReach(blend);
    expect(reach).toBeCloseTo(0.3);

    // Just past 1 the old function still differs from its value at 1: clamping t first would be wrong.
    const atOne = glslGetGradientColor(uniforms, 1);
    const pastOne = glslGetGradientColor(uniforms, 1.15);
    expect(Math.abs(atOne[0] - pastOne[0]) + Math.abs(atOne[1] - pastOne[1]) + Math.abs(atOne[2] - pastOne[2])).toBeGreaterThan(0.01);

    const table = bakePalette(colors, true, blend);
    const got = sampleTable(table, blend, 1.15);
    for (let c = 0; c < 3; c++) expect(Math.abs(got[c] - pastOne[c]) * 255).toBeLessThanOrEqual(1);

    // Beyond the reach every tap is clamped: the palette is constant.
    expect(sampleTable(table, blend, 1 + reach + 0.5)).toEqual(sampleTable(table, blend, 1 + reach + 5));
    expect(sampleTable(table, blend, -reach - 0.5)).toEqual(sampleTable(table, blend, -reach - 5));
  });

  it("without a blend the table spans exactly [0, 1], ending on the first and last stop", () => {
    const colors = PALETTES["editor default"];
    const table = bakePalette(colors, true, 0);
    expect(paletteReach(0)).toBe(0);
    expect(paletteDomain(0)).toEqual({ scale: 1, bias: 0 });
    for (let c = 0; c < 3; c++) {
      expect(table[c]).toBeCloseTo(colors[0][c], 5);
      expect(table[(PALETTE_SIZE - 1) * 4 + c]).toBeCloseTo(colors[colors.length - 1][c], 5);
    }
  });

  it("maps the ends of the reach to the ends of the table", () => {
    for (const blend of [0.011, 0.3, 0.85, 1]) {
      const reach = paletteReach(blend);
      const { scale, bias } = paletteDomain(blend);
      expect(-reach * scale + bias).toBeCloseTo(0, 12);
      expect((1 + reach) * scale + bias).toBeCloseTo(1, 12);
    }
  });

  it("uses at most the eight stops a layer's uniforms hold, and tolerates an empty palette", () => {
    const eleven: V3[] = Array.from({ length: 11 }, (_, i) => [i / 10, 0, 1 - i / 10]);
    expect(Array.from(bakePalette(eleven, true, 0))).toEqual(Array.from(bakePalette(eleven.slice(0, MAX_PALETTE_COLORS), true, 0)));
    const empty = bakePalette([], true, 0);
    expect(Array.from(empty.slice(0, 4))).toEqual([0, 0, 0, 1]);
  });

  it("writes into the buffer it is given", () => {
    const out = new Float32Array(PALETTE_SIZE * 4);
    const returned = bakePalette(PALETTES["two stops"], true, 0.4, out);
    expect(returned).toBe(out);
    expect(out[PALETTE_SIZE * 4 - 1]).toBe(1);
  });

  it("keeps out-of-gamut Oklab interpolations as the shader did: unclamped, never negative", () => {
    const table = bakePalette(PALETTES["saturated primaries"], true, 0);
    let max = 0;
    for (let i = 0; i < table.length; i++) {
      if (i % 4 !== 3) max = Math.max(max, table[i]);
      if (i % 4 !== 3) expect(table[i]).toBeGreaterThanOrEqual(0);
    }
    // A texture format that clamps to [0, 1] would change these colours before the layer shader sees them.
    expect(max).toBeGreaterThan(0.99);
  });
});

describe("palette cache key", () => {
  const colors: V3[] = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]];

  it("matches the palette it was set from, and only that one", () => {
    const key = createPaletteKey();
    expect(paletteKeyMatches(key, colors, true, 0.2)).toBe(false); // nothing baked yet
    setPaletteKey(key, colors, true, 0.2);
    expect(paletteKeyMatches(key, colors, true, 0.2)).toBe(true);
    // A copy with the same values is the same palette.
    expect(paletteKeyMatches(key, colors.map((c) => [...c] as V3), true, 0.2)).toBe(true);

    expect(paletteKeyMatches(key, colors, false, 0.2)).toBe(false);
    expect(paletteKeyMatches(key, colors, true, 0.21)).toBe(false);
    expect(paletteKeyMatches(key, colors.slice(0, 2), true, 0.2)).toBe(false);
    expect(paletteKeyMatches(key, [...colors, [1, 1, 1]], true, 0.2)).toBe(false);
    for (let stop = 0; stop < 3; stop++) {
      for (let channel = 0; channel < 3; channel++) {
        const edited = colors.map((c) => [...c] as V3);
        edited[stop][channel] += 0.001;
        expect(paletteKeyMatches(key, edited, true, 0.2)).toBe(false);
      }
    }
  });

  it("is updated in place, growing and shrinking with the palette", () => {
    const key = createPaletteKey();
    const stops = key.colors;
    setPaletteKey(key, colors, true, 0);
    setPaletteKey(key, colors.slice(0, 1), false, 0.5);
    expect(key.colors).toBe(stops);
    expect(paletteKeyMatches(key, colors.slice(0, 1), false, 0.5)).toBe(true);
    expect(paletteKeyMatches(key, colors, false, 0.5)).toBe(false);
  });

  it("ignores stops past the eight a layer can hold", () => {
    const many: V3[] = Array.from({ length: 10 }, (_, i) => [i / 10, 0, 0]);
    const key = createPaletteKey();
    setPaletteKey(key, many, true, 0);
    const changedTail = many.map((c) => [...c] as V3);
    changedTail[9][0] = 0.99;
    expect(paletteKeyMatches(key, changedTail, true, 0)).toBe(true);
  });
});

describe("Display P3", () => {
  const texel = (table: Float32Array, i: number): V3 => [table[i * 4], table[i * 4 + 1], table[i * 4 + 2]];

  it("converts P3 to sRGB as Chromium does (clipping what sRGB can't show)", () => {
    // Chromium drew P3 (100, 200, 120) onto an sRGB canvas as (45, 203, 111).
    const srgb = displayP3ToSrgb([100 / 255, 200 / 255, 120 / 255]).map((c) => c * 255);
    srgb.forEach((c, i) => expect(Math.abs(c - [45, 203, 111][i])).toBeLessThan(0.5));
    displayP3ToSrgb([1, 0, 0]).forEach((c, i) => expect(c).toBeCloseTo([1, 0, 0][i], 9));
    const grey = displayP3ToSrgb([0.5, 0.5, 0.5]);
    grey.forEach((c) => expect(c).toBeCloseTo(0.5, 5));
  });

  it("bakes P3 stops back to themselves through Oklab", () => {
    const stops: V3[] = [[0.1, 0.2, 0.9], [0.9, 0.3, 0.2], [0.2, 0.85, 0.9]];
    const table = bakePalette(stops, true, 0, undefined, true);
    // Texels 0, 255.5 and 511 are t = 0, 0.5 and 1: the three stops.
    for (const [index, stop] of [[0, stops[0]], [PALETTE_SIZE - 1, stops[2]]] as [number, V3][]) {
      texel(table, index).forEach((c, i) => expect(c).toBeCloseTo(stop[i], 5));
    }
  });

  it("blends in Oklab between the colours the P3 values are, not as if they were sRGB", () => {
    // Muted colours, inside sRGB too: the P3 bake, converted to sRGB, is the
    // sRGB bake of the same colours (to well within an 8-bit level; the
    // tables are float32).
    const p3: V3[] = [[0.4, 0.45, 0.5], [0.6, 0.5, 0.4], [0.45, 0.55, 0.45]];
    const viaP3 = bakePalette(p3, true, 0.3, undefined, true);
    const viaSrgb = bakePalette(p3.map(displayP3ToSrgb), true, 0.3);
    for (let i = 0; i < PALETTE_SIZE; i += 37) {
      const converted = displayP3ToSrgb(texel(viaP3, i));
      converted.forEach((c, k) => expect(c).toBeCloseTo(texel(viaSrgb, i)[k], 3));
    }
  });

  it("is part of the cache key", () => {
    const key = createPaletteKey();
    const stops: V3[] = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]];
    setPaletteKey(key, stops, true, 0.2, true);
    expect(paletteKeyMatches(key, stops, true, 0.2, true)).toBe(true);
    expect(paletteKeyMatches(key, stops, true, 0.2)).toBe(false);
  });
});

describe("palette lookup in common.glsl", () => {
  const SHADER_DIR = path.resolve(__dirname, "../../../packages/core/src/shaders");
  const common = fs.readFileSync(path.join(SHADER_DIR, "common.glsl"), "utf8");

  it("declares the table size the baker uses", () => {
    expect(common).toContain(`const float PALETTE_TEXELS = ${PALETTE_SIZE}.0;`);
  });

  it("getGradientColor is one texel-centre lookup through u_paletteDomain", () => {
    const body = /vec3 getGradientColor\(float t\)\s*\{([\s\S]*?)\n\}/.exec(common)![1];
    expect(body.match(/texture(Lod)?\(/g)).toHaveLength(1);
    expect(body).toContain("t * u_paletteDomain.x + u_paletteDomain.y");
    expect(body).toContain("(u * (PALETTE_TEXELS - 1.0) + 0.5) / PALETTE_TEXELS");
    // The per-pixel colour maths is gone: no colour-space conversion per lookup.
    expect(common).not.toContain("sampleColorAt");
    expect(common).not.toContain("linearToOklab");
    expect(body).not.toContain("u_oklabEnabled");
  });
});
