import { describe, expect, it } from "vitest";
import { GRADIENT_TYPES } from "@wavr/core";
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
  gradientType: "halo",
  speed: 0.42,
  complexity: 5,
  scale: 1.2,
  distortion: 0.33,
  softness: 0.68,
  brightness: 1.1,
  saturation: 0.92,
};

/** The script the standalone player carries, decoded from its data URL. */
function playerScript(code: string): string {
  const match = code.match(/src="data:text\/javascript;charset=utf-8,([^"]+)"/);
  expect(match).not.toBeNull();
  return decodeURIComponent(match?.[1] ?? "");
}

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
      type: 24,
      softness: 0.68,
    });
  });

  it("preserves shader type and softness in the React exporter", () => {
    const code = exportReactComponent(state);
    expect(code).toContain("vec3 haloGradient(vec2 uv, float time)");
    expect(code).toContain("const float SOFTNESS = 0.68;");
    // Softness also melts the palette's colours into each other, at 0.85 of its value.
    expect(code).toContain("const BLEND = 0.578;");
    expect(code).toContain("const float SPEED = 0.42;");
  });

  it("preserves shader type and softness in the Web Component exporter", () => {
    const code = exportWebComponent({ ...state, gradientType: "liquidChrome", softness: 0.62 });
    expect(code).toContain("vec3 liquidChromeGradient(vec2 uv, float time)");
    expect(code).toContain("const float SOFTNESS = 0.62;");
    expect(code).toContain("const BLEND = 0.527;");
  });

  it("preserves shader type and softness in the standalone player exporter", () => {
    const code = exportStandalonePlayer({ ...state, gradientType: "iridescentFoil", softness: 0.76 });
    const script = playerScript(code);
    expect(script).toContain("vec3 iridescentFoilGradient(vec2 uv, float time)");
    expect(script).toContain("const float SOFTNESS = 0.76;");
    expect(script).toContain("const BLEND = 0.646;");
  });

  it("maps the light types into portable exports", () => {
    expect(generateEmbedConfig({ ...state, gradientType: "plasmaOrb", softness: 0.7 })).toMatchObject({
      type: 22,
      softness: 0.7,
    });

    // The light leak's shader doesn't read softness; it only softens the palette.
    const code = exportReactComponent({ ...state, gradientType: "lightLeak", softness: 0.56 });
    expect(code).toContain("vec3 lightLeakGradient(vec2 uv, float time)");
    expect(code).toContain("const BLEND = 0.476;");
  });

  it("exports every gradient with its own code and none of another's", () => {
    for (const type of GRADIENT_TYPES) {
      const drawn = type === "image" ? "lightWall" : type;
      const code = exportReactComponent({ ...state, gradientType: type });
      const others = GRADIENT_TYPES.filter((other) => other !== drawn && other !== "image");
      expect(code, type).toContain(`vec3 ${drawn}Gradient(vec2 uv, float time)`);
      for (const other of others) expect(code, `${type} has ${other}`).not.toContain(`${other}Gradient(`);
    }
  });

  it("applies the editor's colour grade", () => {
    const code = exportReactComponent({ ...state, hueShift: 30, toneMapMode: 2, oklabEnabled: false, colorBlend: 0.4 });
    expect(code).toContain("const float BRIGHTNESS = 1.1;");
    expect(code).toContain("const float SATURATION = 0.92;");
    expect(code).toContain("const float HUE_SHIFT = 30.0; // degrees");
    expect(code).toContain("const int TONE_MAP_MODE = 2;");
    expect(code).toContain("const OKLAB = false;");
    expect(code).toContain("const BLEND = 0.578;"); // the larger of softness * 0.85 and the colour blend
    expect(exportReactComponent({ ...state, softness: 0.1, colorBlend: 0.4 })).toContain("const BLEND = 0.4;");
  });

  it("no longer ends in Reinhard c / (c + 1), which halved every export's brightness", () => {
    for (const code of [exportReactComponent(state), exportWebComponent(state), playerScript(exportStandalonePlayer(state))]) {
      expect(code).not.toMatch(/\/\s*\(\s*\w+\s*\+\s*1(?:\.0*)?\s*\)/);
      expect(code).toContain("highlightShoulder");
    }
  });

  describe("pointer", () => {
    const withPointer = { ...state, gradientType: "lightWall", mouseReact: 0.5 };
    const without = { ...state, gradientType: "lightWall", mouseReact: 0 };
    const hooks = ["pointerenter", "pointermove", "pointerdown", "pointerleave", "pointercancel"];

    it("is in all three code exports when the pointer reacts", () => {
      for (const [name, code] of [
        ["React component", exportReactComponent(withPointer)],
        ["web component", exportWebComponent(withPointer)],
        ["standalone player", playerScript(exportStandalonePlayer(withPointer))],
      ] as const) {
        for (const hook of hooks) expect(code, `${name}: ${hook}`).toContain(`"${hook}"`);
        expect(code, name).toContain("vec2 mouseWarpPush(vec2 uv)");
        expect(code, name).toContain("const float MOUSE_REACT = 0.5;");
        expect(code, name).toContain("u_mousePresence");
        expect(code, name).toContain("const spring = ");
      }
    });

    it("is in none of them when it does not", () => {
      for (const [name, code] of [
        ["React component", exportReactComponent(without)],
        ["web component", exportWebComponent(without)],
        ["standalone player", playerScript(exportStandalonePlayer(without))],
      ] as const) {
        expect(code, name).not.toMatch(/pointer(enter|move|down|leave|cancel)|mouse|spring|steer/i);
      }
    });

    it("the usage notes say what the pointer needs from the page", () => {
      for (const make of [exportReactComponent, exportWebComponent, exportStandalonePlayer]) {
        expect(make(withPointer), make.name).toContain("bends around the pointer");
        expect(make(withPointer), make.name).toContain("pointer-events: none");
        expect(make(without), make.name).not.toContain("bends around the pointer");
      }
    });
  });

  describe("web component and player", () => {
    it("clean up when removed, and survive being pasted twice", () => {
      for (const code of [exportWebComponent(state), playerScript(exportStandalonePlayer(state))]) {
        expect(code).toContain("disconnectedCallback");
        expect(code).toContain("customElements.get(\"wavr-gradient\")");
        expect(code).toContain("mode");
      }
    });

    it("keeps its variables out of the page's global scope", () => {
      const script = exportWebComponent(state);
      expect(script).toMatch(/<script>\n\(\(\) => \{\n/);
      expect(script).toMatch(/\}\)\(\);\n<\/script>/);
    });

    it("has the readable form with comments and the standalone one without", () => {
      expect(exportWebComponent(state)).toContain("// The palette, r g b in 0..1");
      expect(playerScript(exportStandalonePlayer(state))).not.toContain("//");
    });

    it("stays small", () => {
      for (const type of GRADIENT_TYPES) {
        const player = exportStandalonePlayer({ ...state, gradientType: type, mouseReact: 1 });
        expect(player.length, type).toBeLessThan(18_000);
        // Display P3 adds its colour conversion (palette bake, canvas) on top.
        const p3 = exportStandalonePlayer({ ...state, gradientType: type, mouseReact: 1, colorProfile: "display-p3" });
        expect(p3.length, `${type} in P3`).toBeLessThan(18_500);
      }
    });
  });
});
