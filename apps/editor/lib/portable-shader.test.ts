import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { GRADIENT_TYPES, GRADIENT_TYPE_IDS, type ShaderParts } from "@wavr/core";
import {
  buildPortableShader,
  glslFloat,
  portableFragmentShader,
  resolvePortableSettings,
  type PortableState,
} from "./portable-shader";

const SHADER_DIR = path.resolve(__dirname, "../../../packages/core/src/shaders");
const read = (name: string) => fs.readFileSync(path.join(SHADER_DIR, name), "utf8");

const state: PortableState = {
  colors: [
    [0.388, 0.357, 1],
    [1, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  gradientType: "lightWall",
  speed: 0.4,
  complexity: 3,
  scale: 1,
  distortion: 0.3,
  softness: 0.5,
  brightness: 1,
  saturation: 1,
};
const shaderFor = (type: string, extra: Partial<PortableState> = {}) =>
  portableFragmentShader({ ...state, gradientType: type, ...extra });

const stripComments = (source: string) => source.replace(/\/\/.*$/gm, "");

// ---------------------------------------------------------------------------
// A stand-in for a GLSL compiler, which a unit test doesn't have: finds names
// the source uses without declaring them (the mistake that left the old export
// of every gradient with an undefined COMPLEXITY, so that none of them compiled).
// ---------------------------------------------------------------------------

const KEYWORDS = new Set([
  "if", "else", "for", "while", "return", "break", "continue", "discard", "const", "uniform", "in", "out", "struct",
  "precision", "highp", "mediump", "lowp", "void", "bool", "int", "uint", "float", "vec2", "vec3", "vec4", "ivec2",
  "uvec2", "mat2", "mat3", "mat4", "sampler2D", "true", "false", "version", "es",
]);
const BUILTINS = new Set([
  "abs", "acos", "asin", "atan", "ceil", "clamp", "cos", "cross", "dFdx", "dFdy", "distance", "dot", "exp", "exp2", "floor", "fwidth",
  "fract", "gl_FragCoord", "length", "log", "max", "min", "mix", "mod", "normalize", "pow", "reflect", "round", "sign",
  "sin", "smoothstep", "sqrt", "step", "tan", "tanh", "texture", "textureLod",
]);

function undeclaredNames(source: string): string[] {
  const code = stripComments(source).replace(/^\s*#.*$/gm, "");
  const declared = new Set<string>();
  // Anything that follows a type name is a declaration: variables, parameters, functions, members.
  const type = "(?:void|bool|int|uint|float|[ibu]?vec[234]|mat[234]|sampler2D|[A-Z]\\w*)";
  for (const m of code.matchAll(new RegExp(`\\b${type}\\s+([A-Za-z_]\\w*)`, "g"))) declared.add(m[1]);
  for (const m of code.matchAll(/\bstruct\s+(\w+)/g)) declared.add(m[1]);
  const missing = new Set<string>();
  for (const m of code.matchAll(/\b[A-Za-z_]\w*\b/g)) {
    const name = m[0];
    if (code[(m.index ?? 0) - 1] === ".") continue; // a member or swizzle
    if (!KEYWORDS.has(name) && !BUILTINS.has(name) && !declared.has(name)) missing.add(name);
  }
  return [...missing];
}

describe("the undeclared-name check", () => {
  it("finds a name that is used but never declared", () => {
    expect(undeclaredNames("float f(float x) { return x * COMPLEXITY; }")).toEqual(["COMPLEXITY"]);
    expect(undeclaredNames("const float COMPLEXITY = 3.0;\nfloat f(float x) { return x * COMPLEXITY; }")).toEqual([]);
    expect(undeclaredNames("vec3 f() { return unknownHelper(vec3(1.0)); }")).toEqual(["unknownHelper"]);
  });
});

describe("portable fragment shader", () => {
  for (const type of GRADIENT_TYPES) {
    // The image gradient has no picture in an export and falls back to the light wall.
    const drawn = type === "image" ? "lightWall" : type;

    describe(type, () => {
      for (const mouseReact of [0, 0.5]) {
        const source = shaderFor(type, { mouseReact, hueShift: 25 });

        it(`declares every name it uses and every uniform it sets (pointer ${mouseReact > 0 ? "on" : "off"})`, () => {
          expect(undeclaredNames(source)).toEqual([]);
          const code = stripComments(source);
          const declared = new Set([...code.matchAll(/^uniform\s+\S+\s+(\w+)/gm)].map((m) => m[1]));
          const used = new Set(code.match(/\bu_\w+\b/g));
          expect([...used].filter((name) => !declared.has(name))).toEqual([]);
          expect([...declared].filter((name) => !used.has(name))).toEqual([]);
        });
      }

      it("holds only its own gradient function, and none of the engine's dispatch", () => {
        const source = stripComments(shaderFor(type));
        const definitions = [...source.matchAll(/^vec3 (\w+Gradient)\(vec2 uv, float time\)/gm)].map((m) => m[1]);
        expect(definitions).toEqual([`${drawn}Gradient`]);
        expect(source).not.toContain("computeGradient");
        expect(source).not.toContain("customGradient");
        expect(source).not.toMatch(/\bWAVR_/);
        // Called once, from main.
        const main = source.slice(source.indexOf("void main()"));
        expect(main.match(new RegExp(`\\b${drawn}Gradient\\(`, "g"))).toHaveLength(1);
      });

      it("is the engine's gradient code, line for line", () => {
        // The function as gradients.glsl has it, with the engine's parameters named as the export names them.
        const engine = read("gradients.glsl");
        const start = engine.indexOf(`vec3 ${drawn}Gradient(vec2 uv, float time) {`);
        const body = engine.slice(start, engine.indexOf("\n}\n", start) + 2);
        expect(start).toBeGreaterThan(0);
        const renamed = body.replace(
          /\bu_(speed|scale|complexity|distortion|softness|colorCount)\b/g,
          (_, name: string) => name.replace(/([A-Z])/g, "_$1").toUpperCase(),
        );
        expect(shaderFor(type)).toContain(renamed);
      });

      it("maps the palette without fract() and tone maps without Reinhard", () => {
        const source = stripComments(shaderFor(type));
        // A palette lookup is never fed fract(): the palette folds (pingPong) instead of jumping from its last colour to its first.
        expect(source).not.toMatch(/(?:getGradientColor|getColor|softColor)\(\s*fract\(/);
        // The old export ended in c / (c + 1), which sends 1.0 to 0.5.
        expect(source).not.toMatch(/\/\s*\(\s*[A-Za-z_]\w*\s*\+\s*1(?:\.0*)?\s*\)/);
        expect(source).not.toMatch(/\bsoftColor\b|\bgetColor\b|\bfieldFor\b/);
        // The engine's curve, not a stand-in.
        expect(source).toContain("vec3 highlightShoulder(vec3 c, float knee)");
        expect(source).toContain("if (TONE_MAP_MODE == 1) return peakShoulder(c, 0.8);");
        // Standard range: the engine's HDR peak collapses to white, and no uniform carries it.
        expect(source).toContain("vec3 peakShoulder(vec3 c, float knee) { return highlightShoulder(c, knee); }");
        expect(source).not.toMatch(/\bu_hdrPeak\b/);
      });
    });
  }

  it("only the gradients that read the stops themselves get them as uniforms", () => {
    const uniformsOf = (type: string) =>
      [...buildPortableShader(resolvePortableSettings({ ...state, gradientType: type })).uniforms].filter((u) =>
        /^u_colors/.test(u),
      );
    expect(uniformsOf("lightWall")).toEqual(["u_colors"]);
    expect(uniformsOf("aperture")).toEqual(["u_colors"]);
    expect(uniformsOf("inkSmoke")).toEqual([]);
    expect(shaderFor("lightWall")).toContain("uniform vec3 u_colors[4];");
    expect(shaderFor("lightWall")).toContain("const int COLOR_COUNT = 4;");
    expect(shaderFor("lightWall", { colors: [[1, 0, 0], [0, 0, 1]] })).toContain("uniform vec3 u_colors[2];");
  });

  describe("the pointer", () => {
    // mouse.glsl names a warp style per gradient: read that table independently of the export.
    const table = new Map<number, string>();
    for (const m of read("mouse.glsl").matchAll(/^#elif WAVR_GRADIENT == (\d+)\n#define WAVR_MOUSE_WARP (\w+)/gm)) {
      table.set(Number(m[1]), m[2]);
    }

    it("the table covers every gradient", () => {
      expect([...table.keys()].sort((a, b) => a - b)).toEqual(
        GRADIENT_TYPES.map((type) => GRADIENT_TYPE_IDS[type]).sort((a, b) => a - b),
      );
    });

    for (const type of GRADIENT_TYPES) {
      const drawn = type === "image" ? "lightWall" : type;
      it(`${type} warps with the style the engine gives ${drawn}`, () => {
        const source = stripComments(shaderFor(type, { mouseReact: 0.5 }));
        const style = table.get(GRADIENT_TYPE_IDS[drawn as keyof typeof GRADIENT_TYPE_IDS]);
        const styles = [...source.matchAll(/^vec2 (mouseWarp\w+)\(vec2 uv\)/gm)].map((m) => m[1]).filter((n) => n !== "mouseWarp");
        expect(styles).toEqual([style]);
        expect(source).toContain(`return ${style}(uv);`);
        expect(source).toContain("vec2 uv = mouseWarp(v_uv);");
        expect(source).toContain("const float MOUSE_REACT = 0.5;");
        expect(source).toMatch(/uniform vec2 u_mouseSmooth;/);
        expect(source).toMatch(/uniform vec2 u_mouseVelocity;/);
        expect(source).toMatch(/uniform float u_mousePresence;/);
      });
    }

    it("is left out entirely when the pointer is off", () => {
      const source = shaderFor("lightWall", { mouseReact: 0 });
      expect(source).not.toMatch(/mouse|MOUSE/i);
      expect(source).toContain("vec2 uv = v_uv;");
    });
  });

  describe("the colour grade", () => {
    it("carries brightness, saturation, tone map and deband, in the post pass's order", () => {
      const source = shaderFor("inkSmoke", { brightness: 1.2, saturation: 0.8, toneMapMode: 2 });
      expect(source).toContain("const float BRIGHTNESS = 1.2;");
      expect(source).toContain("const float SATURATION = 0.8;");
      expect(source).toContain("const int TONE_MAP_MODE = 2;");
      expect(source).toContain("const float DEBAND = 1.0;");
      const main = stripComments(source.slice(source.indexOf("void main()")));
      const order = ["adjustSaturation(", "color *= BRIGHTNESS", "applyToneMap(", "interleavedGradientNoise("].map((s) => main.indexOf(s));
      expect(order.every((i) => i > 0)).toBe(true);
      expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it("rotates the hue only when asked to", () => {
      expect(shaderFor("inkSmoke")).not.toContain("rotateHue");
      const shifted = shaderFor("inkSmoke", { hueShift: -40 });
      expect(shifted).toContain("const float HUE_SHIFT = -40.0; // degrees");
      expect(shifted).toContain("color = rotateHue(color, HUE_SHIFT * 6.28318 / 360.0);");
    });

    it("leaves the anti-banding noise out when it is off", () => {
      const source = shaderFor("inkSmoke", { debandEnabled: false });
      expect(source).not.toContain("DEBAND");
      expect(source).not.toContain("interleavedGradientNoise");
    });
  });

  describe("settings", () => {
    it("are the engine's defaults where a state says nothing", () => {
      expect(resolvePortableSettings(state)).toMatchObject({
        oklab: true,
        toneMapMode: 1,
        deband: 1,
        mouseReact: 0,
        hueShift: 0,
      });
    });

    it("keep out-of-range values in range", () => {
      const settings = resolvePortableSettings({
        ...state,
        complexity: 99,
        mouseReact: 7,
        toneMapMode: 9,
        speed: Number.NaN,
        colors: Array.from({ length: 12 }, () => [1, 1, 1] as [number, number, number]),
      });
      expect(settings).toMatchObject({ complexity: 8, mouseReact: 1, toneMapMode: 1, speed: 0.4 });
      expect(settings.colors).toHaveLength(8);
      expect(resolvePortableSettings({ ...state, colors: [] }).colors).toEqual([[0, 0, 0]]);
    });

    it("draw a light wall where an export has nothing to draw", () => {
      for (const type of ["image", "nonsense"]) {
        expect(resolvePortableSettings({ ...state, gradientType: type })).toMatchObject({
          gradientType: "lightWall",
          gradientId: GRADIENT_TYPE_IDS.lightWall,
        });
      }
    });

    it("write floats the way GLSL wants them", () => {
      expect(glslFloat(1)).toBe("1.0");
      expect(glslFloat(0)).toBe("0.0");
      expect(glslFloat(0.68)).toBe("0.68");
      expect(glslFloat(-40)).toBe("-40.0");
      expect(glslFloat(0.33333)).toBe("0.333");
      expect(glslFloat(1e-7)).toBe("0.0");
    });
  });

  describe("when the engine's shaders change", () => {
    const parts: ShaderParts = {
      hsl: "",
      blendModes: "",
      layer: "",
      common: read("common.glsl"),
      mouse: read("mouse.glsl"),
      gradients: read("gradients.glsl"),
      post: read("post.glsl"),
    };
    const settings = resolvePortableSettings(state);

    it("the real files build", () => {
      expect(() => buildPortableShader(settings, parts)).not.toThrow();
    });

    it("a gradient that needs a uniform an export can't provide fails loudly instead of emitting a shader that won't compile", () => {
      const gradients = parts.gradients.replace("float f = 0.16 + 0.11 * u_complexity;", "float f = 0.16 + 0.11 * u_complexity * u_imageScale;");
      expect(gradients).not.toBe(parts.gradients);
      expect(() => buildPortableShader(resolvePortableSettings({ ...state, gradientType: "liquidChrome" }), { ...parts, gradients })).toThrow(
        /u_imageScale/,
      );
    });

    it("a missing helper is reported", () => {
      const post = parts.post.replace("vec3 applyToneMap(vec3 c) {", "vec3 applyToneMapRenamed(vec3 c) {");
      expect(() => buildPortableShader(settings, { ...parts, post })).toThrow(/applyToneMap/);
    });

    it("a gradient with no dispatch branch is reported", () => {
      const gradients = parts.gradients.replace("return lightWallGradient(uv, time);", "return vec3(0.0);");
      expect(() => buildPortableShader(settings, { ...parts, gradients })).toThrow(/no gradient function/);
    });
  });
});
