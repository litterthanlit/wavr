import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  GradientConfig,
  WavrSceneDocument,
  gradientConfigFromSceneDocument,
  sceneDocumentFromGradientConfig,
} from "../src";

describe("WavrSceneDocument", () => {
  it("wraps the current GradientConfig in a canonical scene document", () => {
    const config = GradientConfig.parse({
      ...DEFAULT_CONFIG,
      bloom: { enabled: true, intensity: 0.7 },
      glow: { enabled: false, intensity: 0.2, radius: 0.04 },
    });

    const document = sceneDocumentFromGradientConfig(config, {
      name: "Hero shader",
      canvas: {
        width: 1920,
        height: 1080,
        background: "transparent",
      },
    });

    expect(() => WavrSceneDocument.parse(document)).not.toThrow();
    expect(document.version).toBe("wavr.scene.v1");
    expect(document.meta.name).toBe("Hero shader");
    expect(document.canvas.width).toBe(1920);
    expect(document.canvas.height).toBe(1080);
    expect(document.layers[0]).toMatchObject({
      id: "layer-1",
      name: "Layer 1",
      kind: "shader",
      visible: true,
      opacity: 1,
      blendMode: "normal",
      source: {
        kind: "gradient",
        gradient: config.layers[0],
      },
    });
    expect(document.postEffects.map((effect) => effect.type)).toEqual(["bloom", "glow"]);
  });

  it("round-trips scene documents back to GradientConfig without dropping global effects", () => {
    const config = GradientConfig.parse({
      ...DEFAULT_CONFIG,
      layers: [
        DEFAULT_CONFIG.layers[0],
        {
          ...DEFAULT_CONFIG.layers[0],
          type: "aurora",
          opacity: 0.6,
          blendMode: "screen",
        },
      ],
      trail: { enabled: true, length: 0.95, width: 0.08 },
      realBloom: { enabled: true },
    });

    const document = sceneDocumentFromGradientConfig(config, { name: "Round trip" });
    const roundTrip = gradientConfigFromSceneDocument(document);

    expect(GradientConfig.parse(roundTrip)).toEqual(config);
  });
});
