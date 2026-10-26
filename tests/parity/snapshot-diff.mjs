// Compares two runs of `pnpm snapshots` image by image (same file names), to
// see what a change to the shaders or the engine did to the pictures.
//
//   pnpm snapshots:diff <dirA> <dirB> [--only halo,fixture-solid] [--fail-above 2]
//
// Per image: the largest single-channel difference (0-255), the mean
// difference, and the share of pixels differing by more than 1, 2 and 4.
// --fail-above N exits with code 1 if any image has a channel off by more than
// N, for checks that a refactor changed nothing (use 1 to allow for rounding).
// Files only one run has, and images of different sizes, are listed, not compared.

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

function parseArgs(argv) {
  const options = { dirs: [], only: null, failAbove: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--only") options.only = new Set(argv[++i].split(",").filter(Boolean));
    else if (arg === "--fail-above") options.failAbove = Number(argv[++i]);
    else if (arg === "--") continue;
    else options.dirs.push(path.resolve(arg));
  }
  if (options.dirs.length !== 2) throw new Error("usage: snapshot-diff <dirA> <dirB> [--only a,b] [--fail-above N]");
  if (options.failAbove !== null && !Number.isFinite(options.failAbove)) throw new Error("--fail-above takes a number");
  return options;
}

const pngs = (dir) => new Set(fs.readdirSync(dir).filter((file) => file.endsWith(".png")));
const read = (file) => PNG.sync.read(fs.readFileSync(file));
const name = (file) => file.replace(/\.png$/, "");

function main() {
  const { dirs: [dirA, dirB], only, failAbove } = parseArgs(process.argv.slice(2));
  const a = pngs(dirA);
  const b = pngs(dirB);
  const keep = (file) => !only || only.has(name(file)) || only.has(name(file).replace(/^(type|fixture|scene)-/, ""));
  const shared = [...a].filter((file) => b.has(file) && keep(file)).sort();

  console.log(`${"image".padEnd(34)} ${"max".padStart(4)} ${"mean".padStart(7)} ${">1".padStart(7)} ${">2".padStart(7)} ${">4".padStart(7)}`);
  let worst = 0;
  for (const file of shared) {
    const imageA = read(path.join(dirA, file));
    const imageB = read(path.join(dirB, file));
    if (imageA.width !== imageB.width || imageA.height !== imageB.height) {
      console.log(`${name(file).padEnd(34)} different sizes: ${imageA.width}x${imageA.height} vs ${imageB.width}x${imageB.height}`);
      continue;
    }
    const pixels = imageA.width * imageA.height;
    let max = 0;
    let sum = 0;
    let over1 = 0;
    let over2 = 0;
    let over4 = 0;
    for (let i = 0; i < pixels; i++) {
      let pixelMax = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(imageA.data[i * 4 + c] - imageB.data[i * 4 + c]);
        sum += d;
        if (d > pixelMax) pixelMax = d;
      }
      if (pixelMax > max) max = pixelMax;
      if (pixelMax > 1) over1++;
      if (pixelMax > 2) over2++;
      if (pixelMax > 4) over4++;
    }
    worst = Math.max(worst, max);
    const share = (count) => `${((count / pixels) * 100).toFixed(2)}%`.padStart(7);
    console.log(
      `${name(file).padEnd(34)} ${String(max).padStart(4)} ${(sum / pixels / 3).toFixed(3).padStart(7)} ${share(over1)} ${share(over2)} ${share(over4)}`,
    );
  }

  for (const [label, from, to] of [["only in A", a, b], ["only in B", b, a]]) {
    const missing = [...from].filter((file) => !to.has(file) && keep(file)).sort().map(name);
    if (missing.length > 0) console.log(`${label}: ${missing.join(", ")}`);
  }
  console.log(`\n${shared.length} images compared, largest channel difference ${worst}/255`);
  if (failAbove !== null && worst > failAbove) {
    console.error(`over --fail-above ${failAbove}`);
    process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
