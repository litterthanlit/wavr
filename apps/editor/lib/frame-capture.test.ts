import { describe, expect, it } from "vitest";
import { flipRowsRGBA } from "@wavr/core";
import { snapshotFrame } from "./export";

describe("flipRowsRGBA", () => {
  it("reverses row order so readPixels output becomes top-down", () => {
    // 2x3 image; each pixel's red channel encodes its row index.
    const width = 2;
    const height = 3;
    const bottomUp = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        bottomUp.set([y, x, 0, 255], i);
      }
    }

    const topDown = flipRowsRGBA(bottomUp, width, height);

    expect(topDown).toBeInstanceOf(Uint8ClampedArray);
    expect(Array.from(topDown.subarray(0, 8))).toEqual([2, 0, 0, 255, 2, 1, 0, 255]);
    expect(Array.from(topDown.subarray(8, 16))).toEqual([1, 0, 0, 255, 1, 1, 0, 255]);
    expect(Array.from(topDown.subarray(16, 24))).toEqual([0, 0, 0, 255, 0, 1, 0, 255]);
  });

  it("does not mutate the input", () => {
    const input = new Uint8Array([1, 1, 1, 1, 2, 2, 2, 2]);
    flipRowsRGBA(input, 1, 2);
    expect(Array.from(input)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });
});

describe("snapshotFrame", () => {
  it("returns null before the engine has rendered a frame", () => {
    expect(
      snapshotFrame({ captureImageData: () => null, getElapsedTime: () => 0, getMaxCaptureSize: () => 4096 }),
    ).toBeNull();
  });
});
