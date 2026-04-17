import { z } from "zod";
import { d } from "../descriptions.gen";

export const LiquifyEffect = d(
  "LiquifyEffect",
  z.object({
    enabled: d("LiquifyEffect.enabled", z.boolean()),
    intensity: d("LiquifyEffect.intensity", z.number().min(0).max(1)).default(0.3),
    scale: d("LiquifyEffect.scale", z.number().min(0.1).max(10)).default(2),
  }).strict()
);
export type LiquifyEffect = z.infer<typeof LiquifyEffect>;
