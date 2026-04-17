import { z } from "zod";
import { d } from "../descriptions.gen";

export const ParallaxEffect = d(
  "ParallaxEffect",
  z.object({
    enabled: d("ParallaxEffect.enabled", z.boolean()),
    strength: d("ParallaxEffect.strength", z.number().min(0).max(1)).default(0.5),
  }).strict()
);
export type ParallaxEffect = z.infer<typeof ParallaxEffect>;
