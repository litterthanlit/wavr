import { z } from "zod";
import { d } from "../descriptions.gen";

export const RealBloomEffect = d(
  "RealBloomEffect",
  z.object({
    enabled: d("RealBloomEffect.enabled", z.boolean()),
  }).strict()
);
export type RealBloomEffect = z.infer<typeof RealBloomEffect>;
