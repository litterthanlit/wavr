import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  GradientConfig,
  compileRenderPlan,
  sceneDocumentFromGradientConfig,
} from "../src";

describe("compileRenderPlan", () => {
  it("turns layers and single-pass effects into explicit render passes", () => {
    const config = GradientConfig.parse({
      ...DEFAULT_CONFIG,
      layers: [
        DEFAULT_CONFIG.layers[0],
        {
          ...DEFAULT_CONFIG.layers[0],
          type: "plasma",
          opacity: 0.5,
          blendMode: "screen",
        },
      ],
      glow: { enabled: true, intensity: 0.25, radius: 0.04 },
    });

    const plan = compileRenderPlan(sceneDocumentFromGradientConfig(config, { name: "Plan" }));

    expect(plan.passes.map((pass) => pass.id)).toEqual([
      "layer:layer-1",
      "layer:layer-2",
      "composite:layers",
      "post:glow",
      "output:screen",
    ]);
    expect(plan.resources.map((resource) => resource.id)).toContain("layer:layer-1");
    expect(plan.estimatedCost.drawPasses).toBe(5);
    expect(plan.compatibilityWarnings).toEqual([]);
  });

  it("expands real bloom into a multi-pass chain when feedback is not active", () => {
    const config = GradientConfig.parse({
      ...DEFAULT_CONFIG,
      realBloom: { enabled: true },
    });

    const plan = compileRenderPlan(sceneDocumentFromGradientConfig(config, { name: "Bloom" }));

    expect(plan.passes.map((pass) => pass.id)).toEqual([
      "layer:layer-1",
      "post:realBloom:extract",
      "post:realBloom:blur-x",
      "post:realBloom:blur-y",
      "post:realBloom:composite",
      "output:screen",
    ]);
  });

  it("warns and skips real bloom when feedback needs the previous frame", () => {
    const config = GradientConfig.parse({
      ...DEFAULT_CONFIG,
      feedback: { enabled: true, decay: 0.8 },
      realBloom: { enabled: true },
    });

    const plan = compileRenderPlan(sceneDocumentFromGradientConfig(config, { name: "Feedback" }));

    expect(plan.passes.map((pass) => pass.id)).toEqual([
      "layer:layer-1",
      "post:feedback",
      "output:screen",
    ]);
    expect(plan.compatibilityWarnings).toEqual([
      {
        code: "real-bloom-feedback-disabled",
        severity: "warning",
        message: "Real bloom is skipped while feedback is active in the current renderer.",
        effectId: "realBloom",
      },
    ]);
  });

  it("ignores unknown effect nodes until a plugin registry owns them", () => {
    const document = sceneDocumentFromGradientConfig(DEFAULT_CONFIG, { name: "Plugin" });
    document.postEffects.push({
      id: "plugin-effect",
      type: "plugin.effect",
      enabled: true,
      params: {},
    });

    const plan = compileRenderPlan(document);

    expect(plan.passes.map((pass) => pass.id)).toEqual([
      "layer:layer-1",
      "output:screen",
    ]);
  });
});
