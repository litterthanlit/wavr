import { describe, expect, it } from "vitest";
import { createLayer, resolveConfig } from "@wavr/core";
import { halo } from "@wavr/core/presets";

describe("resolveConfig", () => {
  it("treats preset layers as visible when the flag is omitted", () => {
    const state = resolveConfig(halo);
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0]?.visible).toBe(true);
  });

  it("keeps an explicit hidden layer hidden", () => {
    const layer = createLayer({ gradientType: "mesh", visible: false });
    expect(layer.visible).toBe(false);
  });
});
