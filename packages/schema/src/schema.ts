import { z } from "zod";
import { d } from "./descriptions.gen";
import { ColorSpace } from "./primitives";
import { LayerConfig } from "./layer";
import {
  NoiseEffect,
  BloomEffect,
  BlurEffect,
  CurlEffect,
  KaleidoscopeEffect,
  ReactionDiffusionEffect,
  PixelSortEffect,
  FeedbackEffect,
  AsciiEffect,
  DitherEffect,
  ParallaxEffect,
  Shape3DEffect,
  MeshDistortionEffect,
  RippleEffect,
  GlowEffect,
  CausticEffect,
  LiquifyEffect,
  TrailEffect,
  RealBloomEffect,
  DebandEffect,
} from "./effects";

export const GradientConfig = d(
  "GradientConfig",
  z.object({
    version: d("GradientConfig.version", z.literal("2.0.0")),
    colorSpace: d("GradientConfig.colorSpace", ColorSpace).default("linear"),
    layers: d("GradientConfig.layers", z.array(LayerConfig).min(1).max(4)),

    brightness: d("GradientConfig.brightness", z.number().min(0.1).max(2)).default(1),
    saturation: d("GradientConfig.saturation", z.number().min(0).max(2)).default(1),
    grain: d("GradientConfig.grain", z.number().min(0).max(1)).default(0),
    vignette: d("GradientConfig.vignette", z.number().min(0).max(1)).default(0),
    chromaticAberration: d("GradientConfig.chromaticAberration", z.number().min(0).max(1)).default(0),
    hueShift: d("GradientConfig.hueShift", z.number().min(-180).max(180)).default(0),
    domainWarp: d("GradientConfig.domainWarp", z.number().min(0).max(1)).default(0),
    radialBlur: d("GradientConfig.radialBlur", z.number().min(0).max(1)).default(0),
    mouseReact: d("GradientConfig.mouseReact", z.number().min(0).max(1)).default(0.5),
    oklabEnabled: d("GradientConfig.oklabEnabled", z.boolean()).default(true),
    toneMapMode: d("GradientConfig.toneMapMode", z.number().int().min(0).max(3)).default(1),

    noise: NoiseEffect.optional(),
    bloom: BloomEffect.optional(),
    blur: BlurEffect.optional(),
    curl: CurlEffect.optional(),
    kaleidoscope: KaleidoscopeEffect.optional(),
    reactionDiffusion: ReactionDiffusionEffect.optional(),
    pixelSort: PixelSortEffect.optional(),
    feedback: FeedbackEffect.optional(),
    ascii: AsciiEffect.optional(),
    dither: DitherEffect.optional(),
    parallax: ParallaxEffect.optional(),
    shape3d: Shape3DEffect.optional(),
    meshDistortion: MeshDistortionEffect.optional(),
    ripple: RippleEffect.optional(),
    glow: GlowEffect.optional(),
    caustic: CausticEffect.optional(),
    liquify: LiquifyEffect.optional(),
    trail: TrailEffect.optional(),
    realBloom: RealBloomEffect.optional(),
    deband: DebandEffect.optional(),
  }).strict()
);
export type GradientConfig = z.infer<typeof GradientConfig>;
