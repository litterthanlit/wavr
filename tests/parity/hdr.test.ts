import { test, expect } from "@playwright/test";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { GradientConfig } from "@wavr/schema";
import type { HdrRun } from "./pages/hdr";

// The HDR output end to end, on SwiftShader: the engine draws a live frame with
// light above white, packs it into two 8-bit frames, WebGPU decodes them onto
// an extended-range canvas, and the page reads that canvas back as half floats.
// Compared with a standard-range capture of the same frame:
//   - at no headroom the HDR canvas holds the standard frame (12 bits against 8);
//   - at two stops the light field's light is four times brighter in linear
//     light, its wall is unchanged, and nothing passes the peak.
// Skipped (not failed) only where the browser has no WebGPU adapter at all.

test.use({
  launchOptions: {
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      // WebGPU on SwiftShader's Vulkan: with the default backend, presenting a
      // WebGPU canvas loses the device (and the WebGL context with it).
      "--enable-unsafe-webgpu",
      "--enable-features=Vulkan",
      "--use-vulkan=swiftshader",
      "--use-webgpu-adapter=swiftshader",
    ],
  },
});

const PAGE_URL = pathToFileURL(path.resolve(__dirname, "pages/hdr.html")).toString();

// An aperture with no haze (distortion 0): light over a wall, nothing mixed in
// display values, no grain, deband, bloom or tone map to blur the comparison.
const APERTURE = (colorProfile: "srgb" | "display-p3" = "srgb"): GradientConfig => ({
  version: "2.0.0",
  colorSpace: "linear",
  colorProfile,
  toneMapMode: 0,
  grain: 0,
  deband: { enabled: false, strength: 1 },
  layers: [{
    type: "aperture",
    colors: [[0.3, 0.32, 0.36], [0.98, 0.9, 0.95], [0.85, 0.35, 0.75], [0.35, 0.45, 1]],
    speed: 0.3,
    complexity: 2,
    scale: 1.15,
    distortion: 0,
    softness: 0.9,
    opacity: 1,
    blendMode: "normal",
    depth: 0,
  }],
} as GradientConfig);

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

test.describe("HDR output", () => {
  let render: (config: GradientConfig, headroom: number) => Promise<HdrRun>;
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(PAGE_URL);
    render = (config, headroom) => page.evaluate(([c, h]) => window.__wavrHdr(c, h), [config, headroom] as const);
  });

  test.afterEach(() => {
    expect(pageErrors).toEqual([]);
  });

  test("holds the standard frame at no headroom, in either profile", async () => {
    for (const profile of ["srgb", "display-p3"] as const) {
      const result = await render(APERTURE(profile), 0);
      test.skip(result.unsupported === true, "this browser has no WebGPU adapter");
      let maxDiff = 0;
      for (let i = 0; i < result.sdr.length; i++) {
        maxDiff = Math.max(maxDiff, Math.abs(result.hdr[i] - result.sdr[i] / 255));
      }
      expect(maxDiff, `${profile}: largest difference, in 8-bit levels`).toBeLessThanOrEqual(1 / 255);
    }
  });

  test("shines the light four times brighter at two stops, and leaves the wall as it is", async () => {
    const result = await render(APERTURE(), 2);
    test.skip(result.unsupported === true, "this browser has no WebGPU adapter");
    const { sdr, hdr, width, height } = result;
    const peak = 1.055 * Math.pow(4, 1 / 2.4) - 0.055;

    let brightest = 0;
    let alphaDiff = 0;
    const ratios: number[] = [];
    let wallDiff = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) brightest = Math.max(brightest, hdr[i + c]);
        alphaDiff = Math.max(alphaDiff, Math.abs(hdr[i + 3] - 1));
        const sdrLinear = [0, 1, 2].map((c) => toLinear(sdr[i + c] / 255));
        const hdrLinear = [0, 1, 2].map((c) => toLinear(hdr[i + c]));
        // Inside the opening: well lit in the standard frame.
        if (Math.max(...sdrLinear) > 0.3) {
          for (let c = 0; c < 3; c++) if (sdrLinear[c] > 0.05) ratios.push(hdrLinear[c] / sdrLinear[c]);
        }
        // The frame's corners are wall.
        if ((x < 4 || x >= width - 4) && (y < 4 || y >= height - 4)) {
          for (let c = 0; c < 3; c++) wallDiff = Math.max(wallDiff, Math.abs(hdr[i + c] - sdr[i + c] / 255));
        }
      }
    }
    const median = ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
    console.log(`HDR at two stops: brightest ${brightest.toFixed(3)} (peak ${peak.toFixed(3)}), light ${median.toFixed(3)}x over ${ratios.length} samples, wall within ${(wallDiff * 255).toFixed(2)} levels`);
    expect(brightest, "some light is brighter than white").toBeGreaterThan(1.3);
    expect(brightest, "nothing past the peak").toBeLessThanOrEqual(peak + 1e-3);
    expect(alphaDiff, "opaque").toBeLessThan(1e-3);
    expect(wallDiff, "the wall, in 8-bit levels").toBeLessThanOrEqual(1 / 255);
    expect(ratios.length).toBeGreaterThan(200);
    expect(median, "median brightening of the light").toBeCloseTo(4, 1);
    const within = ratios.filter((r) => Math.abs(r / 4 - 1) < 0.1).length / ratios.length;
    expect(within, "share of the opening within 10% of four times").toBeGreaterThan(0.9);
  });
});
