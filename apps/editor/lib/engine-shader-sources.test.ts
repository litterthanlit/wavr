import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FULL_RESOLUTION_GRADIENTS, GRADIENT_TYPES, GRADIENT_TYPE_IDS } from "@wavr/core";
import { PROGRAM_UNIFORM_NAMES } from "../../../packages/core/src/engine";
import {
  assembleLayerSource,
  assemblePostSource,
  type ShaderParts,
} from "../../../packages/core/src/shader-sources";

// Vitest stubs .glsl imports to "", so read the real files.
const SHADER_DIR = path.resolve(__dirname, "../../../packages/core/src/shaders");
const read = (name: string) => fs.readFileSync(path.join(SHADER_DIR, name), "utf8");
const parts: ShaderParts = {
  hsl: read("hsl.glsl"),
  blendModes: read("blend-modes.glsl"),
  common: read("common.glsl"),
  mouse: read("mouse.glsl"),
  gradients: read("gradients.glsl"),
  layer: read("layer.glsl"),
  post: read("post.glsl"),
};

/**
 * Just enough of the GLSL preprocessor to see which code a program keeps:
 * #define, #if/#elif/#else/#endif with `defined(X)` and `NAME ==/!= N`, #error.
 * Like GLSL ES, an undefined identifier in #if is an error.
 */
function preprocess(source: string): string {
  const defines = new Map<string, string>();
  const evaluate = (expression: string): boolean => {
    const expr = expression.trim();
    let m = /^defined\(\s*(\w+)\s*\)$/.exec(expr);
    if (m) return defines.has(m[1]);
    m = /^(\w+)\s*(==|!=)\s*(-?\d+)$/.exec(expr);
    if (m) {
      const value = defines.get(m[1]);
      if (value === undefined) throw new Error(`undefined identifier in #if: ${m[1]}`);
      return (Number(value) === Number(m[3])) === (m[2] === "==");
    }
    throw new Error(`unsupported #if expression: ${expr}`);
  };

  // Each frame: [parent active, a branch was taken, this branch active]
  const stack: [boolean, boolean, boolean][] = [];
  let active = true;
  const out: string[] = [];
  for (const line of source.split("\n")) {
    const directive = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
    if (!directive) {
      if (active) out.push(line);
      continue;
    }
    const [, name, rest] = directive;
    switch (name) {
      case "define": {
        const [key, ...value] = rest.trim().split(/\s+/);
        if (active) defines.set(key, value.join(" "));
        break;
      }
      case "if":
      case "ifdef":
      case "ifndef": {
        const taken: boolean = active && (name === "if" ? evaluate(rest) : defines.has(rest.trim()) === (name === "ifdef"));
        stack.push([active, taken, taken]);
        active = taken;
        break;
      }
      case "elif": {
        const frame = stack[stack.length - 1];
        const taken: boolean = frame[0] && !frame[1] && evaluate(rest);
        frame[1] ||= taken;
        frame[2] = taken;
        active = taken;
        break;
      }
      case "else": {
        const frame = stack[stack.length - 1];
        const taken: boolean = frame[0] && !frame[1];
        frame[1] = true;
        frame[2] = taken;
        active = taken;
        break;
      }
      case "endif":
        active = stack.pop()![0];
        break;
      case "error":
        if (active) throw new Error(`#error ${rest}`);
        break;
      default: // #version and anything else: kept as is
        if (active) out.push(line);
    }
  }
  expect(stack).toHaveLength(0);
  return out.join("\n");
}

const stripComments = (source: string) => source.replace(/\/\/.*$/gm, "");

// Gradient functions: `vec3 <name>Gradient(vec2 uv, float time) {`, not the dispatcher.
const GRADIENT_DEFINITION = /^vec3 (\w+Gradient)\(vec2 uv, float time\)\s*\{/gm;
const definitions = (source: string) =>
  [...source.matchAll(GRADIENT_DEFINITION)].map((m) => m[1]).filter((name) => name !== "computeGradient");
const callsOf = (name: string, source: string) => source.match(new RegExp(`\\b${name}\\(`, "g"))?.length ?? 0;

describe("assembled layer source", () => {
  for (const type of GRADIENT_TYPES) {
    const id = GRADIENT_TYPE_IDS[type];

    it(`${type} holds exactly one gradient function, called once from layer main`, () => {
      const source = stripComments(preprocess(assembleLayerSource(id, parts)));

      expect(definitions(source)).toEqual([`${type}Gradient`]);

      // computeGradient: one definition dispatching to that one function...
      expect(callsOf("computeGradient", source)).toBe(2);
      const dispatch = /vec3 computeGradient\(vec2 uv, float time\)\s*\{([^}]*)\}/.exec(source)!;
      expect(dispatch[1].trim()).toBe(`return ${type}Gradient(uv, time);`);

      // ...and one call, in main, so the compiler inlines the gradient once.
      const main = source.slice(source.indexOf("void main()"));
      expect(callsOf("computeGradient", main)).toBe(1);
      expect(callsOf(`${type}Gradient`, main)).toBe(0);

      // Nothing of the old single-pass design is left.
      for (const gone of ["sampleScene", "u_postPass", "u_isBaseLayer", "u_gradientType", "u_customEnabled"]) {
        expect(source, gone).not.toContain(gone);
      }
    });
  }

  it("defines the shader id before anything else", () => {
    expect(assembleLayerSource(9, parts).startsWith("#version 300 es\n#define WAVR_GRADIENT 9\n")).toBe(true);
  });

  it("the image gradient program skips the image blend, other programs keep it", () => {
    const imageProgram = stripComments(preprocess(assembleLayerSource(GRADIENT_TYPE_IDS.image, parts)));
    const meshProgram = stripComments(preprocess(assembleLayerSource(GRADIENT_TYPE_IDS.lightWall, parts)));
    expect(imageProgram).not.toContain("imgSample");
    expect(meshProgram).toContain("imgSample");
  });

  it("numbers each file so compile errors read ERROR: <file>:<line>", () => {
    const source = assembleLayerSource({ custom: "  return vec3(1.0);" }, parts);
    // A part's first line is line 1 of its file...
    expect(source).toContain(`#line 1 3\n${parts.common}`);
    expect(source).toContain(`#line 1 6\n${parts.gradients}`);
    expect(source).toContain(`#line 1 7\n${parts.layer}`);
    // ...and the user's body starts at line 1 (the signature is line 0).
    expect(source).toContain("#line 0 5\nvec3 customGradient(vec2 uv, float time) {\n  return vec3(1.0);\n}");
    expect(assemblePostSource(parts)).toContain(`#line 1 8\n${parts.post}`);
  });

  it("custom program holds the user's function and no built-in gradient", () => {
    const body = "  return vec3(uv, time);";
    const source = stripComments(preprocess(assembleLayerSource({ custom: body }, parts)));
    expect(definitions(source)).toEqual(["customGradient"]);
    expect(source).toContain(`vec3 customGradient(vec2 uv, float time) {\n${body}\n}`);
    const main = source.slice(source.indexOf("void main()"));
    expect(callsOf("computeGradient", main)).toBe(1);
    // Declared ahead of computeGradient, which calls it.
    expect(source.indexOf("vec3 customGradient(")).toBeLessThan(source.indexOf("vec3 computeGradient("));
  });

  it("every gradient guard is preprocessed away in a program for another gradient", () => {
    const source = preprocess(assembleLayerSource(GRADIENT_TYPE_IDS.lightWall, parts));
    expect(source).not.toMatch(/^#if/m);
    expect(source).not.toMatch(/^#endif/m);
  });
});

describe("assembled post source", () => {
  const source = stripComments(preprocess(assemblePostSource(parts)));

  it("contains no gradient code", () => {
    expect(definitions(source)).toEqual([]);
    expect(source).not.toContain("computeGradient");
    expect(source).not.toContain("customGradient");
    expect(source).not.toContain("u_gradientType");
    expect(source).not.toContain("dispatchBlend");
  });

  it("reads neighbouring pixels from the scene texture only", () => {
    // One fetch per tap, through the render-scale addressing (compositeUV), never a gradient evaluation.
    expect(source).toMatch(
      /vec4 sampleSceneRGBA\(vec2 uv\)\s*\{\s*return textureLod\(u_sceneTexture, compositeUV\(uv, vec2\(textureSize\(u_sceneTexture, 0\)\)\), 0\.0\);/,
    );
    expect(source).toMatch(/vec3 sampleScene\(vec2 uv\)\s*\{\s*return sampleSceneRGBA\(uv\)\.rgb;/);
    const main = source.slice(source.indexOf("void main()"));
    expect(callsOf("sampleScene", main)).toBeGreaterThan(10);
    expect(main).not.toContain("u_postPass");
    // Every read of the scene goes through those two functions.
    const direct = source.match(/\b(texture|textureLod|texelFetch)\(\s*u_sceneTexture/g) ?? [];
    expect(direct).toHaveLength(1);
  });
});

describe("render scale", () => {
  it("every gradient that reads gl_FragCoord is drawn at full resolution by the engine", () => {
    // At a reduced render scale a pixel of the layer pass is bigger on screen, so a pattern laid out in
    // gl_FragCoord would change size. FULL_RESOLUTION_GRADIENTS is how the engine avoids that; a
    // gradient added to this file with such a pattern must join it.
    // A type can have several guarded blocks (its helpers get their own, ahead of it).
    const blocks = [...stripComments(parts.gradients).matchAll(/^#if WAVR_GRADIENT == (\d+)\n([\s\S]*?)^#endif/gm)];
    expect(new Set(blocks.map((b) => Number(b[1]))).size).toBe(GRADIENT_TYPES.length);
    const readers = GRADIENT_TYPES.filter((type) =>
      blocks.some((b) => Number(b[1]) === GRADIENT_TYPE_IDS[type] && b[2].includes("gl_FragCoord")),
    );
    for (const type of readers) expect(FULL_RESOLUTION_GRADIENTS.has(type), type).toBe(true);
    // And nothing on the list is there for no reason: a type of its own, not a typo.
    for (const type of FULL_RESOLUTION_GRADIENTS) expect(GRADIENT_TYPES).toContain(type);
  });

  it("only the gradients read gl_FragCoord in the layer program: the shared parts and layer main do not", () => {
    for (const name of ["common", "mouse", "layer", "hsl", "blendModes"] as const) {
      expect(stripComments(parts[name]), name).not.toContain("gl_FragCoord");
    }
  });

  it("the layer program reads the previous layers, and post the scene, through compositeUV", () => {
    const layer = stripComments(preprocess(assembleLayerSource(GRADIENT_TYPE_IDS.lightWall, parts)));
    expect(layer.match(/texture\(\s*u_compositePrev/g)).toHaveLength(1);
    expect(layer).toContain("texture(u_compositePrev, compositeUV(v_uv, vec2(textureSize(u_compositePrev, 0))))");
    expect(stripComments(parts.post)).not.toMatch(/\bu_compositePrev\b/);
  });

  it("compositeUV is the clamped uv at full scale and stays half a texel inside the drawn area", () => {
    const common = stripComments(parts.common);
    const body = /vec2 compositeUV\(vec2 uv, vec2 targetSize\)\s*\{([\s\S]*?)\n\}/.exec(common)![1];
    expect(body).toContain("vec2 halfTexel = 0.5 / targetSize;");
    expect(body).toContain("clamp(uv * u_compositeScale, halfTexel, u_compositeScale - halfTexel)");
  });
});

describe("shader uniforms", () => {
  const sources = ["common.glsl", "mouse.glsl", "gradients.glsl", "layer.glsl", "post.glsl", "vertex.glsl"].map(read);
  const declared = new Set<string>();
  for (const source of sources) {
    for (const m of stripComments(source).matchAll(/^\s*uniform\s+\w+\s+(\w+)/gm)) declared.add(m[1]);
  }

  it("every uniform a shader declares is listed in PROGRAM_UNIFORM_NAMES", () => {
    // u_colors is an array; its elements are looked up as u_colors[i].
    const arrays = new Set(["u_colors"]);
    const missing = [...declared].filter((name) => !arrays.has(name) && !PROGRAM_UNIFORM_NAMES.includes(name));
    expect(missing, "uniforms the engine would never set").toEqual([]);
  });

  it("every listed uniform is declared by some shader", () => {
    const stale = PROGRAM_UNIFORM_NAMES.filter((name) => !declared.has(name));
    expect(stale).toEqual([]);
  });
});
