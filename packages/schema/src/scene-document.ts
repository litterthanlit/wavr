import { z } from "zod";
import { BlendMode, ColorSpace } from "./primitives";
import { LayerConfig } from "./layer";
import { GradientConfig, type GradientConfig as GradientConfigValue } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";
import {
  applyEffectNodesToGradientConfig,
  effectNodesFromGradientConfig,
  type EffectNode,
} from "./effect-registry";

const SceneColorSpace = z.enum(["srgb", "linear", "display-p3", "oklab"]);
const LayerKind = z.enum(["shader", "image", "text", "shape", "scene3d", "group"]);
const TimelinePlayback = z.enum(["loop", "once", "bounce"]);
const TimelineValueType = z.enum(["number", "color", "vec2", "boolean", "select"]);
const PerformanceProfile = z.enum(["auto", "quality", "battery", "custom"]);

export const WavrAsset = z.object({
  id: z.string().min(1),
  kind: z.enum(["image", "video", "audio", "font", "lut", "texture"]),
  name: z.string().min(1),
  mimeType: z.string().min(1),
  source: z.enum(["local", "remote", "uploaded", "generated"]),
  url: z.string().min(1).optional(),
  blobRef: z.string().min(1).optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  colorSpace: SceneColorSpace.optional(),
  maxTextureSize: z.number().positive().optional(),
}).strict();
export type WavrAsset = z.infer<typeof WavrAsset>;

export const WavrEffectNode = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  enabled: z.boolean(),
  params: z.record(z.unknown()),
}).strict();
export type WavrEffectNode = z.infer<typeof WavrEffectNode>;

export const WavrTransform = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scaleX: z.number().default(1),
  scaleY: z.number().default(1),
  rotation: z.number().default(0),
}).strict();
export type WavrTransform = z.infer<typeof WavrTransform>;

export const WavrLayerSource = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("gradient"),
    gradient: LayerConfig,
  }).strict(),
  z.object({
    kind: z.literal("asset"),
    assetId: z.string().min(1),
  }).strict(),
  z.object({
    kind: z.literal("text"),
    text: z.string(),
  }).strict(),
  z.object({
    kind: z.literal("empty"),
  }).strict(),
]);
export type WavrLayerSource = z.infer<typeof WavrLayerSource>;

export const WavrLayerNode = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: LayerKind,
  visible: z.boolean(),
  locked: z.boolean(),
  opacity: z.number().min(0).max(1),
  blendMode: BlendMode,
  transform: WavrTransform,
  source: WavrLayerSource,
  effects: z.array(WavrEffectNode),
}).strict();
export type WavrLayerNode = z.infer<typeof WavrLayerNode>;

export const WavrTimelineKeyframe = z.object({
  time: z.number().min(0),
  value: z.unknown(),
  easing: z.union([
    z.enum(["linear", "ease", "ease-in", "ease-out", "spring"]),
    z.tuple([
      z.number().min(0).max(1),
      z.number().min(-2).max(2),
      z.number().min(0).max(1),
      z.number().min(-2).max(2),
    ]),
  ]),
}).strict();
export type WavrTimelineKeyframe = z.infer<typeof WavrTimelineKeyframe>;

export const WavrTimelineTrack = z.object({
  id: z.string().min(1),
  targetPath: z.string().min(1),
  valueType: TimelineValueType,
  keyframes: z.array(WavrTimelineKeyframe),
}).strict();
export type WavrTimelineTrack = z.infer<typeof WavrTimelineTrack>;

export const WavrTimeline = z.object({
  duration: z.number().positive(),
  playback: TimelinePlayback,
  tracks: z.array(WavrTimelineTrack),
}).strict();
export type WavrTimeline = z.infer<typeof WavrTimeline>;

export const WavrInteractionDriver = z.object({
  id: z.string().min(1),
  type: z.enum(["scroll", "hover", "click", "pointer", "audio", "intersection"]),
  targetPath: z.string().min(1).optional(),
  params: z.record(z.unknown()).default({}),
}).strict();
export type WavrInteractionDriver = z.infer<typeof WavrInteractionDriver>;

export const WavrExportProfile = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  target: z.enum(["static", "video", "react", "web-component", "iframe", "vanilla"]),
  fidelity: z.enum(["full", "portable", "fallback"]),
  params: z.record(z.unknown()).default({}),
}).strict();
export type WavrExportProfile = z.infer<typeof WavrExportProfile>;

export const WavrSceneGlobals = z.object({
  colorSpace: ColorSpace,
  brightness: z.number().min(0.1).max(2),
  saturation: z.number().min(0).max(2),
  grain: z.number().min(0).max(1),
  vignette: z.number().min(0).max(1),
  chromaticAberration: z.number().min(0).max(1),
  hueShift: z.number().min(-180).max(180),
  domainWarp: z.number().min(0).max(1),
  radialBlur: z.number().min(0).max(1),
  mouseReact: z.number().min(0).max(1),
  oklabEnabled: z.boolean(),
  toneMapMode: z.number().int().min(0).max(3),
}).strict();
export type WavrSceneGlobals = z.infer<typeof WavrSceneGlobals>;

export const WavrSceneDocument = z.object({
  version: z.literal("wavr.scene.v1"),
  meta: z.object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    createdAt: z.string().min(1).optional(),
    updatedAt: z.string().min(1).optional(),
  }).strict(),
  canvas: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    colorSpace: SceneColorSpace,
    background: z.union([z.literal("transparent"), z.string().min(1)]),
  }).strict(),
  globals: WavrSceneGlobals,
  assets: z.record(WavrAsset),
  layers: z.array(WavrLayerNode),
  postEffects: z.array(WavrEffectNode),
  timeline: WavrTimeline,
  interactions: z.array(WavrInteractionDriver),
  exportProfiles: z.array(WavrExportProfile),
  performanceProfile: PerformanceProfile,
}).strict();
export type WavrSceneDocument = z.infer<typeof WavrSceneDocument>;

export interface SceneDocumentFromConfigOptions {
  id?: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  canvas?: Partial<{
    width: number;
    height: number;
    colorSpace: z.infer<typeof SceneColorSpace>;
    background: "transparent" | string;
  }>;
  performanceProfile?: z.infer<typeof PerformanceProfile>;
}

const DEFAULT_TRANSFORM: WavrTransform = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

type GradientLayerNode = WavrLayerNode & {
  kind: "shader";
  source: Extract<WavrLayerSource, { kind: "gradient" }>;
};

function isGradientLayerNode(layer: WavrLayerNode): layer is GradientLayerNode {
  return layer.kind === "shader" && layer.source.kind === "gradient";
}

function globalsFromConfig(config: GradientConfigValue): WavrSceneGlobals {
  return {
    colorSpace: config.colorSpace,
    brightness: config.brightness,
    saturation: config.saturation,
    grain: config.grain,
    vignette: config.vignette,
    chromaticAberration: config.chromaticAberration,
    hueShift: config.hueShift,
    domainWarp: config.domainWarp,
    radialBlur: config.radialBlur,
    mouseReact: config.mouseReact,
    oklabEnabled: config.oklabEnabled,
    toneMapMode: config.toneMapMode,
  };
}

export function sceneDocumentFromGradientConfig(
  input: GradientConfigValue,
  options: SceneDocumentFromConfigOptions = {},
): WavrSceneDocument {
  const config = GradientConfig.parse(input);
  const layers = config.layers.map((layer, index): WavrLayerNode => ({
    id: `layer-${index + 1}`,
    name: `Layer ${index + 1}`,
    kind: "shader",
    visible: true,
    locked: false,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    transform: { ...DEFAULT_TRANSFORM },
    source: {
      kind: "gradient",
      gradient: layer,
    },
    effects: [],
  }));

  return WavrSceneDocument.parse({
    version: "wavr.scene.v1",
    meta: {
      id: options.id,
      name: options.name ?? "Untitled scene",
      createdAt: options.createdAt,
      updatedAt: options.updatedAt,
    },
    canvas: {
      width: options.canvas?.width ?? 1440,
      height: options.canvas?.height ?? 900,
      colorSpace: options.canvas?.colorSpace ?? config.colorSpace,
      background: options.canvas?.background ?? "transparent",
    },
    globals: globalsFromConfig(config),
    assets: {},
    layers,
    postEffects: effectNodesFromGradientConfig(config),
    timeline: {
      duration: 8,
      playback: "loop",
      tracks: [],
    },
    interactions: [],
    exportProfiles: [],
    performanceProfile: options.performanceProfile ?? "auto",
  });
}

export function gradientConfigFromSceneDocument(input: WavrSceneDocument): GradientConfigValue {
  const document = WavrSceneDocument.parse(input);
  const layers = document.layers
    .filter(isGradientLayerNode)
    .map((layer) => ({
      ...layer.source.gradient,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
    }));

  const base = GradientConfig.parse({
    ...DEFAULT_CONFIG,
    ...document.globals,
    layers,
  });

  return GradientConfig.parse(
    applyEffectNodesToGradientConfig(base, document.postEffects as EffectNode[]),
  );
}
