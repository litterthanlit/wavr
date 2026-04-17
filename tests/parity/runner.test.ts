import { test, expect } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { hashFramebuffer } from "@wavr/schema/parity";
import type { GradientConfig } from "@wavr/schema";

// Parity harness. See specs/0002-parity-harness.md.
//
// Two modes, selected by PARITY_WRITE env var:
//   - write  (PARITY_WRITE=1): render each fixture × timestep, hash the
//     framebuffer, write hex hash to tests/parity/goldens/<name>.t<ms>.hash.
//   - compare (default): read golden hash, compare. On mismatch, dump the
//     actual frame to test-results/<name>.t<ms>.actual.png and fail.

const WRITE_MODE = process.env.PARITY_WRITE === "1";
const CANVAS_SIZE = 512;
const TIME_STEPS: readonly number[] = [0, 0.5, 1.0];

const HARNESS_DIR = path.resolve(__dirname);
const REPO_ROOT = path.resolve(HARNESS_DIR, "../..");
const FIXTURES_DIR = path.resolve(REPO_ROOT, "packages/schema/test/fixtures/parity");
const GOLDENS_DIR = path.resolve(HARNESS_DIR, "goldens");
const RESULTS_DIR = path.resolve(REPO_ROOT, "test-results");
const RUNNER_URL = pathToFileURL(path.resolve(HARNESS_DIR, "pages/runner.html")).toString();

interface Fixture {
  name: string;
  config: GradientConfig;
}

function loadFixtures(): Fixture[] {
  if (!fs.existsSync(FIXTURES_DIR)) {
    throw new Error(`Parity fixtures directory not found at ${FIXTURES_DIR}`);
  }
  const files = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return files.map((file) => {
    const name = path.basename(file, ".json");
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, file), "utf8");
    return { name, config: JSON.parse(raw) as GradientConfig };
  });
}

function goldenPath(name: string, tMs: number): string {
  return path.join(GOLDENS_DIR, `${name}.t${tMs}.hash`);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writePng(outPath: string, pixels: Uint8Array, width: number, height: number): void {
  const png = new PNG({ width, height });
  // WebGL readPixels returns bottom-to-top scanlines; flip to top-down for PNG.
  for (let y = 0; y < height; y++) {
    const src = (height - 1 - y) * width * 4;
    const dst = y * width * 4;
    png.data.set(pixels.subarray(src, src + width * 4), dst);
  }
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

const fixtures = loadFixtures();

test.describe("parity", () => {
  test.beforeAll(() => {
    if (WRITE_MODE) ensureDir(GOLDENS_DIR);
    ensureDir(RESULTS_DIR);
  });

  for (const fixture of fixtures) {
    for (const t of TIME_STEPS) {
      const tMs = Math.round(t * 1000);
      const label = `${fixture.name} @ t=${tMs}ms`;

      test(label, async ({ page }) => {
        await page.goto(RUNNER_URL, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.__wavrReady !== undefined);
        await page.evaluate(() => window.__wavrReady);

        const pixelsArr = await page.evaluate(
          async ({ config, time }) => {
            const buf = await window.__wavrRender(config, time);
            return Array.from(buf);
          },
          { config: fixture.config, time: t },
        );
        const pixels = new Uint8Array(pixelsArr);
        expect(pixels.length).toBe(CANVAS_SIZE * CANVAS_SIZE * 4);

        const actualHash = await hashFramebuffer(pixels, 2);
        const hashFile = goldenPath(fixture.name, tMs);

        if (WRITE_MODE) {
          fs.writeFileSync(hashFile, `${actualHash}\n`, "utf8");
          // eslint-disable-next-line no-console
          console.log(`[parity:write] ${fixture.name}.t${tMs} → ${actualHash}`);
          return;
        }

        if (!fs.existsSync(hashFile)) {
          const actualPng = path.join(RESULTS_DIR, `${fixture.name}.t${tMs}.actual.png`);
          writePng(actualPng, pixels, CANVAS_SIZE, CANVAS_SIZE);
          throw new Error(
            `Parity golden not found: ${path.relative(REPO_ROOT, hashFile)}. ` +
              `Run \`pnpm parity:generate\` (or trigger the parity-generate workflow) ` +
              `to create it. Actual hash was ${actualHash}. ` +
              `Frame dumped to ${path.relative(REPO_ROOT, actualPng)}.`,
          );
        }

        const expectedHash = fs.readFileSync(hashFile, "utf8").trim();
        if (expectedHash !== actualHash) {
          const actualPng = path.join(RESULTS_DIR, `${fixture.name}.t${tMs}.actual.png`);
          writePng(actualPng, pixels, CANVAS_SIZE, CANVAS_SIZE);
          // eslint-disable-next-line no-console
          console.error(
            `Parity drift in ${fixture.name} at t=${tMs}. ` +
              `Expected ${expectedHash}, got ${actualHash}. ` +
              `See ${path.relative(REPO_ROOT, actualPng)}.`,
          );
        }
        expect(actualHash).toBe(expectedHash);
      });
    }
  }
});
