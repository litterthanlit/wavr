import { GradientConfig, LayerConfig } from "./types";
import { EngineState } from "./engine";
import { LayerParams, createLayer } from "./layers";

const LAYER_DEFAULTS: Required<Omit<LayerConfig, "type" | "colors">> = {
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  opacity: 1.0,
  blendMode: "normal",
  depth: 0,
};

function resolveLayer(layer: LayerConfig): LayerParams {
  return createLayer({
    gradientType: layer.type,
    colors: layer.colors,
    speed: layer.speed ?? LAYER_DEFAULTS.speed,
    complexity: layer.complexity ?? LAYER_DEFAULTS.complexity,
    scale: layer.scale ?? LAYER_DEFAULTS.scale,
    distortion: layer.distortion ?? LAYER_DEFAULTS.distortion,
    opacity: layer.opacity ?? LAYER_DEFAULTS.opacity,
    blendMode: layer.blendMode ?? LAYER_DEFAULTS.blendMode,
    depth: layer.depth ?? LAYER_DEFAULTS.depth,
  });
}

export function resolveConfig(config: GradientConfig): EngineState {
  const layers = config.layers.map(resolveLayer);

  return {
    layers,
    brightness: config.brightness ?? 1.0,
    saturation: config.saturation ?? 1.0,
    noiseEnabled: config.noise?.enabled ?? false,
    noiseIntensity: config.noise?.intensity ?? 0.3,
    noiseScale: config.noise?.scale ?? 1.0,
    grain: config.grain ?? 0,
    mouseReact: config.mouseReact ?? 0.5,
    bloomEnabled: config.bloom?.enabled ?? false,
    bloomIntensity: config.bloom?.intensity ?? 0.3,
    vignette: config.vignette ?? 0,
    blurEnabled: config.blur?.enabled ?? false,
    blurAmount: config.blur?.amount ?? 0,
    radialBlurAmount: config.radialBlur ?? 0,
    colorBlend: 0,
    chromaticAberration: config.chromaticAberration ?? 0,
    hueShift: config.hueShift ?? 0,
    asciiEnabled: config.ascii?.enabled ?? false,
    asciiSize: config.ascii?.size ?? 8,
    ditherEnabled: config.dither?.enabled ?? false,
    ditherSize: config.dither?.size ?? 4,
    curlEnabled: config.curl?.enabled ?? false,
    curlIntensity: config.curl?.intensity ?? 0.5,
    curlScale: config.curl?.scale ?? 1.0,
    kaleidoscopeEnabled: config.kaleidoscope?.enabled ?? false,
    kaleidoscopeSegments: config.kaleidoscope?.segments ?? 6,
    kaleidoscopeRotation: config.kaleidoscope?.rotation ?? 0,
    reactionDiffEnabled: config.reactionDiffusion?.enabled ?? false,
    reactionDiffIntensity: config.reactionDiffusion?.intensity ?? 0.5,
    reactionDiffScale: config.reactionDiffusion?.scale ?? 1.0,
    pixelSortEnabled: config.pixelSort?.enabled ?? false,
    pixelSortIntensity: config.pixelSort?.intensity ?? 0.5,
    pixelSortThreshold: config.pixelSort?.threshold ?? 0.5,
    domainWarp: config.domainWarp ?? 0,
    feedbackEnabled: config.feedback?.enabled ?? false,
    feedbackDecay: config.feedback?.decay ?? 0.5,
    parallaxEnabled: config.parallax?.enabled ?? false,
    parallaxStrength: config.parallax?.strength ?? 0.5,
    threeDEnabled: config.shape3d?.enabled ?? false,
    threeDShape: config.shape3d
      ? ["sphere", "torus", "plane", "cylinder", "cube"].indexOf(config.shape3d.shape)
      : 0,
    threeDPerspective: config.shape3d?.perspective ?? 1.5,
    threeDRotationSpeed: config.shape3d?.rotationSpeed ?? 0.3,
    threeDZoom: config.shape3d?.zoom ?? 1.0,
    threeDLighting: config.shape3d?.lighting ?? 0.5,
    meshDistortionEnabled: config.meshDistortion?.enabled ?? false,
    meshDisplacement: config.meshDistortion?.displacement ?? 0.3,
    meshFrequency: config.meshDistortion?.frequency ?? 2.0,
    meshSpeed: config.meshDistortion?.speed ?? 0.5,
    oklabEnabled: config.oklabEnabled ?? true,
    toneMapMode: config.toneMapMode ?? 1,
    rippleEnabled: config.ripple?.enabled ?? false,
    rippleIntensity: config.ripple?.intensity ?? 0.5,
    glowEnabled: config.glow?.enabled ?? false,
    glowIntensity: config.glow?.intensity ?? 0.5,
    glowRadius: config.glow?.radius ?? 0.05,
    causticEnabled: config.caustic?.enabled ?? false,
    causticIntensity: config.caustic?.intensity ?? 0.5,
    liquifyEnabled: config.liquify?.enabled ?? false,
    liquifyIntensity: config.liquify?.intensity ?? 0.3,
    liquifyScale: config.liquify?.scale ?? 2.0,
    trailEnabled: config.trail?.enabled ?? false,
    trailLength: config.trail?.length ?? 0.96,
    trailWidth: config.trail?.width ?? 0.05,
    realBloomEnabled: config.realBloomEnabled ?? false,
    debandEnabled: config.deband?.enabled ?? true,
    debandStrength: config.deband?.strength ?? 1,
    playing: true,
    customGLSL: null,
  };
}

const SHAPE_NAMES = ["sphere", "torus", "plane", "cylinder", "cube"] as const;

export function stateToConfig(state: EngineState): GradientConfig {
  const config: GradientConfig = {
    layers: state.layers.map((l) => ({
      type: l.gradientType as LayerConfig["type"],
      colors: l.colors,
      speed: l.speed,
      complexity: l.complexity,
      scale: l.scale,
      distortion: l.distortion,
      opacity: l.opacity,
      blendMode: l.blendMode,
      depth: l.depth,
    })),
  };

  if (state.brightness !== 1.0) config.brightness = state.brightness;
  if (state.saturation !== 1.0) config.saturation = state.saturation;
  if (state.grain) config.grain = state.grain;
  if (state.vignette) config.vignette = state.vignette;
  if (state.chromaticAberration) config.chromaticAberration = state.chromaticAberration;
  if (state.hueShift) config.hueShift = state.hueShift;
  if (state.domainWarp) config.domainWarp = state.domainWarp;
  if (state.radialBlurAmount) config.radialBlur = state.radialBlurAmount;
  if (state.mouseReact !== 0.5) config.mouseReact = state.mouseReact;
  if (state.noiseEnabled) config.noise = { enabled: true, intensity: state.noiseIntensity, scale: state.noiseScale };
  if (state.bloomEnabled) config.bloom = { enabled: true, intensity: state.bloomIntensity };
  if (state.blurEnabled) config.blur = { enabled: true, amount: state.blurAmount };
  if (state.curlEnabled) config.curl = { enabled: true, intensity: state.curlIntensity, scale: state.curlScale };
  if (state.kaleidoscopeEnabled) config.kaleidoscope = { enabled: true, segments: state.kaleidoscopeSegments, rotation: state.kaleidoscopeRotation };
  if (state.reactionDiffEnabled) config.reactionDiffusion = { enabled: true, intensity: state.reactionDiffIntensity, scale: state.reactionDiffScale };
  if (state.pixelSortEnabled) config.pixelSort = { enabled: true, intensity: state.pixelSortIntensity, threshold: state.pixelSortThreshold };
  if (state.feedbackEnabled) config.feedback = { enabled: true, decay: state.feedbackDecay };
  if (state.asciiEnabled) config.ascii = { enabled: true, size: state.asciiSize };
  if (state.ditherEnabled) config.dither = { enabled: true, size: state.ditherSize };
  if (state.parallaxEnabled) config.parallax = { enabled: true, strength: state.parallaxStrength };
  if (state.threeDEnabled) config.shape3d = {
    enabled: true,
    shape: SHAPE_NAMES[state.threeDShape] ?? "sphere",
    perspective: state.threeDPerspective,
    rotationSpeed: state.threeDRotationSpeed,
    zoom: state.threeDZoom,
    lighting: state.threeDLighting,
  };
  if (state.meshDistortionEnabled) config.meshDistortion = {
    enabled: true,
    displacement: state.meshDisplacement,
    frequency: state.meshFrequency,
    speed: state.meshSpeed,
  };
  // Deband: always emit so the engine's default-on behavior round-trips
  // correctly when the user explicitly disables it.
  config.deband = { enabled: state.debandEnabled, strength: state.debandStrength };

  return config;
}
