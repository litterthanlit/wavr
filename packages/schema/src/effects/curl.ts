import { z } from "zod";
import { d } from "../descriptions.gen";

export const CurlEffect = d(
  "CurlEffect",
  z.object({
    enabled: d("CurlEffect.enabled", z.boolean()),
    intensity: d("CurlEffect.intensity", z.number().min(0).max(1)).default(0.5),
    scale: d("CurlEffect.scale", z.number().min(0.1).max(10)).default(1),
  }).strict()
);
export type CurlEffect = z.infer<typeof CurlEffect>;
