import { z } from "zod";
import { d } from "../descriptions.gen";

export const GlowEffect = d(
  "GlowEffect",
  z.object({
    enabled: d("GlowEffect.enabled", z.boolean()),
    intensity: d("GlowEffect.intensity", z.number().min(0).max(1)).default(0.5),
    radius: d("GlowEffect.radius", z.number().min(0).max(0.5)).default(0.05),
  }).strict()
);
export type GlowEffect = z.infer<typeof GlowEffect>;
