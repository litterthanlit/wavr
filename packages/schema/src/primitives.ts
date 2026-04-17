import { z } from "zod";
import { d } from "./descriptions.gen";

// Convention: primitives never carry defaults. Defaults are applied at the
// use site (e.g. LayerConfig.blendMode defaults to "normal", Shape3DEffect.shape
// defaults to "sphere") so the same primitive can be reused in contexts with
// different defaults without accidental coupling.

export const RGBColor = d(
  "RGBColor",
  z.tuple([
    z.number().min(0).max(1),
    z.number().min(0).max(1),
    z.number().min(0).max(1),
  ])
);
export type RGBColor = z.infer<typeof RGBColor>;

export const ColorSpace = d("ColorSpace", z.enum(["linear", "oklab"]));
export type ColorSpace = z.infer<typeof ColorSpace>;

export const GradientType = d(
  "GradientType",
  z.enum([
    "mesh", "radial", "linear", "conic", "plasma",
    "dither", "scanline", "glitch", "voronoi", "image",
  ])
);
export type GradientType = z.infer<typeof GradientType>;

// 26-value Photoshop set — source of truth: packages/core/src/layers.ts
export const BlendMode = d(
  "BlendMode",
  z.enum([
    "normal",
    "darken", "multiply", "colorBurn", "linearBurn", "darkerColor",
    "lighten", "screen", "colorDodge", "add", "lighterColor",
    "overlay", "softLight", "hardLight", "vividLight", "linearLight", "pinLight", "hardMix",
    "difference", "exclusion", "subtract", "divide",
    "hue", "saturation", "color", "luminosity",
  ])
);
export type BlendMode = z.infer<typeof BlendMode>;

export const Shape3DKind = d(
  "Shape3DKind",
  z.enum(["sphere", "torus", "plane", "cylinder", "cube"])
);
export type Shape3DKind = z.infer<typeof Shape3DKind>;
