import type { GradientState } from "./store";

/**
 * An effect the editor no longer offers but still renders, which an older
 * link, project or preset can have switched on: how to tell it is on, and the
 * patch that turns it off. The Effects tab lists the ones a scene uses, so
 * nothing on screen comes from a control the user can't see.
 */
export interface SceneExtra {
  label: string;
  isOn: (state: GradientState) => boolean;
  off: Partial<GradientState>;
}

type Flag = { [K in keyof GradientState]: GradientState[K] extends boolean ? K : never }[keyof GradientState];

const flag = (label: string, key: Flag): SceneExtra => ({
  label,
  isOn: (state) => state[key],
  off: { [key]: false },
});

export const SCENE_EXTRAS: readonly SceneExtra[] = [
  flag("Noise Overlay", "noiseEnabled"),
  flag("Reaction-Diffusion", "reactionDiffEnabled"),
  flag("Classic Bloom", "bloomEnabled"),
  flag("Soft Glow", "glowEnabled"),
  flag("Caustics", "causticEnabled"),
  { label: "Radial Blur", isOn: (state) => state.radialBlurAmount > 0, off: { radialBlurAmount: 0 } },
  flag("Curl Noise", "curlEnabled"),
  flag("Liquify", "liquifyEnabled"),
  flag("Kaleidoscope", "kaleidoscopeEnabled"),
  flag("Dither", "ditherEnabled"),
  flag("ASCII", "asciiEnabled"),
  flag("Pixel Sort", "pixelSortEnabled"),
  flag("Parallax", "parallaxEnabled"),
  flag("Mesh Distortion", "meshDistortionEnabled"),
  flag("Shader Shape Projection", "threeDEnabled"),
  flag("Feedback Loop", "feedbackEnabled"),
];

/** The extras switched on in this scene. */
export function sceneExtrasOn(state: GradientState): SceneExtra[] {
  return SCENE_EXTRAS.filter((extra) => extra.isOn(state));
}
