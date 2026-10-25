import { beforeAll, describe, expect, it } from "vitest";
import { GradientEngine, createLayer, displayPeak, hdrPeak, resolveConfig } from "@wavr/core";
import type { ColorProfile, EngineState, HdrOutput } from "@wavr/core";
import { createFakeGL, type DrawRecord, type FakeGLOptions } from "./test-utils/fake-webgl";

beforeAll(() => {
  // Node has no ImageData; the engine only needs the constructor.
  if (typeof ImageData === "undefined") {
    (globalThis as Record<string, unknown>).ImageData = class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
  }
});

function state(overrides: Partial<EngineState> = {}): EngineState {
  const base = resolveConfig({ layers: [{ type: "aperture", colors: [[0.2, 0.2, 0.25], [0.4, 0.5, 1]] }] });
  return { ...base, layers: [createLayer({ gradientType: "aperture" })], ...overrides };
}

type OutputCall =
  | { kind: "copy"; tile: 0 | 1; drawsSoFar: number; colorSpace: unknown }
  | { kind: "present"; range: number; profile: ColorProfile };

function setup(options: FakeGLOptions = { floatTargets: true }) {
  const fake = createFakeGL(options);
  const engine = new GradientEngine(fake.canvas, {});
  const calls: OutputCall[] = [];
  const output: HdrOutput = {
    copyTile: (_source, tile) => {
      calls.push({ kind: "copy", tile, drawsSoFar: fake.draws.length, colorSpace: fake.context.drawingBufferColorSpace });
    },
    present: (range, profile) => {
      calls.push({ kind: "present", range, profile });
    },
  };
  const isPack = (draw: DrawRecord) => fake.programOf(draw)?.fragmentSource.includes("u_tile") ?? false;
  return { engine, output, calls, isPack, ...fake };
}

describe("GradientEngine HDR output", () => {
  it("draws a live frame into a half-float target and packs it onto the canvas as two tiles for the output", () => {
    const { engine, output, calls, draws, isPack, attachments, textureFormats, context, feedbackLoops } = setup();
    engine.setHdrOutput(output);
    calls.length = 0;
    draws.length = 0;
    engine.render(state({ hdrHeadroom: 2, colorProfile: "display-p3" }));

    const [layer, post, tile0, tile1] = draws;
    expect(draws).toHaveLength(4);
    expect(layer.uniforms.u_hdrPeak).toBe(4);
    expect(post.uniforms.u_hdrPeak).toBe(4);
    // The post pass writes the HDR target, not the canvas.
    expect(post.target).not.toBeNull();
    const frame = attachments.get(post.target!)!;
    expect(textureFormats.get(frame)).toBe("RGBA16F");

    // Then the pack pass, twice onto the canvas, reading that frame.
    for (const [tile, draw] of [tile0, tile1].entries()) {
      expect(isPack(draw)).toBe(true);
      expect(draw.target).toBeNull();
      expect(draw.uniforms.u_tile).toBe(tile);
      expect(draw.uniforms.u_range).toBeCloseTo(displayPeak(4), 6);
      expect(draw.boundTextures.get(0)).toBe(frame);
    }
    // Each tile is taken right after it is drawn, with the canvas holding data, not colour.
    expect(calls).toEqual([
      { kind: "copy", tile: 0, drawsSoFar: 3, colorSpace: "srgb" },
      { kind: "copy", tile: 1, drawsSoFar: 4, colorSpace: "srgb" },
      { kind: "present", range: displayPeak(4), profile: "display-p3" },
    ]);
    expect(context.drawingBufferColorSpace).toBe("srgb");
    expect(engine.isPresentingHdr()).toBe(true);
    expect(feedbackLoops).toEqual([]);
  });

  it("goes through the output at the white peak when the scene asks for no headroom", () => {
    const { engine, output, calls, draws } = setup();
    engine.setHdrOutput(output);
    draws.length = 0;
    calls.length = 0;
    engine.render(state({ hdrHeadroom: 0 }));
    expect(draws[0].uniforms.u_hdrPeak).toBe(1);
    expect(draws[2].uniforms.u_range).toBe(1);
    expect(calls.at(-1)).toEqual({ kind: "present", range: 1, profile: "srgb" });
  });

  it("caps the headroom at three stops", () => {
    expect(hdrPeak(5)).toBe(8);
    expect(hdrPeak(-1)).toBe(1);
    const { engine, output, draws } = setup();
    engine.setHdrOutput(output);
    draws.length = 0;
    engine.render(state({ hdrHeadroom: 3 }));
    expect(draws[0].uniforms.u_hdrPeak).toBe(8);
  });

  it("stays at the white peak without half-float targets, which can't carry light above it", () => {
    const { engine, output, calls, draws } = setup({});
    engine.setHdrOutput(output);
    draws.length = 0;
    engine.render(state({ hdrHeadroom: 2 }));
    expect(draws[0].uniforms.u_hdrPeak).toBe(1);
    expect(calls.at(-1)).toMatchObject({ kind: "present", range: 1 });
  });

  it("draws the last state again at once when the output is attached or detached", () => {
    const { engine, output, calls, draws, deletedTextures, attachments, context } = setup();
    engine.render(state({ hdrHeadroom: 1, colorProfile: "display-p3" }));
    expect(context.drawingBufferColorSpace).toBe("display-p3");
    expect(draws.at(-1)?.target).toBeNull();

    engine.setHdrOutput(output);
    expect(calls.at(-1)).toMatchObject({ kind: "present", profile: "display-p3" });
    const hdrTarget = draws[draws.length - 3].target!;
    const frame = attachments.get(hdrTarget)!;

    draws.length = 0;
    engine.setHdrOutput(null);
    // Back on the canvas, in the scene's profile, at the white peak; the HDR target is gone.
    expect(draws).toHaveLength(2);
    expect(draws[1].target).toBeNull();
    expect(draws[1].uniforms.u_hdrPeak).toBe(1);
    expect(context.drawingBufferColorSpace).toBe("display-p3");
    expect(deletedTextures).toContain(frame);
    expect(engine.isPresentingHdr()).toBe(false);
  });

  it("keeps captures standard range and off the output", () => {
    const { engine, output, calls, draws, isPack } = setup();
    engine.setHdrOutput(output);
    engine.render(state({ hdrHeadroom: 2 }));
    calls.length = 0;
    draws.length = 0;

    const frame = engine.captureImageData({ state: state({ hdrHeadroom: 2 }) });
    expect(frame).not.toBeNull();
    expect(calls).toEqual([]);
    expect(draws.some(isPack)).toBe(false);
    expect(draws.every((draw) => draw.uniforms.u_hdrPeak === undefined || draw.uniforms.u_hdrPeak === 1)).toBe(true);
    // And the live frames still go to the output.
    expect(engine.isPresentingHdr()).toBe(true);
  });

  it("carries the light above white through the feedback loop and packs the feedback target", () => {
    const { engine, output, draws, isPack, attachments, textureFormats, feedbackLoops } = setup();
    engine.setHdrOutput(output);
    draws.length = 0;
    engine.render(state({ hdrHeadroom: 2, feedbackEnabled: true }));
    const post = draws[1];
    const feedbackTexture = attachments.get(post.target!)!;
    expect(textureFormats.get(feedbackTexture)).toBe("RGBA16F");
    const packs = draws.filter(isPack);
    expect(packs).toHaveLength(2);
    expect(packs.every((draw) => draw.boundTextures.get(0) === feedbackTexture)).toBe(true);
    expect(feedbackLoops).toEqual([]);
  });

  it("raises the cinematic bloom's threshold with the peak, so light that much brighter glares that much brighter", () => {
    const { engine, output, draws, programOf } = setup();
    engine.setHdrOutput(output);
    draws.length = 0;
    engine.render(state({ hdrHeadroom: 2, realBloomEnabled: true }));
    const firstDown = draws.find((draw) => programOf(draw)?.fragmentSource.includes("u_threshold"));
    expect(firstDown?.uniforms.u_threshold).toBeCloseTo(0.3 * 4, 6);
  });
});
