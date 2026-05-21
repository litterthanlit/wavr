import { describe, expect, it } from "vitest";
import {
  EFFECT_DEFINITIONS,
  EFFECT_REGISTRY,
  defaultParamsForEffect,
  getEffectDefinition,
  listAnimatableEffectPaths,
} from "../src";

describe("effect registry", () => {
  it("defines the current global effects once with pass and property metadata", () => {
    expect(EFFECT_DEFINITIONS.length).toBeGreaterThanOrEqual(20);
    expect(EFFECT_REGISTRY.glow).toMatchObject({
      id: "glow",
      category: "light",
      passType: "single-pass",
    });
    expect(EFFECT_REGISTRY.realBloom).toMatchObject({
      id: "realBloom",
      passType: "multi-pass",
    });
    expect(EFFECT_REGISTRY.trail).toMatchObject({
      id: "trail",
      passType: "feedback",
    });
  });

  it("exposes defaults and animatable property paths for generated UI/timeline work", () => {
    expect(defaultParamsForEffect("glow")).toEqual({
      enabled: false,
      intensity: 0.5,
      radius: 0.05,
    });
    expect(listAnimatableEffectPaths("glow")).toEqual([
      "effects.glow.params.intensity",
      "effects.glow.params.radius",
    ]);
    expect(getEffectDefinition("glow").properties.map((property) => property.path)).toEqual([
      "params.enabled",
      "params.intensity",
      "params.radius",
    ]);
  });
});
