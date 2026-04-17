import { z } from "zod";
import { d } from "../descriptions.gen";

export const DitherEffect = d(
  "DitherEffect",
  z.object({
    enabled: d("DitherEffect.enabled", z.boolean()),
    size: d("DitherEffect.size", z.number().int().min(1).max(16)).default(4),
  }).strict()
);
export type DitherEffect = z.infer<typeof DitherEffect>;
