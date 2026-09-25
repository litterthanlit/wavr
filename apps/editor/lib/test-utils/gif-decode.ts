// Minimal GIF89a decoder for tests: global colour table, full-frame images,
// no interlacing. Enough to round-trip what lib/gif.ts writes.

export interface DecodedGif {
  width: number;
  height: number;
  palette: Uint8Array;
  loopCount: number | null;
  delaysCs: number[];
  frames: Uint8Array[]; // palette indices per frame
}

function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const clearCode = 1 << minCodeSize;
  const eofCode = clearCode + 1;
  const out = new Uint8Array(pixelCount);
  let outPos = 0;

  let dict: number[][] = [];
  let codeSize = minCodeSize + 1;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clearCode; i++) dict[i] = [i];
    dict[clearCode] = [];
    dict[eofCode] = [];
    codeSize = minCodeSize + 1;
  };
  reset();

  let bitPos = 0;
  const readCode = () => {
    let code = 0;
    for (let i = 0; i < codeSize; i++) {
      const byte = data[(bitPos + i) >> 3];
      if ((byte >> ((bitPos + i) & 7)) & 1) code |= 1 << i;
    }
    bitPos += codeSize;
    return code;
  };

  let prev: number[] | null = null;
  while (bitPos + codeSize <= data.length * 8) {
    const code = readCode();
    if (code === clearCode) {
      reset();
      prev = null;
      continue;
    }
    if (code === eofCode) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code];
    else if (prev && code === dict.length) entry = [...prev, prev[0]];
    else throw new Error(`invalid LZW code ${code} (dict ${dict.length})`);
    for (const v of entry) out[outPos++] = v;
    if (prev) {
      dict.push([...prev, entry[0]]);
      if (dict.length === 1 << codeSize && codeSize < 12) codeSize++;
    }
    prev = entry;
  }
  if (outPos !== pixelCount) throw new Error(`decoded ${outPos} pixels, expected ${pixelCount}`);
  return out;
}

export function decodeGif(bytes: Uint8Array): DecodedGif {
  let pos = 0;
  const u8 = () => bytes[pos++];
  const u16 = () => bytes[pos++] | (bytes[pos++] << 8);
  const header = String.fromCharCode(...bytes.subarray(0, 6));
  if (header !== "GIF89a") throw new Error(`bad header ${header}`);
  pos = 6;
  const width = u16();
  const height = u16();
  const flags = u8();
  pos += 2;
  if (!(flags & 0x80)) throw new Error("no global colour table");
  const paletteSize = 3 * (1 << ((flags & 7) + 1));
  const palette = bytes.slice(pos, pos + paletteSize);
  pos += paletteSize;

  const result: DecodedGif = { width, height, palette, loopCount: null, delaysCs: [], frames: [] };
  const readSubBlocks = () => {
    const chunks: number[] = [];
    for (let len = u8(); len !== 0; len = u8()) {
      for (let i = 0; i < len; i++) chunks.push(u8());
    }
    return Uint8Array.from(chunks);
  };

  for (;;) {
    const marker = u8();
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = u8();
      const body = readSubBlocks();
      if (label === 0xf9) result.delaysCs.push(body[1] | (body[2] << 8));
      if (label === 0xff && String.fromCharCode(...body.subarray(0, 11)) === "NETSCAPE2.0") {
        result.loopCount = body[12] | (body[13] << 8);
      }
    } else if (marker === 0x2c) {
      pos += 4; // left, top
      const w = u16();
      const h = u16();
      const imageFlags = u8();
      if (imageFlags & 0x80) throw new Error("unexpected local colour table");
      const minCodeSize = u8();
      result.frames.push(lzwDecode(readSubBlocks(), minCodeSize, w * h));
    } else {
      throw new Error(`unexpected block 0x${marker.toString(16)} at ${pos - 1}`);
    }
  }
  return result;
}
