import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GradientEngine, PALETTE_SIZE, bakePalette, createLayer, effectiveBlend, resolveConfig } from "@wavr/core";
import type { EngineState } from "@wavr/core";
import { createFakeGL } from "./test-utils/fake-webgl";

const globals = globalThis as Record<string, unknown>;
const saved = { Image: globals.Image, ImageData: globals.ImageData };

beforeAll(() => {
  // Node has neither. The picture loads as soon as it is given a source.
  globals.Image = class {
    onload: (() => void) | null = null;
    width = 4;
    height = 4;
    set src(_value: string) {
      this.onload?.();
    }
  };
  globals.ImageData = class {
    colorSpace: string;
    constructor(public data: Uint8ClampedArray, public width: number, public height: number, settings?: { colorSpace?: string }) {
      this.colorSpace = settings?.colorSpace ?? "srgb";
    }
  };
});

afterAll(() => {
  globals.Image = saved.Image;
  globals.ImageData = saved.ImageData;
});

const COLORS: [number, number, number][] = [[0.1, 0.2, 0.9], [0.9, 0.3, 0.2], [0.2, 0.85, 0.9]];

function state(overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "lightWall", colors: COLORS }] });
  return { ...base, layers: [createLayer({ gradientType: "lightWall", colors: COLORS })], ...overrides };
}

function setup() {
  const fake = createFakeGL();
  const engine = new GradientEngine(fake.canvas, {});
  return { engine, ...fake };
}

describe("GradientEngine colour profile", () => {
  it("presents the canvas in the scene's profile", () => {
    const { engine, context } = setup();
    engine.render(state());
    expect(context.drawingBufferColorSpace).toBe("srgb");
    engine.render(state({ colorProfile: "display-p3" }));
    expect(context.drawingBufferColorSpace).toBe("display-p3");
    engine.render(state());
    expect(context.drawingBufferColorSpace).toBe("srgb");
  });

  it("leaves a browser without drawingBufferColorSpace as it is", () => {
    const { engine, context } = setup();
    delete context.drawingBufferColorSpace;
    expect(engine.render(state({ colorProfile: "display-p3" }))).toBe(true);
    expect("drawingBufferColorSpace" in context).toBe(false);
  });

  it("hands the light fields their raw stops, the values themselves whatever the profile", () => {
    const { engine, draws } = setup();
    engine.render(state({ colorProfile: "display-p3" }));
    const [layerPass] = draws;
    COLORS.forEach((color, i) => expect(layerPass.uniforms[`u_colors[${i}]`]).toEqual(color));
  });

  it("bakes the palette in the scene's profile, and again when the profile changes", () => {
    const { engine, uploads } = setup();
    const halo = createLayer({ gradientType: "halo", colors: COLORS });
    const blend = effectiveBlend(0, halo.softness);
    const palettes = () => uploads.filter((u) => u.format === "RGBA16F" && u.width === PALETTE_SIZE && u.height === 1);

    engine.render(state({ layers: [halo], colorProfile: "display-p3" }));
    expect(palettes().at(-1)?.data).toEqual(Array.from(bakePalette(COLORS, true, blend, undefined, true)));

    engine.render(state({ layers: [halo], colorProfile: "display-p3" }));
    expect(palettes()).toHaveLength(1);

    engine.render(state({ layers: [halo] }));
    expect(palettes()).toHaveLength(2);
    expect(palettes().at(-1)?.data).toEqual(Array.from(bakePalette(COLORS, true, blend)));
  });

  it("converts a picture into the scene's profile on upload, but never a distortion map", () => {
    const { engine, imageUploads, context } = setup();
    const layer = createLayer({
      gradientType: "lightWall",
      colors: COLORS,
      imageData: "data:image/png;base64,picture",
      distortionMapData: "data:image/png;base64,map",
      distortionMapEnabled: true,
    });

    engine.render(state({ layers: [layer], colorProfile: "display-p3" }));
    expect(imageUploads.map((u) => u.unpackColorSpace)).toEqual(["display-p3", "srgb"]);
    expect(context.unpackColorSpace).toBe("srgb");

    // Back in sRGB the picture is uploaded again, as sRGB; the map is reused.
    engine.render(state({ layers: [layer] }));
    expect(imageUploads.map((u) => u.unpackColorSpace)).toEqual(["display-p3", "srgb", "srgb"]);
    engine.render(state({ layers: [layer] }));
    expect(imageUploads).toHaveLength(3);
  });

  it("tags a capture with the scene's profile", () => {
    const { engine } = setup();
    engine.render(state({ colorProfile: "display-p3" }));
    expect(engine.captureImageData()?.colorSpace).toBe("display-p3");
    expect(engine.captureImageData({ state: state() })?.colorSpace).toBe("srgb");
  });
});
