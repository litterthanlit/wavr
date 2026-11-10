// Counts blank frames while a container holding a WebGL canvas is resized every
// frame, with the engine's resize pattern and with a redraw after each resize.
//   node plans/assets/002-resize-repro.cjs plans/assets/002-resize-repro.html
// Needs Playwright with a Chromium (require("playwright")). Result when the plan was written:
//   engine: 37 of 40 screenshots blank; redraw: 0 of 40.
const { chromium } = require("playwright");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const zlib = require("node:zlib");

// Minimal PNG reader (8-bit RGB/RGBA, no interlace): the pixel at (x, y).
function pngPixel(buffer, x, y) {
  let offset = 8, width = 0, height = 0, colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); colorType = data[9]; }
    if (type === "IDAT") idat.push(data);
    offset += 12 + length;
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp + 1;
  const rows = [];
  let prev = Buffer.alloc(width * bpp);
  for (let row = 0; row <= y; row++) {
    const line = Buffer.from(raw.subarray(row * stride + 1, (row + 1) * stride));
    const filter = raw[row * stride];
    for (let i = 0; i < line.length; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      if (filter === 1) line[i] = (line[i] + a) & 255;
      else if (filter === 2) line[i] = (line[i] + b) & 255;
      else if (filter === 3) line[i] = (line[i] + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        line[i] = (line[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    prev = line;
    rows.push(line);
  }
  return [prev[x * bpp], prev[x * bpp + 1], prev[x * bpp + 2]];
}

(async () => {
  const file = process.argv[2];
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  for (const mode of ["engine", "redraw"]) {
    const page = await browser.newPage({ viewport: { width: 420, height: 280 }, deviceScaleFactor: 1 });
    await page.goto(`${pathToFileURL(path.resolve(file))}?mode=${mode}`);
    await page.waitForTimeout(300);
    const still = pngPixel(await page.screenshot(), 60, 60);
    await page.evaluate(() => window.startMorph());
    let blank = 0;
    const shots = 40;
    for (let i = 0; i < shots; i++) {
      const [r, g, b] = pngPixel(await page.screenshot(), 60, 60);
      if (r > 240 && g > 240 && b > 240) blank++;
    }
    await page.evaluate(() => window.stopMorph());
    console.log(`${mode.padEnd(7)} at rest: rgb(${still.join(",")})   while resizing: ${blank} of ${shots} screenshots show a blank canvas`);
    await page.close();
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exit(1); });
