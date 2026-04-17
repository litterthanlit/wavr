import { z } from "zod";
import { d } from "./descriptions.gen";
import { BlendMode, GradientType, RGBColor } from "./primitives";

export const LayerConfig = d(
  "LayerConfig",
  z.object({
    type: d("LayerConfig.type", GradientType),
    colors: d("LayerConfig.colors", z.array(RGBColor).min(2).max(8)),
    speed: d("LayerConfig.speed", z.number().min(0).max(2)).default(0.4),
    complexity: d("LayerConfig.complexity", z.number().int().min(1).max(8)).default(3),
    scale: d("LayerConfig.scale", z.number().min(0.2).max(4)).default(1),
    distortion: d("LayerConfig.distortion", z.number().min(0).max(1)).default(0.3),
    opacity: d("LayerConfig.opacity", z.number().min(0).max(1)).default(1),
    blendMode: d("LayerConfig.blendMode", BlendMode).default("normal"),
    depth: d("LayerConfig.depth", z.number().min(-1).max(1)).default(0),
  }).strict()
);
export type LayerConfig = z.infer<typeof LayerConfig>;
