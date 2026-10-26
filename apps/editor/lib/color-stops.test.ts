import { describe, expect, it } from "vitest";
import { bakePalette, effectiveBlend } from "@wavr/core";
import {
  barPalette,
  insertStop,
  insertionIndex,
  moveStop,
  nearestSlot,
  reverseStops,
  sameStops,
  stopPosition,
  type Rgb,
} from "./color-stops";

const RED: Rgb = [1, 0, 0];
const GREEN: Rgb = [0, 1, 0];
const BLUE: Rgb = [0, 0, 1];

describe("color stops", () => {
  it("spaces stops evenly, as the palette reads them", () => {
    expect([0, 1, 2, 3].map((i) => stopPosition(i, 4))).toEqual([0, 1 / 3, 2 / 3, 1]);
  });

  it("drags a stop to the nearest slot", () => {
    expect(nearestSlot(0, 4)).toBe(0);
    expect(nearestSlot(0.49, 4)).toBe(1);
    expect(nearestSlot(0.51, 4)).toBe(2);
    expect(nearestSlot(1.2, 4)).toBe(3);
  });

  it("inserts between the stops either side of the click", () => {
    // Three stops at 0, 0.5, 1.
    expect(insertionIndex(0.01, 3)).toBe(1);
    expect(insertionIndex(0.49, 3)).toBe(1);
    expect(insertionIndex(0.51, 3)).toBe(2);
    expect(insertionIndex(0.99, 3)).toBe(2);
    // On a stop it goes after the one before it, never outside the ends.
    expect(insertionIndex(0.5, 3)).toBe(1);
    expect(insertionIndex(0, 3)).toBe(1);
    expect(insertionIndex(1, 3)).toBe(2);
  });

  it("moves, inserts and reverses without touching the input", () => {
    const colors = [RED, GREEN, BLUE];
    expect(moveStop(colors, 0, 2)).toEqual([GREEN, BLUE, RED]);
    expect(moveStop(colors, 2, 0)).toEqual([BLUE, RED, GREEN]);
    expect(insertStop(colors, 1, [0.5, 0.5, 0])).toEqual([RED, [0.5, 0.5, 0], GREEN, BLUE]);
    expect(reverseStops(colors)).toEqual([BLUE, GREEN, RED]);
    expect(colors).toEqual([RED, GREEN, BLUE]);
    expect(moveStop(colors, 0, 1)[1]).not.toBe(colors[0]);
  });

  it("tells a palette that is exactly another from one that differs", () => {
    expect(sameStops([RED, GREEN], [[1, 0, 0], [0, 1, 0]])).toBe(true);
    expect(sameStops([RED, GREEN], [GREEN, RED])).toBe(false);
    expect(sameStops([RED, GREEN], [RED, GREEN, BLUE])).toBe(false);
    expect(sameStops([RED], [[1, 0, 0.001]])).toBe(false);
  });
});

describe("the bar's palette", () => {
  const options = { oklab: false, softness: 0, colorProfile: "srgb" as const };

  it("shows each stop's own colour at its position", () => {
    const palette = barPalette([RED, GREEN, BLUE], options);
    // To within the table's resolution: 0.5 falls between two of its 512 texels.
    const near = (actual: Rgb, expected: Rgb) => actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 3));
    near(palette.sample(0), RED);
    near(palette.sample(0.5), GREEN);
    near(palette.sample(1), BLUE);
  });

  it("is the table the engine bakes, softness and Oklab included", () => {
    const colors = [RED, BLUE];
    const palette = barPalette(colors, { ...options, oklab: true, softness: 0.8 });
    // With blend the table runs past [0, 1]; the bar maps t onto its middle.
    const table = bakePalette(colors, true, effectiveBlend(0.8));
    const middle = palette.sample(0.5);
    expect(middle[0]).toBeCloseTo(table[256 * 4], 2);
    expect(middle[2]).toBeCloseTo(table[256 * 4 + 2], 2);
    // An Oklab blend of red and blue isn't the sRGB average.
    expect(middle).not.toEqual(barPalette(colors, options).sample(0.5));
  });
});
