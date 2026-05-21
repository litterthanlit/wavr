import type { GradientConfig } from "./schema";
import type { PropertyCostHint, PropertySchema, PropertyValueType } from "./property-schema";

export type EffectId =
  | "noise"
  | "bloom"
  | "blur"
  | "curl"
  | "kaleidoscope"
  | "reactionDiffusion"
  | "pixelSort"
  | "feedback"
  | "ascii"
  | "dither"
  | "parallax"
  | "shape3d"
  | "meshDistortion"
  | "ripple"
  | "glow"
  | "caustic"
  | "liquify"
  | "trail"
  | "realBloom"
  | "deband";

export type EffectCategory =
  | "color"
  | "blur"
  | "distort"
  | "stylize"
  | "light"
  | "interaction"
  | "utility";

export type EffectPassType = "inline" | "single-pass" | "multi-pass" | "feedback";

export interface EffectNode {
  id: string;
  type: EffectId;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface EffectDefinition {
  id: EffectId;
  label: string;
  category: EffectCategory;
  defaultParams: Record<string, unknown>;
  properties: readonly PropertySchema[];
  passType: EffectPassType;
  compatibility: readonly string[];
}

type NumberPropertyOptions = {
  min: number;
  max: number;
  step?: number;
  animatable?: boolean;
  costHint?: PropertyCostHint;
};

function prop(
  name: string,
  label: string,
  type: PropertyValueType,
  value: unknown,
  options: Partial<PropertySchema> = {},
): PropertySchema {
  return {
    path: `params.${name}`,
    label,
    type,
    default: value,
    animatable: false,
    exposedInExport: true,
    affectsCompile: false,
    affectsLayout: false,
    ...options,
  };
}

function enabled(defaultValue = false): PropertySchema {
  return prop("enabled", "Enabled", "boolean", defaultValue, {
    affectsCompile: true,
  });
}

function number(
  name: string,
  label: string,
  value: number,
  options: NumberPropertyOptions,
): PropertySchema {
  return prop(name, label, "number", value, {
    min: options.min,
    max: options.max,
    step: options.step ?? 0.01,
    animatable: options.animatable ?? true,
    costHint: options.costHint,
  });
}

function select(
  name: string,
  label: string,
  value: string,
  options: readonly string[],
): PropertySchema {
  return prop(name, label, "select", value, {
    options,
    affectsCompile: true,
  });
}

function defaultsFrom(properties: readonly PropertySchema[]): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const property of properties) {
    const key = property.path.replace(/^params\./, "");
    defaults[key] = property.default;
  }
  return defaults;
}

function defineEffect(
  definition: Omit<EffectDefinition, "defaultParams"> & {
    defaultParams?: Record<string, unknown>;
  },
): EffectDefinition {
  return {
    ...definition,
    defaultParams: definition.defaultParams ?? defaultsFrom(definition.properties),
  };
}

export const EFFECT_DEFINITIONS: readonly EffectDefinition[] = [
  defineEffect({
    id: "noise",
    label: "Noise",
    category: "stylize",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.3, { min: 0, max: 1 }),
      number("scale", "Scale", 1, { min: 0.1, max: 10, costHint: "medium" }),
    ],
  }),
  defineEffect({
    id: "bloom",
    label: "Bloom",
    category: "light",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.3, { min: 0, max: 2, costHint: "medium" }),
    ],
  }),
  defineEffect({
    id: "blur",
    label: "Blur",
    category: "blur",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("amount", "Amount", 0, { min: 0, max: 1, costHint: "high" }),
    ],
  }),
  defineEffect({
    id: "curl",
    label: "Curl",
    category: "distort",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.5, { min: 0, max: 1 }),
      number("scale", "Scale", 1, { min: 0.1, max: 10, costHint: "medium" }),
    ],
  }),
  defineEffect({
    id: "kaleidoscope",
    label: "Kaleidoscope",
    category: "distort",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("segments", "Segments", 6, { min: 2, max: 16, step: 1, animatable: false }),
      number("rotation", "Rotation", 0, { min: -180, max: 180, step: 1 }),
    ],
  }),
  defineEffect({
    id: "reactionDiffusion",
    label: "Reaction Diffusion",
    category: "stylize",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.5, { min: 0, max: 1, costHint: "high" }),
      number("scale", "Scale", 1, { min: 0.1, max: 10, costHint: "medium" }),
    ],
  }),
  defineEffect({
    id: "pixelSort",
    label: "Pixel Sort",
    category: "stylize",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.5, { min: 0, max: 1, costHint: "high" }),
      number("threshold", "Threshold", 0.5, { min: 0, max: 1 }),
    ],
  }),
  defineEffect({
    id: "feedback",
    label: "Feedback",
    category: "interaction",
    passType: "feedback",
    compatibility: ["realBloom"],
    properties: [
      enabled(),
      number("decay", "Decay", 0.5, { min: 0, max: 1, costHint: "high" }),
    ],
  }),
  defineEffect({
    id: "ascii",
    label: "ASCII",
    category: "stylize",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("size", "Size", 8, { min: 2, max: 32, step: 1, animatable: false }),
    ],
  }),
  defineEffect({
    id: "dither",
    label: "Dither",
    category: "stylize",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("size", "Size", 4, { min: 1, max: 16, step: 1, animatable: false }),
    ],
  }),
  defineEffect({
    id: "parallax",
    label: "Parallax",
    category: "interaction",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("strength", "Strength", 0.5, { min: 0, max: 1 }),
    ],
  }),
  defineEffect({
    id: "shape3d",
    label: "3D Shape",
    category: "distort",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      select("shape", "Shape", "sphere", ["sphere", "torus", "plane", "cylinder", "cube"]),
      number("perspective", "Perspective", 1.5, { min: 0.1, max: 5 }),
      number("rotationSpeed", "Rotation Speed", 0.3, { min: 0, max: 2 }),
      number("zoom", "Zoom", 1, { min: 0.1, max: 5 }),
      number("lighting", "Lighting", 0.5, { min: 0, max: 1 }),
    ],
  }),
  defineEffect({
    id: "meshDistortion",
    label: "Mesh Distortion",
    category: "distort",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("displacement", "Displacement", 0.3, { min: 0, max: 1 }),
      number("frequency", "Frequency", 2, { min: 0, max: 10, costHint: "medium" }),
      number("speed", "Speed", 0.5, { min: 0, max: 2 }),
    ],
  }),
  defineEffect({
    id: "ripple",
    label: "Ripple",
    category: "interaction",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.5, { min: 0, max: 1 }),
    ],
  }),
  defineEffect({
    id: "glow",
    label: "Glow",
    category: "light",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.5, { min: 0, max: 1, costHint: "medium" }),
      number("radius", "Radius", 0.05, { min: 0, max: 0.5, costHint: "high" }),
    ],
  }),
  defineEffect({
    id: "caustic",
    label: "Caustics",
    category: "light",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.5, { min: 0, max: 1, costHint: "medium" }),
    ],
  }),
  defineEffect({
    id: "liquify",
    label: "Liquify",
    category: "distort",
    passType: "inline",
    compatibility: [],
    properties: [
      enabled(),
      number("intensity", "Intensity", 0.3, { min: 0, max: 1 }),
      number("scale", "Scale", 2, { min: 0.1, max: 10, costHint: "medium" }),
    ],
  }),
  defineEffect({
    id: "trail",
    label: "Mouse Trail",
    category: "interaction",
    passType: "feedback",
    compatibility: ["realBloom"],
    properties: [
      enabled(),
      number("length", "Length", 0.96, { min: 0, max: 1, costHint: "high" }),
      number("width", "Width", 0.05, { min: 0, max: 1 }),
    ],
  }),
  defineEffect({
    id: "realBloom",
    label: "Real Bloom",
    category: "light",
    passType: "multi-pass",
    compatibility: ["feedback", "trail"],
    properties: [
      enabled(),
    ],
  }),
  defineEffect({
    id: "deband",
    label: "Deband",
    category: "color",
    passType: "single-pass",
    compatibility: [],
    properties: [
      enabled(true),
      number("strength", "Strength", 1, { min: 0, max: 2 }),
    ],
  }),
] as const;

export const EFFECT_REGISTRY: Record<EffectId, EffectDefinition> = EFFECT_DEFINITIONS.reduce(
  (registry, definition) => {
    registry[definition.id] = definition;
    return registry;
  },
  {} as Record<EffectId, EffectDefinition>,
);

export function getEffectDefinition(id: EffectId): EffectDefinition {
  const definition = EFFECT_REGISTRY[id];
  if (!definition) {
    throw new Error(`Unknown Wavr effect: ${id}`);
  }
  return definition;
}

export function defaultParamsForEffect(id: EffectId): Record<string, unknown> {
  return { ...getEffectDefinition(id).defaultParams };
}

export function listAnimatableEffectPaths(id: EffectId): string[] {
  const definition = getEffectDefinition(id);
  return definition.properties
    .filter((property) => property.animatable)
    .map((property) => `effects.${definition.id}.${property.path}`);
}

export function effectNodesFromGradientConfig(config: GradientConfig): EffectNode[] {
  const record = config as unknown as Record<EffectId, Record<string, unknown> | undefined>;
  const nodes: EffectNode[] = [];

  for (const definition of EFFECT_DEFINITIONS) {
    const params = record[definition.id];
    if (!params) continue;
    nodes.push({
      id: definition.id,
      type: definition.id,
      enabled: Boolean(params.enabled),
      params: { ...params },
    });
  }

  return nodes;
}

export function applyEffectNodesToGradientConfig(
  config: GradientConfig,
  effects: readonly EffectNode[],
): GradientConfig {
  const next = { ...config } as unknown as Record<string, unknown>;

  for (const definition of EFFECT_DEFINITIONS) {
    delete next[definition.id];
  }

  for (const effect of effects) {
    if (!EFFECT_REGISTRY[effect.type]) continue;
    next[effect.type] = { ...effect.params, enabled: effect.enabled };
  }

  return next as GradientConfig;
}
