import { z } from "zod";
import { d } from "../descriptions.gen";

export const AsciiEffect = d(
  "AsciiEffect",
  z.object({
    enabled: d("AsciiEffect.enabled", z.boolean()),
    size: d("AsciiEffect.size", z.number().int().min(2).max(32)).default(8),
  }).strict()
);
export type AsciiEffect = z.infer<typeof AsciiEffect>;
