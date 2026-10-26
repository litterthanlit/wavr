import { describe, expect, it } from "vitest";
import { createLayer, resolveConfig, type GradientConfig } from "@wavr/core";
import { halo } from "@wavr/core/presets";

describe("resolveConfig", () => {
  it("treats preset layers as visible when the flag is omitted", () => {
    const state = resolveConfig(halo);
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]?.visible).toBe(true);
  });

  it("draws a layer naming a retired gradient type as lightWall, with its colours", () => {
    const colors: [number, number, number][] = [[0.1, 0.2, 0.9], [0.9, 0.3, 0.2]];
    // As a page or an old wavr.config.ts may still pass it to @wavr/gradient.
    const config = JSON.parse(JSON.stringify({ layers: [{ type: "mesh", colors, speed: 0.6 }] })) as GradientConfig;
    expect(resolveConfig(config).layers[0]).toMatchObject({ gradientType: "lightWall", colors, speed: 0.6 });
  });

  it("keeps an explicit hidden layer hidden", () => {
    const layer = createLayer({ gradientType: "mesh", visible: false });
    expect(layer.visible).toBe(false);
  });
});
