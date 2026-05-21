import { describe, expect, it } from "vitest";
import { createLayer } from "@wavr/core";
import { WavrSceneDocument } from "@wavr/schema";
import { DEFAULT_SCENE_3D_STATE, cloneScene3D } from "./scene3d";
import { sceneDocumentToJson, sceneDocumentToStorePatch, storeToSceneDocument } from "./scene-document";
import type { GradientState } from "./store";

function minimalState(overrides: Partial<GradientState> = {}): GradientState {
  const layer = createLayer();
  return {
    layers: [layer],
    activeLayerIndex: 0,
    brightness: 1,
    saturation: 1,
    noiseEnabled: false,
    noiseIntensity: 0.3,
    noiseScale: 1,
    grain: 0,
    mouseReact: 0.5,
    bloomEnabled: false,
    bloomIntensity: 0.3,
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
    curlIntensity: 0.5,
    curlScale: 1,
    kaleidoscopeEnabled: false,
    kaleidoscopeSegments: 6,
    kaleidoscopeRotation: 0,
    reactionDiffEnabled: false,
    reactionDiffIntensity: 0.5,
    reactionDiffScale: 1,
    pixelSortEnabled: false,
    pixelSortIntensity: 0.5,
    pixelSortThreshold: 0.5,
    domainWarp: 0,
    feedbackEnabled: false,
    feedbackDecay: 0.5,
    oklabEnabled: true,
    toneMapMode: 1,
    rippleEnabled: false,
    rippleIntensity: 0.5,
    glowEnabled: false,
    glowIntensity: 0.5,
    glowRadius: 0.05,
    causticEnabled: false,
    causticIntensity: 0.5,
    liquifyEnabled: false,
    liquifyIntensity: 0.3,
    liquifyScale: 2,
    trailEnabled: false,
    trailLength: 0.96,
    trailWidth: 0.05,
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
    parallaxStrength: 0.5,
    threeDEnabled: false,
    threeDShape: 0,
    threeDPerspective: 1.5,
    threeDRotationSpeed: 0.3,
    threeDZoom: 1,
    threeDLighting: 0.5,
    meshDistortionEnabled: false,
    meshDisplacement: 0.3,
    meshFrequency: 2,
    meshSpeed: 0.5,
    scene3DEnabled: false,
    scene3D: cloneScene3D(DEFAULT_SCENE_3D_STATE),
    gradientType: layer.gradientType,
    speed: layer.speed,
    complexity: layer.complexity,
    scale: layer.scale,
    distortion: layer.distortion,
    softness: layer.softness,
    colors: layer.colors,
    set: () => {},
    setDiscrete: () => {},
    commitSet: () => {},
    setColor: () => {},
    addColor: () => {},
    removeColor: () => {},
    loadPreset: () => {},
    randomize: () => {},
    undo: () => {},
    redo: () => {},
    addLayer: () => {},
    removeLayer: () => {},
    selectLayer: () => {},
    setLayerParam: () => {},
    setLayerOpacity: () => {},
    setLayerBlendMode: () => {},
    toggleLayerVisibility: () => {},
    moveLayer: () => {},
    setLayerImage: () => {},
    setLayerDistortionMap: () => {},
    setScene3D: () => {},
    addSceneObject: () => {},
    updateSceneObject: () => {},
    removeSceneObject: () => {},
    selectSceneObject: () => {},
    addParticleField: () => {},
    updateParticleField: () => {},
    removeParticleField: () => {},
    toggleTimeline: () => {},
    addKeyframe: () => {},
    removeKeyframe: () => {},
    setTimelinePosition: () => {},
    setTimelineDuration: () => {},
    setTimelinePlaybackMode: () => {},
    ...overrides,
  };
}

describe("editor scene document adapter", () => {
  it("exports schema-owned editor state as a valid scene document", () => {
    const layer = createLayer({
      gradientType: "aurora",
      opacity: 0.72,
      blendMode: "screen",
      depth: 0.25,
    });
    const document = storeToSceneDocument(minimalState({
      layers: [layer],
      gradientType: "aurora",
      brightness: 1.2,
      noiseEnabled: true,
      noiseIntensity: 0.45,
      performanceMode: "battery",
    }), {
      name: "Hero scene",
      canvas: { width: 1920, height: 1080 },
    });

    expect(() => WavrSceneDocument.parse(document)).not.toThrow();
    expect(document.meta.name).toBe("Hero scene");
    expect(document.canvas).toMatchObject({ width: 1920, height: 1080 });
    expect(document.performanceProfile).toBe("battery");
    expect(document.layers[0]).toMatchObject({
      kind: "shader",
      opacity: 0.72,
      blendMode: "screen",
      source: {
        kind: "gradient",
        gradient: {
          type: "aurora",
          depth: 0.25,
        },
      },
    });
    expect(document.globals.brightness).toBe(1.2);
    expect(document.postEffects.find((effect) => effect.type === "noise")).toMatchObject({
      enabled: true,
      params: { intensity: 0.45 },
    });
  });

  it("preserves editor layer visibility in the scene document", () => {
    const visibleLayer = createLayer({ gradientType: "mesh", visible: true });
    const hiddenLayer = createLayer({ gradientType: "plasma", visible: false });

    const document = storeToSceneDocument(minimalState({
      layers: [visibleLayer, hiddenLayer],
    }));

    expect(document.layers.map((layer) => layer.visible)).toEqual([true, false]);
  });

  it("converts existing timeline keyframes into property tracks", () => {
    const document = storeToSceneDocument(minimalState({
      timelineEnabled: true,
      timelineDuration: 12,
      timelinePlaybackMode: "bounce",
      keyframes: [
        { time: 0, params: { speed: 0.2, brightness: 1 } },
        { time: 4, params: { speed: 0.8, brightness: 1.4, noiseIntensity: 0.65 } },
      ],
    }));

    expect(document.timeline.duration).toBe(12);
    expect(document.timeline.playback).toBe("bounce");
    expect(document.timeline.tracks).toEqual([
      {
        id: "track-layers-layer-1-source-gradient-speed",
        targetPath: "layers.layer-1.source.gradient.speed",
        valueType: "number",
        keyframes: [
          { time: 0, value: 0.2, easing: "ease" },
          { time: 4, value: 0.8, easing: "ease" },
        ],
      },
      {
        id: "track-globals-brightness",
        targetPath: "globals.brightness",
        valueType: "number",
        keyframes: [
          { time: 0, value: 1, easing: "ease" },
          { time: 4, value: 1.4, easing: "ease" },
        ],
      },
      {
        id: "track-postEffects-noise-params-intensity",
        targetPath: "postEffects.noise.params.intensity",
        valueType: "number",
        keyframes: [
          { time: 4, value: 0.65, easing: "ease" },
        ],
      },
    ]);
  });

  it("serializes scene documents as stable pretty JSON", () => {
    const document = storeToSceneDocument(minimalState(), { name: "JSON scene" });
    const json = sceneDocumentToJson(document);

    expect(JSON.parse(json)).toMatchObject({
      version: "wavr.scene.v1",
      meta: { name: "JSON scene" },
    });
    expect(json).toContain('\n  "version": "wavr.scene.v1"');
  });

  it("loads scene document timeline tracks into the current project shape", () => {
    const document = storeToSceneDocument(minimalState({
      timelineEnabled: true,
      timelineDuration: 12,
      timelinePlaybackMode: "bounce",
      keyframes: [
        { time: 0, params: { speed: 0.2, brightness: 1 } },
        { time: 4, params: { speed: 0.8, brightness: 1.4, noiseIntensity: 0.65 } },
      ],
    }));

    const patch = sceneDocumentToStorePatch(document);

    expect(patch).toMatchObject({
      timelineEnabled: true,
      timelineDuration: 12,
      timelinePlaybackMode: "bounce",
      keyframes: [
        { time: 0, params: { speed: 0.2, brightness: 1 } },
        { time: 4, params: { speed: 0.8, brightness: 1.4, noiseIntensity: 0.65 } },
      ],
    });
  });
});
