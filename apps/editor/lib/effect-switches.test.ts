import { describe, expect, it } from "vitest";
import { PRESET_CATALOG } from "@wavr/core/presets";
import { EFFECT_SWITCHES, isSwitchOn, switchPatch } from "./effect-switches";
import { presetToStorePatch } from "./preset-patch";
import { useGradientStore } from "./store";

describe("effect switches", () => {
  it("turns an effect on at its default amount and off at zero", () => {
    expect(switchPatch("grain", true)).toEqual({ grain: 0.03 });
    expect(switchPatch("grain", false)).toEqual({ grain: 0 });
    expect(switchPatch("mouseReact", true)).toEqual({ mouseReact: 0.5 });
    expect(EFFECT_SWITCHES.grain.label).toBe("Grain");
    expect(EFFECT_SWITCHES.mouseReact.label).toBe("Pointer");
  });

  it("reads any positive amount as on", () => {
    expect(isSwitchOn(0.6)).toBe(true);
    expect(isSwitchOn(0)).toBe(false);
  });

  it("restores the scene's own amount through undo", () => {
    const store = useGradientStore;
    const lightLeak = PRESET_CATALOG.find((entry) => entry.id === "lightLeak")!;
    store.getState().loadPreset(presetToStorePatch(lightLeak.config));
    expect(store.getState().grain).toBe(0.6);
    store.getState().setDiscrete(switchPatch("grain", false));
    store.getState().setDiscrete(switchPatch("grain", true));
    expect(store.getState().grain).toBe(0.03);
    store.getState().undo();
    store.getState().undo();
    expect(store.getState().grain).toBe(0.6);
  });
});
