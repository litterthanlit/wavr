import { z } from "zod";
import { d } from "../descriptions.gen";

export const BloomEffect = d(
  "BloomEffect",
  z.object({
    enabled: d("BloomEffect.enabled", z.boolean()),
    intensity: d("BloomEffect.intensity", z.number().min(0).max(2)).default(0.3),
  }).strict()
);
export type BloomEffect = z.infer<typeof BloomEffect>;
