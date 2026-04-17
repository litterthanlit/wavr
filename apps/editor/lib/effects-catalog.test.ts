import { describe, it, expect } from "vitest";
import { EFFECTS_CATALOG, EFFECT_LABELS } from "./effects-catalog";
import { useGradientStore } from "./store";

describe("effects catalog", () => {
  it("is non-empty", () => {
    expect(EFFECTS_CATALOG.length).toBeGreaterThan(0);
  });

  it("every entry has a non-empty flag, label, and section", () => {
    for (const entry of EFFECTS_CATALOG) {
      expect(entry.flag, `missing flag on ${JSON.stringify(entry)}`).toBeTruthy();
      expect(entry.label, `missing label on ${entry.flag}`).toBeTruthy();
      expect(entry.section, `missing section on ${entry.flag}`).toBeTruthy();
    }
  });

  it("every flag exists on the live store and is a boolean", () => {
    const state = useGradientStore.getState() as unknown as Record<string, unknown>;
    for (const entry of EFFECTS_CATALOG) {
      expect(state[entry.flag], `store missing ${entry.flag}`).not.toBeUndefined();
      expect(typeof state[entry.flag]).toBe("boolean");
    }
  });

  it("flags are unique", () => {
    const flags = EFFECTS_CATALOG.map((e) => e.flag);
    const dupes = flags.filter((f, i) => flags.indexOf(f) !== i);
    expect(dupes, `duplicate flags: ${dupes.join(", ")}`).toEqual([]);
  });

  it("EFFECT_LABELS covers every flag in the catalog", () => {
    for (const entry of EFFECTS_CATALOG) {
      expect(EFFECT_LABELS[entry.flag]).toBe(entry.label);
    }
  });
});
