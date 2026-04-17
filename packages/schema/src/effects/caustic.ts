import { z } from "zod";
import { d } from "../descriptions.gen";

export const CausticEffect = d(
  "CausticEffect",
  z.object({
    enabled: d("CausticEffect.enabled", z.boolean()),
    intensity: d("CausticEffect.intensity", z.number().min(0).max(1)).default(0.5),
  }).strict()
);
export type CausticEffect = z.infer<typeof CausticEffect>;
