import { describe, expect, it } from "vitest";
import {
  GRADIENT_TYPES,
  LIGHT_FIELD_PALETTES,
  LIGHT_GRADIENT_PALETTES,
  defaultSoftnessForGradientType,
  isLightRampPalette,
  rotateHue,
} from "@wavr/core";
import { RANDOM_GRADIENT_TYPES, randomLook } from "./gradient-types";
import { useGradientStore } from "./store";

type Rgb = readonly [number, number, number];

const toLinear = (c: number) => (c >= 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92);
const P3_TO_SRGB = [[1.2249401, -0.2249404, 0], [-0.0420569, 1.0420571, 0], [-0.0196376, -0.0786361, 1.0982735]];

function oklch(color: Rgb, displayP3 = false): { L: number; C: number; h: number } {
  let [r, g, b] = color.map(toLinear) as [number, number, number];
  if (displayP3) {
    [r, g, b] = P3_TO_SRGB.map((row) => row[0]! * r + row[1]! * g + row[2]! * b) as [number, number, number];
  }
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) * 180) / Math.PI };
}

const hueDelta = (from: number, to: number) => ((to - from + 540) % 360) - 180;

function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("rotateHue", () => {
  it("turns the hue by the angle and keeps lightness and chroma", () => {
    const teal: Rgb = [0.2, 0.55, 0.5];
    const before = oklch(teal);
    for (const degrees of [30, 90, 200, -45]) {
      const after = oklch(rotateHue(teal, degrees));
      expect(after.L).toBeCloseTo(before.L, 4);
      expect(after.C).toBeCloseTo(before.C, 4);
      expect(hueDelta(before.h, after.h)).toBeCloseTo(((degrees + 540) % 360) - 180, 2);
    }
  });

  it("leaves a grey grey", () => {
    const grey = rotateHue([0.5, 0.5, 0.5], 120);
    grey.forEach((c) => expect(c).toBeCloseTo(0.5, 5));
  });

  it("keeps a colour it would push out of gamut inside it, at the same hue and lightness", () => {
    const red: Rgb = [1, 0, 0];
    const before = oklch(red);
    const after = rotateHue(red, 180);
    for (const c of after) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
    const lch = oklch(after);
    expect(lch.L).toBeCloseTo(before.L, 3);
    expect(lch.C).toBeLessThan(before.C);
    expect(Math.abs(hueDelta(before.h, lch.h))).toBeCloseTo(180, 0);
  });

  it("reads Display P3 values as P3", () => {
    const sage: Rgb = [0.45, 0.6, 0.5];
    const before = oklch(sage, true);
    const turned = rotateHue(sage, 60, true);
    const after = oklch(turned, true);
    expect(after.L).toBeCloseTo(before.L, 4);
    expect(after.C).toBeCloseTo(before.C, 4);
    expect(hueDelta(before.h, after.h)).toBeCloseTo(60, 2);
    expect(turned).not.toEqual(rotateHue(sage, 60));
  });
});

describe("randomLook", () => {
  it("picks from every type but image", () => {
    expect([...RANDOM_GRADIENT_TYPES].sort()).toEqual(
      ["aperture", "halo", "horizonGlow", "inkSmoke", "iridescentFoil", "lightLeak", "lightWall", "liquidChrome", "plasmaOrb"],
    );
    const picked = new Set(RANDOM_GRADIENT_TYPES.map((_, i) => randomLook(sequence((i + 0.5) / RANDOM_GRADIENT_TYPES.length, 0.3), "srgb").gradientType));
    expect([...picked].sort()).toEqual([...RANDOM_GRADIENT_TYPES].sort());
    expect(picked.has("image")).toBe(false);
    expect(GRADIENT_TYPES).toEqual(expect.arrayContaining([...picked]));
  });

  it("gives the type its own palette turned to one hue, and its softness", () => {
    const look = randomLook(sequence(0, 0.25), "srgb");
    const type = RANDOM_GRADIENT_TYPES[0]!;
    const palette = { ...LIGHT_GRADIENT_PALETTES, ...LIGHT_FIELD_PALETTES }[type];
    expect(look.gradientType).toBe(type);
    expect(look.softness).toBe(defaultSoftnessForGradientType(type));
    expect(look.colors).toEqual(palette.map((c) => rotateHue(c, 90)));
  });

  it("keeps a light mode's palette running from dark to light at any hue", () => {
    for (const [type, palette] of Object.entries(LIGHT_GRADIENT_PALETTES)) {
      const index = RANDOM_GRADIENT_TYPES.indexOf(type as (typeof RANDOM_GRADIENT_TYPES)[number]);
      for (const turn of [0.1, 0.4, 0.7, 0.95]) {
        const look = randomLook(sequence((index + 0.5) / RANDOM_GRADIENT_TYPES.length, turn), "srgb");
        expect(look.gradientType).toBe(type);
        expect(look.colors.map((c) => oklch(c).L)).toEqual(palette.map((c) => expect.closeTo(oklch(c).L, 3)));
        expect(isLightRampPalette(look.colors), `${type} at ${turn * 360}°`).toBe(true);
      }
    }
  });
});

describe("add layer", () => {
  it("adds a halo on its own palette, screened over the layers below at full opacity", () => {
    const before = useGradientStore.getState().layers.length;
    useGradientStore.getState().addLayer();
    const { layers, activeLayerIndex } = useGradientStore.getState();
    expect(layers).toHaveLength(before + 1);
    expect(activeLayerIndex).toBe(before);
    expect(layers[before]).toMatchObject({
      gradientType: "halo",
      colors: LIGHT_GRADIENT_PALETTES.halo,
      blendMode: "screen",
      opacity: 1,
      softness: defaultSoftnessForGradientType("halo"),
    });
  });
});
