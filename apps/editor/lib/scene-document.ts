import {
  GradientConfig,
  WavrSceneDocument,
  gradientConfigFromSceneDocument,
  sceneDocumentFromGradientConfig,
  type SceneDocumentFromConfigOptions,
  type WavrSceneDocumentValue,
} from "@wavr/schema";
import type { GradientState } from "./store";
import { KEYFRAMEABLE_PARAMS, type KeyframeParams } from "./timeline";
import { configToStorePatch, storeToConfig } from "./url-sync";

export type StoreToSceneDocumentOptions = Omit<SceneDocumentFromConfigOptions, "performanceProfile"> & {
  performanceProfile?: SceneDocumentFromConfigOptions["performanceProfile"];
};

const GLOBAL_TIMELINE_PATHS: Partial<Record<keyof KeyframeParams, string>> = {
  brightness: "globals.brightness",
  saturation: "globals.saturation",
  hueShift: "globals.hueShift",
  vignette: "globals.vignette",
  colorBlend: "editor.colorBlend",
  noiseIntensity: "postEffects.noise.params.intensity",
};

const LAYER_TIMELINE_PARAMS = new Set<keyof KeyframeParams>([
  "speed",
  "complexity",
  "scale",
  "distortion",
]);

function trackIdFromPath(path: string): string {
  const slug = path.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `track-${slug}`;
}

function targetPathForParam(param: keyof KeyframeParams, activeLayerIndex: number): string | null {
  if (LAYER_TIMELINE_PARAMS.has(param)) {
    return `layers.layer-${activeLayerIndex + 1}.source.gradient.${param}`;
  }
  return GLOBAL_TIMELINE_PATHS[param] ?? null;
}

function timelineFromState(state: GradientState): WavrSceneDocumentValue["timeline"] {
  const tracks: WavrSceneDocumentValue["timeline"]["tracks"] = [];
  const sortedKeyframes = [...state.keyframes].sort((a, b) => a.time - b.time);

  for (const param of KEYFRAMEABLE_PARAMS) {
    const targetPath = targetPathForParam(param, state.activeLayerIndex);
    if (!targetPath) continue;

    const keyframes = sortedKeyframes.flatMap((keyframe) => {
      const value = keyframe.params[param];
      if (typeof value !== "number") return [];
      return [{
        time: Math.max(0, keyframe.time),
        value,
        easing: "ease" as const,
      }];
    });

    if (keyframes.length === 0) continue;

    tracks.push({
      id: trackIdFromPath(targetPath),
      targetPath,
      valueType: "number",
      keyframes,
    });
  }

  return {
    duration: Math.max(1, state.timelineDuration),
    playback: state.timelinePlaybackMode,
    tracks,
  };
}

function paramForTargetPath(path: string): keyof KeyframeParams | null {
  const globalEntry = Object.entries(GLOBAL_TIMELINE_PATHS)
    .find(([, targetPath]) => targetPath === path);
  if (globalEntry) return globalEntry[0] as keyof KeyframeParams;

  const layerMatch = path.match(/^layers\.layer-\d+\.source\.gradient\.(speed|complexity|scale|distortion)$/);
  return layerMatch ? layerMatch[1] as keyof KeyframeParams : null;
}

function activeLayerIndexFromTimeline(timeline: WavrSceneDocumentValue["timeline"]): number | undefined {
  for (const track of timeline.tracks) {
    const match = track.targetPath.match(/^layers\.layer-(\d+)\./);
    if (!match) continue;
    return Math.max(0, Number(match[1]) - 1);
  }
  return undefined;
}

function keyframesFromTimeline(timeline: WavrSceneDocumentValue["timeline"]) {
  const byTime = new Map<number, KeyframeParams>();

  for (const track of timeline.tracks) {
    const param = paramForTargetPath(track.targetPath);
    if (!param) continue;

    for (const keyframe of track.keyframes) {
      if (typeof keyframe.value !== "number") continue;
      const params = byTime.get(keyframe.time) ?? {};
      params[param] = keyframe.value;
      byTime.set(keyframe.time, params);
    }
  }

  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, params]) => ({ time, params }));
}

export function storeToSceneDocument(
  state: GradientState,
  options: StoreToSceneDocumentOptions = {},
): WavrSceneDocumentValue {
  const config = GradientConfig.parse(storeToConfig(state));
  const document = sceneDocumentFromGradientConfig(config, {
    ...options,
    name: options.name ?? "Untitled scene",
    performanceProfile: options.performanceProfile ?? state.performanceMode,
  });

  return WavrSceneDocument.parse({
    ...document,
    layers: document.layers.map((layer, index) => ({
      ...layer,
      visible: state.layers[index]?.visible ?? layer.visible,
    })),
    timeline: timelineFromState(state),
  });
}

export function sceneDocumentToStorePatch(document: WavrSceneDocumentValue): Partial<GradientState> {
  const parsed = WavrSceneDocument.parse(document);
  const config = GradientConfig.parse(gradientConfigFromSceneDocument(parsed));
  const patch = configToStorePatch(config);
  const keyframes = keyframesFromTimeline(parsed.timeline);
  const activeLayerIndex = activeLayerIndexFromTimeline(parsed.timeline);

  patch.timelineEnabled = keyframes.length > 0;
  patch.timelineDuration = parsed.timeline.duration;
  patch.timelinePlaybackMode = parsed.timeline.playback;
  patch.keyframes = keyframes;
  if (activeLayerIndex !== undefined) patch.activeLayerIndex = activeLayerIndex;
  if (parsed.performanceProfile !== "custom") patch.performanceMode = parsed.performanceProfile;

  return patch;
}

export function sceneDocumentToJson(document: WavrSceneDocumentValue): string {
  return `${JSON.stringify(WavrSceneDocument.parse(document), null, 2)}\n`;
}
