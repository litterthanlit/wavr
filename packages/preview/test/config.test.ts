import { describe, expect, it } from "vitest";
import { halo, inkSmoke } from "@wavr/core/presets";
import {
  cloneConfig,
  formatReactSnippet,
  hexToRgb,
  padColors,
  patchActiveLayer,
  rgbToHex,
  shouldShowEditor,
} from "../src/config";
import { getPreset } from "../src/presets";

describe("config helpers", () => {
  it("converts rgb and hex round-trip", () => {
    expect(rgbToHex([1, 0, 0])).toBe("#ff0000");
    expect(hexToRgb("#00ff00")).toEqual([0, 1, 0]);
    expect(hexToRgb("#fff")).toEqual([1, 1, 1]);
  });

  it("pads colors to four stops", () => {
    expect(padColors([[1, 0, 0]])).toHaveLength(4);
    expect(padColors(undefined)[0]).toEqual([0, 0, 0]);
  });

  it("patches the active layer without mutating the original", () => {
    const next = patchActiveLayer(halo, { type: "plasmaOrb", speed: 0.9 });
    expect(halo.layers[0]?.type).toBe("halo");
    expect(next.layers[0]?.type).toBe("plasmaOrb");
    expect(next.layers[0]?.speed).toBe(0.9);
  });

  it("clones configs", () => {
    const original = inkSmoke.grain;
    const copy = cloneConfig(inkSmoke);
    copy.grain = 1;
    expect(copy.grain).toBe(1);
    expect(inkSmoke.grain).toBe(original);
  });

  it("formats a react snippet", () => {
    const snippet = formatReactSnippet(halo);
    expect(snippet).toContain('import { WavrGradient } from "@wavr/gradient"');
    expect(snippet).toContain('"halo"');
  });

  it("resolves named presets", () => {
    expect(getPreset("roseSmoke")?.layers[0]?.type).toBe("inkSmoke");
  });

  it("honors editor query overrides", () => {
    window.history.replaceState({}, "", "/?editor=1");
    expect(shouldShowEditor(false)).toBe(true);
    window.history.replaceState({}, "", "/?editor=0");
    expect(shouldShowEditor(true)).toBe(false);
    window.history.replaceState({}, "", "/");
    expect(shouldShowEditor(false)).toBe(false);
    expect(shouldShowEditor(true)).toBe(true);
  });
});

describe("preset options", () => {
  it("offers only presets that resolve", async () => {
    const { PRESET_OPTIONS } = await import("../src/presets");
    expect(PRESET_OPTIONS.every((option) => getPreset(option.id))).toBe(true);
  });
});
