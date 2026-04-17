import { z } from "zod";
import { d } from "../descriptions.gen";

export const ReactionDiffusionEffect = d(
  "ReactionDiffusionEffect",
  z.object({
    enabled: d("ReactionDiffusionEffect.enabled", z.boolean()),
    intensity: d("ReactionDiffusionEffect.intensity", z.number().min(0).max(1)).default(0.5),
    scale: d("ReactionDiffusionEffect.scale", z.number().min(0.1).max(10)).default(1),
  }).strict()
);
export type ReactionDiffusionEffect = z.infer<typeof ReactionDiffusionEffect>;
