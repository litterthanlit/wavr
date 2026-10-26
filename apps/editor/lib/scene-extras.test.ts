import { describe, expect, it } from "vitest";
import { useGradientStore } from "./store";
import { SCENE_EXTRAS, sceneExtrasOn } from "./scene-extras";

const initial = () => useGradientStore.getState();
const labels = (state: ReturnType<typeof initial>) => sceneExtrasOn(state).map((extra) => extra.label);

describe("scene extras", () => {
  it("lists nothing for the scene the editor opens on", () => {
    expect(labels(initial())).toEqual([]);
  });

  it("lists an effect the editor no longer offers while a scene has it on", () => {
    expect(labels({ ...initial(), asciiEnabled: true })).toEqual(["ASCII"]);
    expect(labels({ ...initial(), radialBlurAmount: 0.3, threeDEnabled: true })).toEqual([
      "Radial Blur",
      "Shader Shape Projection",
    ]);
  });

  it("turns each one off with its patch", () => {
    const everything = SCENE_EXTRAS.reduce((state, extra) => ({ ...state, ...invert(extra.off) }), initial());
    expect(labels(everything)).toEqual(SCENE_EXTRAS.map((extra) => extra.label));
    for (const extra of SCENE_EXTRAS) {
      expect(extra.isOn({ ...everything, ...extra.off }), extra.label).toBe(false);
    }
  });
});

/** The patch that switches an extra on: true for a flag, a nonzero amount for radial blur. */
function invert(off: object) {
  return Object.fromEntries(Object.entries(off).map(([key, value]) => [key, value === false ? true : 0.5]));
}
