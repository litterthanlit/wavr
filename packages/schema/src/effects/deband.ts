import { z } from "zod";
import { d } from "../descriptions.gen";

export const DebandEffect = d(
  "DebandEffect",
  z.object({
    enabled: d("DebandEffect.enabled", z.boolean()),
    strength: d("DebandEffect.strength", z.number().min(0).max(2)).default(1),
  }).strict()
);
export type DebandEffect = z.infer<typeof DebandEffect>;
