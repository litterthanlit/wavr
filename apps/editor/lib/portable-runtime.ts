import {
  MAX_POINTER_SPEED,
  MAX_POINTER_STEP,
  PALETTE_SIZE,
  POINTER_OMEGA,
  PRESENCE_OMEGA_IN,
  PRESENCE_OMEGA_OUT,
  SNAP_PRESENCE,
  effectiveBlend,
} from "@wavr/core";
import { PORTABLE_VERTEX_SHADER, buildPortableShader, type PortableSettings } from "./portable-shader";

/**
 * The JavaScript half of the portable code exports: the palette, the WebGL
 * setup, the draw loop and, when the pointer is on, the pointer. React,
 * web-component and standalone exports all embed the same text, so they can't
 * differ; only the host around it does (a hook, a custom element).
 *
 * The same text is emitted as TypeScript (for the React component, which a
 * strict project has to accept) or as plain JavaScript: `t("...")` below is a
 * type annotation that only the TypeScript flavour keeps.
 *
 * Two parts are ports of engine code, kept to the same arithmetic so the output
 * matches the editor, and checked against it in portable-runtime.test.ts:
 * the palette bake (packages/core/src/palette.ts) and the pointer smoothing
 * (packages/core/src/pointer.ts, with the constants taken from there).
 */

export type PortableLanguage = "ts" | "js";

/** A number as short as it can be, without losing a visible digit: 0.388, 1, 0. */
function jsNumber(value: number): string {
  return String(+value.toFixed(3));
}

/** Text safe inside a JavaScript template literal. */
export function templateLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

/**
 * Everything the host needs, as source text: the palette settings, the shaders,
 * the helpers and `startWavr(canvas, scrollLinked)`. startWavr draws into the
 * canvas until the function it returns is called, and returns undefined where
 * WebGL 2 isn't available.
 */
export function portableModule(settings: PortableSettings, language: PortableLanguage): string {
  const shader = buildPortableShader(settings);
  const t = (annotation: string) => (language === "ts" ? annotation : "");
  const bang = t("!");
  const uses = (uniform: string) => shader.uniforms.has(uniform);
  const pointer = settings.mouseReact > 0;
  const blend = effectiveBlend(settings.colorBlend, settings.softness);

  const colors = settings.colors.map((c) => `  [${c.map(jsNumber).join(", ")}],`).join("\n");

  const palette = `// The palette is baked into a ${PALETTE_SIZE} x 1 texture that the shader reads with one fetch: a smooth curve
// through the stops, in Oklab or sRGB, then averaged over a few neighbours by BLEND. This is the editor's own
// palette maths.
const toLinear = (c${t(": number")}) => (c >= 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92);
const toSrgb = (c${t(": number")}) => (c >= 0.0031308 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : c * 12.92);
const toOklab = (c${t(": number[]")}) => {
${settings.displayP3 ? `  // The colours are Display P3; Oklab is defined on linear sRGB.
  const pr = toLinear(c[0]);
  const pg = toLinear(c[1]);
  const pb = toLinear(c[2]);
  const r = 1.2249401 * pr - 0.2249404 * pg;
  const g = -0.0420569 * pr + 1.0420571 * pg;
  const b = -0.0196376 * pr - 0.0786361 * pg + 1.0982735 * pb;` : `  const r = toLinear(c[0]);
  const g = toLinear(c[1]);
  const b = toLinear(c[2]);`}
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const fromOklab = (lab${t(": number[]")}) => {
  const l = lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2];
  const m = lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2];
  const s = lab[0] - 0.0894841775 * lab[1] - 1.291485548 * lab[2];
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
${settings.displayP3 ? `  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const b = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;
  // Back to Display P3.
  return [
    0.8224621 * r + 0.177538 * g,
    0.0331941 * r + 0.9668058 * g,
    0.0170827 * r + 0.0723974 * g + 0.9105199 * b,
  ].map((c) => toSrgb(Math.max(c, 0)));` : `  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ].map((c) => toSrgb(Math.max(c, 0)));`}
};
const mixStops = COLORS.map((c) => (OKLAB ? toOklab(c) : c));
// The direction the curve passes each stop in: toward the next stop from the one before, so the colour never
// rests on a stop. A channel that repeats, peaks or dips at the stop gets none, so repeated stops hold their
// colour and no channel overshoots a stop it peaks or dips at. Nor do the two ends, so the palette is flat
// where the shader folds it back.
const tangents = mixStops.map((c, j) =>
  c.map((v, i) => {
    if (j === 0 || j === mixStops.length - 1) return 0;
    const d0 = v - mixStops[j - 1][i];
    const d1 = mixStops[j + 1][i] - v;
    return d0 * d1 > 0 ? 0.5 * (d0 + d1) : 0;
  }),
);
// The texture covers t from -REACH to 1 + REACH: how far the blend still moves the colour past the ends.
const REACH = BLEND < 0.01 ? 0 : BLEND * 0.3;
const SPAN = 1 + 2 * REACH;

// The colour at position t along the stops, as sRGB.
const sampleStops = (t${t(": number")}) => {
  const last = mixStops.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * last;
  const index = Math.floor(scaled);
  const next = Math.min(index + 1, last);
  const f = scaled - index;
  const step = f * f * (3 - 2 * f);
  const leave = f * (1 - f) * (1 - f);
  const arrive = f * f * (f - 1);
  const a = mixStops[index];
  const b = mixStops[next];
  const ta = tangents[index];
  const tb = tangents[next];
  const c = [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * step + ta[i] * leave + tb[i] * arrive);
  return OKLAB ? fromOklab(c) : c.map((v) => Math.max(v, 0));
};

const bakePalette = () => {
  const taps = BLEND < 0.01 ? [[0, 1]] : [[0, 0.4], [-1, 0.15], [1, 0.15], [-2, 0.1], [2, 0.1], [-0.5, 0.05], [0.5, 0.05]];
  const spread = BLEND * 0.15;
  const data = new Float32Array(${PALETTE_SIZE} * 4);
  for (let i = 0; i < ${PALETTE_SIZE}; i++) {
    const t = -REACH + (SPAN * i) / ${PALETTE_SIZE - 1};
    let r = 0;
    let g = 0;
    let b = 0;
    for (const [offset, weight] of taps) {
      const c = sampleStops(t + offset * spread);
      r += c[0] * weight;
      g += c[1] * weight;
      b += c[2] * weight;
    }
    data.set([r, g, b, 1], i * 4);
  }
  return data;
};`;

  const spring = `// A critically damped spring, advanced exactly: the editor's pointer smoothing, which follows the cursor
// closely without ever overshooting it.
const spring = (s${t(": { value: number; velocity: number }")}, target${t(": number")}, omega${t(": number")}, dt${t(": number")}) => {
  const decay = Math.exp(-omega * dt);
  const offset = s.value - target;
  const carry = (s.velocity + omega * offset) * dt;
  s.value = target + (offset + carry) * decay;
  s.velocity = (s.velocity - omega * carry) * decay;
};`;

  const pointerSetup = `
  // The pointer: smoothed like the editor's, and present only while it is over the canvas.
  const px = { value: 0.5, velocity: 0 };
  const py = { value: 0.5, velocity: 0 };
  const presence = { value: 0, velocity: 0 };
  let targetX = 0.5;
  let targetY = 0.5;
  let inside = false;
  const aim = (event${t(": PointerEvent")}) => {
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return;
    targetX = (event.clientX - rect.left) / rect.width;
    targetY = 1 - (event.clientY - rect.top) / rect.height;
    if (!inside) {
      inside = true;
      // Arriving from outside: start at the pointer instead of sweeping in from where it left.
      if (presence.value < ${SNAP_PRESENCE}) {
        px.value = targetX;
        py.value = targetY;
        px.velocity = 0;
        py.velocity = 0;
      }
    }
  };
  const leave = () => {
    inside = false;
  };
  canvas.addEventListener("pointerenter", aim);
  canvas.addEventListener("pointermove", aim);
  canvas.addEventListener("pointerdown", aim);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("pointercancel", leave);
  window.addEventListener("blur", leave);
  const uMouseSmooth = uniform("u_mouseSmooth");
  const uMouseVelocity = uniform("u_mouseVelocity");
  const uMousePresence = uniform("u_mousePresence");
  const steer = (dt${t(": number")}) => {
    const step = Math.min(Math.max(dt, 0), ${MAX_POINTER_STEP});
    spring(px, targetX, ${POINTER_OMEGA}, step);
    spring(py, targetY, ${POINTER_OMEGA}, step);
    spring(presence, inside ? 1 : 0, inside ? ${PRESENCE_OMEGA_IN} : ${PRESENCE_OMEGA_OUT}, step);
    presence.value = Math.min(Math.max(presence.value, 0), 1);
    // The shader wants the velocity in canvas heights per second, capped.
    let vx = px.velocity * (canvas.width / canvas.height);
    let vy = py.velocity;
    const speed = Math.hypot(vx, vy);
    if (speed > ${MAX_POINTER_SPEED}) {
      vx *= ${MAX_POINTER_SPEED} / speed;
      vy *= ${MAX_POINTER_SPEED} / speed;
    }
    gl.uniform2f(uMouseSmooth, px.value, py.value);
    gl.uniform2f(uMouseVelocity, vx, vy);
    gl.uniform1f(uMousePresence, presence.value);
  };
`;

  const paletteUniforms = [
    uses("u_paletteTexture") &&
      `  gl.uniform1i(uniform("u_paletteTexture"), 0);\n  gl.uniform2f(uniform("u_paletteDomain"), 1 / SPAN, REACH / SPAN);`,
    uses("u_colors") && `  gl.uniform3fv(uniform("u_colors"), COLORS.flat());`,
  ].filter(Boolean).join("\n");

  const start = `// Draws the gradient into \`canvas\` until the function it returns is called.
// scrollLinked: time follows the page's scroll position instead of the clock.
function startWavr(canvas${t(": HTMLCanvasElement")}, scrollLinked${t(": boolean")})${t(": (() => void) | undefined")} {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false });
  if (!gl) return undefined;
${settings.displayP3 ? `  // The colours are Display P3: present them so where the browser can (elsewhere they show as sRGB).
  if ("drawingBufferColorSpace" in gl) gl.drawingBufferColorSpace = "display-p3";
` : ""}
  const compile = (type${t(": number")}, source${t(": string")}) => {
    const shader = gl.createShader(type)${bang};
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
    return shader;
  };
  const program = gl.createProgram()${bang};
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  gl.useProgram(program);
  const uniform = (name${t(": string")}) => gl.getUniformLocation(program, name);

  // A quad that covers the canvas.
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, ${PALETTE_SIZE}, 1, 0, gl.RGBA, gl.FLOAT, bakePalette());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
${paletteUniforms}
  const uTime = uniform("u_time");
  const uResolution = uniform("u_resolution");

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
${pointer ? pointerSetup : ""}
  let raf = 0;
  let time = 0;
  let last = performance.now();
  let lastDraw = 0;
  const render = () => {
    raf = requestAnimationFrame(render);
    const now = performance.now();
    if (document.hidden || now - lastDraw < 1000 / 45) return;
    lastDraw = now;
    const dt = (now - last) / 1000;
    last = now;
    if (scrollLinked) {
      const range = document.documentElement.scrollHeight - window.innerHeight;
      time = range > 0 ? (window.scrollY / range) * 10 : 0;
    } else {
      time += dt;
    }
${pointer ? "    steer(dt);\n" : ""}    gl.uniform1f(uTime, time);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  render();

  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
${pointer ? `    canvas.removeEventListener("pointerenter", aim);
    canvas.removeEventListener("pointermove", aim);
    canvas.removeEventListener("pointerdown", aim);
    canvas.removeEventListener("pointerleave", leave);
    canvas.removeEventListener("pointercancel", leave);
    window.removeEventListener("blur", leave);
` : ""}    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };
}`;

  return `// The palette, ${settings.displayP3 ? "Display P3 " : ""}r g b in 0..1. Edit the colours and the gradient follows.
const COLORS${t(": number[][]")} = [
${colors}
];
const OKLAB = ${settings.oklab}; // blend the colours in Oklab, which keeps mixes clean and bright
const BLEND = ${jsNumber(blend)}; // how far neighbouring colours melt into each other; 0 keeps the stops crisp

const VERTEX = \`${templateLiteral(PORTABLE_VERTEX_SHADER)}\`;

const FRAGMENT = \`${templateLiteral(shader.source)}\`;

${palette}
${pointer ? `\n${spring}\n` : ""}
${start}`;
}

/**
 * Indents every line of generated JavaScript except the lines inside a template
 * literal (the shaders), which are left as they are.
 */
export function indentCode(code: string, indent: string): string {
  let inTemplate = false;
  return code
    .split("\n")
    .map((line) => {
      const out = inTemplate || line === "" ? line : indent + line;
      // Every backtick that isn't escaped opens or closes a template literal.
      if (line.replace(/\\`/g, "").split("`").length % 2 === 0) inTemplate = !inTemplate;
      return out;
    })
    .join("\n");
}

/**
 * Drops comments, indentation and blank lines: for the standalone player,
 * which is read by the browser, not by a person. Nothing the exports generate
 * has a `//` inside a string.
 */
export function compactCode(code: string): string {
  return code
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter((line) => line !== "")
    .join("\n");
}
