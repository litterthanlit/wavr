// Measures how hard the edges in snapshot PNGs are, to check that a glow is soft.
//
//   node tests/parity/edge-probe.mjs <png>... [--max 0.1]
//
// Per image: the largest and the 99th-percentile luminance step between
// neighbouring pixels (horizontal and vertical) after a 3x3 box blur, in
// display values 0..1. The blur keeps grain from counting as an edge.
// --max N exits with code 1 if any image's maxStep is above N.

import fs from "node:fs";
import { PNG } from "pngjs";

function parseArgs(argv) {
  const options = { files: [], max: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--max") options.max = Number(argv[++i]);
    else if (arg === "--") continue;
    else options.files.push(arg);
  }
  if (options.files.length === 0) throw new Error("usage: edge-probe <png>... [--max N]");
  if (options.max !== null && !Number.isFinite(options.max)) throw new Error("--max takes a number");
  return options;
}

function luminance({ data, width, height }) {
  const luma = new Float64Array(width * height);
  for (let i = 0; i < luma.length; i++) {
    luma[i] = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
  }
  return luma;
}

function boxBlur(luma, width, height) {
  const out = new Float64Array(luma.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          sum += luma[ny * width + nx];
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

function measure(file) {
  const image = PNG.sync.read(fs.readFileSync(file));
  const { width, height } = image;
  const blurred = boxBlur(luminance(image), width, height);
  const steps = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const here = blurred[y * width + x];
      if (x + 1 < width) steps.push(Math.abs(blurred[y * width + x + 1] - here));
      if (y + 1 < height) steps.push(Math.abs(blurred[(y + 1) * width + x] - here));
    }
  }
  const sorted = Float64Array.from(steps).sort();
  const maxStep = sorted.length > 0 ? sorted[sorted.length - 1] : 0;
  const p99Step = sorted.length > 0 ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] : 0;
  return { maxStep, p99Step };
}

function main() {
  const { files, max } = parseArgs(process.argv.slice(2));
  for (const file of files) {
    const { maxStep, p99Step } = measure(file);
    console.log(`${file} maxStep=${maxStep.toFixed(4)} p99Step=${p99Step.toFixed(4)}`);
    if (max !== null && maxStep > max) process.exitCode = 1;
  }
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
