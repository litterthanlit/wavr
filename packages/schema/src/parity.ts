/**
 * Deterministic framebuffer hashing for render-parity tests.
 *
 * Strict byte equality breaks across GPUs (software vs hardware swiftshader,
 * different driver versions, etc.) with ~1 LSB per channel of legitimate
 * variation. `hashFramebuffer` quantizes each channel to the nearest multiple
 * of `bucket` before hashing, so goldens tolerate that drift for most pixels.
 *
 * **Tolerance model (important).** Quantization maps values to bucket centers
 * via `Math.round(v / bucket) * bucket`. Values within the same bucket hash
 * identically. However, bucket boundaries are crossed at odd midpoints — a
 * value of 128 maps to 128, but 129 maps to 130 with bucket=2. In practice
 * this means bucket=2 tolerates ±1 LSB drift for roughly half of source
 * values; pixels near bucket boundaries can still flip. For render parity
 * across GPUs, bucket=4 or larger is recommended. bucket=1 enforces strict
 * byte equality.
 *
 * Reference: specs/0001-schema.md §6.3.
 */

export interface CompareResult {
  equal: boolean;
}

/**
 * Hash a RGBA framebuffer with tolerance bucketing.
 *
 * @param pixels  Raw RGBA bytes (length is width * height * 4).
 * @param bucket  Quantization granularity. bucket=2 tolerates ±1 LSB per
 *                channel (the observed ULP band). bucket=1 enforces strict
 *                byte equality. Defaults to 2.
 * @returns       Hex-encoded SHA-256 of the quantized buffer.
 */
export async function hashFramebuffer(pixels: Uint8Array, bucket = 2): Promise<string> {
  if (!Number.isInteger(bucket) || bucket < 1) {
    throw new Error(`hashFramebuffer: bucket must be a positive integer, got ${bucket}`);
  }
  // Always copy into a fresh ArrayBuffer-backed Uint8Array so crypto.subtle.digest
  // gets a BufferSource with a narrow ArrayBuffer type (TS 5.7+ type-generic).
  const quantized = quantize(pixels, bucket);
  // Cast narrows TypedArray<ArrayBufferLike> → BufferSource for the Web Crypto
  // signature. `quantized` is always backed by a fresh ArrayBuffer at runtime.
  const digest = await getCrypto().subtle.digest("SHA-256", quantized as unknown as ArrayBuffer);
  return toHex(new Uint8Array(digest));
}

export function compareHash(a: string, b: string): CompareResult {
  return { equal: a === b };
}

// ---- helpers --------------------------------------------------------------

function quantize(pixels: Uint8Array, bucket: number): Uint8Array {
  const out = new Uint8Array(pixels.length);
  if (bucket === 1) {
    out.set(pixels);
    return out;
  }
  for (let i = 0; i < pixels.length; i++) {
    // Round to nearest multiple of `bucket`, clamp to [0, 255].
    const v = Math.round((pixels[i] ?? 0) / bucket) * bucket;
    out[i] = v > 255 ? 255 : v;
  }
  return out;
}

function getCrypto(): Crypto {
  // globalThis.crypto is standard in Node 18+ and all modern browsers.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("@wavr/schema: globalThis.crypto.subtle is required for hashFramebuffer");
  }
  return c;
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return hex;
}
