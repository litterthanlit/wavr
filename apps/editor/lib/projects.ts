import { GradientState, type PerformanceMode } from "./store";
import { LayerParams } from "@wavr/core";
import { Keyframe, PlaybackMode } from "./timeline";
import { cloneScene3D, type Scene3DState } from "./scene3d";
import { sceneDocumentToStorePatch, storeToSceneDocument } from "./scene-document";
import type { WavrSceneDocumentValue } from "@wavr/schema";
import {
  getImageBackend,
  isDataUrl,
  isImageRef,
  loadImage,
  pruneImages,
  storeImage,
  type ImageBackend,
} from "./image-store";

export interface SavedProject {
  name: string;
  timestamp: number;
  state?: ProjectState;
  sceneDocument?: WavrSceneDocumentValue;
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
  curlEnabled: boolean;
  curlIntensity: number;
  curlScale: number;
  kaleidoscopeEnabled: boolean;
  kaleidoscopeSegments: number;
  kaleidoscopeRotation: number;
  reactionDiffEnabled: boolean;
  reactionDiffIntensity: number;
  reactionDiffScale: number;
  pixelSortEnabled: boolean;
  pixelSortIntensity: number;
  pixelSortThreshold: number;
  domainWarp: number;
  feedbackEnabled: boolean;
  feedbackDecay: number;
  oklabEnabled: boolean;
  toneMapMode: number;
  rippleEnabled: boolean;
  rippleIntensity: number;
  glowEnabled: boolean;
  glowIntensity: number;
  glowRadius: number;
  causticEnabled: boolean;
  causticIntensity: number;
  liquifyEnabled: boolean;
  liquifyIntensity: number;
  liquifyScale: number;
  trailEnabled: boolean;
  trailLength: number;
  trailWidth: number;
  realBloomEnabled: boolean;
  debandEnabled: boolean;
  debandStrength: number;
  customGLSL: string | null;
  audioEnabled: boolean;
  audioSource: "mic" | "file";
  audioBassTarget: string;
  audioTrebleTarget: string;
  audioEnergyTarget: string;
  audioSensitivity: number;
  performanceMode: PerformanceMode;
  timelineEnabled: boolean;
  timelineDuration: number;
  timelinePlaybackMode: PlaybackMode;
  keyframes: Keyframe[];
  timelinePosition: number;
  parallaxEnabled: boolean;
  parallaxStrength: number;
  threeDEnabled: boolean;
  threeDShape: number;
  threeDPerspective: number;
  threeDRotationSpeed: number;
  threeDZoom: number;
  threeDLighting: number;
  meshDistortionEnabled: boolean;
  meshDisplacement: number;
  meshFrequency: number;
  meshSpeed: number;
  scene3DEnabled: boolean;
  scene3D: Scene3DState;
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
    curlEnabled: state.curlEnabled as boolean,
    curlIntensity: state.curlIntensity as number,
    curlScale: state.curlScale as number,
    kaleidoscopeEnabled: state.kaleidoscopeEnabled as boolean,
    kaleidoscopeSegments: state.kaleidoscopeSegments as number,
    kaleidoscopeRotation: state.kaleidoscopeRotation as number,
    reactionDiffEnabled: state.reactionDiffEnabled as boolean,
    reactionDiffIntensity: state.reactionDiffIntensity as number,
    reactionDiffScale: state.reactionDiffScale as number,
    pixelSortEnabled: state.pixelSortEnabled as boolean,
    pixelSortIntensity: state.pixelSortIntensity as number,
    pixelSortThreshold: state.pixelSortThreshold as number,
    domainWarp: state.domainWarp as number,
    feedbackEnabled: state.feedbackEnabled as boolean,
    feedbackDecay: state.feedbackDecay as number,
    oklabEnabled: state.oklabEnabled as boolean,
    toneMapMode: state.toneMapMode as number,
    rippleEnabled: state.rippleEnabled as boolean,
    rippleIntensity: state.rippleIntensity as number,
    glowEnabled: state.glowEnabled as boolean,
    glowIntensity: state.glowIntensity as number,
    glowRadius: state.glowRadius as number,
    causticEnabled: state.causticEnabled as boolean,
    causticIntensity: state.causticIntensity as number,
    liquifyEnabled: state.liquifyEnabled as boolean,
    liquifyIntensity: state.liquifyIntensity as number,
    liquifyScale: state.liquifyScale as number,
    trailEnabled: state.trailEnabled as boolean,
    trailLength: state.trailLength as number,
    trailWidth: state.trailWidth as number,
    realBloomEnabled: state.realBloomEnabled as boolean,
    debandEnabled: state.debandEnabled as boolean,
    debandStrength: state.debandStrength as number,
    customGLSL: state.customGLSL as string | null,
    audioEnabled: state.audioEnabled as boolean,
    audioSource: state.audioSource as "mic" | "file",
    audioBassTarget: state.audioBassTarget as string,
    audioTrebleTarget: state.audioTrebleTarget as string,
    audioEnergyTarget: state.audioEnergyTarget as string,
    audioSensitivity: state.audioSensitivity as number,
    performanceMode: (state.performanceMode ?? "auto") as PerformanceMode,
    timelineEnabled: state.timelineEnabled as boolean,
    timelineDuration: state.timelineDuration as number,
    timelinePlaybackMode: state.timelinePlaybackMode as PlaybackMode,
    keyframes: state.keyframes as Keyframe[],
    timelinePosition: state.timelinePosition as number,
    parallaxEnabled: state.parallaxEnabled as boolean,
    parallaxStrength: state.parallaxStrength as number,
    threeDEnabled: state.threeDEnabled as boolean,
    threeDShape: state.threeDShape as number,
    threeDPerspective: state.threeDPerspective as number,
    threeDRotationSpeed: state.threeDRotationSpeed as number,
    threeDZoom: state.threeDZoom as number,
    threeDLighting: state.threeDLighting as number,
    meshDistortionEnabled: state.meshDistortionEnabled as boolean,
    meshDisplacement: state.meshDisplacement as number,
    meshFrequency: state.meshFrequency as number,
    meshSpeed: state.meshSpeed as number,
    scene3DEnabled: state.scene3DEnabled as boolean,
    scene3D: cloneScene3D(state.scene3D as Scene3DState),
  };
}

export function exportProjectStateForUrl(state: GradientState): ProjectState {
  const exported = exportProjectState(state);
  exported.layers = exported.layers.map((l) => ({
    ...l,
    imageData: null,
    distortionMapData: null,
  }));
  return exported;
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

function writeProjects(projects: SavedProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      throw new Error("Storage quota exceeded. Try removing unused projects or images.");
    }
    throw e;
  }
}

// Project writes and image pruning run one at a time, so a prune can't delete
// an image that another save has stored but not yet referenced.
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

type ImageField = "imageData" | "distortionMapData";
const IMAGE_FIELDS: ImageField[] = ["imageData", "distortionMapData"];

/** Move inline data-URL images into the image store, leaving references. */
async function externalizeImages(project: SavedProject, store: ImageBackend): Promise<SavedProject> {
  const layers = project.state?.layers;
  if (!project.state || !layers?.some((l) => IMAGE_FIELDS.some((f) => isDataUrl(l[f])))) return project;
  const nextLayers = await Promise.all(layers.map(async (layer) => {
    const next = { ...layer };
    for (const field of IMAGE_FIELDS) {
      const value = layer[field];
      if (isDataUrl(value)) next[field] = await storeImage(store, value);
    }
    return next;
  }));
  return { ...project, state: { ...project.state, layers: nextLayers } };
}

function collectImageRefs(projects: SavedProject[]): Set<string> {
  const refs = new Set<string>();
  for (const project of projects) {
    for (const layer of project.state?.layers ?? []) {
      for (const field of IMAGE_FIELDS) {
        const value = layer[field];
        if (isImageRef(value)) refs.add(value);
      }
    }
  }
  return refs;
}

async function pruneUnreferenced(store: ImageBackend, projects: SavedProject[]): Promise<void> {
  try {
    await pruneImages(store, collectImageRefs(projects));
  } catch (err) {
    console.warn("[wavr] could not clean up stored images", err);
  }
}

/**
 * Save (or overwrite) a project. Images go to IndexedDB and the project keeps
 * references; images still inline in older projects are moved too, which
 * frees localStorage space. Falls back to inline images without IndexedDB.
 */
export function saveProject(name: string, state: GradientState): Promise<void> {
  return serialized(async () => {
    const projects = loadProjects();
    const existing = projects.findIndex((p) => p.name === name);
    const timestamp = Date.now();
    const isoTimestamp = new Date(timestamp).toISOString();
    const previous = existing >= 0 ? projects[existing] : undefined;
    const entry: SavedProject = {
      name,
      timestamp,
      state: exportProjectState(state),
      sceneDocument: storeToSceneDocument(state, {
        name,
        createdAt: previous?.sceneDocument?.meta.createdAt ?? isoTimestamp,
        updatedAt: isoTimestamp,
      }),
    };
    if (existing >= 0) {
      projects[existing] = entry;
    } else {
      projects.push(entry);
    }

    const store = getImageBackend();
    let toWrite = projects;
    if (store) {
      try {
        toWrite = await Promise.all(projects.map((p) => externalizeImages(p, store)));
      } catch (err) {
        console.warn("[wavr] image storage unavailable; saving images inline", err);
      }
    }
    writeProjects(toWrite);
    if (store) await pruneUnreferenced(store, toWrite);
  });
}

export interface ProjectLoadResult {
  patch: Partial<GradientState>;
  /** Images the project referenced that are no longer stored. */
  missingImages: number;
}

/** Store patch for a saved project, with stored images resolved. */
export async function projectStateForLoad(project: SavedProject): Promise<ProjectLoadResult> {
  if (!project.state) {
    const patch = project.sceneDocument ? sceneDocumentToStorePatch(project.sceneDocument) : {};
    return { patch, missingImages: 0 };
  }
  const store = getImageBackend();
  let missingImages = 0;
  const layers = await Promise.all(project.state.layers.map(async (layer) => {
    const next = { ...layer };
    for (const field of IMAGE_FIELDS) {
      const value = layer[field];
      if (!isImageRef(value)) continue;
      let resolved: string | null = null;
      try {
        resolved = store ? await loadImage(store, value) : null;
      } catch (err) {
        console.warn("[wavr] could not read a stored image", err);
      }
      if (resolved === null) missingImages++;
      next[field] = resolved;
    }
    return next;
  }));
  return { patch: { ...project.state, layers } as Partial<GradientState>, missingImages };
}

export function deleteProject(name: string): Promise<void> {
  return serialized(async () => {
    const projects = loadProjects().filter((p) => p.name !== name);
    writeProjects(projects);
    const store = getImageBackend();
    if (store) await pruneUnreferenced(store, projects);
  });
}
