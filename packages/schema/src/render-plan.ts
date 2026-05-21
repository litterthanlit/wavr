import { WavrSceneDocument, type WavrSceneDocument as WavrSceneDocumentValue } from "./scene-document";
import type { WavrLayerNode, WavrLayerSource } from "./scene-document";
import { getEffectDefinition, type EffectId } from "./effect-registry";

export type RenderPassKind =
  | "draw"
  | "post"
  | "feedback"
  | "composite"
  | "copy"
  | "downsample"
  | "upsample"
  | "output";

export interface RenderResource {
  id: string;
  kind: "texture" | "framebuffer" | "screen";
  resolutionScale: number;
  persistent: boolean;
}

export interface RenderPass {
  id: string;
  kind: RenderPassKind;
  shaderKey: string;
  inputTextures: string[];
  outputTarget: string;
  resolutionScale: number;
  clear: boolean;
  effects: string[];
}

export interface SceneCost {
  drawPasses: number;
  resourceCount: number;
  fullResolutionPasses: number;
  activeEffects: number;
}

export interface CompatibilityWarning {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  effectId?: string;
}

export interface RenderPlan {
  passes: RenderPass[];
  resources: RenderResource[];
  estimatedCost: SceneCost;
  compatibilityWarnings: CompatibilityWarning[];
}

function pass(
  id: string,
  kind: RenderPassKind,
  shaderKey: string,
  inputTextures: string[],
  outputTarget: string,
  effects: string[] = [],
  resolutionScale = 1,
): RenderPass {
  return {
    id,
    kind,
    shaderKey,
    inputTextures,
    outputTarget,
    resolutionScale,
    clear: kind === "draw" || kind === "composite",
    effects,
  };
}

function resource(id: string, persistent = false, resolutionScale = 1): RenderResource {
  return {
    id,
    kind: "framebuffer",
    resolutionScale,
    persistent,
  };
}

function isKnownEffectId(id: string): id is EffectId {
  try {
    getEffectDefinition(id as EffectId);
    return true;
  } catch {
    return false;
  }
}

type GradientLayerNode = WavrLayerNode & {
  kind: "shader";
  source: Extract<WavrLayerSource, { kind: "gradient" }>;
};

function isVisibleGradientLayer(layer: WavrLayerNode): layer is GradientLayerNode {
  return layer.visible && layer.kind === "shader" && layer.source.kind === "gradient";
}

export function compileRenderPlan(input: WavrSceneDocumentValue): RenderPlan {
  const document = WavrSceneDocument.parse(input);
  const passes: RenderPass[] = [];
  const resources: RenderResource[] = [];
  const compatibilityWarnings: CompatibilityWarning[] = [];
  const visibleShaderLayers = document.layers.filter(isVisibleGradientLayer);

  let currentTarget = "screen";

  for (const layer of visibleShaderLayers) {
    const target = `layer:${layer.id}`;
    resources.push(resource(target));
    passes.push(pass(target, "draw", `gradient:${layer.source.gradient.type}`, [], target));
    currentTarget = target;
  }

  if (visibleShaderLayers.length > 1) {
    const inputs = visibleShaderLayers.map((layer) => `layer:${layer.id}`);
    currentTarget = "composite:layers";
    resources.push(resource(currentTarget));
    passes.push(pass(currentTarget, "composite", "composite:layers", inputs, currentTarget));
  }

  const activeEffects = document.postEffects.filter((effect) => effect.enabled && isKnownEffectId(effect.type));
  const feedbackActive = activeEffects.some((effect) => getEffectDefinition(effect.type as EffectId).passType === "feedback");

  for (const effect of activeEffects) {
    const definition = getEffectDefinition(effect.type as EffectId);
    if (definition.id === "realBloom" && feedbackActive) {
      compatibilityWarnings.push({
        code: "real-bloom-feedback-disabled",
        severity: "warning",
        message: "Real bloom is skipped while feedback is active in the current renderer.",
        effectId: "realBloom",
      });
      continue;
    }

    if (definition.id === "realBloom") {
      const brightTarget = "realBloom:brights";
      const blurXTarget = "realBloom:blur-x";
      const blurYTarget = "realBloom:blur-y";
      resources.push(resource(brightTarget, false, 0.5));
      resources.push(resource(blurXTarget, false, 0.5));
      resources.push(resource(blurYTarget, false, 0.5));
      passes.push(pass("post:realBloom:extract", "post", "realBloom:extract", [currentTarget], brightTarget, ["realBloom"], 0.5));
      passes.push(pass("post:realBloom:blur-x", "post", "realBloom:blur-x", [brightTarget], blurXTarget, ["realBloom"], 0.5));
      passes.push(pass("post:realBloom:blur-y", "post", "realBloom:blur-y", [blurXTarget], blurYTarget, ["realBloom"], 0.5));
      passes.push(pass("post:realBloom:composite", "composite", "realBloom:composite", [currentTarget, blurYTarget], currentTarget, ["realBloom"]));
      continue;
    }

    if (definition.passType === "feedback") {
      const target = `${definition.id}:accum`;
      resources.push(resource(target, true));
      passes.push(pass(`post:${definition.id}`, "feedback", definition.id, [currentTarget], target, [definition.id]));
      currentTarget = target;
      continue;
    }

    if (definition.passType === "single-pass") {
      const target = `post:${definition.id}:output`;
      resources.push(resource(target));
      passes.push(pass(`post:${definition.id}`, "post", definition.id, [currentTarget], target, [definition.id]));
      currentTarget = target;
    }
  }

  passes.push(pass("output:screen", "output", "copy", [currentTarget], "screen"));

  return {
    passes,
    resources,
    estimatedCost: {
      drawPasses: passes.length,
      resourceCount: resources.length,
      fullResolutionPasses: passes.filter((renderPass) => renderPass.resolutionScale === 1).length,
      activeEffects: activeEffects.length,
    },
    compatibilityWarnings,
  };
}
