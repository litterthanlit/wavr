import { describe, expect, it } from "vitest";
import { estimateTextureBytes, summarizeGpuResources } from "@wavr/core";

describe("core instrumentation helpers", () => {
  it("estimates RGBA texture memory", () => {
    expect(estimateTextureBytes(1920, 1080)).toBe(8_294_400);
    expect(estimateTextureBytes(1920, 1080, 2)).toBe(16_588_800);
  });

  it("summarizes framebuffer and texture resources", () => {
    expect(summarizeGpuResources([
      { kind: "framebuffer", count: 2 },
      { kind: "texture", width: 100, height: 50, count: 3 },
    ])).toEqual({
      framebufferCount: 2,
      textureCount: 3,
      estimatedBytes: 60_000,
    });
  });
});
