import { describe, expect, it } from "vitest";
import {
  exportReactComponent,
  exportStandalonePlayer,
  exportWebComponent,
  generateEmbedCode,
  generateEmbedConfig,
} from "./export";

const state = {
  colors: [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9],
  ] as [number, number, number][],
  gradientType: "aurora",
  speed: 0.42,
  complexity: 5,
  scale: 1.2,
  distortion: 0.33,
  softness: 0.68,
  brightness: 1.1,
  saturation: 0.92,
};

describe("export helpers", () => {
  it("generates iframe embed code for the viewer-only embed route", () => {
    const code = generateEmbedCode("s2.example", 320, 180);

    expect(code).toContain('src="https://wavr.app/embed#s2.example"');
    expect(code).toContain('width="320"');
    expect(code).toContain('height="180"');
    expect(code).not.toContain("/editor#");
  });

  it("includes gradient type and softness in the embed config", () => {
    expect(generateEmbedConfig(state)).toMatchObject({
      type: 11,
      softness: 0.68,
    });
  });

  it("preserves shader type and softness in the React exporter", () => {
    const code = exportReactComponent(state);
    expect(code).toContain("const int TYPE = 11;");
    expect(code).toContain("const float SOFTNESS = 0.68;");
  });

  it("preserves shader type and softness in the Web Component exporter", () => {
    const code = exportWebComponent({ ...state, gradientType: "liquid", softness: 0.62 });
    expect(code).toContain("const int TYPE = 12;");
    expect(code).toContain("const float SOFTNESS = 0.62;");
  });

  it("preserves shader type and softness in the standalone player exporter", () => {
    const code = exportStandalonePlayer({ ...state, gradientType: "softCells", softness: 0.76 });
    const match = code.match(/src="data:text\/javascript;charset=utf-8,([^"]+)"/);
    expect(match).not.toBeNull();
    const script = decodeURIComponent(match?.[1] ?? "");
    expect(script).toContain("const int TYPE = 13;");
    expect(script).toContain("const float SOFTNESS = 0.76;");
  });

  it("maps the new curated shader types into portable exports", () => {
    expect(generateEmbedConfig({ ...state, gradientType: "prismGlass", softness: 0.7 })).toMatchObject({
      type: 15,
      softness: 0.7,
    });

    const code = exportReactComponent({ ...state, gradientType: "neonTunnel", softness: 0.56 });
    expect(code).toContain("const int TYPE = 16;");
    expect(code).toContain("const float SOFTNESS = 0.56;");
  });
});
