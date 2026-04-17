import { z } from "zod";
import { d } from "../descriptions.gen";

export const PixelSortEffect = d(
  "PixelSortEffect",
  z.object({
    enabled: d("PixelSortEffect.enabled", z.boolean()),
    intensity: d("PixelSortEffect.intensity", z.number().min(0).max(1)).default(0.5),
    threshold: d("PixelSortEffect.threshold", z.number().min(0).max(1)).default(0.5),
  }).strict()
);
export type PixelSortEffect = z.infer<typeof PixelSortEffect>;
