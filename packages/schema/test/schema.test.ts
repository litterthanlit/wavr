import { describe, expect, it } from "vitest";
import type { ZodTypeAny } from "zod";
import { GradientConfig, DEFAULT_CONFIG } from "../src";

/**
 * Walker-invariant tests — enforce §3.1 of specs/0001-schema.md:
 *   - every object is .strict()
 *   - every number has .min() and .max()
 *   - every field that lands in a ZodObject.shape entry has a non-empty
 *     description somewhere on its unwrap chain (self, innerType, or deeper
 *     wrappers).
 *
 * The description invariant is enforced by iterating shape[key] entries
 * directly — not by "leaf = skip." That means `z.number().min(0).max(1)` with
 * no `d()` wrapper fails this test, even though ZodNumber is a leaf type.
 */

interface ZodAnyDef {
  typeName: string;
  description?: string;
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  checks?: Array<{ kind: string; value?: number }>;
  unknownKeys?: "strict" | "passthrough" | "strip";
}

function defOf(schema: ZodTypeAny): ZodAnyDef {
  return (schema as unknown as { _def: ZodAnyDef })._def;
}

// Does this schema or anything in its unwrap chain carry a non-empty description?
function hasDescriptionOnChain(schema: ZodTypeAny): boolean {
  let cur: ZodTypeAny | undefined = schema;
  const seen = new Set<ZodTypeAny>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const def = defOf(cur);
    if (def.description && def.description.trim().length > 0) return true;
    cur = def.innerType ?? def.schema;
  }
  return false;
}

function walkObjects(
  schema: ZodTypeAny,
  path: string,
  seen: Set<ZodTypeAny>,
  visit: (obj: ZodTypeAny, objPath: string) => void,
): void {
  if (seen.has(schema)) return;
  seen.add(schema);

  const def = defOf(schema);
  const name = def.typeName;

  if (name === "ZodObject") {
    visit(schema, path);
    const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape;
    for (const [key, child] of Object.entries(shape)) {
      walkObjects(child, path ? `${path}.${key}` : key, seen, visit);
    }
    return;
  }

  if (name === "ZodArray") {
    const el = (schema as unknown as { element: ZodTypeAny }).element;
    walkObjects(el, `${path}[]`, seen, visit);
    return;
  }
  if (name === "ZodTuple") {
    const items = (schema as unknown as { items: ZodTypeAny[] }).items;
    items.forEach((item, i) => walkObjects(item, `${path}[${i}]`, seen, visit));
    return;
  }
  if (name === "ZodOptional" || name === "ZodNullable" || name === "ZodDefault" || name === "ZodEffects") {
    const next = def.innerType ?? def.schema;
    if (next) walkObjects(next, path, seen, visit);
    return;
  }
  if (name === "ZodUnion" || name === "ZodDiscriminatedUnion") {
    const opts = (schema as unknown as { options: ZodTypeAny[] }).options;
    opts.forEach((opt, i) => walkObjects(opt, `${path}|${i}`, seen, visit));
  }
}

function collectNumbers(schema: ZodTypeAny, path: string, seen: Set<ZodTypeAny>, out: Array<{ schema: ZodTypeAny; path: string }>): void {
  if (seen.has(schema)) return;
  seen.add(schema);
  const def = defOf(schema);
  const name = def.typeName;
  if (name === "ZodNumber") out.push({ schema, path });
  if (name === "ZodObject") {
    const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape;
    for (const [key, child] of Object.entries(shape)) {
      collectNumbers(child, path ? `${path}.${key}` : key, seen, out);
    }
    return;
  }
  if (name === "ZodArray") {
    collectNumbers((schema as unknown as { element: ZodTypeAny }).element, `${path}[]`, seen, out);
    return;
  }
  if (name === "ZodTuple") {
    const items = (schema as unknown as { items: ZodTypeAny[] }).items;
    items.forEach((item, i) => collectNumbers(item, `${path}[${i}]`, seen, out));
    return;
  }
  if (name === "ZodOptional" || name === "ZodNullable" || name === "ZodDefault" || name === "ZodEffects") {
    const next = def.innerType ?? def.schema;
    if (next) collectNumbers(next, path, seen, out);
  }
}

describe("schema invariants", () => {
  const objects: Array<{ schema: ZodTypeAny; path: string }> = [];
  walkObjects(GradientConfig, "", new Set(), (obj, path) => objects.push({ schema: obj, path }));

  const numbers: Array<{ schema: ZodTypeAny; path: string }> = [];
  collectNumbers(GradientConfig, "", new Set(), numbers);

  it("visits a non-trivial number of objects and numbers", () => {
    expect(objects.length).toBeGreaterThan(15); // root + 19 effects + layer
    expect(numbers.length).toBeGreaterThan(30);
  });

  it("every ZodObject has .strict() unknownKeys", () => {
    const loose = objects.filter(({ schema }) => defOf(schema).unknownKeys !== "strict");
    expect(loose.map((o) => o.path)).toEqual([]);
  });

  it("every ZodNumber has both .min() and .max()", () => {
    const missing = numbers.filter(({ schema }) => {
      const checks = defOf(schema).checks ?? [];
      return !checks.some((c) => c.kind === "min") || !checks.some((c) => c.kind === "max");
    });
    expect(missing.map((n) => n.path)).toEqual([]);
  });

  // The real invariant: every shape entry must carry a non-empty description
  // on its unwrap chain. A contributor who writes
  //     mystery: z.number().min(0).max(1)
  // with no d() wrapper fails this test — which is the whole point of forcing
  // descriptions through the descriptions.gen.ts key registry.
  it("every ZodObject shape entry has a description on its chain", () => {
    const undescribed: string[] = [];
    for (const { schema, path } of objects) {
      const shape = (schema as unknown as { shape: Record<string, ZodTypeAny> }).shape;
      for (const [key, child] of Object.entries(shape)) {
        if (!hasDescriptionOnChain(child)) {
          undescribed.push(path ? `${path}.${key}` : key);
        }
      }
    }
    expect(undescribed).toEqual([]);
  });

  // Self-test: the test above is only meaningful if it actually trips on an
  // undescribed field. Assert that a synthetic broken object is caught.
  it("self-test: catches an undescribed shape entry", async () => {
    const { z } = await import("zod");
    const bad = z.object({
      mystery: z.number().min(0).max(1).default(0),
    }).strict();
    const shape = (bad as unknown as { shape: Record<string, ZodTypeAny> }).shape;
    expect(hasDescriptionOnChain(shape.mystery!)).toBe(false);
  });

  it("self-test: passes a described shape entry", async () => {
    const { z } = await import("zod");
    const good = z.object({
      mystery: z.number().min(0).max(1).describe("ok").default(0),
    }).strict();
    const shape = (good as unknown as { shape: Record<string, ZodTypeAny> }).shape;
    expect(hasDescriptionOnChain(shape.mystery!)).toBe(true);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("parses cleanly", () => {
    expect(() => GradientConfig.parse(DEFAULT_CONFIG)).not.toThrow();
  });

  it("round-trips through parse", () => {
    const parsed = GradientConfig.parse(DEFAULT_CONFIG);
    const reparsed = GradientConfig.parse(parsed);
    expect(reparsed).toEqual(parsed);
  });
});

describe("strict-mode behavior", () => {
  it("rejects unknown root keys", () => {
    const bad = { ...DEFAULT_CONFIG, someTypo: 1 } as unknown;
    expect(GradientConfig.safeParse(bad).success).toBe(false);
  });

  it("rejects unknown layer keys", () => {
    const bad = {
      ...DEFAULT_CONFIG,
      layers: [{ ...DEFAULT_CONFIG.layers[0], mystery: true }],
    } as unknown;
    expect(GradientConfig.safeParse(bad).success).toBe(false);
  });

  it("rejects out-of-range numerics", () => {
    const bad = { ...DEFAULT_CONFIG, brightness: 99 } as unknown;
    expect(GradientConfig.safeParse(bad).success).toBe(false);
  });

  it("rejects version mismatch", () => {
    const bad = { ...DEFAULT_CONFIG, version: "1.0.0" } as unknown;
    expect(GradientConfig.safeParse(bad).success).toBe(false);
  });

  it("rejects kebab-case blend mode (our enum is camelCase)", () => {
    const bad = {
      ...DEFAULT_CONFIG,
      layers: [{ ...DEFAULT_CONFIG.layers[0], blendMode: "color-dodge" }],
    } as unknown;
    expect(GradientConfig.safeParse(bad).success).toBe(false);
  });
});

describe("accepts effect groups", () => {
  it("accepts a config with every effect group enabled", () => {
    const full = {
      ...DEFAULT_CONFIG,
      noise: { enabled: true, intensity: 0.3, scale: 1 },
      bloom: { enabled: true, intensity: 0.3 },
      blur: { enabled: true, amount: 0.2 },
      curl: { enabled: true, intensity: 0.5, scale: 1 },
      kaleidoscope: { enabled: true, segments: 6, rotation: 0 },
      reactionDiffusion: { enabled: true, intensity: 0.5, scale: 1 },
      pixelSort: { enabled: true, intensity: 0.5, threshold: 0.5 },
      feedback: { enabled: true, decay: 0.5 },
      ascii: { enabled: true, size: 8 },
      dither: { enabled: true, size: 4 },
      parallax: { enabled: true, strength: 0.5 },
      shape3d: {
        enabled: true,
        shape: "sphere" as const,
        perspective: 1.5,
        rotationSpeed: 0.3,
        zoom: 1,
        lighting: 0.5,
      },
      meshDistortion: { enabled: true, displacement: 0.3, frequency: 2, speed: 0.5 },
      ripple: { enabled: true, intensity: 0.5 },
      glow: { enabled: true, intensity: 0.5, radius: 0.05 },
      caustic: { enabled: true, intensity: 0.5 },
      liquify: { enabled: true, intensity: 0.3, scale: 2 },
      trail: { enabled: true, length: 0.96, width: 0.05 },
      realBloom: { enabled: true },
    };
    expect(() => GradientConfig.parse(full)).not.toThrow();
  });
});
