import { z } from "zod";
import { d } from "../descriptions.gen";

export const RippleEffect = d(
  "RippleEffect",
  z.object({
    enabled: d("RippleEffect.enabled", z.boolean()),
    intensity: d("RippleEffect.intensity", z.number().min(0).max(1)).default(0.5),
  }).strict()
);
export type RippleEffect = z.infer<typeof RippleEffect>;
