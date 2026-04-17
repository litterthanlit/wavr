import { z } from "zod";
import { d } from "../descriptions.gen";

export const NoiseEffect = d(
  "NoiseEffect",
  z.object({
    enabled: d("NoiseEffect.enabled", z.boolean()),
    intensity: d("NoiseEffect.intensity", z.number().min(0).max(1)).default(0.3),
    scale: d("NoiseEffect.scale", z.number().min(0.1).max(10)).default(1),
  }).strict()
);
export type NoiseEffect = z.infer<typeof NoiseEffect>;
