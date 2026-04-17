import { z } from "zod";
import { d } from "../descriptions.gen";

export const KaleidoscopeEffect = d(
  "KaleidoscopeEffect",
  z.object({
    enabled: d("KaleidoscopeEffect.enabled", z.boolean()),
    segments: d("KaleidoscopeEffect.segments", z.number().int().min(2).max(16)).default(6),
    rotation: d("KaleidoscopeEffect.rotation", z.number().min(-180).max(180)).default(0),
  }).strict()
);
export type KaleidoscopeEffect = z.infer<typeof KaleidoscopeEffect>;
