import { describe, expect, it } from "vitest";
import { MAX_STOPS, MIN_STOPS } from "./color-stops";
import { NATURE_PALETTES, paletteSwatch } from "./nature-palettes";

const luma = (c: readonly number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe("nature palettes", () => {
  it("have unique ids and sentence-case names", () => {
    const ids = NATURE_PALETTES.map((palette) => palette.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { name } of NATURE_PALETTES) expect(name).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/);
  });

  it("fit a layer: a legal number of stops, every channel in range", () => {
    for (const { id, colors } of NATURE_PALETTES) {
      expect(colors.length, id).toBeGreaterThanOrEqual(MIN_STOPS);
      expect(colors.length, id).toBeLessThanOrEqual(MAX_STOPS);
      for (const channel of colors.flat()) {
        expect(channel, id).toBeGreaterThanOrEqual(0);
        expect(channel, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it("run from dark to light, as the light looks read a palette", () => {
    for (const { id, colors } of NATURE_PALETTES) {
      expect(luma(colors[0]), id).toBeLessThan(0.3);
      expect(luma(colors[colors.length - 1]), id).toBeGreaterThan(luma(colors[0]) + 0.2);
    }
  });

  it("draws a swatch through every stop", () => {
    expect(paletteSwatch([[0, 0, 0], [1, 0.5, 0]])).toBe("linear-gradient(90deg, rgb(0 0 0), rgb(255 128 0))");
  });
});
