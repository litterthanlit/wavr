// Renders every gradient type (one default layer each) and every parity
// fixture at a fixed time to PNGs, so a change to the shaders or engine can be
// looked at, or diffed against a run from another commit.
//
//   pnpm snapshots [outDir] [--only mesh,fixture-solid] [--time 1] [--size 512]
//                  [--width 768 --height 432]
//                  [--mouse 0.4,0.6] [--stroke 0.2,0.5,0.8,0.5[,0.4]] [--ripple 0.5,0.5[,0.4]]
//                  [--state mouseReact=1,trailEnabled=true]
//                  [--scale 0.6] [--bench 20] [--scenes scenes.json]
//
// --size makes square images; --width/--height override it (a non-square size
// shows whether effects are circles). The pointer options stage the pointer for
// a still, with positions as 0..1 across and y up:
//   --mouse x,y        the pointer rests there, present (the mouse effects at rest)
//   --stroke x0,y0,x1,y1[,seconds]
//                      the pointer travels that line at constant speed (default
//                      0.4 s) and the frame is taken as it arrives, so the
//                      velocity-driven effects and the trail show
//   --ripple x,y[,age] a click there `age` seconds ago (default 0.4), ripple on
//   --state k=v,...    overrides engine state fields (numbers and true/false)
// Without a pointer option the pointer is absent: no mouse effect at all.
//
// --scale draws the layers at that fraction of the size, as the live view does
// at that render scale (captures and exports are always 1), then upsamples for
// the global effects. --bench N times N more captures of each frame and prints
// the median (ms): relative numbers only, SwiftShader renders on the CPU
// (--size 960 has the pixel count of a 1280x720 canvas).
//
// outDir defaults to test-results/snapshots. Files are type-<gradient>.png and
// fixture-<name>.png, plus manifest.json with the timings and pixel stats.
// --scenes adds images of your own: a JSON array of { name, type | config,
// state? } (a gradient type or a GradientConfig, plus engine-state overrides
// such as colorBlend). They are written as scene-<name>.png.
// `pnpm snapshots` rebuilds the page bundle first (tests/parity/pages/snapshot.ts).
//
// Frames are rendered by engine.captureImageData in headless Chromium on
// SwiftShader; the WebGL canvas itself is never read. Timings are per capture:
// a gradient type's first frame is slow because SwiftShader compiles at the
// first draw ("ready" is how long the driver took to report the programs
// linked). The `image` type is drawn with a generated test picture.
//
// Env: CHROMIUM_PATH overrides the browser (default /opt/pw-browsers/chromium
// when it exists, else Playwright's own).
// Exit code 1 if any image failed to render or came out entirely black.

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const FIXTURES_DIR = path.join(REPO_ROOT, "packages/schema/test/fixtures/parity");
// SNAPSHOT_PAGE points at another build of the page (an html file next to its
// bundle), e.g. one made from another commit's engine, to compare images and
// --bench timings between the two.
const PAGE_FILE = process.env.SNAPSHOT_PAGE
  ? path.resolve(process.env.SNAPSHOT_PAGE)
  : path.join(HERE, "pages/snapshot.html");
const PAGE_URL = pathToFileURL(PAGE_FILE).toString();

/** "0.4,0.6" -> [0.4, 0.6]; between `min` and `max` numbers. */
function parseNumbers(flag, text, min, max) {
  const values = String(text).split(",").map(Number);
  if (values.length < min || values.length > max || values.some((v) => !Number.isFinite(v))) {
    throw new Error(`${flag} takes ${min === max ? min : `${min} to ${max}`} comma-separated numbers`);
  }
  return values;
}

function parseState(text) {
  const state = {};
  for (const pair of String(text).split(",").filter(Boolean)) {
    const [key, value] = pair.split("=");
    if (!key || value === undefined) throw new Error("--state takes key=value pairs");
    state[key] = value === "true" ? true : value === "false" ? false : Number(value);
    if (typeof state[key] === "number" && !Number.isFinite(state[key])) throw new Error(`--state ${key}: not a number`);
  }
  return state;
}

function parseArgs(argv) {
  const options = {
    outDir: path.join(REPO_ROOT, "test-results/snapshots"),
    only: null,
    time: 1,
    size: 512,
    width: null,
    height: null,
    mouse: null,
    stroke: null,
    ripple: null,
    state: null,
    scale: 1,
    bench: 0,
    scenes: null,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--only") options.only = new Set(argv[++i].split(",").filter(Boolean));
    else if (arg === "--time") options.time = Number(argv[++i]);
    else if (arg === "--size") options.size = Number(argv[++i]);
    else if (arg === "--width") options.width = Number(argv[++i]);
    else if (arg === "--height") options.height = Number(argv[++i]);
    else if (arg === "--mouse") options.mouse = parseNumbers("--mouse", argv[++i], 2, 2);
    else if (arg === "--stroke") {
      const [x0, y0, x1, y1, seconds = 0.4] = parseNumbers("--stroke", argv[++i], 4, 5);
      options.stroke = { from: [x0, y0], to: [x1, y1], seconds };
    } else if (arg === "--ripple") {
      const [x, y, age = 0.4] = parseNumbers("--ripple", argv[++i], 2, 3);
      options.ripple = { at: [x, y], age };
    } else if (arg === "--state") options.state = parseState(argv[++i]);
    else if (arg === "--scale") options.scale = Number(argv[++i]);
    else if (arg === "--bench") options.bench = Number(argv[++i]);
    else if (arg === "--scenes") options.scenes = path.resolve(argv[++i]);
    else if (arg === "--") continue;
    else positional.push(arg);
  }
  if (positional[0]) options.outDir = path.resolve(positional[0]);
  options.width ??= options.size;
  options.height ??= options.size;
  const numeric = [options.time, options.size, options.width, options.height, options.scale, options.bench];
  if (!numeric.every(Number.isFinite)) {
    throw new Error("--time, --size, --width, --height, --scale and --bench take numbers");
  }
  return options;
}

function readFixtures() {
  return fs
    .readdirSync(FIXTURES_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({
      name: `fixture-${path.basename(file, ".json")}`,
      job: { config: JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, file), "utf8")) },
    }));
}

function readScenes(file) {
  if (!file) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")).map(({ name, ...job }) => ({ name: `scene-${name}`, job }));
}

const seconds = (ms) => `${(ms / 1000).toFixed(2)}s`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!process.env.SNAPSHOT_PAGE && !fs.existsSync(path.join(HERE, "pages/snapshot.global.js"))) {
    throw new Error("tests/parity/pages/snapshot.global.js is missing: run `pnpm snapshots` (or `pnpm build:parity-runner`) first");
  }
  fs.mkdirSync(options.outDir, { recursive: true });

  const executablePath =
    process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });

  const manifest = [];
  let jobs = [];
  let failed = 0;
  const started = Date.now();
  try {
    const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
    page.on("pageerror", (err) => console.error(`  [page error] ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error(`  [console] ${msg.text()}`);
    });
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.__wavrSnapshotReady);

    // One default layer per gradient type (the page has the canonical list), then the parity fixtures.
    const types = await page.evaluate(() => window.__wavrGradientTypes);
    jobs = [
      ...types.map((type) => ({ name: `type-${type}`, job: { type } })),
      ...readFixtures(),
      ...readScenes(options.scenes),
    ].filter(
      ({ name }) => !options.only || options.only.has(name) || options.only.has(name.replace(/^(type|fixture|scene)-/, "")),
    );
    if (jobs.length === 0) throw new Error("No images match --only");

    for (const [index, { name, job }] of jobs.entries()) {
      const label = `[${String(index + 1).padStart(2)}/${jobs.length}] ${name.padEnd(24)}`;
      const wallStart = Date.now();
      try {
        const result = await page.evaluate(({ job, shot }) => window.__wavrSnapshot(job, shot), {
          job,
          shot: {
            time: options.time,
            width: options.width,
            height: options.height,
            renderScale: options.scale,
            benchFrames: options.bench,
            ...(options.mouse && { mouse: options.mouse }),
            ...(options.stroke && { stroke: options.stroke }),
            ...(options.ripple && { ripple: options.ripple }),
            ...(options.state && { state: options.state }),
          },
        });
        const file = path.join(options.outDir, `${name}.png`);
        fs.writeFileSync(file, Buffer.from(result.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
        const blank = result.litFraction === 0;
        if (blank) failed++;
        console.log(
          `${label} ${seconds(result.captureMs).padStart(7)} (ready ${seconds(result.programsReadyMs)})` +
            `  lit ${(result.litFraction * 100).toFixed(1)}%  mean ${result.meanLuma.toFixed(3)}` +
            `${result.benchMs === undefined ? "" : `  bench ${result.benchMs.toFixed(1)}ms/frame`}` +
            `${blank ? "  BLANK" : ""}  ${path.relative(process.cwd(), file)}`,
        );
        const { dataUrl: _dataUrl, ...stats } = result;
        manifest.push({ name, file: `${name}.png`, ...stats, blank });
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`${label} FAILED after ${seconds(Date.now() - wallStart)}: ${message.split("\n")[0]}`);
        manifest.push({ name, error: message });
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(options.outDir, "manifest.json"),
    JSON.stringify(
      {
        time: options.time,
        width: options.width,
        height: options.height,
        scale: options.scale,
        mouse: options.mouse,
        stroke: options.stroke,
        ripple: options.ripple,
        state: options.state,
        images: manifest,
      },
      null,
      2,
    ),
  );
  console.log(
    `\n${jobs.length - failed}/${jobs.length} images in ${seconds(Date.now() - started)} -> ${path.relative(process.cwd(), options.outDir)}`,
  );
  if (failed > 0) {
    console.error(`${failed} failed or came out entirely black`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
