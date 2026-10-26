import { describe, expect, it } from "vitest";
import { aurora, sunset } from "@wavr/core/presets";
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
    const next = patchActiveLayer(aurora, { type: "plasma", speed: 0.9 });
    expect(aurora.layers[0]?.type).toBe("aurora");
    expect(next.layers[0]?.type).toBe("plasma");
    expect(next.layers[0]?.speed).toBe(0.9);
  });

  it("clones configs", () => {
    const original = sunset.grain;
    const copy = cloneConfig(sunset);
    copy.grain = 1;
    expect(copy.grain).toBe(1);
    expect(sunset.grain).toBe(original);
  });

  it("formats a react snippet", () => {
    const snippet = formatReactSnippet(aurora);
    expect(snippet).toContain('import { WavrGradient } from "@wavr/gradient"');
    expect(snippet).toContain('"aurora"');
  });

  it("resolves named presets", () => {
    expect(getPreset("ocean")?.layers[0]?.type).toBe("silk");
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
  it("offers no archived preset, but still resolves one by id", async () => {
    const { PRESET_CATALOG } = await import("@wavr/core/presets");
    const { PRESET_OPTIONS } = await import("../src/presets");
    const archived = new Set(PRESET_CATALOG.filter((entry) => entry.category === "archive").map((entry) => entry.id));
    expect(PRESET_OPTIONS.filter((option) => archived.has(option.id))).toEqual([]);
    expect(PRESET_OPTIONS.every((option) => getPreset(option.id))).toBe(true);
    expect(getPreset("vaporwave")).toBeDefined();
  });
});
