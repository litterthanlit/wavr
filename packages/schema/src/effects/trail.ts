import { z } from "zod";
import { d } from "../descriptions.gen";

export const TrailEffect = d(
  "TrailEffect",
  z.object({
    enabled: d("TrailEffect.enabled", z.boolean()),
    length: d("TrailEffect.length", z.number().min(0).max(1)).default(0.96),
    width: d("TrailEffect.width", z.number().min(0).max(1)).default(0.05),
  }).strict()
);
export type TrailEffect = z.infer<typeof TrailEffect>;
