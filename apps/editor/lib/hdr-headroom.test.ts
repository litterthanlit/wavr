import { describe, expect, it } from "vitest";
import { createLayer } from "@wavr/core";
import { GradientConfig } from "@wavr/schema";
import { useGradientStore } from "./store";
import { configToStorePatch, storeToConfig } from "./url-sync";

describe("HDR headroom in the editor", () => {
  it("starts in standard range", () => {
    expect(useGradientStore.getState().hdrHeadroom).toBe(0);
  });

  it("loads a patch that brings colours without a headroom as standard range, and keeps one that names it", () => {
    const store = useGradientStore;
    store.setState({ hdrHeadroom: 2 });
    store.getState().loadPreset({ colors: [[1, 0, 0], [0, 0, 1]] });
    expect(store.getState().hdrHeadroom).toBe(0);

    store.setState({ hdrHeadroom: 2 });
    store.getState().loadPreset({ layers: [createLayer()] });
    expect(store.getState().hdrHeadroom).toBe(0);

    store.getState().loadPreset({ layers: [createLayer()], hdrHeadroom: 1.5 });
    expect(store.getState().hdrHeadroom).toBe(1.5);

    // An effects-only patch says nothing about the light: the headroom stays.
    store.getState().loadPreset({ grain: 0.2 });
    expect(store.getState().hdrHeadroom).toBe(1.5);
    store.setState({ hdrHeadroom: 0 });
  });

  it("round-trips through the URL config", () => {
    const config = storeToConfig({ ...useGradientStore.getState(), hdrHeadroom: 2.5 });
    expect(config.hdrHeadroom).toBe(2.5);
    expect(GradientConfig.safeParse(config).success).toBe(true);
    expect(configToStorePatch(GradientConfig.parse(config)).hdrHeadroom).toBe(2.5);
    // A URL from before HDR has none, which reads as standard range.
    const withoutHeadroom: Record<string, unknown> = { ...config };
    delete withoutHeadroom.hdrHeadroom;
    expect(configToStorePatch(GradientConfig.parse(withoutHeadroom)).hdrHeadroom).toBe(0);
  });
});
