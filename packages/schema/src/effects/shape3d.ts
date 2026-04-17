import { z } from "zod";
import { d } from "../descriptions.gen";
import { Shape3DKind } from "../primitives";

export const Shape3DEffect = d(
  "Shape3DEffect",
  z.object({
    enabled: d("Shape3DEffect.enabled", z.boolean()),
    shape: d("Shape3DEffect.shape", Shape3DKind).default("sphere"),
    perspective: d("Shape3DEffect.perspective", z.number().min(0.1).max(5)).default(1.5),
    rotationSpeed: d("Shape3DEffect.rotationSpeed", z.number().min(0).max(2)).default(0.3),
    zoom: d("Shape3DEffect.zoom", z.number().min(0.1).max(5)).default(1),
    lighting: d("Shape3DEffect.lighting", z.number().min(0).max(1)).default(0.5),
  }).strict()
);
export type Shape3DEffect = z.infer<typeof Shape3DEffect>;
