import { describe, expect, it } from "vitest";
import { defaultFormat, degrees, em, fixed, fps, hdrPeakLabel, percent, px, radiansAsDegrees, stepDecimals, times } from "./units";

describe("slider value formats", () => {
  it("shows a 0–1 amount as a percentage of itself, not of its range", () => {
    expect(defaultFormat(0, 1, 0.01)(0.3)).toBe("30%");
    // A range inside 0–1 still reads as the amount: a trail length of 0.96 is 96%.
    expect(defaultFormat(0.9, 0.99, 0.01)(0.96)).toBe("96%");
    expect(defaultFormat(0, 0.5, 0.01)(0.25)).toBe("25%");
  });

  it("shows anything else as the number at its step's precision", () => {
    expect(defaultFormat(1, 8, 1)(3)).toBe("3");
    expect(defaultFormat(-1, 1, 0.01)(-0.25)).toBe("-0.25");
    expect(defaultFormat(0, 2, 0.1)(1)).toBe("1.0");
    // A quantity inside 0–1 that isn't a share takes fixed() instead.
    expect(fixed(3)(0.02)).toBe("0.020");
    expect([1, 0.5, 0.25, 0.1, 0.05, 0.01, 0.005, 0.001].map(stepDecimals)).toEqual([0, 1, 1, 1, 2, 2, 3, 3]);
  });

  it("names its unit where there is one", () => {
    expect(percent(1.5)).toBe("150%");
    expect(times(0.4)).toBe("0.40×");
    expect(degrees(179.6)).toBe("180°");
    expect(radiansAsDegrees(Math.PI / 2)).toBe("90°");
    expect(px(4)).toBe("4 px");
    expect(px(4.5)).toBe("4.5 px");
    expect(em(0.05)).toBe("0.05 em");
    expect(fps(60)).toBe("60 fps");
  });

  it("shows HDR headroom as how much brighter than white light shines", () => {
    expect(hdrPeakLabel(0)).toBe("Off");
    expect(hdrPeakLabel(1)).toBe("2×");
    expect(hdrPeakLabel(1.5)).toBe("2.8×");
    expect(hdrPeakLabel(3)).toBe("8×");
  });
});
