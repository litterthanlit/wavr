import { describe, expect, it } from "vitest";
import { PaletteLookup, buildPalette, encodeGif, indexFrame } from "./gif";
import { decodeGif } from "./test-utils/gif-decode";

function noiseFrame(width: number, height: number, seed: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4);
  let s = seed;
  for (let i = 0; i < px.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    px[i] = (s >>> 16) & 255;
  }
  return px;
}

function gradientFrame(width: number, height: number, phase: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const t = 0.5 + 0.5 * Math.sin(x / width * 3 + y / height * 2 + phase);
      px[i] = 30 + 220 * t;
      px[i + 1] = 20 + 60 * t;
      px[i + 2] = 90 + 60 * (1 - t);
      px[i + 3] = 255;
    }
  }
  return px;
}

function expectedIndices(frames: Uint8ClampedArray[], width: number, height: number) {
  const lookup = new PaletteLookup(buildPalette(frames));
  return frames.map((frame) => indexFrame(frame, width, height, lookup));
}

describe("encodeGif", () => {
  it("round-trips every frame's palette indices exactly", () => {
    // Odd sizes and noise push the LZW table through many resets and all code widths.
    const cases: [number, number, Uint8ClampedArray[]][] = [
      [257, 131, [noiseFrame(257, 131, 1), noiseFrame(257, 131, 2), noiseFrame(257, 131, 3)]],
      [160, 90, Array.from({ length: 5 }, (_, f) => gradientFrame(160, 90, f * 0.4))],
      [1, 1, [new Uint8ClampedArray([10, 200, 30, 255])]],
    ];
    for (const [width, height, frames] of cases) {
      const decoded = decodeGif(encodeGif({ width, height, frames, delayCs: 8 }));
      expect(decoded.width).toBe(width);
      expect(decoded.height).toBe(height);
      expect(decoded.frames).toEqual(expectedIndices(frames, width, height));
    }
  });

  it("writes a looping animation with the requested delay", () => {
    const frames = [gradientFrame(8, 8, 0), gradientFrame(8, 8, 1)];
    const decoded = decodeGif(encodeGif({ width: 8, height: 8, frames, delayCs: 7 }));
    expect(decoded.loopCount).toBe(0); // 0 = forever
    expect(decoded.delaysCs).toEqual([7, 7]);
    expect(decoded.frames).toHaveLength(2);
  });

  it("reports progress per frame", () => {
    const progress: number[] = [];
    const frames = [gradientFrame(4, 4, 0), gradientFrame(4, 4, 1), gradientFrame(4, 4, 2)];
    encodeGif({ width: 4, height: 4, frames, delayCs: 8, onProgress: (p) => progress.push(p) });
    expect(progress).toEqual([1 / 3, 2 / 3, 1]);
  });

  it("stays close to smooth gradients (no hard banding)", () => {
    const width = 240;
    const height = 135;
    const frames = [gradientFrame(width, height, 0)];
    const decoded = decodeGif(encodeGif({ width, height, frames, delayCs: 8 }));
    const indices = decoded.frames[0];
    let error = 0;
    for (let p = 0; p < indices.length; p++) {
      for (let c = 0; c < 3; c++) {
        error += Math.abs(decoded.palette[indices[p] * 3 + c] - frames[0][p * 4 + c]);
      }
    }
    // The previous fixed 6×7×6 palette averaged ~11 on gradients like this.
    expect(error / (indices.length * 3)).toBeLessThan(4);
  });
});

describe("buildPalette", () => {
  it("reproduces a small set of colours exactly", () => {
    // Colours at histogram bin centres (6 bits per channel → 4k + 2).
    const colours = [
      [2, 2, 2],
      [254, 254, 254],
      [130, 66, 198],
    ];
    const frame = new Uint8ClampedArray(colours.flatMap((c) => [...c, 255]));
    const palette = buildPalette([frame]);
    const entries = Array.from({ length: 3 }, (_, i) => Array.from(palette.subarray(i * 3, i * 3 + 3)));
    expect(entries).toEqual(expect.arrayContaining(colours));
  });
});
