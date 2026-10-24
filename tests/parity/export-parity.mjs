// Compares the code the editor exports against the engine, image by image: for
// every gradient type it renders the engine (snapshot.mjs, through
// engine.captureImageData) and the exported player (or web component) in
// headless Chromium at the same time, size and palette, and reports how far
// apart the pictures are.
//
//   node tests/parity/export-parity.mjs [outDir] [--size 384] [--time 1]
//        [--aspect 1.78] [--only mesh,aurora] [--format standalone|web]
//        [--palette sunset] [--layer scale=2,complexity=8] [--state toneMapMode=2,hueShift=30]
//        [--mouse 0.4,0.6] [--max-mean 2]
//
// Options other than --format and --max-mean go to snapshot.mjs as they are (see
// its header), and the same palette, layer and state overrides go to the
// export. --mouse puts the pointer there, on both sides, and lets it settle.
// --max-mean N exits with code 1 if any type's mean difference is above N (0-255).
//
// Writes outDir/engine/type-*.png, outDir/export/type-*.png, outDir/diff/type-*.png
// (the absolute difference, 8x) and outDir/pairs/type-*.png (engine | export |
// diff), for looking at: a mean difference says how far apart, not what is wrong.
//
// The exported page is the shipped code, unchanged. Only the harness around it
// differs: a fake clock (performance.now and requestAnimationFrame) so a frame
// is drawn at exactly the time asked for, and getContext is told to keep the
// drawing buffer so the canvas can be read back afterwards. The image gradient
// is skipped: it has no texture in a portable export.
//
// Env: CHROMIUM_PATH overrides the browser (default /opt/pw-browsers/chromium).

import { chromium } from "@playwright/test";
import { build } from "tsup";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");

const PALETTES = {
  sunset: ["#ff7a45", "#f2486b", "#8c33a6", "#1a0d40"],
  ocean: ["#050d26", "#1a4db3", "#4db3e6", "#e6f2ff"],
  pastel: ["#faf0e6", "#e6bfcc", "#b3bff2", "#ccf2e6"],
  duo: ["#1a1a4d", "#e6808f"],
  mono: ["#0d0d0d", "#6b6b6b", "#f2f2f2"],
  night: ["#050a1f", "#0f9e8f", "#6354e6", "#c9f2dc"],
  dusk: ["#14123b", "#5b3bd6", "#e0489a", "#ffb38a"],
  ember: ["#1a0b2e", "#6a1b9a", "#ff5e7e", "#ffc27a"],
};

function parseArgs(argv) {
  const options = {
    outDir: path.join(REPO_ROOT, "test-results/export-parity"),
    size: 384,
    aspect: 1,
    time: 1,
    only: null,
    format: "standalone",
    palette: null,
    layer: {},
    state: {},
    mouse: null,
    maxMean: null,
    passthrough: [],
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--size") options.size = Number(next());
    else if (arg === "--aspect") options.aspect = Number(next());
    else if (arg === "--time") options.time = Number(next());
    else if (arg === "--only") options.only = new Set(next().split(",").filter(Boolean));
    else if (arg === "--format") options.format = next();
    else if (arg === "--palette") options.palette = next();
    else if (arg === "--layer") options.layer = parsePairs("--layer", next());
    else if (arg === "--state") options.state = parsePairs("--state", next());
    else if (arg === "--mouse") options.mouse = next().split(",").map(Number);
    else if (arg === "--max-mean") options.maxMean = Number(next());
    else if (arg === "--") continue;
    else positional.push(arg);
  }
  if (positional[0]) options.outDir = path.resolve(positional[0]);
  if (!["standalone", "web"].includes(options.format)) throw new Error("--format takes standalone or web");
  if (options.mouse && (options.mouse.length !== 2 || options.mouse.some((v) => !Number.isFinite(v)))) {
    throw new Error("--mouse takes x,y");
  }
  return options;
}

function parsePairs(flag, text) {
  return Object.fromEntries(
    text.split(",").filter(Boolean).map((pair) => {
      const [key, value] = pair.split("=");
      if (!key || value === undefined) throw new Error(`${flag} takes key=value pairs`);
      // A value that isn't a number or true/false is a string (colorProfile=display-p3).
      const number = Number(value);
      return [key, value === "true" ? true : value === "false" ? false : Number.isFinite(number) ? number : value];
    }),
  );
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`"${hex}" is not a #rrggbb colour`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Installed before the page's own scripts. Time stands still until __step, and
// the drawing buffer is kept so toDataURL() works after the frame is presented.
const HARNESS = `(() => {
  let now = 0;
  let queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = (callback) => { queue.push(callback); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__step = (ms) => { now = ms; const due = queue; queue = []; for (const callback of due) callback(now); };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    return getContext.call(this, type, type === "webgl2" ? { ...attributes, preserveDrawingBuffer: true } : attributes);
  };
})();`;

async function loadCodegen(outDir) {
  const buildDir = path.join(outDir, ".codegen");
  await build({
    config: false,
    entry: { codegen: path.join(HERE, "pages/export-codegen.ts") },
    outDir: buildDir,
    format: ["esm"],
    platform: "node",
    target: "es2022",
    clean: true,
    dts: false,
    silent: true,
    noExternal: [/.*/],
    loader: { ".glsl": "text" },
  });
  return import(pathToFileURL(path.join(buildDir, "codegen.mjs")).toString());
}

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function compare(engine, exported) {
  const diff = new PNG({ width: engine.width, height: engine.height });
  const pixels = engine.width * engine.height;
  let sum = 0;
  let max = 0;
  let over8 = 0;
  for (let i = 0; i < pixels; i++) {
    let pixelMax = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(engine.data[i * 4 + c] - exported.data[i * 4 + c]);
      sum += d;
      pixelMax = Math.max(pixelMax, d);
      diff.data[i * 4 + c] = Math.min(255, d * 8);
    }
    diff.data[i * 4 + 3] = 255;
    max = Math.max(max, pixelMax);
    if (pixelMax > 8) over8++;
  }
  return { mean: sum / pixels / 3, max, over8: over8 / pixels, diff };
}

function sideBySide(...images) {
  const { width, height } = images[0];
  const out = new PNG({ width: width * images.length + (images.length - 1) * 4, height });
  out.data.fill(24);
  images.forEach((image, index) => PNG.bitblt(image, out, 0, 0, width, height, index * (width + 4), 0));
  return out;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { outDir, size } = options;
  const width = Math.round(size * options.aspect);
  const dirs = Object.fromEntries(["engine", "export", "diff", "pairs"].map((name) => [name, path.join(outDir, name)]));
  fs.mkdirSync(outDir, { recursive: true });
  for (const dir of Object.values(dirs)) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }

  const codegen = await loadCodegen(outDir);
  const types = codegen.GRADIENT_TYPES.filter((type) => type !== "image" && (!options.only || options.only.has(type)));
  if (types.length === 0) throw new Error("No gradient type matches --only");

  // The engine's side: snapshot.mjs, with the options it shares.
  const snapshotArgs = [
    path.join(HERE, "snapshot.mjs"), dirs.engine,
    "--size", String(size), "--aspect", String(options.aspect), "--time", String(options.time), "--only", types.join(","),
  ];
  if (options.palette) snapshotArgs.push("--palette", options.palette);
  const pairs = (object) => Object.entries(object).map(([k, v]) => `${k}=${v}`).join(",");
  if (Object.keys(options.layer).length > 0) snapshotArgs.push("--layer", pairs(options.layer));
  if (Object.keys(options.state).length > 0) snapshotArgs.push("--state", pairs(options.state));
  if (options.mouse) snapshotArgs.push("--mouse", options.mouse.join(","));
  const snapshot = spawnSync(process.execPath, snapshotArgs, { stdio: ["ignore", "ignore", "inherit"], cwd: REPO_ROOT });
  if (snapshot.status !== 0) throw new Error("snapshot.mjs failed");

  const colors = options.palette ? (PALETTES[options.palette] ?? options.palette.split(",")).map(hexToRgb) : undefined;
  const exportFor = options.format === "web" ? codegen.exportWebComponent : codegen.exportStandalonePlayer;
  const stateFor = (type) => {
    const layer = codegen.createLayer({ gradientType: type, colors, ...options.layer });
    const engine = { ...codegen.resolveConfig({ layers: [] }), ...options.state };
    return {
      colors: layer.colors,
      gradientType: type,
      speed: layer.speed,
      complexity: layer.complexity,
      scale: layer.scale,
      distortion: layer.distortion,
      softness: layer.softness,
      brightness: engine.brightness,
      saturation: engine.saturation,
      hueShift: engine.hueShift,
      domainWarp: engine.domainWarp,
      colorBlend: engine.colorBlend,
      oklabEnabled: engine.oklabEnabled,
      toneMapMode: engine.toneMapMode,
      colorProfile: engine.colorProfile,
      mouseReact: engine.mouseReact,
      debandEnabled: engine.debandEnabled,
      debandStrength: engine.debandStrength,
    };
  };

  const executablePath =
    process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });

  const rows = [];
  try {
    const context = await browser.newContext({ viewport: { width, height: size }, deviceScaleFactor: 1 });
    await context.addInitScript(HARNESS);
    console.log(`${"type".padEnd(12)} ${"mean".padStart(7)} ${"max".padStart(5)} ${">8".padStart(7)}  bytes`);
    for (const type of types) {
      const code = exportFor(stateFor(type));
      const page = await context.newPage();
      const problems = [];
      page.on("pageerror", (err) => problems.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") problems.push(msg.text());
      });
      await page.setContent(
        `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000}` +
          `wavr-gradient{position:fixed;left:0;top:0;width:${width}px!important;height:${size}px!important}</style>${code}`,
      );
      await page.waitForFunction(
        (px) => document.querySelector("wavr-gradient")?.shadowRoot?.querySelector("canvas")?.width === px,
        width,
      );

      if (options.mouse) {
        await page.mouse.move(options.mouse[0] * width, (1 - options.mouse[1]) * size);
        // Frames up to the time asked for, so the pointer and its presence have settled.
        for (const step of [0.25, 0.5, 0.75]) if (step < options.time) await page.evaluate((ms) => window.__step(ms), step * 1000);
      }
      await page.evaluate((ms) => window.__step(ms), options.time * 1000);
      const dataUrl = await page.evaluate(() =>
        document.querySelector("wavr-gradient").shadowRoot.querySelector("canvas").toDataURL("image/png"),
      );
      await page.close();

      const file = `type-${type}.png`;
      fs.writeFileSync(path.join(dirs.export, file), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
      const engineImage = readPng(path.join(dirs.engine, file));
      const exportImage = readPng(path.join(dirs.export, file));
      if (engineImage.width !== exportImage.width || engineImage.height !== exportImage.height) {
        throw new Error(`${type}: engine ${engineImage.width}x${engineImage.height}, export ${exportImage.width}x${exportImage.height}`);
      }
      const result = compare(engineImage, exportImage);
      fs.writeFileSync(path.join(dirs.diff, file), PNG.sync.write(result.diff));
      fs.writeFileSync(path.join(dirs.pairs, file), PNG.sync.write(sideBySide(engineImage, exportImage, result.diff)));
      rows.push({ type, ...result, bytes: code.length, problems });
      console.log(
        `${type.padEnd(12)} ${result.mean.toFixed(2).padStart(7)} ${String(result.max).padStart(5)} ` +
          `${`${(result.over8 * 100).toFixed(1)}%`.padStart(7)}  ${code.length}` +
          `${problems.length > 0 ? `  PAGE ERRORS: ${problems[0].split("\n")[0]}` : ""}`,
      );
    }
  } finally {
    await browser.close();
  }

  const mean = rows.reduce((total, row) => total + row.mean, 0) / rows.length;
  console.log(`\n${rows.length} types, average of the mean differences ${mean.toFixed(2)}/255 -> ${path.relative(process.cwd(), outDir)}`);
  fs.writeFileSync(
    path.join(outDir, "report.json"),
    JSON.stringify(rows.map(({ diff: _diff, ...row }) => row), null, 2),
  );
  const failed = rows.filter((row) => row.problems.length > 0 || (options.maxMean !== null && row.mean > options.maxMean));
  if (failed.length > 0) {
    console.error(`over the limit or with page errors: ${failed.map((row) => row.type).join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
