import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLayer } from "@wavr/core";
import { exportProjectState, projectStateForLoad, saveProject } from "./projects";
import { DEFAULT_SCENE_3D_STATE, cloneScene3D } from "./scene3d";
import type { GradientState } from "./store";

function installLocalStorage() {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
    clear: () => entries.clear(),
  });
}

function minimalState(overrides: Partial<GradientState> = {}): GradientState {
  return {
    layers: [createLayer()],
    activeLayerIndex: 0,
    brightness: 1,
    saturation: 1,
    noiseEnabled: false,
    noiseIntensity: 0,
    noiseScale: 1,
    grain: 0,
    mouseReact: 0,
    bloomEnabled: false,
    bloomIntensity: 0,
    vignette: 0,
    blurEnabled: false,
    blurAmount: 0,
    radialBlurAmount: 0,
    colorBlend: 0,
    chromaticAberration: 0,
    hueShift: 0,
    asciiEnabled: false,
    asciiSize: 8,
    ditherEnabled: false,
    ditherSize: 4,
    curlEnabled: false,
    curlIntensity: 0,
    curlScale: 1,
    kaleidoscopeEnabled: false,
    kaleidoscopeSegments: 6,
    kaleidoscopeRotation: 0,
    reactionDiffEnabled: false,
    reactionDiffIntensity: 0,
    reactionDiffScale: 1,
    pixelSortEnabled: false,
    pixelSortIntensity: 0,
    pixelSortThreshold: 0.5,
    domainWarp: 0,
    feedbackEnabled: false,
    feedbackDecay: 0,
    oklabEnabled: true,
    toneMapMode: 1,
    rippleEnabled: false,
    rippleIntensity: 0,
    glowEnabled: false,
    glowIntensity: 0,
    glowRadius: 0,
    causticEnabled: false,
    causticIntensity: 0,
    liquifyEnabled: false,
    liquifyIntensity: 0,
    liquifyScale: 1,
    trailEnabled: false,
    trailLength: 0,
    trailWidth: 0,
    realBloomEnabled: false,
    debandEnabled: true,
    debandStrength: 1,
    audioEnabled: false,
    audioSource: "mic",
    audioBassTarget: "distortion",
    audioTrebleTarget: "brightness",
    audioEnergyTarget: "scale",
    audioSensitivity: 0.5,
    performanceMode: "auto",
    playing: true,
    timelineEnabled: false,
    timelineDuration: 10,
    timelinePlaybackMode: "loop",
    keyframes: [],
    timelinePosition: 0,
    customGLSL: null,
    parallaxEnabled: false,
    parallaxStrength: 0,
    threeDEnabled: false,
    threeDShape: 0,
    threeDPerspective: 1,
    threeDRotationSpeed: 0,
    threeDZoom: 1,
    threeDLighting: 0,
    meshDistortionEnabled: false,
    meshDisplacement: 0,
    meshFrequency: 1,
    meshSpeed: 0,
    scene3DEnabled: false,
    scene3D: cloneScene3D(DEFAULT_SCENE_3D_STATE),
    gradientType: "mesh",
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
    softness: 0,
    colors: [[1, 1, 1]],
    set: () => {},
    setLayerParam: () => {},
    setLayerBlendMode: () => {},
    addLayer: () => {},
    duplicateLayer: () => {},
    removeLayer: () => {},
    selectLayer: () => {},
    reorderLayers: () => {},
    mergeLayerDown: () => {},
    flattenLayers: () => {},
    randomize: () => {},
    randomizePalette: () => {},
    setPreset: () => {},
    reset: () => {},
    exportJSON: () => "{}",
    importJSON: () => false,
    setKeyframes: () => {},
    addKeyframe: () => {},
    updateKeyframe: () => {},
    removeKeyframe: () => {},
    setTimelinePosition: () => {},
    applyKeyframeAtPosition: () => {},
    setScene3D: () => {},
    addSceneObject: () => {},
    updateSceneObject: () => {},
    removeSceneObject: () => {},
    selectSceneObject: () => {},
    addParticleField: () => {},
    updateParticleField: () => {},
    removeParticleField: () => {},
    ...overrides,
  } as unknown as GradientState;
}

describe("project export", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("preserves debanding and custom shader state", () => {
    const exported = exportProjectState(minimalState({
      debandEnabled: false,
      debandStrength: 0.37,
      customGLSL: "void main(){ fragColor = vec4(1.0); }",
    }));

    expect(exported.debandEnabled).toBe(false);
    expect(exported.debandStrength).toBe(0.37);
    expect(exported.customGLSL).toBe("void main(){ fragColor = vec4(1.0); }");
  });

  it("preserves editor-only Three scene state", () => {
    const scene3D = cloneScene3D(DEFAULT_SCENE_3D_STATE);
    const baseObject = scene3D.objects[0];
    if (!baseObject) throw new Error("Expected default scene object");
    scene3D.objects[0] = {
      ...baseObject,
      kind: "torus",
      color: "#38bdf8",
      position: [1, 2, 3],
    };

    const exported = exportProjectState(minimalState({
      scene3DEnabled: true,
      scene3D,
    }));

    expect(exported.scene3DEnabled).toBe(true);
    expect(exported.scene3D.objects[0]?.kind).toBe("torus");
    expect(exported.scene3D.objects[0]?.position).toEqual([1, 2, 3]);
    expect(exported.scene3D).not.toBe(scene3D);
  });

  it("preserves editor performance mode", () => {
    const exported = exportProjectState(minimalState({
      performanceMode: "battery",
    }));

    expect(exported.performanceMode).toBe("battery");
  });

  it("saves a scene document next to the legacy project state", () => {
    localStorage.clear();

    saveProject("Scene doc", minimalState({
      brightness: 1.25,
      performanceMode: "quality",
    }));

    const raw = localStorage.getItem("wavr-projects");
    const projects = JSON.parse(raw ?? "[]");
    expect(projects[0].sceneDocument).toMatchObject({
      version: "wavr.scene.v1",
      meta: { name: "Scene doc" },
      globals: { brightness: 1.25 },
      performanceProfile: "quality",
    });
  });

  it("can load from scene-document-only saved projects", () => {
    const state = minimalState({
      layers: [createLayer({ gradientType: "plasma", speed: 0.7 })],
      brightness: 1.3,
    });
    saveProject("Future scene", state);
    const saved = JSON.parse(localStorage.getItem("wavr-projects") ?? "[]")[0];
    delete saved.state;

    const patch = projectStateForLoad(saved);

    expect(patch).toMatchObject({
      brightness: 1.3,
      layers: [
        expect.objectContaining({
          gradientType: "plasma",
          speed: 0.7,
        }),
      ],
    });
  });
});
