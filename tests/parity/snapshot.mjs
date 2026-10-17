// Renders every gradient type (one default layer each) and every parity
// fixture at a fixed time to PNGs, so a change to the shaders or engine can be
// looked at, or diffed against a run from another commit.
//
//   pnpm snapshots [outDir] [--only mesh,fixture-solid] [--time 1] [--size 512] [--palette sunset]
//
// --palette swaps the palette of the gradient-type images (not the fixtures): a
// name from PALETTES below, or comma-separated hex colours ("#ff6b6b,#4ecdc4").
// The default is the editor's default four-colour palette.
//
// outDir defaults to test-results/snapshots. Files are type-<gradient>.png and
// fixture-<name>.png, plus manifest.json with the timings and pixel stats.
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
const PAGE_URL = pathToFileURL(path.join(HERE, "pages/snapshot.html")).toString();

const PALETTES = {
  sunset: ["#ff7a45", "#f2486b", "#8c33a6", "#1a0d40"],
  ocean: ["#050d26", "#1a4db3", "#4db3e6", "#e6f2ff"],
  pastel: ["#faf0e6", "#e6bfcc", "#b3bff2", "#ccf2e6"],
  duo: ["#1a1a4d", "#e6808f"],
  mono: ["#0d0d0d", "#6b6b6b", "#f2f2f2"],
};

function parseHexPalette(spec) {
  const hexes = PALETTES[spec] ?? spec.split(",");
  return hexes.map((hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) throw new Error(`--palette: "${hex}" is not a #rrggbb colour (or one of ${Object.keys(PALETTES).join(", ")})`);
    const n = parseInt(m[1], 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  });
}

function parseArgs(argv) {
  const options = { outDir: path.join(REPO_ROOT, "test-results/snapshots"), only: null, time: 1, size: 512, colors: undefined };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--only") options.only = new Set(argv[++i].split(",").filter(Boolean));
    else if (arg === "--time") options.time = Number(argv[++i]);
    else if (arg === "--size") options.size = Number(argv[++i]);
    else if (arg === "--palette") options.colors = parseHexPalette(argv[++i]);
    else if (arg === "--") continue;
    else positional.push(arg);
  }
  if (positional[0]) options.outDir = path.resolve(positional[0]);
  if (!Number.isFinite(options.time) || !Number.isFinite(options.size)) {
    throw new Error("--time and --size take numbers");
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

const seconds = (ms) => `${(ms / 1000).toFixed(2)}s`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(path.join(HERE, "pages/snapshot.global.js"))) {
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
    jobs = [...types.map((type) => ({ name: `type-${type}`, job: { type, colors: options.colors } })), ...readFixtures()].filter(
      ({ name }) => !options.only || options.only.has(name) || options.only.has(name.replace(/^(type|fixture)-/, "")),
    );
    if (jobs.length === 0) throw new Error("No images match --only");

    for (const [index, { name, job }] of jobs.entries()) {
      const label = `[${String(index + 1).padStart(2)}/${jobs.length}] ${name.padEnd(24)}`;
      const wallStart = Date.now();
      try {
        const result = await page.evaluate(({ job, time, size }) => window.__wavrSnapshot(job, time, size), {
          job,
          time: options.time,
          size: options.size,
        });
        const file = path.join(options.outDir, `${name}.png`);
        fs.writeFileSync(file, Buffer.from(result.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
        const blank = result.litFraction === 0;
        if (blank) failed++;
        console.log(
          `${label} ${seconds(result.captureMs).padStart(7)} (ready ${seconds(result.programsReadyMs)})` +
            `  lit ${(result.litFraction * 100).toFixed(1)}%  mean ${result.meanLuma.toFixed(3)}` +
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
    JSON.stringify({ time: options.time, size: options.size, images: manifest }, null, 2),
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
