import { describe, expect, it } from "vitest";
import { createLayer, displayP3ToSrgb } from "@wavr/core";
import { GradientConfig } from "@wavr/schema";
import { cssColor } from "./css-color";
import { exportCSS } from "./export";
import { useGradientStore } from "./store";
import { configToStorePatch, storeToConfig } from "./url-sync";

const P3_COLORS: [number, number, number][] = [[0.1, 0.45, 0.95], [0.2, 0.85, 0.9]];

describe("colour profile in the editor", () => {
  it("loads a patch that brings colours without a profile as sRGB, and keeps one that names it", () => {
    const store = useGradientStore;
    store.setState({ colorProfile: "display-p3" });
    store.getState().loadPreset({ colors: P3_COLORS });
    expect(store.getState().colorProfile).toBe("srgb");

    store.setState({ colorProfile: "display-p3" });
    store.getState().loadPreset({ layers: [createLayer({ colors: P3_COLORS })] });
    expect(store.getState().colorProfile).toBe("srgb");

    store.getState().loadPreset({ colors: P3_COLORS, colorProfile: "display-p3" });
    expect(store.getState().colorProfile).toBe("display-p3");

    // An effects-only patch says nothing about the colours: the profile stays.
    store.getState().loadPreset({ grain: 0.2 });
    expect(store.getState().colorProfile).toBe("display-p3");
    store.setState({ colorProfile: "srgb" });
  });

  it("round-trips through the URL config", () => {
    const state = { ...useGradientStore.getState(), colorProfile: "display-p3" as const };
    const config = storeToConfig(state);
    expect(config.colorProfile).toBe("display-p3");
    expect(GradientConfig.safeParse(config).success).toBe(true);
    expect(configToStorePatch(GradientConfig.parse(config)).colorProfile).toBe("display-p3");
  });

  it("paints swatches as the canvas does", () => {
    expect(cssColor([1, 0.5, 0])).toBe("#ff8000");
    expect(cssColor([1, 0.5, 0], "display-p3")).toBe("color(display-p3 1 0.5 0)");
    expect(cssColor([0.12345, 0, 1.2], "display-p3")).toBe("color(display-p3 0.1235 0 1)");
  });

  it("writes CSS with an sRGB fallback before the P3 gradient", () => {
    const srgb = exportCSS(P3_COLORS);
    expect(srgb.match(/background: /g)).toHaveLength(1);
    expect(srgb).not.toContain("display-p3");

    const p3 = exportCSS(P3_COLORS, undefined, "display-p3");
    const lines = p3.split("\n").filter((line) => line.trim().startsWith("background: "));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(cssColor(displayP3ToSrgb(P3_COLORS[0])));
    expect(lines[1]).toContain(cssColor(P3_COLORS[0], "display-p3"));
  });
});
