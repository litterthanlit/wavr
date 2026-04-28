import { describe, expect, it } from "vitest";
import { SCENES } from "./scenes";

describe("scene gallery", () => {
  it("includes curated Three/R3F remix scenes with scene state", () => {
    const sceneNames = ["Orbital Aurora", "Chrome Product Field", "Particle Veil"];

    for (const name of sceneNames) {
      const scene = SCENES.find((item) => item.name === name);
      expect(scene, `missing ${name}`).toBeDefined();
      expect(scene?.data.scene3DEnabled).toBe(true);
      expect(scene?.data.scene3D?.objects.length).toBeGreaterThan(0);
      expect(scene?.data.scene3D?.particles.length).toBeGreaterThan(0);
    }
  });
});
