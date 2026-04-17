import { z } from "zod";
import { d } from "../descriptions.gen";

export const FeedbackEffect = d(
  "FeedbackEffect",
  z.object({
    enabled: d("FeedbackEffect.enabled", z.boolean()),
    decay: d("FeedbackEffect.decay", z.number().min(0).max(1)).default(0.5),
  }).strict()
);
export type FeedbackEffect = z.infer<typeof FeedbackEffect>;
