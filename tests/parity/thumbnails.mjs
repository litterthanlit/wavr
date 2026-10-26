// Renders the thumbnail of every built-in preset that the editor's Presets
// panel shows: apps/editor/public/presets/<id>.webp, plus thumbnails.json with
// a hash of each preset's config. The editor appends the hash to the image URL
// (a changed preset is a new URL, never a stale cached picture), and
// apps/editor/lib/presets.test.ts fails when a preset's config no longer
// matches its thumbnail's hash: run `pnpm thumbnails` after changing a preset.
//
//   pnpm thumbnails [--only aperture,halo]
//
// Frames come from the snapshot page (engine.captureImageData, as an export
// renders them) at twice the thumbnail size and are downsampled by the
// browser. Thumbnails are sRGB WebP: a Display P3 preset's frame is converted
// on the way (its most saturated colours clip slightly), so every browser
// shows the same picture. Captures are standard range, HDR presets included.
//
// Env: CHROMIUM_PATH as in snapshot.mjs.

import { chromium } from "@playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../..");
const PAGE_URL = pathToFileURL(path.join(HERE, "pages/snapshot.html")).toString();
const OUT_DIR = path.join(REPO_ROOT, "apps/editor/public/presets");
const MANIFEST = path.join(OUT_DIR, "thumbnails.json");

// 4:3, sharp on a 2x screen at the widest card (the sidebar is at most 420px).
const WIDTH = 384;
const HEIGHT = 288;
// Far enough into the animation that every preset has moved off its first frame.
const TIME = 3;
const QUALITY = 0.82;

/** The hash the editor's test recomputes from the catalogue: sha256 of the config's JSON, 10 hex digits. */
const configHash = (config) => crypto.createHash("sha256").update(JSON.stringify(config)).digest("hex").slice(0, 10);

async function main() {
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? new Set(process.argv[onlyIndex + 1].split(",").filter(Boolean)) : null;
  if (!fs.existsSync(path.join(HERE, "pages/snapshot.global.js"))) {
    throw new Error("tests/parity/pages/snapshot.global.js is missing: run `pnpm thumbnails` (or `pnpm build:parity-runner`) first");
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};

  const executablePath =
    process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const browser = await chromium.launch({
    executablePath,
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  let bytes = 0;
  try {
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.error(`  [page error] ${err.message}`));
    await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => window.__wavrSnapshotReady);
    const configs = await page.evaluate(() => window.__wavrPresetConfigs);
    const ids = Object.keys(configs).filter((id) => !only || only.has(id));
    if (ids.length === 0) throw new Error("No presets match --only");

    for (const [index, id] of ids.entries()) {
      const webp = await page.evaluate(
        async ({ id, width, height, time, quality }) => {
          const shot = await window.__wavrSnapshot(
            { preset: id },
            { time, width: width * 2, height: height * 2, renderScale: 1, benchFrames: 0 },
          );
          if (shot.litFraction === 0) throw new Error(`${id} rendered black`);
          // The PNG is tagged with the frame's colour space; drawing it onto an
          // sRGB canvas converts it.
          const image = new Image();
          image.src = shot.dataUrl;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, width, height);
          return canvas.toDataURL("image/webp", quality);
        },
        { id, width: WIDTH, height: HEIGHT, time: TIME, quality: QUALITY },
      );
      if (!webp.startsWith("data:image/webp")) throw new Error("This browser can't encode WebP");
      const data = Buffer.from(webp.replace(/^data:image\/webp;base64,/, ""), "base64");
      fs.writeFileSync(path.join(OUT_DIR, `${id}.webp`), data);
      manifest[id] = configHash(configs[id]);
      bytes += data.length;
      console.log(`[${String(index + 1).padStart(2)}/${ids.length}] ${id.padEnd(18)} ${(data.length / 1024).toFixed(1)} KB`);
    }

    // Only the catalogue's presets, in its order.
    const ordered = Object.fromEntries(Object.keys(configs).filter((id) => manifest[id]).map((id) => [id, manifest[id]]));
    fs.writeFileSync(MANIFEST, `${JSON.stringify(ordered, null, 2)}\n`);
    console.log(`\n${ids.length} thumbnails, ${(bytes / 1024).toFixed(0)} KB -> ${path.relative(REPO_ROOT, OUT_DIR)}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
