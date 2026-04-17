import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  hashFramebuffer,
  compareHash,
  GradientConfig,
  encodeUrl,
  decodeUrl,
  migrate,
} from "../src";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures", "parity");

// ---------- hash property tests --------------------------------------------

describe("hashFramebuffer", () => {
  it("is deterministic: same input → same hash", async () => {
    const pixels = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    const a = await hashFramebuffer(pixels);
    const b = await hashFramebuffer(pixels);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashFramebuffer(new Uint8Array([10, 20, 30, 255]));
    const b = await hashFramebuffer(new Uint8Array([99, 99, 99, 255]));
    expect(a).not.toBe(b);
  });

  it("values within the same bucket hash identically (deterministic tolerance)", async () => {
    // With bucket=2, values {1,2} both map to 2; {3,4} both map to 4; etc.
    // So a buffer of 2s hashes the same as a buffer of 1s. This is the
    // deterministic guarantee — see parity.ts docstring for the boundary note.
    const a = new Uint8Array([2, 2, 2, 2, 4, 4, 4, 4, 6, 6, 6, 6]);
    const b = new Uint8Array([1, 2, 2, 1, 3, 4, 4, 3, 5, 6, 6, 5]);
    const hashA = await hashFramebuffer(a, 2);
    const hashB = await hashFramebuffer(b, 2);
    expect(hashA).toBe(hashB);
  });

  it("larger buckets give broader tolerance", async () => {
    // bucket=4 maps 2,3,4,5 all to 4. All six values below are in bucket 4.
    const a = new Uint8Array([2, 3, 4, 5, 4, 3]);
    const b = new Uint8Array([4, 4, 4, 4, 4, 4]);
    const hashA = await hashFramebuffer(a, 4);
    const hashB = await hashFramebuffer(b, 4);
    expect(hashA).toBe(hashB);
  });

  it("does NOT tolerate drift larger than bucket", async () => {
    const pixels = new Uint8Array(64).fill(128);
    const drifted = new Uint8Array(64).fill(128);
    drifted[0] = 200; // +72 is way beyond bucket=2

    const original = await hashFramebuffer(pixels);
    const big = await hashFramebuffer(drifted);
    expect(big).not.toBe(original);
  });

  it("bucket=1 enforces strict byte equality", async () => {
    const pixels = new Uint8Array([128, 128, 128, 255]);
    const perturbed = new Uint8Array([129, 128, 128, 255]);
    const a = await hashFramebuffer(pixels, 1);
    const b = await hashFramebuffer(perturbed, 1);
    expect(a).not.toBe(b);
  });

  it("rejects invalid bucket values", async () => {
    const pixels = new Uint8Array(4);
    await expect(hashFramebuffer(pixels, 0)).rejects.toThrow();
    await expect(hashFramebuffer(pixels, -1)).rejects.toThrow();
    await expect(hashFramebuffer(pixels, 1.5)).rejects.toThrow();
  });

  it("handles empty buffers", async () => {
    const hash = await hashFramebuffer(new Uint8Array(0));
    // SHA-256 of empty input is a well-known constant
    expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("clamps quantized values to 0-255", async () => {
    const pixels = new Uint8Array([255, 254, 253, 252]);
    // Should not throw on edge-of-range values with larger buckets
    await expect(hashFramebuffer(pixels, 16)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("compareHash", () => {
  it("equal for same hash", () => {
    expect(compareHash("abc", "abc").equal).toBe(true);
  });
  it("unequal for different hashes", () => {
    expect(compareHash("abc", "def").equal).toBe(false);
  });
});

// ---------- fixture validation --------------------------------------------

describe("parity fixtures", () => {
  const fixtureFiles = readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"));

  it("has the minimum fixture set from spec §6.4", () => {
    const required = [
      "solid.json",
      "mesh-3layer.json",
      "full-effects.json",
      "animated-plasma.json",
      "dither-bayer.json",
      "voronoi-classic.json",
      "shape3d-sphere.json",
    ];
    for (const name of required) {
      expect(fixtureFiles).toContain(name);
    }
  });

  for (const file of fixtureFiles) {
    describe(`fixture: ${file}`, () => {
      const raw = readFileSync(join(FIXTURES_DIR, file), "utf8");
      const parsed: unknown = JSON.parse(raw);

      it("parses under GradientConfig", () => {
        expect(() => GradientConfig.parse(parsed)).not.toThrow();
      });

      it("migrates to itself (idempotent V2 pass-through)", () => {
        const result = migrate(parsed);
        expect(result.detectedShape).toBe("v2");
      });

      it("round-trips through URL codec", () => {
        const config = GradientConfig.parse(parsed);
        const encoded = encodeUrl(config);
        const decoded = decodeUrl(encoded);
        expect(decoded).toEqual(config);
      });

      it("encodes under MAX_URL_BYTES", () => {
        const config = GradientConfig.parse(parsed);
        const encoded = encodeUrl(config);
        expect(encoded.length).toBeLessThan(6 * 1024);
      });
    });
  }
});
