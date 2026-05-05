import { describe, expect, it } from "vitest";
import { GradientEngine } from "@wavr/core";
import type { LayerParams } from "@wavr/core";

function layer(imageData: string | null, distortionMapData: string | null): LayerParams {
  return {
    imageData,
    distortionMapData,
  } as LayerParams;
}

function engineHarness() {
  return Object.assign(Object.create(GradientEngine.prototype), {
    lastTextureRefs: [],
    lastTextureCleanupMs: 0,
  }) as GradientEngine;
}

describe("GradientEngine texture cleanup scheduling", () => {
  it("runs when image or distortion map refs change", () => {
    const engine = engineHarness() as unknown as {
      shouldCleanupTextures: (layers: LayerParams[], nowMs: number) => boolean;
    };

    expect(engine.shouldCleanupTextures([layer("image:a", null)], 1000)).toBe(true);
    expect(engine.shouldCleanupTextures([layer("image:a", null)], 1100)).toBe(false);
    expect(engine.shouldCleanupTextures([layer("image:b", null)], 1200)).toBe(true);
    expect(engine.shouldCleanupTextures([layer("image:b", "map:a")], 1300)).toBe(true);
  });

  it("runs periodically even when refs stay the same", () => {
    const engine = engineHarness() as unknown as {
      shouldCleanupTextures: (layers: LayerParams[], nowMs: number) => boolean;
    };
    const layers = [layer("image:a", null)];

    expect(engine.shouldCleanupTextures(layers, 1000)).toBe(true);
    expect(engine.shouldCleanupTextures(layers, 5999)).toBe(false);
    expect(engine.shouldCleanupTextures(layers, 6000)).toBe(true);
  });
});
