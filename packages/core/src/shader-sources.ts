import vertexSource from "./shaders/vertex.glsl";
import hslSource from "./shaders/hsl.glsl";
import blendModesSource from "./shaders/blend-modes.glsl";
import commonSource from "./shaders/common.glsl";
import mouseSource from "./shaders/mouse.glsl";
import gradientsSource from "./shaders/gradients.glsl";
import layerSource from "./shaders/layer.glsl";
import postSource from "./shaders/post.glsl";

/** The GLSL files the fragment programs are assembled from. */
export interface ShaderParts {
  hsl: string;
  blendModes: string;
  common: string;
  mouse: string;
  gradients: string;
  layer: string;
  post: string;
}

export const SHADER_PARTS: ShaderParts = {
  hsl: hslSource,
  blendModes: blendModesSource,
  common: commonSource,
  mouse: mouseSource,
  gradients: gradientsSource,
  layer: layerSource,
  post: postSource,
};

/** Vertex shader of the layer program: fullscreen quad or displaced mesh. */
export const LAYER_VERTEX_SOURCE = vertexSource;

/** Fullscreen-quad vertex shader of the post, trail and bloom programs. */
export const FULLSCREEN_VERTEX_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// highp samplers: the composite target may be half-float, and lowp lookups
// would round it on some mobile GPUs.
const PRELUDE = "precision highp float;\nprecision highp sampler2D;\n";

// `#define`s go right after `#version`; the shader files declare neither.
function header(defines: readonly string[]): string {
  return `#version 300 es\n${defines.map((d) => `#define ${d}\n`).join("")}${PRELUDE}`;
}

// Compile errors read `ERROR: <file>:<line>`. Each part is numbered so that
// <line> is the line in its own file: 1 hsl, 2 blend-modes, 3 common, 4 mouse,
// 5 the Custom GLSL body, 6 gradients, 7 layer, 8 post.
const FILE = { hsl: 1, blendModes: 2, common: 3, mouse: 4, custom: 5, gradients: 6, layer: 7, post: 8 } as const;
const file = (index: number, source: string) => `#line 1 ${index}\n${source}`;

/**
 * Fragment source of a layer program. A gradient id (GRADIENT_TYPE_IDS) gives
 * a program holding only that gradient function; `{ custom }` gives the Custom
 * GLSL program, whose `customGradient` body is the user's code and which holds
 * no built-in gradient. Both inline the gradient exactly once, in layer main.
 */
export function assembleLayerSource(
  gradient: number | { custom: string },
  parts: ShaderParts = SHADER_PARTS,
): string {
  const custom = typeof gradient === "object";
  const defines = custom ? ["WAVR_GRADIENT -1", "WAVR_CUSTOM"] : [`WAVR_GRADIENT ${gradient}`];
  return [
    header(defines),
    file(FILE.hsl, parts.hsl),
    file(FILE.blendModes, parts.blendModes),
    file(FILE.common, parts.common),
    file(FILE.mouse, parts.mouse),
    // Declared before gradients.glsl, whose computeGradient calls it. Line 0
    // is the signature, so the user's first line is line 1 in errors.
    custom ? `#line 0 ${FILE.custom}\nvec3 customGradient(vec2 uv, float time) {\n${gradient.custom}\n}\n` : "",
    file(FILE.gradients, parts.gradients),
    file(FILE.layer, parts.layer),
  ].join("\n");
}

/** Fragment source of the post program: global effects, no gradient code. */
export function assemblePostSource(parts: ShaderParts = SHADER_PARTS): string {
  return [header([]), file(FILE.common, parts.common), file(FILE.post, parts.post)].join("\n");
}
