import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLayer } from "@wavr/core";
import { deleteProject, exportProjectState, loadProjects, projectStateForLoad, saveProject } from "./projects";
import {
  IMAGE_REF_PREFIX,
  MemoryImageBackend,
  blobToDataUrl,
  dataUrlToBlob,
  setImageBackendForTests,
} from "./image-store";
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

  it("saves a scene document next to the legacy project state", async () => {
    localStorage.clear();

    await saveProject("Scene doc", minimalState({
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

  it("can load from scene-document-only saved projects", async () => {
    const state = minimalState({
      layers: [createLayer({ gradientType: "plasma", speed: 0.7 })],
      brightness: 1.3,
    });
    await saveProject("Future scene", state);
    const saved = JSON.parse(localStorage.getItem("wavr-projects") ?? "[]")[0];
    delete saved.state;

    const { patch } = await projectStateForLoad(saved);

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

// Small but distinct "images": the store hashes bytes, so any data URL works.
const PNG_A = "data:image/png;base64," + btoa("image-a".repeat(200));
const PNG_B = "data:image/webp;base64," + btoa("image-b".repeat(200));

function stored(): string {
  return localStorage.getItem("wavr-projects") ?? "[]";
}

describe("project image storage", () => {
  let images: MemoryImageBackend;

  beforeEach(() => {
    installLocalStorage();
    images = new MemoryImageBackend();
    setImageBackendForTests(images);
  });

  afterEach(() => setImageBackendForTests(undefined));

  it("keeps image bytes out of localStorage and restores them on load", async () => {
    await saveProject("With image", minimalState({
      layers: [createLayer({ imageData: PNG_A, distortionMapData: PNG_B })],
    }));

    expect(stored()).not.toContain("data:image");
    const [project] = loadProjects();
    expect(project.state?.layers[0].imageData).toMatch(new RegExp(`^${IMAGE_REF_PREFIX}[0-9a-f]{64}$`));
    expect(images.entries.size).toBe(2);

    const { patch, missingImages } = await projectStateForLoad(project);
    expect(missingImages).toBe(0);
    expect(patch.layers?.[0].imageData).toBe(PNG_A);
    expect(patch.layers?.[0].distortionMapData).toBe(PNG_B);
  });

  it("stores identical images once", async () => {
    await saveProject("Twice", minimalState({
      layers: [createLayer({ imageData: PNG_A }), createLayer({ imageData: PNG_A })],
    }));
    await saveProject("Again", minimalState({ layers: [createLayer({ imageData: PNG_A })] }));
    expect(images.entries.size).toBe(1);
  });

  it("moves inline images out of older projects on the next save", async () => {
    const legacy = [{
      name: "Legacy",
      timestamp: 1,
      state: { ...exportProjectState(minimalState()), layers: [createLayer({ imageData: PNG_A })] },
    }];
    localStorage.setItem("wavr-projects", JSON.stringify(legacy));
    const before = stored().length;

    await saveProject("New", minimalState());

    expect(stored()).not.toContain("data:image");
    expect(stored().length).toBeLessThan(before + 20_000);
    const legacyProject = loadProjects().find((p) => p.name === "Legacy")!;
    expect((await projectStateForLoad(legacyProject)).patch.layers?.[0].imageData).toBe(PNG_A);
  });

  it("deletes images no project uses, but keeps shared ones", async () => {
    await saveProject("One", minimalState({ layers: [createLayer({ imageData: PNG_A })] }));
    await saveProject("Two", minimalState({ layers: [createLayer({ imageData: PNG_A, distortionMapData: PNG_B })] }));
    expect(images.entries.size).toBe(2);

    await deleteProject("Two");
    expect(images.entries.size).toBe(1); // PNG_A is still used by "One"

    // Overwriting a project drops the image it no longer uses.
    await saveProject("One", minimalState());
    expect(images.entries.size).toBe(0);
  });

  it("reports images that are no longer stored", async () => {
    await saveProject("Lost", minimalState({ layers: [createLayer({ imageData: PNG_A })] }));
    images.entries.clear();

    const { patch, missingImages } = await projectStateForLoad(loadProjects()[0]);
    expect(missingImages).toBe(1);
    expect(patch.layers?.[0].imageData).toBeNull();
  });

  it("keeps images inline when IndexedDB is unavailable", async () => {
    setImageBackendForTests(null);
    await saveProject("Inline", minimalState({ layers: [createLayer({ imageData: PNG_A })] }));
    expect(loadProjects()[0].state?.layers[0].imageData).toBe(PNG_A);
  });

  it("falls back to inline images if the image store fails", async () => {
    vi.spyOn(images, "put").mockRejectedValue(new Error("disk full"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await saveProject("Fallback", minimalState({ layers: [createLayer({ imageData: PNG_A })] }));
    expect(loadProjects()[0].state?.layers[0].imageData).toBe(PNG_A);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("surfaces a readable error when localStorage is full", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    });
    await expect(saveProject("Big", minimalState())).rejects.toThrow(/Storage quota exceeded/);
  });

  it("does not lose images when saves overlap", async () => {
    await Promise.all([
      saveProject("A", minimalState({ layers: [createLayer({ imageData: PNG_A })] })),
      saveProject("B", minimalState({ layers: [createLayer({ imageData: PNG_B })] })),
      deleteProject("nonexistent"),
    ]);
    expect(loadProjects().map((p) => p.name).sort()).toEqual(["A", "B"]);
    expect(images.entries.size).toBe(2);
  });
});

describe("image-store data URLs", () => {
  it("round-trips base64 and percent-encoded data URLs", async () => {
    expect(await blobToDataUrl(dataUrlToBlob(PNG_A))).toBe(PNG_A);
    const svg = "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E";
    const blob = dataUrlToBlob(svg);
    expect(blob.type).toBe("image/svg+xml");
    expect(await blob.text()).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
  });
});
