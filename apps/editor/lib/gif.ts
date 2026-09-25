/**
 * Animated GIF encoder (no dependencies, runs in a worker or on the main thread).
 *
 * - One global 256-colour palette, built by median cut over a 5-bit-per-channel
 *   histogram of every frame, so gradients get colours where they need them.
 * - 4×4 ordered (Bayer) dithering against banding. Unlike error diffusion it
 *   is stable from frame to frame, so the GIF doesn't shimmer.
 * - LZW with typed-array tables; code-size handling follows the widely used
 *   gif.js / NeuQuant LZWEncoder.
 */

export interface GifInput {
  width: number;
  height: number;
  /** RGBA pixels, top-down, width*height*4 bytes each. Alpha is ignored. */
  frames: Uint8ClampedArray[];
  /** Frame delay in hundredths of a second. */
  delayCs: number;
  onProgress?: (fraction: number) => void;
}

// Histogram / lookup resolution: 6 bits per channel. Smooth gradients use
// only a thin slice of colour space, so finer bins let the palette follow
// them closely.
const BITS = 6;
const LEVELS = 1 << BITS;
const SHIFT = 8 - BITS;
const BINS = 1 << (BITS * 3);

function binOf(r: number, g: number, b: number): number {
  return ((r >> SHIFT) << (BITS * 2)) | ((g >> SHIFT) << BITS) | (b >> SHIFT);
}

/** Centre of a bin along one channel, in 0-255 units. */
function binCentre(level: number): number {
  return (level << SHIFT) + (1 << (SHIFT - 1));
}

/** Median-cut palette (RGB triplets, padded to 256 entries) for the given frames. */
export function buildPalette(frames: Uint8ClampedArray[], maxColors = 256): Uint8Array {
  const counts = new Uint32Array(BINS);
  for (const frame of frames) {
    for (let i = 0; i < frame.length; i += 4) counts[binOf(frame[i], frame[i + 1], frame[i + 2])]++;
  }

  const used: number[] = [];
  for (let bin = 0; bin < BINS; bin++) if (counts[bin] > 0) used.push(bin);

  const channel = (bin: number, c: number) => (bin >> ((2 - c) * BITS)) & (LEVELS - 1);
  type Box = { bins: number[]; range: number; axis: number; population: number };
  const makeBox = (bins: number[]): Box => {
    const min = [LEVELS - 1, LEVELS - 1, LEVELS - 1];
    const max = [0, 0, 0];
    let population = 0;
    for (const bin of bins) {
      for (let c = 0; c < 3; c++) {
        const v = channel(bin, c);
        if (v < min[c]) min[c] = v;
        if (v > max[c]) max[c] = v;
      }
      population += counts[bin];
    }
    let axis = 0;
    for (let c = 1; c < 3; c++) if (max[c] - min[c] > max[axis] - min[axis]) axis = c;
    return { bins, range: max[axis] - min[axis], axis, population };
  };

  const boxes: Box[] = used.length > 0 ? [makeBox(used)] : [];
  while (boxes.length < maxColors) {
    // Split the most populous box that still spans more than one bin.
    let pick = -1;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].range > 0 && (pick < 0 || boxes[i].population * boxes[i].range > boxes[pick].population * boxes[pick].range)) {
        pick = i;
      }
    }
    if (pick < 0) break;
    const box = boxes[pick];
    const sorted = box.bins.slice().sort((a, b) => channel(a, box.axis) - channel(b, box.axis));
    let acc = 0;
    let cut = 1;
    for (; cut < sorted.length; cut++) {
      acc += counts[sorted[cut - 1]];
      if (acc * 2 >= box.population) break;
    }
    cut = Math.min(Math.max(cut, 1), sorted.length - 1);
    boxes.splice(pick, 1, makeBox(sorted.slice(0, cut)), makeBox(sorted.slice(cut)));
  }

  const palette = new Uint8Array(256 * 3);
  boxes.forEach((box, i) => {
    let r = 0, g = 0, b = 0;
    for (const bin of box.bins) {
      const n = counts[bin];
      r += binCentre(channel(bin, 0)) * n;
      g += binCentre(channel(bin, 1)) * n;
      b += binCentre(channel(bin, 2)) * n;
    }
    palette[i * 3] = Math.round(r / box.population);
    palette[i * 3 + 1] = Math.round(g / box.population);
    palette[i * 3 + 2] = Math.round(b / box.population);
  });
  return palette;
}

/**
 * Nearest palette index per histogram bin, computed on first use: frames
 * only touch a small fraction of the 2^18 bins.
 */
export class PaletteLookup {
  private readonly cache = new Int16Array(BINS).fill(-1);

  constructor(private readonly palette: Uint8Array, private readonly colors = 256) {}

  index(bin: number): number {
    const cached = this.cache[bin];
    if (cached >= 0) return cached;
    const r = binCentre((bin >> (BITS * 2)) & (LEVELS - 1));
    const g = binCentre((bin >> BITS) & (LEVELS - 1));
    const b = binCentre(bin & (LEVELS - 1));
    const palette = this.palette;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.colors; i++) {
      const dr = r - palette[i * 3];
      const dg = g - palette[i * 3 + 1];
      const db = b - palette[i * 3 + 2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    this.cache[bin] = best;
    return best;
  }
}

const BAYER_4X4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const DITHER_AMPLITUDE = 8; // peak-to-peak, in 0-255 units

/** Map RGBA pixels to palette indices with ordered dithering. */
export function indexFrame(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  lookup: PaletteLookup,
  dither = true,
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const offset = dither ? (BAYER_4X4[((y & 3) << 2) | (x & 3)] / 15 - 0.5) * DITHER_AMPLITUDE : 0;
      const r = Math.min(255, Math.max(0, pixels[p * 4] + offset));
      const g = Math.min(255, Math.max(0, pixels[p * 4 + 1] + offset));
      const b = Math.min(255, Math.max(0, pixels[p * 4 + 2] + offset));
      out[p] = lookup.index(binOf(r, g, b));
    }
  }
  return out;
}

class ByteWriter {
  private buf = new Uint8Array(1 << 16);
  length = 0;

  private ensure(extra: number) {
    if (this.length + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.length + extra) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.length));
    this.buf = next;
  }

  byte(b: number) {
    this.ensure(1);
    this.buf[this.length++] = b & 0xff;
  }

  short(v: number) {
    this.byte(v);
    this.byte(v >> 8);
  }

  bytes(data: ArrayLike<number>, start = 0, end = data.length) {
    this.ensure(end - start);
    for (let i = start; i < end; i++) this.buf[this.length++] = data[i];
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

const MAX_BITS = 12;
const MAX_CODE = 1 << MAX_BITS; // 4096

/**
 * LZW dictionary: (prefix code, next index) → code. Entries are valid only
 * when their stamp matches the current generation, so clearing is O(1) and
 * the 8 MB of tables are allocated once per GIF rather than per frame.
 */
class LzwTables {
  readonly table = new Int32Array(MAX_CODE << 8);
  readonly stamp = new Int32Array(MAX_CODE << 8);
  generation = 0;
}

/** LZW-compress palette indices into GIF image data sub-blocks. */
function lzwEncode(indices: Uint8Array, minCodeSize: number, out: ByteWriter, tables: LzwTables): void {
  const clearCode = 1 << minCodeSize;
  const eofCode = clearCode + 1;
  const initBits = minCodeSize + 1;
  const { table, stamp } = tables;
  let generation = ++tables.generation;

  let nBits = initBits;
  let maxCode = (1 << nBits) - 1;
  let freeEnt = clearCode + 2;
  let clearFlag = false;

  const block = new Uint8Array(255);
  let blockLen = 0;
  let acc = 0;
  let accBits = 0;

  const flushBlock = () => {
    if (blockLen === 0) return;
    out.byte(blockLen);
    out.bytes(block, 0, blockLen);
    blockLen = 0;
  };
  const pushByte = (b: number) => {
    block[blockLen++] = b;
    if (blockLen === 255) flushBlock();
  };
  const output = (code: number) => {
    acc |= code << accBits;
    accBits += nBits;
    while (accBits >= 8) {
      pushByte(acc & 0xff);
      acc >>>= 8;
      accBits -= 8;
    }
    if (freeEnt > maxCode || clearFlag) {
      if (clearFlag) {
        nBits = initBits;
        maxCode = (1 << nBits) - 1;
        clearFlag = false;
      } else {
        nBits++;
        maxCode = nBits === MAX_BITS ? MAX_CODE : (1 << nBits) - 1;
      }
    }
  };

  out.byte(minCodeSize);
  output(clearCode);

  let ent = indices.length > 0 ? indices[0] : 0;
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i];
    const key = (ent << 8) | c;
    if (stamp[key] === generation) {
      ent = table[key];
      continue;
    }
    output(ent);
    ent = c;
    if (freeEnt < MAX_CODE) {
      table[key] = freeEnt++;
      stamp[key] = generation;
    } else {
      generation = ++tables.generation;
      freeEnt = clearCode + 2;
      clearFlag = true;
      output(clearCode);
    }
  }
  output(ent);
  output(eofCode);

  if (accBits > 0) pushByte(acc & 0xff);
  flushBlock();
  out.byte(0); // block terminator
}

/** Encode frames as a looping animated GIF. */
export function encodeGif({ width, height, frames, delayCs, onProgress }: GifInput): Uint8Array {
  const out = new ByteWriter();
  const palette = buildPalette(frames);
  const lookup = new PaletteLookup(palette);
  const tables = new LzwTables();

  // Header + logical screen descriptor with a 256-entry global colour table.
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // "GIF89a"
  out.short(width);
  out.short(height);
  out.byte(0xf7); // GCT present, 8-bit colour resolution, 2^(7+1) entries
  out.byte(0); // background colour index
  out.byte(0); // pixel aspect ratio
  out.bytes(palette);

  // NETSCAPE2.0 application extension: loop forever.
  out.bytes([0x21, 0xff, 0x0b]);
  for (const ch of "NETSCAPE2.0") out.byte(ch.charCodeAt(0));
  out.bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  const delay = Math.max(2, Math.round(delayCs)); // browsers treat <2 as ~10
  frames.forEach((frame, f) => {
    // Graphic control extension: no transparency, frame delay.
    out.bytes([0x21, 0xf9, 0x04, 0x04]);
    out.short(delay);
    out.bytes([0x00, 0x00]);
    // Image descriptor: full frame, no local colour table.
    out.byte(0x2c);
    out.short(0);
    out.short(0);
    out.short(width);
    out.short(height);
    out.byte(0);
    lzwEncode(indexFrame(frame, width, height, lookup), 8, out, tables);
    onProgress?.((f + 1) / frames.length);
  });

  out.byte(0x3b); // trailer
  return out.result();
}
