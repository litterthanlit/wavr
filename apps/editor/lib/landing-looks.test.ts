import { describe, expect, it } from "vitest";
import { PRESET_CATALOG } from "@wavr/core/presets";
import { LANDING_LOOKS } from "./landing-looks";

describe("landing looks", () => {
  it("are catalogue presets under the catalogue's names", () => {
    for (const look of LANDING_LOOKS) {
      expect(PRESET_CATALOG.find((entry) => entry.id === look.id)?.name).toBe(look.name);
    }
  });
});
