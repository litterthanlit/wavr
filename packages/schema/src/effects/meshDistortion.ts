import { z } from "zod";
import { d } from "../descriptions.gen";

export const MeshDistortionEffect = d(
  "MeshDistortionEffect",
  z.object({
    enabled: d("MeshDistortionEffect.enabled", z.boolean()),
    displacement: d("MeshDistortionEffect.displacement", z.number().min(0).max(1)).default(0.3),
    frequency: d("MeshDistortionEffect.frequency", z.number().min(0).max(10)).default(2),
    speed: d("MeshDistortionEffect.speed", z.number().min(0).max(2)).default(0.5),
  }).strict()
);
export type MeshDistortionEffect = z.infer<typeof MeshDistortionEffect>;
