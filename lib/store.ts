import { create } from "zustand";
import { LayerParams, BlendMode, createLayer, MAX_LAYERS } from "./layers";
import { Keyframe, KeyframeParams, PlaybackMode, KEYFRAMEABLE_PARAMS, interpolateKeyframes } from "./timeline";

export interface GradientState {
  // Layers
  layers: LayerParams[];
  activeLayerIndex: number;

  // Global effects (applied after layer compositing)
  brightness: number;
  saturation: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseScale: number;
  grain: number;
  particlesEnabled: boolean;
  particleCount: number;
  particleSize: number;
  mouseReact: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  vignette: number;
  blurEnabled: boolean;
  blurAmount: number;
  radialBlurAmount: number;
  colorBlend: number;
  chromaticAberration: number;
  hueShift: number;
  asciiEnabled: boolean;
  asciiSize: number;
  ditherEnabled: boolean;
  ditherSize: number;
  voronoiEnabled: boolean;
  voronoiIntensity: number;
  voronoiScale: number;
  curlEnabled: boolean;
  curlIntensity: number;
  curlScale: number;
  kaleidoscopeEnabled: boolean;
  kaleidoscopeSegments: number;
  kaleidoscopeRotation: number;

  // Playback
  playing: boolean;

  // Timeline
  timelineEnabled: boolean;
  timelineDuration: number;
  timelinePlaybackMode: PlaybackMode;
  keyframes: Keyframe[];
  timelinePosition: number;

  // Convenience getters for active layer (derived)
  gradientType: LayerParams["gradientType"];
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  colors: [number, number, number][];

  // Actions
  set: (partial: Partial<GradientState>) => void;
  setDiscrete: (partial: Partial<GradientState>) => void;
  commitSet: () => void;
  setColor: (index: number, color: [number, number, number]) => void;
  addColor: () => void;
  removeColor: (index: number) => void;
  loadPreset: (preset: Partial<GradientState>) => void;
  randomize: () => void;
  undo: () => void;
  redo: () => void;

  // Layer actions
  addLayer: () => void;
  removeLayer: (index: number) => void;
  selectLayer: (index: number) => void;
  setLayerParam: (param: Partial<LayerParams>) => void;
  setLayerOpacity: (index: number, opacity: number) => void;
  setLayerBlendMode: (index: number, mode: BlendMode) => void;
  toggleLayerVisibility: (index: number) => void;
  moveLayer: (from: number, to: number) => void;

  // Timeline actions
  toggleTimeline: () => void;
  addKeyframe: () => void;
  removeKeyframe: (index: number) => void;
  setTimelinePosition: (time: number) => void;
  setTimelineDuration: (duration: number) => void;
  setTimelinePlaybackMode: (mode: PlaybackMode) => void;
}

// Keys excluded from undo snapshots
const HISTORY_EXCLUDE_KEYS: (keyof GradientState)[] = [
  "playing", "set", "setDiscrete", "commitSet", "setColor", "addColor", "removeColor",
  "loadPreset", "randomize", "undo", "redo",
  "addLayer", "removeLayer", "selectLayer", "setLayerParam", "setLayerOpacity",
  "setLayerBlendMode", "toggleLayerVisibility", "moveLayer",
  "toggleTimeline", "addKeyframe", "removeKeyframe", "setTimelinePosition",
  "setTimelineDuration", "setTimelinePlaybackMode",
  // Derived fields
  "gradientType", "speed", "complexity", "scale", "distortion", "colors",
];

type Snapshot = Record<string, unknown>;

function deepCopyLayers(layers: LayerParams[]): LayerParams[] {
  return layers.map((l) => ({
    ...l,
    colors: l.colors.map((c) => [...c] as [number, number, number]),
  }));
}

function takeSnapshot(state: GradientState): Snapshot {
  const snap: Record<string, unknown> = {};
  for (const key of Object.keys(state) as (keyof GradientState)[]) {
    if (HISTORY_EXCLUDE_KEYS.includes(key) || typeof state[key] === "function") continue;
    const val = state[key];
    if (key === "layers") {
      snap[key] = deepCopyLayers(val as LayerParams[]);
    } else if (Array.isArray(val)) {
      snap[key] = val.map((item: unknown) =>
        Array.isArray(item) ? [...item] : item
      );
    } else {
      snap[key] = val;
    }
  }
  return snap;
}

function randomHue(): [number, number, number] {
  const h = Math.random() * 360;
  const s = 0.6 + Math.random() * 0.4;
  const l = 0.4 + Math.random() * 0.3;
  return hslToRgb(h, s, l);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [r + m, g + m, b + m];
}

function getActiveLayer(state: { layers: LayerParams[]; activeLayerIndex: number }): LayerParams {
  return state.layers[state.activeLayerIndex] ?? state.layers[0];
}

// Derive active layer fields for backward compatibility
function deriveActiveLayerFields(layers: LayerParams[], activeLayerIndex: number) {
  const layer = layers[activeLayerIndex] ?? layers[0];
  return {
    gradientType: layer.gradientType,
    speed: layer.speed,
    complexity: layer.complexity,
    scale: layer.scale,
    distortion: layer.distortion,
    colors: layer.colors,
  };
}

const initialLayer = createLayer();

const DEFAULTS = {
  layers: [initialLayer],
  activeLayerIndex: 0,
  ...deriveActiveLayerFields([initialLayer], 0),
  brightness: 1.0,
  saturation: 1.0,
  noiseEnabled: false,
  noiseIntensity: 0.3,
  noiseScale: 1.0,
  grain: 0.0,
  particlesEnabled: false,
  particleCount: 50,
  particleSize: 2.0,
  mouseReact: 0.5,
  bloomEnabled: false,
  bloomIntensity: 0.3,
  vignette: 0.0,
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
  voronoiEnabled: false,
  voronoiIntensity: 0.5,
  voronoiScale: 1.0,
  curlEnabled: false,
  curlIntensity: 0.5,
  curlScale: 1.0,
  kaleidoscopeEnabled: false,
  kaleidoscopeSegments: 6,
  kaleidoscopeRotation: 0,
  playing: true,
  timelineEnabled: false,
  timelineDuration: 10,
  timelinePlaybackMode: "loop" as PlaybackMode,
  keyframes: [] as Keyframe[],
  timelinePosition: 0,
};

const MAX_HISTORY = 50;
const past: Snapshot[] = [];
let future: Snapshot[] = [];
let pendingSnapshot: Snapshot | null = null;

function pushHistory(snapshot: Snapshot) {
  past.push(snapshot);
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
}

function flushPending() {
  if (pendingSnapshot !== null) {
    pushHistory(pendingSnapshot);
    pendingSnapshot = null;
  }
}

// Map layer param keys to top-level state keys for backward compatibility
const LAYER_PARAM_KEYS: (keyof LayerParams)[] = [
  "gradientType", "speed", "complexity", "scale", "distortion", "colors",
];

function applyToActiveLayer(
  state: GradientState,
  partial: Partial<GradientState>,
  rawSet: (p: Partial<GradientState>) => void,
) {
  const layerUpdates: Partial<LayerParams> = {};
  const globalUpdates: Partial<GradientState> = {};
  let hasLayerUpdates = false;

  for (const [key, value] of Object.entries(partial)) {
    if (LAYER_PARAM_KEYS.includes(key as keyof LayerParams)) {
      layerUpdates[key as keyof LayerParams] = value as never;
      hasLayerUpdates = true;
    } else {
      (globalUpdates as Record<string, unknown>)[key] = value;
    }
  }

  if (hasLayerUpdates) {
    const newLayers = state.layers.map((l, i) =>
      i === state.activeLayerIndex ? { ...l, ...layerUpdates } : l
    );
    globalUpdates.layers = newLayers;
    Object.assign(globalUpdates, deriveActiveLayerFields(newLayers, state.activeLayerIndex));
  }

  rawSet(globalUpdates);
}

export const useGradientStore = create<GradientState>((rawSet) => ({
  ...DEFAULTS,

  set: (partial) => {
    if (pendingSnapshot === null) {
      pendingSnapshot = takeSnapshot(useGradientStore.getState());
    }
    applyToActiveLayer(useGradientStore.getState(), partial, rawSet);
  },

  commitSet: () => {
    flushPending();
  },

  setDiscrete: (partial) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    applyToActiveLayer(current, partial, rawSet);
  },

  setColor: (index, color) => {
    if (pendingSnapshot === null) {
      pendingSnapshot = takeSnapshot(useGradientStore.getState());
    }
    const current = useGradientStore.getState();
    const layer = getActiveLayer(current);
    const newColors = layer.colors.map((c, i) =>
      i === index ? color : ([...c] as [number, number, number])
    );
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex ? { ...l, colors: newColors } : l
    );
    rawSet({ layers: newLayers, colors: newColors });
  },

  addColor: () => {
    const current = useGradientStore.getState();
    const layer = getActiveLayer(current);
    if (layer.colors.length >= 8) return;
    flushPending();
    pushHistory(takeSnapshot(current));
    const newColors = [...layer.colors.map(c => [...c] as [number, number, number]), randomHue()];
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex ? { ...l, colors: newColors } : l
    );
    rawSet({ layers: newLayers, colors: newColors });
  },

  removeColor: (index) => {
    const current = useGradientStore.getState();
    const layer = getActiveLayer(current);
    if (layer.colors.length <= 2) return;
    flushPending();
    pushHistory(takeSnapshot(current));
    const newColors = layer.colors.filter((_, i) => i !== index);
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex ? { ...l, colors: newColors } : l
    );
    rawSet({ layers: newLayers, colors: newColors });
  },

  loadPreset: (preset) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    // Presets apply to the active layer's gradient params + global effects
    const layerUpdates: Partial<LayerParams> = {};
    const globalUpdates: Partial<GradientState> = {};
    for (const [key, value] of Object.entries(preset)) {
      if (LAYER_PARAM_KEYS.includes(key as keyof LayerParams)) {
        layerUpdates[key as keyof LayerParams] = value as never;
      } else {
        (globalUpdates as Record<string, unknown>)[key] = value;
      }
    }
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex ? { ...l, ...layerUpdates } : l
    );
    rawSet({
      ...globalUpdates,
      layers: newLayers,
      ...deriveActiveLayerFields(newLayers, current.activeLayerIndex),
    });
  },

  randomize: () => {
    const count = 3 + Math.floor(Math.random() * 3);
    const baseHue = Math.random() * 360;
    const colors: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const hue = (baseHue + i * (360 / count) + (Math.random() - 0.5) * 30) % 360;
      colors.push(hslToRgb(hue, 0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3));
    }
    const types: LayerParams["gradientType"][] = ["mesh", "radial", "linear", "conic", "plasma"];
    const gradientType = types[Math.floor(Math.random() * types.length)];
    const speed = 0.2 + Math.random() * 0.8;
    const complexity = 2 + Math.floor(Math.random() * 4);
    const scale = 0.5 + Math.random() * 2;
    const distortion = Math.random() * 0.6;

    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex
        ? { ...l, colors, gradientType, speed, complexity, scale, distortion }
        : l
    );
    rawSet({
      layers: newLayers,
      ...deriveActiveLayerFields(newLayers, current.activeLayerIndex),
    });
  },

  undo: () => {
    flushPending();
    if (past.length === 0) return;
    const current = useGradientStore.getState();
    future.push(takeSnapshot(current));
    const prev = past.pop()!;
    rawSet({
      ...prev,
      ...deriveActiveLayerFields(
        prev.layers as LayerParams[],
        prev.activeLayerIndex as number
      ),
    } as Partial<GradientState>);
  },

  redo: () => {
    flushPending();
    if (future.length === 0) return;
    const current = useGradientStore.getState();
    past.push(takeSnapshot(current));
    const next = future.pop()!;
    rawSet({
      ...next,
      ...deriveActiveLayerFields(
        next.layers as LayerParams[],
        next.activeLayerIndex as number
      ),
    } as Partial<GradientState>);
  },

  // Layer management
  addLayer: () => {
    const current = useGradientStore.getState();
    if (current.layers.length >= MAX_LAYERS) return;
    flushPending();
    pushHistory(takeSnapshot(current));
    const newLayer = createLayer({
      colors: [randomHue(), randomHue(), randomHue()],
      opacity: 0.7,
    });
    const newLayers = [...current.layers, newLayer];
    const newIndex = newLayers.length - 1;
    rawSet({
      layers: newLayers,
      activeLayerIndex: newIndex,
      ...deriveActiveLayerFields(newLayers, newIndex),
    });
  },

  removeLayer: (index) => {
    const current = useGradientStore.getState();
    if (current.layers.length <= 1) return;
    flushPending();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.filter((_, i) => i !== index);
    const newIndex = Math.min(current.activeLayerIndex, newLayers.length - 1);
    rawSet({
      layers: newLayers,
      activeLayerIndex: newIndex,
      ...deriveActiveLayerFields(newLayers, newIndex),
    });
  },

  selectLayer: (index) => {
    const current = useGradientStore.getState();
    if (index < 0 || index >= current.layers.length) return;
    rawSet({
      activeLayerIndex: index,
      ...deriveActiveLayerFields(current.layers, index),
    });
  },

  setLayerParam: (param) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === current.activeLayerIndex ? { ...l, ...param } : l
    );
    rawSet({
      layers: newLayers,
      ...deriveActiveLayerFields(newLayers, current.activeLayerIndex),
    });
  },

  setLayerOpacity: (index, opacity) => {
    if (pendingSnapshot === null) {
      pendingSnapshot = takeSnapshot(useGradientStore.getState());
    }
    const current = useGradientStore.getState();
    const newLayers = current.layers.map((l, i) =>
      i === index ? { ...l, opacity } : l
    );
    rawSet({ layers: newLayers });
  },

  setLayerBlendMode: (index, mode) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === index ? { ...l, blendMode: mode } : l
    );
    rawSet({ layers: newLayers });
  },

  toggleLayerVisibility: (index) => {
    flushPending();
    const current = useGradientStore.getState();
    pushHistory(takeSnapshot(current));
    const newLayers = current.layers.map((l, i) =>
      i === index ? { ...l, visible: !l.visible } : l
    );
    rawSet({ layers: newLayers });
  },

  moveLayer: (from, to) => {
    const current = useGradientStore.getState();
    if (from === to) return;
    flushPending();
    pushHistory(takeSnapshot(current));
    const newLayers = [...current.layers];
    const [moved] = newLayers.splice(from, 1);
    newLayers.splice(to, 0, moved);
    const newIndex = current.activeLayerIndex === from
      ? to
      : current.activeLayerIndex;
    rawSet({
      layers: newLayers,
      activeLayerIndex: newIndex,
      ...deriveActiveLayerFields(newLayers, newIndex),
    });
  },

  // Timeline
  toggleTimeline: () => {
    const current = useGradientStore.getState();
    rawSet({ timelineEnabled: !current.timelineEnabled });
  },

  addKeyframe: () => {
    const current = useGradientStore.getState();
    flushPending();
    pushHistory(takeSnapshot(current));
    const params: KeyframeParams = {};
    for (const key of KEYFRAMEABLE_PARAMS) {
      if (key in current) {
        params[key] = current[key as keyof typeof current] as number;
      }
    }
    const newKf: Keyframe = { time: current.timelinePosition, params };
    // Replace existing keyframe at same time, or add new
    const existing = current.keyframes.findIndex(
      (kf) => Math.abs(kf.time - current.timelinePosition) < 0.05
    );
    const newKeyframes = [...current.keyframes];
    if (existing >= 0) {
      newKeyframes[existing] = newKf;
    } else {
      newKeyframes.push(newKf);
    }
    newKeyframes.sort((a, b) => a.time - b.time);
    rawSet({ keyframes: newKeyframes });
  },

  removeKeyframe: (index) => {
    const current = useGradientStore.getState();
    flushPending();
    pushHistory(takeSnapshot(current));
    rawSet({ keyframes: current.keyframes.filter((_, i) => i !== index) });
  },

  setTimelinePosition: (time) => {
    rawSet({ timelinePosition: Math.max(0, time) });
  },

  setTimelineDuration: (duration) => {
    rawSet({ timelineDuration: Math.max(1, duration) });
  },

  setTimelinePlaybackMode: (mode) => {
    rawSet({ timelinePlaybackMode: mode });
  },

}));

export function canUndo() { return past.length > 0 || pendingSnapshot !== null; }
export function canRedo() { return future.length > 0; }

export function getInterpolatedParams(): KeyframeParams | null {
  const state = useGradientStore.getState();
  if (!state.timelineEnabled || (state.keyframes as Keyframe[]).length === 0) return null;
  return interpolateKeyframes(
    state.keyframes as Keyframe[],
    state.timelinePosition as number,
    state.timelineDuration as number,
    state.timelinePlaybackMode as PlaybackMode
  );
}
