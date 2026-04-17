import { z } from "zod";
import { d } from "../descriptions.gen";

export const BlurEffect = d(
  "BlurEffect",
  z.object({
    enabled: d("BlurEffect.enabled", z.boolean()),
    amount: d("BlurEffect.amount", z.number().min(0).max(1)).default(0),
  }).strict()
);
export type BlurEffect = z.infer<typeof BlurEffect>;
