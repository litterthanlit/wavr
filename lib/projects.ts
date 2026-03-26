import { GradientState } from "./store";
import { LayerParams } from "./layers";
import { Keyframe, PlaybackMode } from "./timeline";

export interface SavedProject {
  name: string;
  timestamp: number;
  state: ProjectState;
}

export interface ProjectState {
  layers: LayerParams[];
  activeLayerIndex: number;
  brightness: number;
  saturation: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseScale: number;
  grain: number;
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
  timelineEnabled: boolean;
  timelineDuration: number;
  timelinePlaybackMode: PlaybackMode;
  keyframes: Keyframe[];
}

const STORAGE_KEY = "wavr-projects";

export function exportProjectState(state: GradientState): ProjectState {
  return {
    layers: (state.layers as LayerParams[]).map((l) => ({
      ...l,
      colors: l.colors.map((c) => [...c] as [number, number, number]),
    })),
    activeLayerIndex: state.activeLayerIndex as number,
    brightness: state.brightness as number,
    saturation: state.saturation as number,
    noiseEnabled: state.noiseEnabled as boolean,
    noiseIntensity: state.noiseIntensity as number,
    noiseScale: state.noiseScale as number,
    grain: state.grain as number,
    mouseReact: state.mouseReact as number,
    bloomEnabled: state.bloomEnabled as boolean,
    bloomIntensity: state.bloomIntensity as number,
    vignette: state.vignette as number,
    blurEnabled: state.blurEnabled as boolean,
    blurAmount: state.blurAmount as number,
    radialBlurAmount: state.radialBlurAmount as number,
    colorBlend: state.colorBlend as number,
    chromaticAberration: state.chromaticAberration as number,
    hueShift: state.hueShift as number,
    asciiEnabled: state.asciiEnabled as boolean,
    asciiSize: state.asciiSize as number,
    ditherEnabled: state.ditherEnabled as boolean,
    ditherSize: state.ditherSize as number,
    timelineEnabled: state.timelineEnabled as boolean,
    timelineDuration: state.timelineDuration as number,
    timelinePlaybackMode: state.timelinePlaybackMode as PlaybackMode,
    keyframes: state.keyframes as Keyframe[],
  };
}

export function loadProjects(): SavedProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProject(name: string, state: GradientState): void {
  const projects = loadProjects();
  const existing = projects.findIndex((p) => p.name === name);
  const entry: SavedProject = {
    name,
    timestamp: Date.now(),
    state: exportProjectState(state),
  };
  if (existing >= 0) {
    projects[existing] = entry;
  } else {
    projects.push(entry);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function deleteProject(name: string): void {
  const projects = loadProjects().filter((p) => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}
