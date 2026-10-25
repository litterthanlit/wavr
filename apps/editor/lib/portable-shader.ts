import { GRADIENT_TYPE_IDS, SHADER_PARTS, type ColorProfile, type ShaderParts } from "@wavr/core";

/**
 * The fragment shader of the portable code exports (React component, web
 * component, standalone player): one gradient layer, the colour grade of the
 * post pass and, when the pointer is on, the pointer warp.
 *
 * It is not a second implementation of the gradients. It is cut out of the
 * engine's own GLSL (packages/core/src/shaders): the chosen gradient function,
 * mouseWarp() and the helpers they call, found by following the calls from the
 * gradient function down, in the order the engine has them. So an export can't
 * fall behind the editor, and it holds only what its gradient uses, as the
 * engine's program does. Values the engine sets as uniforms (scale, softness,
 * ...) become `const`s at the top of the output, named in capitals, where a
 * user can edit them; the palette, the colours of the mesh and dither modes
 * and the pointer stay uniforms, set by the runtime in portable-runtime.ts.
 *
 * The cutting is by names, so it relies on how the shader files are written:
 * every function and `const` starts in column 0, and a function ends with a `}`
 * in column 0 (or on its own line). portable-shader.test.ts fails if that
 * stops being true, or if a gradient starts using a uniform this file doesn't
 * know how to provide.
 */

/** What an export is built from. Only the first block is required; the rest default to the editor's own defaults. */
export interface PortableState {
  colors: [number, number, number][];
  gradientType: string;
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  softness?: number;
  brightness: number;
  saturation: number;
  /** Degrees. */
  hueShift?: number;
  domainWarp?: number;
  /** Global colour blend, 0..1: how far neighbouring palette colours melt into each other. */
  colorBlend?: number;
  /** Mix colours in Oklab (default) rather than sRGB. */
  oklabEnabled?: boolean;
  /** 0 = none, 1 = highlight shoulder, 2 = ACES (default 1). */
  toneMapMode?: number;
  /** "display-p3": the colours are Display P3, and the canvas presents them so (default "srgb"). */
  colorProfile?: ColorProfile;
  /** Pointer reactivity, 0..1. 0 (the default here) leaves the pointer code out. */
  mouseReact?: number;
  /** Anti-banding noise (default on, strength 1 = half a level either way). */
  debandEnabled?: boolean;
  debandStrength?: number;
}

/** A PortableState with every default applied and every value in range. */
export interface PortableSettings {
  /** The gradient the shader holds: the state's type, or mesh where a portable export has nothing to draw (image, unknown). */
  gradientType: string;
  gradientId: number;
  colors: [number, number, number][];
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  softness: number;
  brightness: number;
  saturation: number;
  hueShift: number;
  domainWarp: number;
  colorBlend: number;
  oklab: boolean;
  toneMapMode: number;
  /** The colours are Display P3 values. */
  displayP3: boolean;
  mouseReact: number;
  /** Strength of the anti-banding noise in 8-bit levels, 0 = off. */
  deband: number;
}

const MAX_COLORS = 8;

function finite(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function resolvePortableSettings(state: PortableState): PortableSettings {
  const ids = GRADIENT_TYPE_IDS as Record<string, number>;
  // The image mode samples an uploaded picture, which a portable export doesn't carry.
  const gradientType = state.gradientType in ids && state.gradientType !== "image" ? state.gradientType : "mesh";
  const colors = state.colors.slice(0, MAX_COLORS).map((c) => [c[0], c[1], c[2]] as [number, number, number]);
  const toneMapMode = Math.round(finite(state.toneMapMode, 1));
  return {
    gradientType,
    gradientId: ids[gradientType],
    colors: colors.length > 0 ? colors : [[0, 0, 0]],
    speed: finite(state.speed, 0.4),
    complexity: clamp(Math.round(finite(state.complexity, 3)), 1, 8),
    scale: finite(state.scale, 1),
    distortion: finite(state.distortion, 0.3),
    softness: finite(state.softness, 0),
    brightness: finite(state.brightness, 1),
    saturation: finite(state.saturation, 1),
    hueShift: finite(state.hueShift, 0),
    domainWarp: finite(state.domainWarp, 0),
    colorBlend: clamp(finite(state.colorBlend, 0), 0, 1),
    oklab: state.oklabEnabled !== false,
    toneMapMode: toneMapMode >= 0 && toneMapMode <= 2 ? toneMapMode : 1,
    displayP3: state.colorProfile === "display-p3",
    mouseReact: clamp(finite(state.mouseReact, 0), 0, 1),
    deband: state.debandEnabled === false ? 0 : Math.max(0, finite(state.debandStrength, 1)),
  };
}

export const PORTABLE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// Preprocessing: just enough of the GLSL preprocessor for the shader files.
// ---------------------------------------------------------------------------

/**
 * Resolves `#if` / `#elif` / `#else` / `#endif` / `#define` / `#error` for a
 * program with the given defines, and substitutes object-like macros. Handles
 * the forms the shader files use: `defined(X)` and `NAME == N` / `NAME != N`.
 */
function preprocess(source: string, defines: Map<string, string>): string {
  const evaluate = (expression: string): boolean => {
    const text = expression.trim();
    let m = /^defined\(\s*(\w+)\s*\)$/.exec(text);
    if (m) return defines.has(m[1]);
    m = /^(\w+)\s*(==|!=)\s*(-?\d+)$/.exec(text);
    if (m) {
      const value = defines.get(m[1]);
      if (value === undefined) throw new Error(`portable shader: undefined identifier in #if: ${m[1]}`);
      return (Number(value) === Number(m[3])) === (m[2] === "==");
    }
    throw new Error(`portable shader: unsupported #if expression: ${text}`);
  };

  // Per #if: [parent active, some branch taken, this branch active]
  const stack: [boolean, boolean, boolean][] = [];
  let active = true;
  const out: string[] = [];
  for (const line of source.split("\n")) {
    const directive = /^\s*#\s*(\w+)\s*(.*)$/.exec(line);
    if (!directive) {
      if (active) out.push(substituteMacros(line, defines));
      continue;
    }
    const [, name, rest] = directive;
    switch (name) {
      case "define": {
        const [key, ...value] = rest.trim().split(/\s+/);
        if (active) defines.set(key, value.join(" "));
        break;
      }
      case "if": {
        const taken: boolean = active && evaluate(rest);
        stack.push([active, taken, taken]);
        active = taken;
        break;
      }
      case "elif": {
        const frame = stack[stack.length - 1];
        const taken: boolean = frame[0] && !frame[1] && evaluate(rest);
        frame[1] ||= taken;
        active = taken;
        break;
      }
      case "else": {
        const frame = stack[stack.length - 1];
        const taken: boolean = frame[0] && !frame[1];
        frame[1] = true;
        active = taken;
        break;
      }
      case "endif":
        active = stack.pop()![0];
        break;
      case "error":
        if (active) throw new Error(`portable shader: #error ${rest}`);
        break;
      default:
        throw new Error(`portable shader: unsupported directive #${name}`);
    }
  }
  return out.join("\n");
}

/** Replaces macros that were #defined to a name, e.g. WAVR_MOUSE_WARP -> mouseWarpPush. */
function substituteMacros(line: string, defines: Map<string, string>): string {
  let result = line;
  for (const [name, value] of defines) {
    if (value && /^\w+$/.test(value) && name.startsWith("WAVR_")) {
      result = result.replace(new RegExp(`\\b${name}\\b`, "g"), value);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cutting: the top-level definitions of a shader file, and what each calls.
// ---------------------------------------------------------------------------

interface Definition {
  name: string;
  /** Source lines, with the comment directly above the definition when the file's comments are kept. */
  text: string;
  /** The definition itself without comments: what to scan for calls. */
  code: string;
}

const TYPE_NAME = String.raw`(?:void|bool|int|uint|float|[ibu]?vec[234]|mat[234](?:x[234])?|[A-Z]\w*)`;
const FUNCTION_START = new RegExp(`^${TYPE_NAME}\\s+(\\w+)\\s*\\(`);
const CONSTANT = /^const\s+\w+\s+(\w+)\s*=/;
const STRUCT_START = /^struct\s+(\w+)\s*\{/;

const stripComments = (line: string) => line.replace(/\/\/.*$/, "");

/**
 * Functions, constants and structs of a preprocessed shader file, in source
 * order. `keepComments`: whether a definition takes the comment above it along
 * (the comments inside a definition always stay).
 */
function definitionsOf(source: string, file: string, keepComments: boolean): Definition[] {
  const lines = source.split("\n");
  const found: Definition[] = [];
  let commentStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("//")) {
      if (commentStart < 0) commentStart = i;
      continue;
    }
    const first = commentStart >= 0 ? commentStart : i;
    commentStart = -1;

    const fn = FUNCTION_START.exec(line);
    const constant = fn ? null : CONSTANT.exec(line);
    const struct = fn || constant ? null : STRUCT_START.exec(line);
    const match = fn ?? constant ?? struct;
    if (!match) continue;

    let end = i;
    if (!constant) {
      // Up to the brace that closes the first one.
      let depth = 0;
      let opened = false;
      for (end = i; end < lines.length; end++) {
        for (const ch of stripComments(lines[end])) {
          if (ch === "{") {
            depth++;
            opened = true;
          } else if (ch === "}") depth--;
        }
        if (opened && depth === 0) break;
      }
      if (end >= lines.length) throw new Error(`portable shader: unterminated ${match[1]} in ${file}`);
    }
    found.push({
      name: match[1],
      text: lines.slice(keepComments ? first : i, end + 1).join("\n"),
      code: lines.slice(i, end + 1).map(stripComments).join("\n"),
    });
    i = end;
  }
  return found;
}

const identifiersOf = (code: string) => code.match(/\b[A-Za-z_]\w*\b/g) ?? [];

// ---------------------------------------------------------------------------
// The shader
// ---------------------------------------------------------------------------

/** Uniforms the runtime sets, and how they are declared. Anything else with a u_ prefix has to be a constant below. */
function uniformDeclarations(colorCount: number): Record<string, string> {
  return {
    u_time: "uniform float u_time;",
    u_resolution: "uniform vec2 u_resolution;",
    u_paletteTexture: "uniform sampler2D u_paletteTexture;",
    u_paletteDomain: "uniform vec2 u_paletteDomain;",
    u_colors: `uniform vec3 u_colors[${colorCount}];`,
    u_colorsMix: `uniform vec3 u_colorsMix[${colorCount}];`,
    u_oklabEnabled: "uniform bool u_oklabEnabled;",
    u_mouseSmooth: "uniform vec2 u_mouseSmooth;",
    u_mouseVelocity: "uniform vec2 u_mouseVelocity;",
    u_mousePresence: "uniform float u_mousePresence;",
  };
}

/** Uniforms of the engine that are fixed in an export: they become capitalised constants. */
function constantDeclarations(s: PortableSettings): Record<string, { name: string; declaration: string }> {
  const float = (name: string, value: number) => ({ name, declaration: `const float ${name} = ${glslFloat(value)};` });
  const int = (name: string, value: number) => ({ name, declaration: `const int ${name} = ${value};` });
  return {
    u_speed: float("SPEED", s.speed),
    u_scale: float("SCALE", s.scale),
    u_complexity: float("COMPLEXITY", s.complexity),
    u_distortion: float("DISTORTION", s.distortion),
    u_softness: float("SOFTNESS", s.softness),
    u_domainWarp: float("DOMAIN_WARP", s.domainWarp),
    u_colorBlend: float("COLOR_BLEND", s.colorBlend),
    u_colorCount: int("COLOR_COUNT", s.colors.length),
    u_mouseReact: float("MOUSE_REACT", s.mouseReact),
    u_toneMapMode: {
      name: "TONE_MAP_MODE",
      declaration: `const int TONE_MAP_MODE = ${s.toneMapMode}; // 0 none, 1 highlight shoulder, 2 ACES filmic`,
    },
    u_displayP3: {
      name: "DISPLAY_P3",
      declaration: `const bool DISPLAY_P3 = ${s.displayP3}; // the colours are Display P3`,
    },
  };
}

/** The engine's HDR helpers (common.glsl, post.glsl) as they are in standard range, the only range an export presents. */
const STANDARD_RANGE: Record<string, string> = {
  framePeak: "float framePeak() { return 1.0; }",
  displayPeak: "float displayPeak() { return 1.0; }",
  peakShoulder: "vec3 peakShoulder(vec3 c, float knee) { return highlightShoulder(c, knee); }",
};

/** Order the constants appear in, with a comment per group. */
const CONSTANT_GROUPS: { comment: string; names: string[] }[] = [
  { comment: "Look: edit and reload", names: ["SPEED", "SCALE", "COMPLEXITY", "DISTORTION", "SOFTNESS", "DOMAIN_WARP", "COLOR_BLEND", "COLOR_COUNT"] },
  { comment: "Pointer: 0 switches it off", names: ["MOUSE_REACT"] },
  { comment: "Colour grade", names: ["BRIGHTNESS", "SATURATION", "HUE_SHIFT", "TONE_MAP_MODE", "DISPLAY_P3", "DEBAND"] },
];

/** A GLSL float literal with at most 3 decimals: 0.4, 1.0, -0.25. */
export function glslFloat(value: number): string {
  const text = String(+value.toFixed(3));
  return /[.e]/.test(text) ? text : `${text}.0`;
}

export interface PortableShader {
  source: string;
  /** The uniforms the source declares (and the runtime therefore has to set). */
  uniforms: ReadonlySet<string>;
}

/**
 * Builds the shader of a portable export from the engine's shader sources
 * (`parts` is for tests; it defaults to the real ones).
 */
export function buildPortableShader(settings: PortableSettings, parts: ShaderParts = SHADER_PARTS): PortableShader {
  const s = settings;
  const pointer = s.mouseReact > 0;
  const hue = Math.abs(s.hueShift) > 0.01;

  const defines = () => new Map([["WAVR_GRADIENT", String(s.gradientId)]]);
  const pool: Definition[] = [
    // The helpers' own comments describe the engine (palette textures, render scale); the gradient's and the
    // pointer's say what the look and the interaction are, which is what someone reading the export wants.
    ...definitionsOf(preprocess(parts.common, defines()), "common.glsl", false),
    ...definitionsOf(preprocess(parts.post, defines()), "post.glsl", false),
    ...definitionsOf(preprocess(parts.mouse, defines()), "mouse.glsl", true),
    ...definitionsOf(preprocess(parts.gradients, defines()), "gradients.glsl", true),
  ];
  // Exports are standard range: the engine's HDR helpers collapse to white.
  for (const definition of pool) {
    const standard = STANDARD_RANGE[definition.name];
    if (standard) definition.text = definition.code = standard;
  }
  const byName = new Map<string, Definition[]>();
  for (const definition of pool) byName.set(definition.name, [...(byName.get(definition.name) ?? []), definition]);

  // The gradient the engine's dispatcher calls for this id.
  const dispatch = byName.get("computeGradient")?.[0];
  const gradient = dispatch && /return\s+(\w+)\s*\(\s*uv\s*,\s*time\s*\)\s*;/.exec(dispatch.code)?.[1];
  if (!gradient || !byName.has(gradient)) throw new Error(`portable shader: no gradient function for id ${s.gradientId}`);

  const roots = [
    gradient,
    "adjustSaturation",
    "applyToneMap",
    ...(pointer ? ["mouseWarp"] : []),
    ...(hue ? ["rotateHue"] : []),
    ...(s.deband > 0 ? ["interleavedGradientNoise"] : []),
  ];
  const needed = new Set<Definition>();
  const visit = (name: string) => {
    for (const definition of byName.get(name) ?? []) {
      if (needed.has(definition)) continue;
      needed.add(definition);
      for (const identifier of identifiersOf(definition.code)) {
        if (identifier !== definition.name) visit(identifier);
      }
    }
  };
  for (const root of roots) {
    if (!byName.has(root)) throw new Error(`portable shader: the engine's shaders no longer define ${root}()`);
    visit(root);
  }
  // Blank line between definitions, except between one-liners.
  const code = pool
    .filter((definition) => needed.has(definition))
    .reduce((joined, { text }, index, list) => {
      const oneLiners = index > 0 && !text.includes("\n") && !list[index - 1].text.includes("\n");
      return index === 0 ? text : `${joined}${oneLiners ? "\n" : "\n\n"}${text}`;
    }, "");

  // The main function: the layer program's, then the post pass's colour grade, in the engine's order.
  const main = `void main() {
  ${pointer ? "// The pointer bends the picture around it, as in the editor.\n  vec2 uv = mouseWarp(v_uv);" : "vec2 uv = v_uv;"}
  vec3 color = clamp(${gradient}(uv, u_time * SPEED), 0.0, 1.0);
${hue ? "  color = rotateHue(color, HUE_SHIFT * 6.28318 / 360.0);\n" : ""}  color = adjustSaturation(color, SATURATION);
  color *= BRIGHTNESS;
  color = clamp(applyToneMap(color), 0.0, 1.0);
${s.deband > 0 ? "  // Half a level of noise either way, so slow gradients don't band.\n  color += vec3(interleavedGradientNoise(gl_FragCoord.xy) - 0.5) * (DEBAND / 255.0);\n" : ""}  fragColor = vec4(color, 1.0);
}`;

  // Every u_ name in the cut-out code is either a uniform the runtime sets or one of the engine's
  // parameters, which become constants here. Comments don't count.
  const scanned = [...needed.values(), { code: main }].map((definition) => definition.code.split("\n").map(stripComments).join("\n")).join("\n");
  const uniformDeclared = uniformDeclarations(s.colors.length);
  const constants = constantDeclarations(s);
  const uniforms = new Set<string>(["u_time", "u_resolution"]);
  const declared = new Map<string, string>();
  let renamed = `${code}\n\n${main}`;
  for (const name of new Set(scanned.match(/\bu_\w+\b/g))) {
    if (name in uniformDeclared) {
      uniforms.add(name);
    } else if (name in constants) {
      declared.set(constants[name].name, constants[name].declaration);
      renamed = renamed.replace(new RegExp(`\\b${name}\\b`, "g"), constants[name].name);
    } else {
      throw new Error(`portable shader: ${gradient} uses ${name}, which portable exports don't provide`);
    }
  }
  // The parameters of the main function.
  declared.set("SPEED", `const float SPEED = ${glslFloat(s.speed)};`);
  declared.set("BRIGHTNESS", `const float BRIGHTNESS = ${glslFloat(s.brightness)};`);
  declared.set("SATURATION", `const float SATURATION = ${glslFloat(s.saturation)};`);
  if (hue) declared.set("HUE_SHIFT", `const float HUE_SHIFT = ${glslFloat(s.hueShift)}; // degrees`);
  if (s.deband > 0) declared.set("DEBAND", `const float DEBAND = ${glslFloat(s.deband)}; // 8-bit levels`);

  const constantLines = CONSTANT_GROUPS.flatMap(({ comment, names }) => {
    const lines = names.filter((name) => declared.has(name)).map((name) => declared.get(name)!);
    return lines.length > 0 ? [`// ${comment}`, ...lines, ""] : [];
  });
  const uniformLines = Object.keys(uniformDeclared).filter((name) => uniforms.has(name)).map((name) => uniformDeclared[name]);

  const source = [
    "#version 300 es",
    "precision highp float;",
    "precision highp sampler2D;",
    `// The ${s.gradientType} gradient of the Wavr editor, as one layer. The gradient and the functions it`,
    "// calls are the editor's own shader code. The palette (getGradientColor) is the one the script",
    "// below bakes from COLORS into a texture.",
    "in vec2 v_uv;",
    "out vec4 fragColor;",
    "",
    ...uniformLines,
    "",
    ...constantLines,
    renamed,
  ].join("\n");
  return { source: source.replace(/\n{3,}/g, "\n\n"), uniforms };
}

/** The fragment shader of a portable export. */
export function portableFragmentShader(state: PortableState, parts?: ShaderParts): string {
  return buildPortableShader(resolvePortableSettings(state), parts).source;
}
