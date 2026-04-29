import { describe, expect, it } from "vitest";
import { SCENES } from "./scenes";

describe("scene gallery", () => {
  it("includes curated Three/R3F remix scenes with scene state", () => {
    const sceneNames = ["Orbital Aurora", "Chrome Product Field", "Particle Veil", "Terrain Field"];

    for (const name of sceneNames) {
      const scene = SCENES.find((item) => item.name === name);
      expect(scene, `missing ${name}`).toBeDefined();
      expect(scene?.data.scene3DEnabled).toBe(true);
      expect(scene?.data.scene3D?.objects.length).toBeGreaterThan(0);
      expect(scene?.data.scene3D?.particles.length).toBeGreaterThan(0);
    }
  });

  it("features the new curated inspo looks first", () => {
    expect(SCENES.slice(0, 4).map((scene) => scene.name)).toEqual([
      "Prism Glass",
      "Neon Tunnel",
      "Terrain Field",
      "Lens Burn",
    ]);
    expect(SCENES[0]?.data.gradientType).toBe("prismGlass");
    expect(SCENES[1]?.data.gradientType).toBe("neonTunnel");
  });
});
