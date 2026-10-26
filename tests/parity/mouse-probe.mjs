// Measures the pointer warp (mouse.glsl) itself, not a picture: for each style
// it renders mouseWarp(uv) - uv into a float target and reports the peak
// displacement, how far the influence reaches and whether it is a circle, in
// aspect-correct canvas heights. Use it to keep the styles calibrated against
// each other (every style should land near MOUSE_STILL / MOUSE_MOVING in
// mouse.glsl at react = 1) after changing a constant there.
//
//   node tests/parity/mouse-probe.mjs [--width 1024 --height 576]
//
// Same browser setup as snapshot.mjs (headless Chromium on SwiftShader).

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHADERS = path.resolve(HERE, "../../packages/core/src/shaders");
const read = (name) => fs.readFileSync(path.join(SHADERS, name), "utf8");

const args = process.argv.slice(2);
const flag = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const WIDTH = flag("--width", 1024);
const HEIGHT = flag("--height", 576);

// A representative gradient id for each style (see the table in mouse.glsl).
const STYLES = [
  { style: "push", id: 25 },
  { style: "lens", id: 19 },
  { style: "swirl", id: 17 },
  { style: "wave", id: 18 },
  { style: "custom (lens)", id: -1, custom: true },
];

const fragment = (style) =>
  [
    "#version 300 es",
    `#define WAVR_GRADIENT ${style.id}`,
    style.custom ? "#define WAVR_CUSTOM" : "",
    "precision highp float;\nprecision highp sampler2D;",
    read("hsl.glsl"),
    read("common.glsl"),
    read("mouse.glsl"),
    `void main() {
      vec2 d = (mouseWarp(v_uv) - v_uv) * vec2(u_resolution.x / u_resolution.y, 1.0);
      fragColor = vec4(d, length(d), 1.0);
    }`,
  ].join("\n");

const executablePath =
  process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({
  executablePath,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

try {
  const page = await browser.newPage();
  const results = await page.evaluate(
    ({ styles, fragments, width, height }) => {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2");
      if (!gl || !gl.getExtension("EXT_color_buffer_float")) throw new Error("needs WebGL2 with float render targets");

      const vertex = `#version 300 es
        layout(location = 0) in vec2 a_position;
        out vec2 v_uv;
        void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      };

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.viewport(0, 0, width, height);
      const pixels = new Float32Array(width * height * 4);
      const aspect = width / height;

      // One render and its statistics, in canvas heights.
      const measure = (program, pointer, velocity, react, presence) => {
        const set2 = (name, x, y) => gl.uniform2f(gl.getUniformLocation(program, name), x, y);
        const set1 = (name, v) => gl.uniform1f(gl.getUniformLocation(program, name), v);
        set2("u_resolution", width, height);
        set2("u_mouseSmooth", pointer[0], pointer[1]);
        set2("u_mouseVelocity", velocity[0], velocity[1]);
        set1("u_mousePresence", presence);
        set1("u_mouseReact", react);
        set1("u_time", 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, pixels);

        let peak = 0;
        let reach = 0;
        let reachX = 0;
        let reachY = 0;
        let centre = 0;
        let nan = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const len = pixels[i + 2];
            if (!Number.isFinite(len)) nan++;
            const px = ((x + 0.5) / width - pointer[0]) * aspect;
            const py = (y + 0.5) / height - pointer[1];
            const dist = Math.hypot(px, py);
            if (len > peak) peak = len;
            if (len > 1e-6) {
              reach = Math.max(reach, dist);
              reachX = Math.max(reachX, Math.abs(px));
              reachY = Math.max(reachY, Math.abs(py));
            }
            if (dist < 1.5 / height) centre = Math.max(centre, len);
          }
        }
        return { peak, reach, reachX, reachY, centre, nan };
      };

      const out = [];
      for (let s = 0; s < styles.length; s++) {
        const program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragments[s]));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        const at = [0.5, 0.5];
        out.push({
          style: styles[s].style,
          still: measure(program, at, [0, 0], 1, 1),
          moving: measure(program, at, [1.5, 0], 1, 1),
          movingUp: measure(program, at, [0, 1.5], 1, 1),
          fast: measure(program, at, [6, 0], 1, 1),
          half: measure(program, at, [0, 0], 0.5, 1),
          halfMoving: measure(program, at, [1.5, 0], 0.5, 1),
          absent: measure(program, at, [1.5, 0], 1, 0),
          off: measure(program, at, [1.5, 0], 0, 1),
        });
      }
      return out;
    },
    { styles: STYLES, fragments: STYLES.map(fragment), width: WIDTH, height: HEIGHT },
  );

  const f = (v) => v.toFixed(4);
  console.log(`canvas ${WIDTH}x${HEIGHT}; displacement of the sampling point in canvas heights, react = 1 unless noted\n`);
  console.log("style          still   moving  movingUp  fast(6/s)  react.5 still  react.5 moving  reach(x/y/max)           centre");
  for (const r of results) {
    console.log(
      `${r.style.padEnd(14)} ${f(r.still.peak)}  ${f(r.moving.peak)}  ${f(r.movingUp.peak)}    ${f(r.fast.peak)}     ` +
        `${f(r.half.peak)}         ${f(r.halfMoving.peak)}          ` +
        `${f(r.moving.reachX)}/${f(r.moving.reachY)}/${f(r.moving.reach)}   ${f(r.moving.centre)}`,
    );
    if (r.absent.peak !== 0 || r.off.peak !== 0) console.log(`  ! not zero with presence 0 (${r.absent.peak}) or react 0 (${r.off.peak})`);
    if (r.still.nan || r.moving.nan) console.log("  ! NaN or Infinity in the displacement");
  }
} finally {
  await browser.close();
}
