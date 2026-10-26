import { describe, expect, it } from "vitest";
import { aperture } from "@wavr/core/presets";
import { INITIAL_EFFECTS, INITIAL_LAYER_PARAMS } from "./initial-scene";
import { useGradientStore } from "./store";

describe("initial scene", () => {
  it("is the Aperture preset, layer and effects", () => {
    const [layer] = aperture.layers;
    expect(INITIAL_LAYER_PARAMS).toEqual({
      gradientType: layer.type,
      colors: layer.colors,
      speed: layer.speed,
      complexity: layer.complexity,
      scale: layer.scale,
      distortion: layer.distortion,
      softness: layer.softness,
    });
    expect(INITIAL_EFFECTS).toEqual({
      grain: aperture.grain,
      toneMapMode: aperture.toneMapMode,
      realBloomEnabled: aperture.realBloomEnabled,
      colorProfile: aperture.colorProfile,
      hdrHeadroom: aperture.hdrHeadroom,
    });
  });

  it("is what the store starts on", () => {
    const state = useGradientStore.getState();
    expect(state.layers).toHaveLength(1);
    expect(state.layers[0].gradientType).toBe("aperture");
    expect(state.layers[0].colors).toEqual(INITIAL_LAYER_PARAMS.colors);
    expect(state.layers[0].softness).toBe(INITIAL_LAYER_PARAMS.softness);
    expect(state.grain).toBe(INITIAL_EFFECTS.grain);
    expect(state.toneMapMode).toBe(INITIAL_EFFECTS.toneMapMode);
    expect(state.realBloomEnabled).toBe(INITIAL_EFFECTS.realBloomEnabled);
    expect(state.colorProfile).toBe("display-p3");
    expect(state.hdrHeadroom).toBe(1.5);
  });
});
