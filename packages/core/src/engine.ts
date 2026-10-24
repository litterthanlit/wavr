import trailFragSource from "./shaders/trail.glsl";
import bloomDownSource from "./shaders/bloom-down.glsl";
import bloomUpSource from "./shaders/bloom-up.glsl";
import {
  FULLSCREEN_VERTEX_SOURCE,
  LAYER_VERTEX_SOURCE,
  assembleLayerSource,
  assemblePostSource,
} from "./shader-sources";
import { BlendMode, ColorProfile, ImageBlendMode, LayerParams, MaskBlendMode, MaskShape } from "./layers";
import {
  createEmptyEngineMetrics,
  summarizeGpuResources,
  type EngineMetrics,
  type GpuResourceSample,
} from "./instrumentation";
import { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply, flipRowsRGBA } from "./math";
import {
  POINTER_SPEED_REF,
  RIPPLE_DURATION,
  TRAIL_FLOOR_PER_FRAME,
  createPointerState,
  pointerVelocity,
  setPointerPresent,
  setPointerTarget,
  settlePointer,
  stepPointer,
} from "./pointer";
import {
  PALETTE_SIZE,
  bakePalette,
  createPaletteKey,
  effectiveBlend,
  paletteDomain,
  paletteKeyMatches,
  setPaletteKey,
  toMixSpace,
  type PaletteKey,
} from "./palette";
import { RenderScaleController, type RenderScaleOptions } from "./render-scale";

export interface EngineState {
  layers: LayerParams[];
  brightness: number;
  saturation: number;
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseScale: number;
  grain: number;
  mouseReact: number;
  bloomEnabled: boolean;
  bloomIntensity: number;
  vignette: number;
  blurEnabled: boolean;
  blurAmount: number;
  radialBlurAmount: number;
  colorBlend: number;
  chromaticAberration: number;
  hueShift: number;
  asciiEnabled: boolean;
  asciiSize: number;
  ditherEnabled: boolean;
  ditherSize: number;
  curlEnabled: boolean;
  curlIntensity: number;
  curlScale: number;
  kaleidoscopeEnabled: boolean;
  kaleidoscopeSegments: number;
  kaleidoscopeRotation: number;
  reactionDiffEnabled: boolean;
  reactionDiffIntensity: number;
  reactionDiffScale: number;
  pixelSortEnabled: boolean;
  pixelSortIntensity: number;
  pixelSortThreshold: number;
  domainWarp: number;
  feedbackEnabled: boolean;
  feedbackDecay: number;
  parallaxEnabled: boolean;
  parallaxStrength: number;
  threeDEnabled: boolean;
  threeDShape: number;
  threeDPerspective: number;
  threeDRotationSpeed: number;
  threeDZoom: number;
  threeDLighting: number;
  meshDistortionEnabled: boolean;
  meshDisplacement: number;
  meshFrequency: number;
  meshSpeed: number;
  oklabEnabled: boolean;
  toneMapMode: number;
  /** The RGB space colour values are read in and the canvas presents in. */
  colorProfile: ColorProfile;
  rippleEnabled: boolean;
  rippleIntensity: number;
  glowEnabled: boolean;
  glowIntensity: number;
  glowRadius: number;
  causticEnabled: boolean;
  causticIntensity: number;
  liquifyEnabled: boolean;
  liquifyIntensity: number;
  liquifyScale: number;
  trailEnabled: boolean;
  trailLength: number;
  trailWidth: number;
  realBloomEnabled: boolean;
  debandEnabled: boolean;
  debandStrength: number;
  playing: boolean;
  customGLSL: string | null;
}

export interface GradientEngineOptions {
  preserveDrawingBuffer?: boolean;
  powerPreference?: WebGLPowerPreference;
}

type UniformMap = Record<string, WebGLUniformLocation>;

/** Shader id for each gradient type (`u_gradientType`). */
export const GRADIENT_TYPE_IDS: Readonly<Record<LayerParams["gradientType"], number>> = {
  mesh: 0,
  radial: 1,
  linear: 2,
  conic: 3,
  plasma: 4,
  dither: 5,
  scanline: 6,
  glitch: 7,
  image: 8,
  voronoi: 9,
  silk: 10,
  aurora: 11,
  liquid: 12,
  softCells: 13,
  grainflow: 14,
  prismGlass: 15,
  neonTunnel: 16,
  liquidChrome: 17,
  iridescentFoil: 18,
  horizonGlow: 19,
  lightLeak: 20,
  inkSmoke: 21,
  plasmaOrb: 22,
  aperture: 23,
  halo: 24,
  lightWall: 25,
};

const IMAGE_BLEND_MODE_MAP: Record<ImageBlendMode, number> = {
  replace: 0,
  normal: 1,
  multiply: 2,
  screen: 3,
  overlay: 4,
};

const MASK_SHAPE_MAP: Record<MaskShape, number> = {
  none: 0,
  circle: 1,
  roundedRect: 2,
  ellipse: 3,
  polygon: 4,
  star: 5,
  blob: 6,
};

const MASK_BLEND_MODE_MAP: Record<MaskBlendMode, number> = {
  union: 0,
  subtract: 1,
  intersect: 2,
  smoothUnion: 3,
};

/**
 * Uniforms the layer and post programs may declare. Locations are looked up by
 * name once per program; a name a program doesn't use is simply absent. A
 * uniform missing from this list is silently never set.
 */
export const PROGRAM_UNIFORM_NAMES: readonly string[] = [
  "u_time", "u_resolution", "u_mouse", "u_mouseSmooth", "u_mouseVelocity",
  "u_speed", "u_complexity", "u_scale", "u_distortion", "u_softness",
  "u_brightness", "u_saturation", "u_colorCount",
  "u_noiseEnabled", "u_noiseIntensity", "u_noiseScale", "u_grain",
  "u_mouseReact", "u_mousePresence",
  "u_bloomEnabled", "u_bloomIntensity", "u_vignette", "u_radialBlurAmount",
  "u_blurEnabled", "u_blurAmount",
  "u_paletteTexture", "u_paletteDomain", "u_compositeScale",
  "u_chromaticAberration", "u_hueShift",
  "u_asciiEnabled", "u_asciiSize", "u_ditherEnabled", "u_ditherSize",
  "u_layerOpacity", "u_sceneTexture",
  "u_curlEnabled", "u_curlIntensity", "u_curlScale",
  "u_kaleidoscopeEnabled", "u_kaleidoscopeSegments", "u_kaleidoscopeRotation",
  "u_reactionDiffEnabled", "u_reactionDiffIntensity", "u_reactionDiffScale",
  "u_pixelSortEnabled", "u_pixelSortIntensity", "u_pixelSortThreshold",
  "u_domainWarp", "u_oklabEnabled", "u_displayP3", "u_colorBlend",
  "u_feedbackEnabled", "u_feedbackDecay", "u_prevFrame",
  // Image/texture uniforms
  "u_imageTexture", "u_distortionMap",
  "u_hasImage", "u_hasDistortionMap",
  "u_imageScale", "u_imageOffset",
  "u_distortionMapIntensity",
  "u_imageBlendMode", "u_imageBlendOpacity",
  // Mask uniforms
  "u_maskEnabled",
  "u_mask1Type", "u_mask1Position", "u_mask1Scale", "u_mask1Rotation",
  "u_mask1Feather", "u_mask1Invert", "u_mask1CornerRadius",
  "u_mask1Sides", "u_mask1StarInner", "u_mask1NoiseDist",
  "u_mask2Type", "u_mask2Position", "u_mask2Scale", "u_mask2Rotation",
  "u_mask2Feather", "u_mask2Invert", "u_mask2CornerRadius",
  "u_mask2Sides", "u_mask2StarInner", "u_mask2NoiseDist",
  "u_maskBlendMode", "u_maskSmoothness",
  // Text mask
  "u_textMaskEnabled", "u_textMaskTexture",
  // Layer compositing (Phase 12)
  "u_blendMode", "u_compositeEnabled", "u_compositePrev",
  // Phase 7: Parallax
  "u_parallaxEnabled", "u_parallaxStrength", "u_layerDepth",
  // Phase 7: 3D Shape Projection
  "u_3dEnabled", "u_3dShape", "u_3dPerspective",
  "u_3dRotationSpeed", "u_3dRotation", "u_3dZoom", "u_3dLighting",
  // Phase 7: Mesh Distortion (vertex shader)
  "u_meshEnabled", "u_meshDisplacement", "u_meshFrequency", "u_meshSpeed", "u_mvp",
  // Phase 11: Shader Quality
  "u_toneMapMode",
  // Phase 11 Week 2: Ripple, Glow, Caustics
  "u_rippleOrigin", "u_rippleTime", "u_rippleEnabled", "u_rippleIntensity",
  "u_glowEnabled", "u_glowIntensity", "u_glowRadius",
  "u_causticEnabled", "u_causticIntensity",
  "u_liquifyEnabled", "u_liquifyIntensity", "u_liquifyScale",
  "u_trailEnabled", "u_trailTexture", "u_trailWidth",
  // Spec 0004: Deband (blue-noise anti-banding, on by default)
  "u_debandEnabled", "u_debandStrength",
  // Cinematic bloom (the bloom pyramid's top level)
  "u_realBloomEnabled", "u_realBloomGain", "u_bloomTexture",
];

// Texture units. Each sampler is bound to one fixed unit in its program.
const UNIT_PREV_FRAME = 0; // post: feedback
const UNIT_IMAGE = 1; // layer
const UNIT_DISTORTION_MAP = 2; // layer
const UNIT_TEXT_MASK = 3; // layer
const UNIT_TRAIL = 4; // post
const UNIT_COMPOSITE_PREV = 5; // layer: layers composited so far
const UNIT_SCENE = 6; // post: all layers composited
const UNIT_PALETTE = 7; // layer, post: baked palette. Only ever sampled, never a render target.
const UNIT_BLOOM = 8; // post: the bloom pyramid's top level

/**
 * Cinematic bloom: linear light below this (brightest channel) doesn't bloom;
 * above it, a quadratic soft knee. About sRGB 0.58, so the light in a scene
 * blooms and its mid-tones don't.
 */
const BLOOM_THRESHOLD = 0.3;
/** Cinematic bloom: the light added back, per unit of thresholded light. */
const BLOOM_STRENGTH = 1.0;
/** Cinematic bloom: the most pyramid levels below the canvas; each doubles the reach. */
const BLOOM_MAX_LEVELS = 7;
/** Cinematic bloom: each level's light, relative to the next narrower one's (a glare falloff). */
const BLOOM_LEVEL_FALLOFF = 0.72;

/** 1 / the summed weight of `levels` pyramid levels, so the bloom's strength doesn't depend on the canvas size. */
function bloomNormalization(levels: number): number {
  let sum = 0;
  for (let i = 0; i < levels; i++) sum += Math.pow(BLOOM_LEVEL_FALLOFF, i);
  return 1 / sum;
}

/**
 * The texture cache key of a picture uploaded for a scene in `profile`: it is
 * converted into the profile's colours on upload, so each profile keeps its own.
 */
function imageTextureKey(dataURL: string, profile: ColorProfile): string {
  return profile === "srgb" ? dataURL : `${profile}:${dataURL}`;
}

/** One level of the bloom pyramid. */
interface BloomLevel {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

/** Lowest fixed render scale setRenderScale accepts. */
const MIN_RENDER_SCALE = 0.25;

/**
 * Gradients whose look is fixed in screen pixels (they read gl_FragCoord for a
 * grid, grain or scanlines) or in image detail. The layer pass is drawn at full
 * resolution whenever one of them is visible, because at a lower scale a pixel
 * of the layer pass is bigger on screen: halftone cells, scanlines and paper
 * grain would grow and an uploaded picture would blur. A test checks this list
 * against the gl_FragCoord users in gradients.glsl.
 */
export const FULL_RESOLUTION_GRADIENTS: ReadonlySet<LayerParams["gradientType"]> = new Set([
  "dither",
  "scanline",
  "glitch",
  "grainflow",
  "image",
]);

/**
 * The lowest the layer pass scale goes while a text mask is on: the mask is
 * evaluated in the layer pass, so at a low scale the letter edges soften by
 * 1/scale pixels. Shape masks are left to the caller's floor.
 */
export const TEXT_MASK_MIN_SCALE = 0.8;

/** A layer's baked palette texture (palette.ts) and what it was baked from. */
interface PaletteSlot {
  texture: WebGLTexture;
  /** Texture storage allocated (the first bake allocates, later ones update it). */
  allocated: boolean;
  key: PaletteKey;
  /** `u_paletteDomain` for the baked blend. */
  domainScale: number;
  domainBias: number;
}

/** `KHR_parallel_shader_compile`: compile and link run off-thread. */
interface ParallelShaderCompile {
  COMPLETION_STATUS_KHR: number;
}

/**
 * A linked (or still linking) program and what the engine needs to drive it.
 * Uniform locations are per program, so each record carries its own.
 */
interface ProgramRecord {
  label: string;
  program: WebGLProgram;
  /** Attached shaders; deleted once the program has linked. */
  shaders: WebGLShader[];
  /** Linked, locations resolved. */
  ready: boolean;
  /** Set when compile or link failed; thrown again on every use. */
  error: Error | null;
  startedAt: number;
  uniforms: UniformMap;
  colorLocations: (WebGLUniformLocation | undefined)[];
  /** `u_colorsMix[i]`: the stops in the space gradients blend them in (palette.ts toMixSpace). */
  mixLocations: (WebGLUniformLocation | undefined)[];
}

export interface CaptureOptions {
  /** State to render. Defaults to the most recently rendered state. */
  state?: EngineState;
  /** Animation time in seconds. Defaults to the live clock. */
  time?: number;
  /** Output size in pixels. Defaults to the canvas size. */
  width?: number;
  height?: number;
  /**
   * Fraction of the output size the layers are drawn at before the global
   * effects (1 = full, the default and what exports use, whatever the live
   * render scale is). Lower values show what the live view looks like at that
   * scale; the same rules apply as live (setRenderScale).
   */
  renderScale?: number;
}

/** Scale `width`×`height` down, keeping aspect, so neither side exceeds `max`. */
export function fitSize(width: number, height: number, max: number): { width: number; height: number } {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scale = Math.min(1, max / Math.max(w, h));
  return {
    width: Math.max(1, Math.floor(w * scale)),
    height: Math.max(1, Math.floor(h * scale)),
  };
}

function getWebGL2Context(
  canvas: HTMLCanvasElement,
  options: GradientEngineOptions,
): WebGL2RenderingContext | null {
  const preserveDrawingBuffer = options.preserveDrawingBuffer ?? false;
  const attempts: WebGLContextAttributes[] = [
    {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer,
      premultipliedAlpha: false,
      powerPreference: options.powerPreference ?? "high-performance",
    },
    {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer,
      premultipliedAlpha: false,
      powerPreference: "default",
    },
    {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer,
      premultipliedAlpha: false,
    },
  ];
  for (const attrs of attempts) {
    const gl = canvas.getContext("webgl2", attrs);
    if (gl) return gl;
  }
  return canvas.getContext("webgl2");
}

export class GradientEngine {
  private gl: WebGL2RenderingContext;
  private textureUnits: number[];
  private parallelCompile: ParallelShaderCompile | null = null;
  /** Render the composite targets as RGBA16F so deband and tone mapping see unquantized colour. */
  private halfFloatTargets = false;
  /** Layer programs by gradient (`g<shader id>`), plus `custom` for Custom GLSL. */
  private layerPrograms = new Map<string, ProgramRecord>();
  private postProgram: ProgramRecord | null = null;
  /** Body of the user's `customGradient`; while set, every layer uses the custom program. */
  private customSource: string | null = null;
  /** The layer/post program bound for uniform uploads; null while an auxiliary program is bound. */
  private active: ProgramRecord | null = null;
  /**
   * Last values uploaded to each layer/post-program uniform, so unchanged ones
   * are skipped (most are constant between frames). Locations belong to one
   * program, so entries are dropped with it (disposeProgram).
   */
  private lastUniformValues = new Map<WebGLUniformLocation, number[]>();
  private elapsedTime = 0;
  private animationId: number | null = null;
  private maxPixelRatio = 1.5;
  private minFrameIntervalMs = 1000 / 60;
  /** The pointer: absent until the first setMouse, then smoothed without overshoot (pointer.ts). */
  private pointer = createPointerState();
  /** Whether the pointer smoother or presence was still moving at the last advancePointer. */
  private pointerMoving = false;
  // Click ripple: origin (uv) and seconds since the click, in real time
  private rippleOriginX = 0;
  private rippleOriginY = 0;
  private rippleAge = RIPPLE_DURATION;
  // Real seconds of pointer time not yet applied to the trail field, and the
  // smoothed pointer where the trail was last stamped (if it was present then).
  private trailPendingDt = 0;
  private trailStampX = 0.5;
  private trailStampY = 0.5;
  private trailStampLive = false;
  /** Seconds a paused loop keeps drawing for after the pointer last moved, so the trail can finish fading. */
  private trailHot = 0;
  // 3D rotation accumulator
  private rotationAngle = 0;
  private speedMultiplier = 1.0;
  // Feedback loop FBO ping-pong
  private feedbackFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private feedbackTextures: [WebGLTexture, WebGLTexture] | null = null;
  private feedbackIndex = 0;
  private feedbackWidth = 0;
  private feedbackHeight = 0;

  // Cinematic bloom: a pyramid of the composited scene's light, made between
  // the layer passes and the post pass, which adds its top level back.
  private bloomDownProgram: WebGLProgram | null = null;
  private bloomUpProgram: WebGLProgram | null = null;
  private bloomDownUniforms: UniformMap = {};
  private bloomUpUniforms: UniformMap = {};
  private bloomLevels: BloomLevel[] = [];
  private bloomCanvasWidth = 0;
  private bloomCanvasHeight = 0;

  // Trail FBO ping-pong
  private trailProgram: WebGLProgram | null = null;
  private trailUniforms: UniformMap = {};
  private trailFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private trailTextures: [WebGLTexture, WebGLTexture] | null = null;
  private trailIndex = 0;
  private trailWidth = 0;
  private trailHeight = 0;

  // Image texture cache
  /** Uploaded pictures and distortion maps, by imageTextureKey(). */
  private textureCache: Map<string, WebGLTexture> = new Map();
  private textureSizes: Map<string, { width: number; height: number }> = new Map();
  private pendingLoads: Set<string> = new Set();
  private textMaskTexture: WebGLTexture | null = null;
  private lastTextureRefs: (string | null)[] = [];
  private lastTextureCleanupMs = 0;
  private static readonly TEXTURE_CLEANUP_INTERVAL_MS = 5000;

  /**
   * One palette texture per visible layer, by position in the frame. A layer
   * whose palette changed is baked again into its slot; slots past the last
   * visible layer are freed.
   */
  private palettes: PaletteSlot[] = [];
  private paletteData = new Float32Array(PALETTE_SIZE * 4);

  /**
   * Render scale: the fraction of the canvas the layer pass is drawn at (the
   * post pass always draws the full canvas and upsamples). Fixed, or chosen by
   * the controller while one is set. See layerPassScale() for when it applies.
   */
  /** The colour space the canvas presents in (drawingBufferColorSpace), as last set by render(). */
  private canvasProfile: ColorProfile = "srgb";
  private renderScale = 1;
  private renderScaleController: RenderScaleController | null = null;
  /** Set while capturing: the scale to draw at instead of the live one. */
  private captureScale: number | null = null;
  /** Size of the layer pass being drawn (what u_resolution is in layer programs). */
  private passWidth = 0;
  private passHeight = 0;
  /** The scale the last frame was drawn at, after layerPassScale(). */
  private drawnScale = 1;
  /** Frames render() has drawn; the loop compares it before and after to see whether a callback drew. */
  private framesDrawn = 0;
  private lastCallbackMs: number | null = null;
  private lastCallbackDrew = false;

  // Layer compositing FBOs (Phase 12)
  private compositeFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private compositeTextures: [WebGLTexture, WebGLTexture] | null = null;
  private compositeWidth = 0;
  private compositeHeight = 0;

  // Fullscreen quad and grid mesh for mesh distortion (Phase 7). Every program
  // has `a_position` at location 0 (layout qualifier), so they all share these.
  private quadVAO: WebGLVertexArrayObject | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private gridVAO: WebGLVertexArrayObject | null = null;
  private gridBuffers: WebGLBuffer[] = [];
  private gridIndexCount = 0;
  private metrics = createEmptyEngineMetrics();

  constructor(canvas: HTMLCanvasElement, options: GradientEngineOptions = {}) {
    const gl = getWebGL2Context(canvas, options);
    if (!gl) throw new Error("WebGL 2 not supported");
    this.gl = gl;
    this.textureUnits = [
      gl.TEXTURE0, gl.TEXTURE1, gl.TEXTURE2, gl.TEXTURE3, gl.TEXTURE4, gl.TEXTURE5, gl.TEXTURE6, gl.TEXTURE7,
      gl.TEXTURE8,
    ];
    this.initProgram();
  }

  /**
   * Drops every GL program and resource and rebuilds the base ones. Call it
   * after a context restore. Layer programs are compiled lazily by render().
   */
  initProgram() {
    const gl = this.gl;

    this.releaseResources();
    this.parallelCompile = gl.getExtension("KHR_parallel_shader_compile") as ParallelShaderCompile | null;
    this.halfFloatTargets = !!(
      gl.getExtension("EXT_color_buffer_float") ?? gl.getExtension("EXT_color_buffer_half_float")
    );

    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    this.quadBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Start the post program now so it compiles alongside the first layer
    // program. Without the extension that blocks, so check it here, where
    // a broken shader has always failed.
    const post = this.getPostProgram();
    if (!this.parallelCompile) this.isProgramReady(post);
  }

  /** Deletes everything initProgram() and the lazy init* methods created. */
  private releaseResources() {
    const gl = this.gl;
    this.destroyFeedbackFBOs();
    this.destroyTrailFBOs();
    this.destroyBloomLevels();
    this.destroyCompositeFBOs();
    this.destroyCaptureFBO();
    this.trimPalettes(0);

    for (const record of this.layerPrograms.values()) this.disposeProgram(record);
    this.layerPrograms.clear();
    if (this.postProgram) this.disposeProgram(this.postProgram);
    this.postProgram = null;
    this.active = null;
    this.lastUniformValues.clear();
    for (const program of [this.trailProgram, this.bloomDownProgram, this.bloomUpProgram]) {
      if (program) gl.deleteProgram(program);
    }
    this.trailProgram = null;
    this.bloomDownProgram = null;
    this.bloomUpProgram = null;
    this.trailUniforms = {};
    this.bloomDownUniforms = {};
    this.bloomUpUniforms = {};

    if (this.quadVAO) gl.deleteVertexArray(this.quadVAO);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);
    if (this.gridVAO) gl.deleteVertexArray(this.gridVAO);
    for (const buffer of this.gridBuffers) gl.deleteBuffer(buffer);
    this.quadVAO = null;
    this.quadBuffer = null;
    this.gridVAO = null;
    this.gridBuffers = [];

    for (const tex of this.textureCache.values()) gl.deleteTexture(tex);
    this.textureCache.clear();
    this.textureSizes.clear();
    if (this.textMaskTexture) gl.deleteTexture(this.textMaskTexture);
    this.textMaskTexture = null;
    this.lastTextureRefs = [];
  }

  private initGridMesh() {
    const gl = this.gl;
    const subdivisions = 64;
    const extent = 1.1; // 1.1× oversize to hide displaced edges

    const vertices: number[] = [];
    for (let y = 0; y <= subdivisions; y++) {
      for (let x = 0; x <= subdivisions; x++) {
        const px = (x / subdivisions) * 2 * extent - extent;
        const py = (y / subdivisions) * 2 * extent - extent;
        vertices.push(px, py);
      }
    }

    const indices: number[] = [];
    const cols = subdivisions + 1;
    for (let y = 0; y < subdivisions; y++) {
      for (let x = 0; x < subdivisions; x++) {
        const i = y * cols + x;
        indices.push(i, i + 1, i + cols);
        indices.push(i + 1, i + cols + 1, i + cols);
      }
    }
    this.gridIndexCount = indices.length;

    this.gridVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.gridVAO);

    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
    this.gridBuffers = [vbo, ibo];

    gl.bindVertexArray(null);
  }

  private drawGeometry(useMesh: boolean) {
    const gl = this.gl;
    if (useMesh) {
      if (!this.gridVAO) this.initGridMesh();
      gl.bindVertexArray(this.gridVAO!);
      gl.drawElements(gl.TRIANGLES, this.gridIndexCount, gl.UNSIGNED_INT, 0);
    } else {
      gl.bindVertexArray(this.quadVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }

  /** Compiles and links synchronously; for the small trail and bloom programs. */
  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    const start = performance.now();
    gl.compileShader(shader);
    this.recordShaderTiming(performance.now() - start);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  /**
   * Starts compiling a layer or post program. The result is polled with
   * isProgramReady(): with KHR_parallel_shader_compile that doesn't block
   * until the compile is done; without it, the first poll does.
   */
  private createProgram(label: string, vertexSource: string, fragmentSource: string): ProgramRecord {
    const gl = this.gl;
    const startedAt = performance.now();
    // Compiling can stall the main thread (and skips frames): not a verdict on the GPU.
    this.renderScaleController?.reset(startedAt);
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram()!;
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertexSource],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      gl.attachShader(program, shader);
      shaders.push(shader);
    }
    gl.linkProgram(program);
    const record: ProgramRecord = {
      label,
      program,
      shaders,
      ready: false,
      error: null,
      startedAt,
      uniforms: {},
      colorLocations: [],
      mixLocations: [],
    };
    return record;
  }

  /**
   * Whether the program has linked. Throws with the info log if it failed.
   * Without the extension this blocks until the compile is done.
   */
  private isProgramReady(record: ProgramRecord): boolean {
    if (record.ready) return true;
    if (record.error) throw record.error;
    // getProgramParameter(LINK_STATUS) and getShaderParameter block until the
    // compile is done, so only ask for them once the extension says it is.
    const ext = this.parallelCompile;
    if (ext && !this.gl.getProgramParameter(record.program, ext.COMPLETION_STATUS_KHR)) {
      return false;
    }
    this.finishProgram(record);
    return true;
  }

  /** Waits for the program to link (blocking), then resolves its uniform locations. */
  private finishProgram(record: ProgramRecord) {
    if (record.ready) return;
    if (record.error) throw record.error;
    const gl = this.gl;

    for (const shader of record.shaders) {
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        record.error = new Error(`Shader compile failed (${record.label}): ${gl.getShaderInfoLog(shader)}`);
        throw record.error;
      }
    }
    if (!gl.getProgramParameter(record.program, gl.LINK_STATUS)) {
      record.error = new Error(`Program link failed (${record.label}): ${gl.getProgramInfoLog(record.program)}`);
      throw record.error;
    }
    for (const shader of record.shaders) {
      gl.detachShader(record.program, shader);
      gl.deleteShader(shader);
    }
    record.shaders = [];
    this.recordShaderTiming(performance.now() - record.startedAt);

    for (const name of PROGRAM_UNIFORM_NAMES) {
      const loc = gl.getUniformLocation(record.program, name);
      if (loc) record.uniforms[name] = loc;
    }
    for (let i = 0; i < 8; i++) {
      const loc = gl.getUniformLocation(record.program, `u_colors[${i}]`);
      record.colorLocations.push(loc ?? undefined);
      record.mixLocations.push(gl.getUniformLocation(record.program, `u_colorsMix[${i}]`) ?? undefined);
    }
    record.ready = true;

    // Each sampler gets its own fixed unit for good.
    this.useProgram(record);
    for (const [name, unit] of [
      ["u_prevFrame", UNIT_PREV_FRAME],
      ["u_imageTexture", UNIT_IMAGE],
      ["u_distortionMap", UNIT_DISTORTION_MAP],
      ["u_textMaskTexture", UNIT_TEXT_MASK],
      ["u_trailTexture", UNIT_TRAIL],
      ["u_compositePrev", UNIT_COMPOSITE_PREV],
      ["u_sceneTexture", UNIT_SCENE],
      ["u_paletteTexture", UNIT_PALETTE],
      ["u_bloomTexture", UNIT_BLOOM],
    ] as const) {
      this.seti(name, unit);
    }
  }

  /** Frees a program and forgets its cached uniform values. */
  private disposeProgram(record: ProgramRecord) {
    const gl = this.gl;
    for (const loc of Object.values(record.uniforms)) this.lastUniformValues.delete(loc);
    for (const loc of [...record.colorLocations, ...record.mixLocations]) {
      if (loc) this.lastUniformValues.delete(loc);
    }
    for (const shader of record.shaders) {
      gl.detachShader(record.program, shader);
      gl.deleteShader(shader);
    }
    record.shaders = [];
    if (this.active === record) {
      gl.useProgram(null);
      this.active = null;
    }
    gl.deleteProgram(record.program);
  }

  /** Binds a layer or post program; setf/seti/set2f/setMat4 then upload to it. */
  private useProgram(record: ProgramRecord) {
    if (this.active === record) return;
    this.gl.useProgram(record.program);
    this.active = record;
  }

  /** Binds a program that isn't a layer/post one (trail, bloom). */
  private useAuxProgram(program: WebGLProgram) {
    this.gl.useProgram(program);
    this.active = null;
  }

  private getPostProgram(): ProgramRecord {
    if (!this.postProgram) {
      this.postProgram = this.createProgram("post", FULLSCREEN_VERTEX_SOURCE, assemblePostSource());
    }
    return this.postProgram;
  }

  /** The program that draws `layer`: one per gradient type, or the custom one. */
  private getLayerProgram(layer: LayerParams): ProgramRecord {
    const gradientId = GRADIENT_TYPE_IDS[layer.gradientType] ?? 0;
    const key = this.customSource !== null ? "custom" : `g${gradientId}`;
    let record = this.layerPrograms.get(key);
    if (!record) {
      const source = this.customSource !== null
        ? assembleLayerSource({ custom: this.customSource })
        : assembleLayerSource(gradientId);
      record = this.createProgram(
        this.customSource !== null ? "layer custom" : `layer ${layer.gradientType}`,
        LAYER_VERTEX_SOURCE,
        source,
      );
      this.layerPrograms.set(key, record);
    }
    return record;
  }

  /**
   * Whether `state` can be drawn now, i.e. every program it needs has
   * finished compiling (compiles are started for any that haven't been).
   * render() skips frames until this is true, so the canvas keeps its last
   * frame while a new gradient type compiles. Defaults to the last state
   * rendered. Throws with the info log if a program failed to compile.
   */
  isReady(state: EngineState | null = this.lastState): boolean {
    if (!state) return this.postProgram ? this.isProgramReady(this.postProgram) : false;
    return this.programsReady(state.layers.filter((l) => l.visible));
  }

  /**
   * Whether any program is still compiling (so frames that need it are being
   * skipped). Polls every pending program, including ones no frame needs any
   * more (a type switched away from mid-compile), so they don't read as
   * compiling forever. Non-blocking: pending programs only exist when the
   * driver compiles in parallel. Cheap enough to call every frame.
   */
  isCompiling(): boolean {
    let compiling = false;
    for (const record of [this.postProgram, ...this.layerPrograms.values()]) {
      if (!record || record.ready || record.error) continue;
      try {
        if (!this.isProgramReady(record)) compiling = true;
      } catch {
        // A failed compile is reported by render() if a frame needs it.
      }
    }
    return compiling;
  }

  /** Starts compiling what a frame of `layers` draws with (each layer's program, then post) and polls it. */
  private programsReady(layers: LayerParams[]): boolean {
    if (layers.length === 0) return true;
    // Poll them all (not just until one is pending) so a failure in any surfaces.
    let ready = this.isProgramReady(this.getPostProgram());
    for (const layer of layers) {
      if (!this.isProgramReady(this.getLayerProgram(layer))) ready = false;
    }
    return ready;
  }

  private recordShaderTiming(ms: number) {
    this.metrics.lastShaderCompileMs = ms;
    this.metrics.totalShaderCompileMs += ms;
  }

  private recordFrameTiming(ms: number) {
    this.metrics.lastCpuFrameMs = ms;
    this.metrics.avgCpuFrameMs = this.metrics.avgCpuFrameMs === 0
      ? ms
      : this.metrics.avgCpuFrameMs * 0.9 + ms * 0.1;
  }

  private assertFramebufferComplete(label: string) {
    const gl = this.gl;
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`${label} framebuffer incomplete: 0x${status.toString(16)}`);
    }
  }

  /**
   * The pointer is at (x, y): uv, 0..1 with y up. Counts as the pointer being
   * present; setPointerActive(false) says it left. Nothing reacts until this
   * is first called, and the first call jumps there instead of sweeping in.
   */
  setMouse(x: number, y: number) {
    setPointerTarget(this.pointer, x, y);
  }

  /** The pointer entered (true) or left (false) the canvas. The effects ease out where the pointer was. */
  setPointerActive(active: boolean) {
    setPointerPresent(this.pointer, active);
  }

  /** A click at (x, y), uv with y up. The ripple runs on real seconds, so it plays while paused too. */
  triggerRipple(x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.rippleOriginX = x;
    this.rippleOriginY = y;
    this.rippleAge = 0;
  }

  /**
   * Advances everything that runs on real time by `dt` seconds: the pointer
   * smoother and presence, the ripple, and the trail's pending decay. startLoop
   * calls this every frame, paused or not; call it directly to drive the pointer
   * without a loop (stills, tests).
   */
  advancePointer(dt: number) {
    const step = Number.isFinite(dt) ? Math.max(dt, 0) : 0;
    this.pointerMoving = stepPointer(this.pointer, step);
    this.rippleAge = Math.min(this.rippleAge + step, RIPPLE_DURATION);
    this.trailPendingDt = Math.min(this.trailPendingDt + step, 0.1);
    this.trailHot = Math.max(this.trailHot - step, 0);
  }

  /** Jumps the smoothed pointer and its presence to where they are heading, at rest. For captures and tests. */
  settlePointer() {
    settlePointer(this.pointer);
    this.pointerMoving = false;
  }

  /**
   * Whether `state` still has pointer-driven visuals changing, so a paused
   * loop has to keep drawing: the smoother or presence settling, a ripple
   * running or a trail fading. False once they have come to rest.
   */
  isPointerAnimating(state: EngineState): boolean {
    return (
      this.pointerMoving ||
      (state.rippleEnabled && this.rippleAge < RIPPLE_DURATION) ||
      (state.trailEnabled && this.trailHot > 0)
    );
  }

  setElapsedTime(t: number) {
    this.elapsedTime = t;
  }

  setSpeedMultiplier(multiplier: number) {
    this.speedMultiplier = multiplier;
  }

  setMaxPixelRatio(ratio: number) {
    this.maxPixelRatio = Math.max(1, Math.min(3, ratio));
    const canvas = this.gl.canvas as HTMLCanvasElement;
    this.resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);
  }

  setMaxFrameRate(fps: number) {
    const clamped = Math.max(24, Math.min(120, fps));
    this.minFrameIntervalMs = 1000 / clamped;
  }

  /**
   * Draws the layers at `scale` (0.25-1) of the canvas size and upsamples them
   * for the global effects, which stay at full resolution: gradients are
   * smooth, so this costs little sharpness and a lot less fill. Fixed; it ends
   * adaptive scaling. Captures and exports always draw at 1 (see CaptureOptions).
   * Layers that need full resolution ignore it (FULL_RESOLUTION_GRADIENTS,
   * Custom GLSL, uploaded pictures), and text masks keep it at 0.8 or above.
   */
  setRenderScale(scale: number) {
    this.renderScaleController = null;
    this.renderScale = Math.min(1, Math.max(MIN_RENDER_SCALE, Number.isFinite(scale) ? scale : 1));
  }

  /**
   * Lets the engine choose the render scale from how the render loop is doing,
   * between 1 and `options.minScale` (default 0.6): it drops a step when more
   * than a quarter of the frames in the last second arrive late for
   * `options.targetFps`, and rises again after a couple of calm seconds, with a
   * longer wait each time a rise did not hold. Only frames drawn by startLoop()
   * count. Pass null to stop and return to full resolution.
   */
  setAdaptiveRenderScale(options: RenderScaleOptions | null) {
    if (!options) {
      this.renderScaleController = null;
      this.renderScale = 1;
      return;
    }
    const controller = new RenderScaleController(options, performance.now());
    this.renderScaleController = controller;
    this.renderScale = controller.scale;
  }

  /** The render scale asked for: the fixed one, or what the adaptive controller has chosen. */
  getRenderScale(): number {
    return this.renderScale;
  }

  resize(width: number, height: number) {
    const gl = this.gl;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    const nextWidth = Math.max(1, Math.floor(width * dpr));
    const nextHeight = Math.max(1, Math.floor(height * dpr));
    if (gl.canvas.width !== nextWidth || gl.canvas.height !== nextHeight) {
      gl.canvas.width = nextWidth;
      gl.canvas.height = nextHeight;
      this.renderScaleController?.reset(performance.now());
    }
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  private initFeedbackFBOs() {
    const gl = this.gl;
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    this.destroyFeedbackFBOs();

    const textures: WebGLTexture[] = [];
    const fbos: WebGLFramebuffer[] = [];

    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textures.push(tex);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this.assertFramebufferComplete(`feedback-${i}`);
      fbos.push(fbo);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.feedbackFBOs = [fbos[0], fbos[1]];
    this.feedbackTextures = [textures[0], textures[1]];
    this.feedbackWidth = width;
    this.feedbackHeight = height;
    this.feedbackIndex = 0;
  }

  private destroyFeedbackFBOs() {
    const gl = this.gl;
    if (this.feedbackFBOs) {
      gl.deleteFramebuffer(this.feedbackFBOs[0]);
      gl.deleteFramebuffer(this.feedbackFBOs[1]);
    }
    if (this.feedbackTextures) {
      gl.deleteTexture(this.feedbackTextures[0]);
      gl.deleteTexture(this.feedbackTextures[1]);
    }
    this.feedbackFBOs = null;
    this.feedbackTextures = null;
  }

  private initTrailProgram() {
    const gl = this.gl;
    const vertShader = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SOURCE);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, trailFragSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    const linkStart = performance.now();
    gl.linkProgram(program);
    this.recordShaderTiming(performance.now() - linkStart);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      throw new Error(`Trail program link failed: ${log}`);
    }

    this.trailProgram = program;
    this.trailUniforms = {};
    const names = [
      "u_trailPrev", "u_trailDecay", "u_trailFloor", "u_trailFrom", "u_trailTo",
      "u_trailWidth", "u_trailAspect", "u_trailStamp",
    ];
    for (const name of names) {
      const loc = gl.getUniformLocation(program, name);
      if (loc) this.trailUniforms[name] = loc;
    }
  }

  private initTrailFBOs() {
    const gl = this.gl;
    // Trail at 1/4 resolution for performance
    const width = Math.max(1, Math.floor(gl.canvas.width / 4));
    const height = Math.max(1, Math.floor(gl.canvas.height / 4));
    this.destroyTrailFBOs();

    const textures: WebGLTexture[] = [];
    const fbos: WebGLFramebuffer[] = [];

    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textures.push(tex);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this.assertFramebufferComplete(`trail-${i}`);
      fbos.push(fbo);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.trailFBOs = [fbos[0], fbos[1]];
    this.trailTextures = [textures[0], textures[1]];
    this.trailWidth = width;
    this.trailHeight = height;
    this.trailIndex = 0;
  }

  private destroyTrailFBOs() {
    const gl = this.gl;
    if (this.trailFBOs) {
      gl.deleteFramebuffer(this.trailFBOs[0]);
      gl.deleteFramebuffer(this.trailFBOs[1]);
    }
    if (this.trailTextures) {
      gl.deleteTexture(this.trailTextures[0]);
      gl.deleteTexture(this.trailTextures[1]);
    }
    this.trailFBOs = null;
    this.trailTextures = null;
  }

  /** Compiles and links one of the small fullscreen programs (trail, bloom) and looks up `names`. */
  private createAuxProgram(label: string, fragmentSource: string, names: string[]): [WebGLProgram, UniformMap] {
    const gl = this.gl;
    const vert = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SOURCE);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    const linkStart = performance.now();
    gl.linkProgram(program);
    this.recordShaderTiming(performance.now() - linkStart);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`${label} link failed: ${gl.getProgramInfoLog(program)}`);
    }
    const uniforms: UniformMap = {};
    for (const name of names) {
      const loc = gl.getUniformLocation(program, name);
      if (loc) uniforms[name] = loc;
    }
    return [program, uniforms];
  }

  private initBloomPrograms() {
    [this.bloomDownProgram, this.bloomDownUniforms] = this.createAuxProgram(
      "Bloom downsample",
      bloomDownSource,
      ["u_source", "u_sourceTexel", "u_sourceScale", "u_threshold"],
    );
    [this.bloomUpProgram, this.bloomUpUniforms] = this.createAuxProgram(
      "Bloom upsample",
      bloomUpSource,
      ["u_source", "u_sourceTexel", "u_weight"],
    );
  }

  /**
   * The bloom pyramid for the current canvas: level 0 at half its size, each
   * level below at half the one above, while both sides stay at least 2 px
   * (BLOOM_MAX_LEVELS at most). Half-float where the composite targets are,
   * so the light keeps its precision down the chain.
   */
  private ensureBloomLevels() {
    const gl = this.gl;
    if (this.bloomLevels.length > 0 &&
        this.bloomCanvasWidth === gl.canvas.width &&
        this.bloomCanvasHeight === gl.canvas.height) {
      return;
    }
    this.destroyBloomLevels();
    // Allocate on unit 0, which the post pass binds afresh, not on whatever unit is active.
    gl.activeTexture(this.textureUnits[0]);
    let width = Math.max(1, Math.ceil(gl.canvas.width / 2));
    let height = Math.max(1, Math.ceil(gl.canvas.height / 2));
    while (this.bloomLevels.length < BLOOM_MAX_LEVELS && (this.bloomLevels.length === 0 || (width >= 2 && height >= 2))) {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (this.halfFloatTargets) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      this.bloomLevels.push({ fbo, texture, width, height });
      this.assertFramebufferComplete(`bloom-${this.bloomLevels.length - 1}`);
      width = Math.max(1, Math.floor(width / 2));
      height = Math.max(1, Math.floor(height / 2));
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.bloomCanvasWidth = gl.canvas.width;
    this.bloomCanvasHeight = gl.canvas.height;
  }

  private destroyBloomLevels() {
    const gl = this.gl;
    for (const level of this.bloomLevels) {
      gl.deleteFramebuffer(level.fbo);
      gl.deleteTexture(level.texture);
    }
    this.bloomLevels = [];
  }

  private static readonly BLEND_MODE_MAP: Record<BlendMode, number> = {
    normal: 0, multiply: 1, screen: 2, overlay: 3, add: 4,
    darken: 5, colorBurn: 6, linearBurn: 7, darkerColor: 8,
    lighten: 9, colorDodge: 10, lighterColor: 11,
    softLight: 12, hardLight: 13, vividLight: 14, linearLight: 15, pinLight: 16, hardMix: 17,
    difference: 18, exclusion: 19, subtract: 20, divide: 21,
    hue: 22, saturation: 23, color: 24, luminosity: 25,
  };

  private ensureCompositeFBOs() {
    const gl = this.gl;
    const width = gl.canvas.width;
    const height = gl.canvas.height;
    if (this.compositeFBOs && this.compositeWidth === width && this.compositeHeight === height) {
      return;
    }
    this.destroyCompositeFBOs();

    // Half-float targets keep the layers' colour unquantized for the post
    // pass (deband, brightness, tone mapping). Fall back to RGBA8 if the
    // driver won't render to them.
    let targets = this.halfFloatTargets ? this.createCompositeTargets(width, height, true) : null;
    if (!targets) {
      this.halfFloatTargets = false;
      targets = this.createCompositeTargets(width, height, false);
    }
    if (!targets) throw new Error("composite framebuffer incomplete");

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.compositeFBOs = targets.fbos;
    this.compositeTextures = targets.textures;
    this.compositeWidth = width;
    this.compositeHeight = height;
  }

  /**
   * The fraction of the composite targets the layers of this frame are drawn
   * into, from their lower-left corner: the capture scale while capturing
   * (1 unless asked otherwise), else the live render scale, and 1 whenever a
   * layer needs full resolution (see FULL_RESOLUTION_GRADIENTS), since the
   * pass would otherwise change how it looks.
   */
  private layerPassScale(layers: LayerParams[]): number {
    let scale = this.captureScale ?? this.renderScale;
    if (scale >= 1 || this.customSource !== null) return 1;
    for (const layer of layers) {
      if (FULL_RESOLUTION_GRADIENTS.has(layer.gradientType) || layer.imageData) return 1;
      if (layer.textMaskEnabled) scale = Math.max(scale, TEXT_MASK_MIN_SCALE);
    }
    return scale;
  }

  /** Two filterable colour targets, or null (and nothing left allocated) if incomplete. */
  private createCompositeTargets(
    width: number,
    height: number,
    halfFloat: boolean,
  ): { fbos: [WebGLFramebuffer, WebGLFramebuffer]; textures: [WebGLTexture, WebGLTexture] } | null {
    const gl = this.gl;
    const textures: WebGLTexture[] = [];
    const fbos: WebGLFramebuffer[] = [];

    for (let i = 0; i < 2; i++) {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (halfFloat) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      textures.push(tex);

      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      fbos.push(fbo);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        for (const f of fbos) gl.deleteFramebuffer(f);
        for (const t of textures) gl.deleteTexture(t);
        return null;
      }
    }
    return { fbos: [fbos[0], fbos[1]], textures: [textures[0], textures[1]] };
  }

  private destroyCompositeFBOs() {
    const gl = this.gl;
    if (this.compositeFBOs) {
      gl.deleteFramebuffer(this.compositeFBOs[0]);
      gl.deleteFramebuffer(this.compositeFBOs[1]);
    }
    if (this.compositeTextures) {
      gl.deleteTexture(this.compositeTextures[0]);
      gl.deleteTexture(this.compositeTextures[1]);
    }
    this.compositeFBOs = null;
    this.compositeTextures = null;
  }

  /**
   * Builds the cinematic bloom pyramid from the composited scene: down the
   * levels (the first pass keeps the light above BLOOM_THRESHOLD, in linear
   * light), then back up, each level blurred into the one above, so level 0
   * holds the light spread at every scale. The post pass adds it back. Reads
   * the drawn corner of the scene at a reduced render scale; the pyramid
   * itself is always sized from the canvas.
   */
  private renderBloomPyramid(sceneTexture: WebGLTexture, sceneScaleX: number, sceneScaleY: number) {
    const gl = this.gl;
    if (!this.bloomDownProgram) this.initBloomPrograms();
    this.ensureBloomLevels();
    const levels = this.bloomLevels;

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);
    this.useAuxProgram(this.bloomDownProgram!);
    const du = this.bloomDownUniforms;
    if (du["u_source"]) gl.uniform1i(du["u_source"], 0);
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const sourceWidth = i === 0 ? this.compositeWidth : levels[i - 1].width;
      const sourceHeight = i === 0 ? this.compositeHeight : levels[i - 1].height;
      gl.bindFramebuffer(gl.FRAMEBUFFER, level.fbo);
      gl.viewport(0, 0, level.width, level.height);
      this.bindTexture(0, i === 0 ? sceneTexture : levels[i - 1].texture);
      if (du["u_sourceTexel"]) gl.uniform2f(du["u_sourceTexel"], 1 / sourceWidth, 1 / sourceHeight);
      if (du["u_sourceScale"]) gl.uniform2f(du["u_sourceScale"], i === 0 ? sceneScaleX : 1, i === 0 ? sceneScaleY : 1);
      if (du["u_threshold"]) gl.uniform1f(du["u_threshold"], i === 0 ? BLOOM_THRESHOLD : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    // Back up: add each level, tent-blurred, into the one above.
    this.useAuxProgram(this.bloomUpProgram!);
    const uu = this.bloomUpUniforms;
    if (uu["u_source"]) gl.uniform1i(uu["u_source"], 0);
    if (uu["u_weight"]) gl.uniform1f(uu["u_weight"], BLOOM_LEVEL_FALLOFF);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = levels.length - 1; i > 0; i--) {
      const target = levels[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.width, target.height);
      this.bindTexture(0, levels[i].texture);
      if (uu["u_sourceTexel"]) gl.uniform2f(uu["u_sourceTexel"], 1 / levels[i].width, 1 / levels[i].height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND);
    this.bindTexture(0, null);
  }

  /**
   * Advances the trail field by the pointer time elapsed since the last call
   * (advancePointer accumulates it): the previous energy decays frame-rate
   * independently, and the pointer stamps a soft line from where it was to
   * where it is. render() calls this, and does nothing when no time has passed,
   * so redrawing the same moment (an export capture, a paused repaint) never
   * ages the trail. Allocates the field when the trail is on.
   */
  updateTrail(state: EngineState) {
    const gl = this.gl;
    if (!state.trailEnabled) {
      // Nothing to keep: drop the field, so enabling the trail again starts clean.
      this.destroyTrailFBOs();
      this.trailPendingDt = 0;
      this.trailStampLive = false;
      return;
    }

    // Lazy init
    if (!this.trailProgram) this.initTrailProgram();
    const expectedW = Math.max(1, Math.floor(gl.canvas.width / 4));
    const expectedH = Math.max(1, Math.floor(gl.canvas.height / 4));
    if (!this.trailFBOs || this.trailWidth !== expectedW || this.trailHeight !== expectedH) {
      this.initTrailFBOs();
    }

    const dt = this.trailPendingDt;
    if (dt <= 0) return;
    this.trailPendingDt = 0;

    const pointer = this.pointer;
    const moving = this.pointerMoving;
    const toX = pointer.x.value;
    const toY = pointer.y.value;
    // Faint under a still pointer, full strength once it moves at about a canvas height per second.
    const [vx, vy] = pointerVelocity(pointer, expectedW / expectedH);
    const speed = Math.min(Math.hypot(vx, vy) / POINTER_SPEED_REF, 1);
    const stamp = pointer.presence.value * (0.12 + 0.88 * speed);
    // A pointer that just entered stamps a dot, not a line from wherever it last was.
    const fromX = this.trailStampLive ? this.trailStampX : toX;
    const fromY = this.trailStampLive ? this.trailStampY : toY;
    this.trailStampX = toX;
    this.trailStampY = toY;
    this.trailStampLive = pointer.presence.value > 0.05;
    // Keep a paused loop drawing while the stroke fades (decay 0.96 per frame takes about 2 s to reach 1/255).
    if (moving) {
      const perFrame = Math.min(Math.max(state.trailLength, 0.5), 0.995);
      this.trailHot = Math.min(Math.log(1 / 255) / (60 * Math.log(perFrame)), 12);
    }

    const read = this.trailIndex;
    const write = 1 - this.trailIndex;

    this.useAuxProgram(this.trailProgram!);
    gl.bindVertexArray(this.quadVAO);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFBOs![write]);
    gl.viewport(0, 0, this.trailWidth, this.trailHeight);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTextures![read]);
    const tu = this.trailUniforms;
    if (tu["u_trailPrev"]) gl.uniform1i(tu["u_trailPrev"], 0);
    if (tu["u_trailDecay"]) gl.uniform1f(tu["u_trailDecay"], Math.pow(state.trailLength, dt * 60));
    if (tu["u_trailFloor"]) gl.uniform1f(tu["u_trailFloor"], TRAIL_FLOOR_PER_FRAME * dt * 60);
    if (tu["u_trailFrom"]) gl.uniform2f(tu["u_trailFrom"], fromX, fromY);
    if (tu["u_trailTo"]) gl.uniform2f(tu["u_trailTo"], toX, toY);
    if (tu["u_trailWidth"]) gl.uniform1f(tu["u_trailWidth"], Math.max(state.trailWidth, 1e-3));
    if (tu["u_trailAspect"]) gl.uniform1f(tu["u_trailAspect"], expectedW / expectedH);
    if (tu["u_trailStamp"]) gl.uniform1f(tu["u_trailStamp"], stamp);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // The field just written is the one the post pass reads.
    this.trailIndex = write;
  }

  /**
   * The texture of a picture, uploaded on first use (null until it has loaded).
   * `profile`: the colour space its colours are converted into on upload, the
   * scene's for a picture; a distortion map is data, not colour, and stays as
   * it is ("srgb", the browser's default).
   */
  loadImageTexture(dataURL: string, profile: ColorProfile = "srgb"): WebGLTexture | null {
    const key = imageTextureKey(dataURL, profile);
    if (this.textureCache.has(key)) {
      return this.textureCache.get(key)!;
    }
    if (this.pendingLoads.has(key)) {
      return null;
    }
    this.pendingLoads.add(key);
    const img = new Image();
    img.onload = () => {
      this.pendingLoads.delete(key);
      const gl = this.gl;
      let source: TexImageSource = img;
      let uploadWidth = img.width;
      let uploadHeight = img.height;
      if (img.width > 2048 || img.height > 2048) {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(2048 / img.width, 2048 / img.height);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        source = canvas;
        uploadWidth = canvas.width;
        uploadHeight = canvas.height;
      }
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      // Where the browser can't convert on upload, the picture goes in as it is.
      if ("unpackColorSpace" in gl) gl.unpackColorSpace = profile;
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      if ("unpackColorSpace" in gl) gl.unpackColorSpace = "srgb";
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.textureCache.set(key, tex);
      this.textureSizes.set(key, { width: uploadWidth, height: uploadHeight });
    };
    img.src = dataURL;
    return null;
  }

  updateTextMaskTexture(canvas: HTMLCanvasElement) {
    const gl = this.gl;
    if (!this.textMaskTexture) {
      this.textMaskTexture = gl.createTexture()!;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.textMaskTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Replaces the gradient of every layer with `code`, the body of
   * `vec3 customGradient(vec2 uv, float time)`, or reverts with null. Compiles
   * synchronously so the result can report errors; the built-in gradient
   * functions aren't available to it, only the helpers (fbm, getGradientColor,
   * mouse displacement, ...). A failed compile leaves the current shader as is.
   */
  setCustomShader(code: string | null): { success: boolean; error?: string } {
    if (code === null) {
      this.customSource = null;
      const previous = this.layerPrograms.get("custom");
      if (previous) this.disposeProgram(previous);
      this.layerPrograms.delete("custom");
      return { success: true };
    }

    const record = this.createProgram("layer custom", LAYER_VERTEX_SOURCE, assembleLayerSource({ custom: code }));
    try {
      this.finishProgram(record);
    } catch (e) {
      this.disposeProgram(record);
      const msg = e instanceof Error ? e.message : "Compilation failed";
      // Report just the GLSL log, without the "Shader compile failed (...):" prefix.
      return { success: false, error: msg.replace(/^(Shader compile|Program link) failed \([^)]*\):\s*/, "") };
    }

    const previous = this.layerPrograms.get("custom");
    if (previous) this.disposeProgram(previous);
    this.layerPrograms.set("custom", record);
    this.customSource = code;
    return { success: true };
  }

  cleanupTextures(layers: LayerParams[], profile: ColorProfile = this.canvasProfile) {
    const referenced = new Set<string>();
    for (const layer of layers) {
      if (layer.imageData) referenced.add(imageTextureKey(layer.imageData, profile));
      if (layer.distortionMapData) referenced.add(layer.distortionMapData);
    }
    for (const [key, tex] of this.textureCache) {
      if (!referenced.has(key)) {
        this.gl.deleteTexture(tex);
        this.textureCache.delete(key);
        this.textureSizes.delete(key);
      }
    }
  }

  getMetrics(): EngineMetrics {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const resources: GpuResourceSample[] = [];

    if (this.feedbackFBOs) {
      resources.push({ kind: "framebuffer", count: 2 });
      resources.push({ kind: "texture", width: this.feedbackWidth, height: this.feedbackHeight, count: 2 });
    }
    if (this.trailFBOs) {
      resources.push({ kind: "framebuffer", count: 2 });
      resources.push({ kind: "texture", width: this.trailWidth, height: this.trailHeight, count: 2 });
    }
    if (this.bloomLevels.length > 0) {
      resources.push({ kind: "framebuffer", count: this.bloomLevels.length });
      for (const level of this.bloomLevels) {
        resources.push({
          kind: "texture",
          width: level.width,
          height: level.height,
          count: 1,
          bytesPerPixel: this.halfFloatTargets ? 8 : 4,
        });
      }
    }
    if (this.compositeFBOs) {
      resources.push({ kind: "framebuffer", count: 2 });
      resources.push({
        kind: "texture",
        width: this.compositeWidth,
        height: this.compositeHeight,
        count: 2,
        bytesPerPixel: this.halfFloatTargets ? 8 : 4,
      });
    }
    if (this.textMaskTexture) {
      resources.push({ kind: "texture", width: canvas.width, height: canvas.height, count: 1 });
    }
    for (const size of this.textureSizes.values()) {
      resources.push({ kind: "texture", width: size.width, height: size.height, count: 1 });
    }

    const summary = summarizeGpuResources(resources);

    const programs = [...this.layerPrograms.values()];
    if (this.postProgram) programs.push(this.postProgram);

    return {
      ...this.metrics,
      ...summary,
      programCount: programs.length,
      pendingPrograms: programs.filter((program) => !program.ready && !program.error).length,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      renderScale: this.drawnScale,
      maxPixelRatio: this.maxPixelRatio,
      frameRateCap: Math.round(1000 / this.minFrameIntervalMs),
    };
  }

  private shouldCleanupTextures(layers: LayerParams[], nowMs: number) {
    const refs: (string | null)[] = [];
    for (const layer of layers) {
      refs.push(layer.imageData ?? null, layer.distortionMapData ?? null);
    }

    let refsChanged = refs.length !== this.lastTextureRefs.length;
    if (!refsChanged) {
      for (let i = 0; i < refs.length; i++) {
        if (refs[i] !== this.lastTextureRefs[i]) {
          refsChanged = true;
          break;
        }
      }
    }

    const intervalElapsed =
      nowMs - this.lastTextureCleanupMs >= GradientEngine.TEXTURE_CLEANUP_INTERVAL_MS;

    if (!refsChanged && !intervalElapsed) return false;

    this.lastTextureRefs = refs;
    this.lastTextureCleanupMs = nowMs;
    return true;
  }

  /**
   * Records `a`..`c` (the first `count` of them) as the value of `loc` and
   * returns whether that differs from what was last uploaded.
   */
  private uniformChanged(loc: WebGLUniformLocation, count: number, a: number, b = 0, c = 0): boolean {
    const last = this.lastUniformValues.get(loc);
    if (last === undefined) {
      this.lastUniformValues.set(loc, [a, b, c]);
      return true;
    }
    if (last[0] === a && (count < 2 || last[1] === b) && (count < 3 || last[2] === c)) {
      return false;
    }
    last[0] = a;
    last[1] = b;
    last[2] = c;
    return true;
  }

  // Uniform setters. They upload to the layer/post program last bound with
  // useProgram(), skipping unchanged values. Always set uniforms through these
  // (never a raw gl.uniform* call on those programs), or the cache desyncs.
  private setf(name: string, val: number) {
    const loc = this.active?.uniforms[name];
    if (loc !== undefined && this.uniformChanged(loc, 1, val)) this.gl.uniform1f(loc, val);
  }

  private seti(name: string, val: number) {
    const loc = this.active?.uniforms[name];
    if (loc !== undefined && this.uniformChanged(loc, 1, val)) this.gl.uniform1i(loc, val);
  }

  private set2f(name: string, x: number, y: number) {
    const loc = this.active?.uniforms[name];
    if (loc !== undefined && this.uniformChanged(loc, 2, x, y)) this.gl.uniform2f(loc, x, y);
  }

  private setMat4(name: string, val: Float32Array) {
    const loc = this.active?.uniforms[name];
    if (loc === undefined) return;
    const last = this.lastUniformValues.get(loc);
    if (last !== undefined && last.length === 16 && last.every((v, i) => v === val[i])) return;
    this.lastUniformValues.set(loc, Array.from(val));
    this.gl.uniformMatrix4fv(loc, false, val);
  }

  private bindTexture(unit: number, texture: WebGLTexture | null) {
    this.gl.activeTexture(this.textureUnits[unit]);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
  }

  /**
   * Binds the baked palette of the layer in slot `slot` (its position among
   * the visible layers) to the palette unit and sets `u_paletteDomain` on the
   * program in use. The table is baked again only when the layer's colours,
   * the colour blend or softness, or the Oklab switch differ from what was
   * baked, so a frame with an unchanged palette uploads nothing.
   */
  private bindPalette(slot: number, layer: LayerParams, state: EngineState) {
    const gl = this.gl;
    const blend = effectiveBlend(state.colorBlend, layer.softness);
    let entry = this.palettes[slot];
    if (!entry) {
      entry = {
        texture: gl.createTexture()!,
        allocated: false,
        key: createPaletteKey(),
        domainScale: 1,
        domainBias: 0,
      };
      this.palettes[slot] = entry;
    }

    this.bindTexture(UNIT_PALETTE, entry.texture);
    const displayP3 = state.colorProfile === "display-p3";
    if (!entry.allocated || !paletteKeyMatches(entry.key, layer.colors, state.oklabEnabled, blend, displayP3)) {
      bakePalette(layer.colors, state.oklabEnabled, blend, this.paletteData, displayP3);
      if (entry.allocated) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, PALETTE_SIZE, 1, gl.RGBA, gl.FLOAT, this.paletteData);
      } else {
        // Half-float: unquantized colour, and linearly filterable without extensions in WebGL 2.
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, PALETTE_SIZE, 1, 0, gl.RGBA, gl.FLOAT, this.paletteData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        entry.allocated = true;
      }
      setPaletteKey(entry.key, layer.colors, state.oklabEnabled, blend, displayP3);
      const domain = paletteDomain(blend);
      entry.domainScale = domain.scale;
      entry.domainBias = domain.bias;
    }
    this.set2f("u_paletteDomain", entry.domainScale, entry.domainBias);
  }

  /** Frees the palette textures of slots from `count` on (layers that were removed or hidden). */
  private trimPalettes(count: number) {
    while (this.palettes.length > count) {
      this.gl.deleteTexture(this.palettes.pop()!.texture);
    }
  }

  /** The raw stops, for the gradients that read `u_colors` / `u_colorsMix` themselves. */
  private setPalette(layer: LayerParams, oklab: boolean, displayP3: boolean) {
    const record = this.active;
    if (!record) return;
    this.setf("u_softness", layer.softness);
    this.seti("u_colorCount", layer.colors.length);
    const colorCount = Math.min(layer.colors.length, record.colorLocations.length);
    for (let i = 0; i < colorCount; i++) {
      const loc = record.colorLocations[i];
      const color = layer.colors[i];
      if (loc !== undefined && this.uniformChanged(loc, 3, color[0], color[1], color[2])) {
        this.gl.uniform3f(loc, color[0], color[1], color[2]);
      }
      const mixLoc = record.mixLocations[i];
      if (mixLoc !== undefined) {
        const mix = toMixSpace(color, oklab, displayP3);
        if (this.uniformChanged(mixLoc, 3, mix[0], mix[1], mix[2])) {
          this.gl.uniform3f(mixLoc, mix[0], mix[1], mix[2]);
        }
      }
    }
  }

  private setLayerUniforms(layer: LayerParams, oklab: boolean, profile: ColorProfile) {
    this.setf("u_speed", layer.speed);
    this.setf("u_complexity", layer.complexity);
    this.setf("u_scale", layer.scale);
    this.setf("u_distortion", layer.distortion);
    this.setPalette(layer, oklab, profile === "display-p3");
    this.setf("u_layerOpacity", layer.opacity);
    // Parallax depth (per-layer)
    this.setf("u_layerDepth", layer.depth);

    // Image texture
    const imageTex = layer.imageData ? this.loadImageTexture(layer.imageData, profile) : null;
    if (imageTex) {
      this.bindTexture(UNIT_IMAGE, imageTex);
      this.setf("u_hasImage", 1.0);
    } else {
      this.setf("u_hasImage", 0.0);
    }

    // Distortion map
    const distortionTex = (layer.distortionMapEnabled && layer.distortionMapData)
      ? this.loadImageTexture(layer.distortionMapData)
      : null;
    if (distortionTex) {
      this.bindTexture(UNIT_DISTORTION_MAP, distortionTex);
      this.setf("u_hasDistortionMap", 1.0);
    } else {
      this.setf("u_hasDistortionMap", 0.0);
    }

    // Image transform uniforms
    this.setf("u_imageScale", layer.imageScale);
    this.set2f("u_imageOffset", layer.imageOffset[0], layer.imageOffset[1]);
    this.setf("u_distortionMapIntensity", layer.distortionMapIntensity);

    this.seti("u_imageBlendMode", IMAGE_BLEND_MODE_MAP[layer.imageBlendMode] ?? 0);
    this.setf("u_imageBlendOpacity", layer.imageBlendOpacity);

    // Mask uniforms
    this.seti("u_maskEnabled", layer.maskEnabled ? 1 : 0);

    this.seti("u_mask1Type", MASK_SHAPE_MAP[layer.mask1.shape] ?? 0);
    this.set2f("u_mask1Position", layer.mask1.position[0], layer.mask1.position[1]);
    this.set2f("u_mask1Scale", layer.mask1.scale[0], layer.mask1.scale[1]);
    this.setf("u_mask1Rotation", layer.mask1.rotation);
    this.setf("u_mask1Feather", layer.mask1.feather);
    this.setf("u_mask1Invert", layer.mask1.invert ? 1.0 : 0.0);
    this.setf("u_mask1CornerRadius", layer.mask1.cornerRadius);
    this.setf("u_mask1Sides", layer.mask1.sides);
    this.setf("u_mask1StarInner", layer.mask1.starInnerRadius);
    this.setf("u_mask1NoiseDist", layer.mask1.noiseDistortion);

    this.seti("u_mask2Type", MASK_SHAPE_MAP[layer.mask2.shape] ?? 0);
    this.set2f("u_mask2Position", layer.mask2.position[0], layer.mask2.position[1]);
    this.set2f("u_mask2Scale", layer.mask2.scale[0], layer.mask2.scale[1]);
    this.setf("u_mask2Rotation", layer.mask2.rotation);
    this.setf("u_mask2Feather", layer.mask2.feather);
    this.setf("u_mask2Invert", layer.mask2.invert ? 1.0 : 0.0);
    this.setf("u_mask2CornerRadius", layer.mask2.cornerRadius);
    this.setf("u_mask2Sides", layer.mask2.sides);
    this.setf("u_mask2StarInner", layer.mask2.starInnerRadius);
    this.setf("u_mask2NoiseDist", layer.mask2.noiseDistortion);

    this.seti("u_maskBlendMode", MASK_BLEND_MODE_MAP[layer.maskBlendMode] ?? 0);
    this.setf("u_maskSmoothness", layer.maskSmoothness);

    // Text mask
    this.setf("u_textMaskEnabled", layer.textMaskEnabled ? 1.0 : 0.0);
    if (layer.textMaskEnabled && this.textMaskTexture) {
      this.bindTexture(UNIT_TEXT_MASK, this.textMaskTexture);
    }
  }

  /** View-projection of the displaced mesh, with a subtle mouse-driven rotation. */
  private meshMvp(): Float32Array {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    const aspect = canvas.width / canvas.height;
    const proj = mat4Perspective(Math.PI / 3, aspect, 0.1, 100.0);
    const view = mat4LookAt([0, 0.8, 2.0], [0, 0, 0], [0, 1, 0]);
    // The pointer tilts the view only while it is present.
    const { x, y, presence } = this.pointer;
    const azimuth = (x.value - 0.5) * presence.value * 0.5;
    const elevation = (y.value - 0.5) * presence.value * 0.3;
    let mv = mat4RotateY(view, azimuth);
    mv = mat4RotateX(mv, elevation);
    return mat4Multiply(proj, mv);
  }

  /** Uniforms shared by every layer draw (the layer program is bound). `mvp` is meshMvp() when mesh distortion is on. */
  private setLayerGlobals(state: EngineState, mvp: Float32Array | null) {
    this.setf("u_time", this.elapsedTime);
    this.set2f("u_resolution", this.passWidth, this.passHeight);
    const pointer = this.pointer;
    const [velocityX, velocityY] = pointerVelocity(pointer, this.gl.canvas.width / this.gl.canvas.height);
    this.set2f("u_mouse", pointer.targetX, pointer.targetY);
    this.set2f("u_mouseSmooth", pointer.x.value, pointer.y.value);
    this.set2f("u_mouseVelocity", velocityX, velocityY);
    this.setf("u_mousePresence", pointer.presence.value);
    this.setf("u_mouseReact", state.mouseReact);
    this.setf("u_domainWarp", state.domainWarp);
    // For gradients that blend the raw stops themselves (mesh); the rest read the baked palette.
    this.seti("u_oklabEnabled", state.oklabEnabled ? 1 : 0);
    this.seti("u_displayP3", state.colorProfile === "display-p3" ? 1 : 0);
    this.setf("u_colorBlend", state.colorBlend);
    // Parallax
    this.seti("u_parallaxEnabled", state.parallaxEnabled ? 1 : 0);
    this.setf("u_parallaxStrength", state.parallaxStrength);
    // 3D Shape Projection
    this.seti("u_3dEnabled", state.threeDEnabled ? 1 : 0);
    this.seti("u_3dShape", state.threeDShape);
    this.setf("u_3dPerspective", state.threeDPerspective);
    this.setf("u_3dRotationSpeed", state.threeDRotationSpeed);
    this.setf("u_3dZoom", state.threeDZoom);
    this.setf("u_3dLighting", state.threeDLighting);
    // Rotation: auto-rotation + mouse-driven offset
    if (state.threeDEnabled) {
      const azimuth = this.rotationAngle + (pointer.x.value - 0.5) * pointer.presence.value * 2.0;
      const elevation = (pointer.y.value - 0.5) * pointer.presence.value * 1.5;
      this.set2f("u_3dRotation", azimuth, elevation);
    }
    // Mesh Distortion
    this.seti("u_meshEnabled", state.meshDistortionEnabled ? 1 : 0);
    this.setf("u_meshDisplacement", state.meshDisplacement);
    this.setf("u_meshFrequency", state.meshFrequency);
    this.setf("u_meshSpeed", state.meshSpeed);
    if (mvp) this.setMat4("u_mvp", mvp);
  }

  /**
   * Uniforms of the post program (bound). `lastLayer` supplies the clock speed
   * and, through its palette (bound by the caller), the colours the effects
   * read (reaction-diffusion), as the last layer's uniforms always carried
   * over to the global-effects draw.
   */
  private setPostUniforms(state: EngineState, lastLayer: LayerParams) {
    this.setf("u_time", this.elapsedTime);
    this.set2f("u_resolution", this.gl.canvas.width, this.gl.canvas.height);
    this.setf("u_speed", lastLayer.speed);

    this.setf("u_brightness", state.brightness);
    this.setf("u_saturation", state.saturation);
    this.seti("u_noiseEnabled", state.noiseEnabled ? 1 : 0);
    this.setf("u_noiseIntensity", state.noiseIntensity);
    this.setf("u_noiseScale", state.noiseScale);
    this.setf("u_grain", state.grain);
    this.seti("u_bloomEnabled", state.bloomEnabled ? 1 : 0);
    this.setf("u_bloomIntensity", state.bloomIntensity);
    this.setf("u_vignette", state.vignette);
    this.setf("u_radialBlurAmount", state.radialBlurAmount);
    this.seti("u_blurEnabled", state.blurEnabled ? 1 : 0);
    this.setf("u_blurAmount", state.blurAmount);
    this.setf("u_chromaticAberration", state.chromaticAberration);
    this.setf("u_hueShift", state.hueShift);
    this.seti("u_asciiEnabled", state.asciiEnabled ? 1 : 0);
    this.setf("u_asciiSize", state.asciiSize);
    this.seti("u_ditherEnabled", state.ditherEnabled ? 1 : 0);
    this.setf("u_ditherSize", state.ditherSize);
    this.seti("u_curlEnabled", state.curlEnabled ? 1 : 0);
    this.setf("u_curlIntensity", state.curlIntensity);
    this.setf("u_curlScale", state.curlScale);
    this.seti("u_kaleidoscopeEnabled", state.kaleidoscopeEnabled ? 1 : 0);
    this.setf("u_kaleidoscopeSegments", state.kaleidoscopeSegments);
    this.setf("u_kaleidoscopeRotation", state.kaleidoscopeRotation);
    this.seti("u_reactionDiffEnabled", state.reactionDiffEnabled ? 1 : 0);
    this.setf("u_reactionDiffIntensity", state.reactionDiffIntensity);
    this.setf("u_reactionDiffScale", state.reactionDiffScale);
    this.seti("u_pixelSortEnabled", state.pixelSortEnabled ? 1 : 0);
    this.setf("u_pixelSortIntensity", state.pixelSortIntensity);
    this.setf("u_pixelSortThreshold", state.pixelSortThreshold);
    this.seti("u_feedbackEnabled", state.feedbackEnabled ? 1 : 0);
    this.setf("u_feedbackDecay", state.feedbackDecay);
    this.seti("u_toneMapMode", state.toneMapMode);
    // Ripple (real seconds since the click)
    this.setf("u_rippleEnabled", state.rippleEnabled && this.rippleAge < RIPPLE_DURATION ? 1.0 : 0.0);
    this.set2f("u_rippleOrigin", this.rippleOriginX, this.rippleOriginY);
    this.setf("u_rippleTime", this.rippleAge);
    this.setf("u_rippleIntensity", state.rippleIntensity);
    // Soft glow
    this.seti("u_glowEnabled", state.glowEnabled ? 1 : 0);
    this.setf("u_glowIntensity", state.glowIntensity);
    this.setf("u_glowRadius", state.glowRadius);
    // Caustics
    this.seti("u_causticEnabled", state.causticEnabled ? 1 : 0);
    this.setf("u_causticIntensity", state.causticIntensity);
    // Trail
    this.seti("u_trailEnabled", state.trailEnabled && this.trailTextures ? 1 : 0);
    this.setf("u_trailWidth", Math.max(state.trailWidth, 1e-3));
    // Liquify
    this.seti("u_liquifyEnabled", state.liquifyEnabled ? 1 : 0);
    this.setf("u_liquifyIntensity", state.liquifyIntensity);
    this.setf("u_liquifyScale", state.liquifyScale);
    // Deband (blue-noise anti-banding) — only on the final composited output
    this.seti("u_debandEnabled", state.debandEnabled ? 1 : 0);
    this.setf("u_debandStrength", state.debandStrength);
  }

  /**
   * Presents the canvas in `profile`: its values are read as Display P3 or
   * sRGB. A browser without drawingBufferColorSpace shows them as sRGB (the
   * same hues, a little less saturated than meant).
   */
  private applyCanvasProfile(profile: ColorProfile) {
    if (profile === this.canvasProfile) return;
    this.canvasProfile = profile;
    const gl = this.gl;
    if ("drawingBufferColorSpace" in gl) gl.drawingBufferColorSpace = profile;
  }

  /**
   * Draws `state` into `output` (the canvas by default) and returns whether it
   * did. It doesn't while a program the frame needs is still compiling; the
   * canvas then keeps the last frame that was presented.
   *
   * Always the same pipeline: each visible layer is drawn by its gradient's
   * layer program into ping-pong composite targets, then the post program
   * applies the global effects to the composited image and writes the final
   * target (the canvas, the feedback target or `output`).
   */
  render(state: EngineState, output: WebGLFramebuffer | null = null): boolean {
    const gl = this.gl;
    this.lastState = state;
    if (gl.isContextLost()) return false;

    const visibleLayers = state.layers.filter((l) => l.visible);
    if (!this.programsReady(visibleLayers)) return false;
    this.applyCanvasProfile(state.colorProfile);

    // Trail field (before the main render — writes to its own targets)
    this.updateTrail(state);

    const feedbackActive = state.feedbackEnabled;

    // Set up FBO for feedback if needed
    if (feedbackActive) {
      if (!this.feedbackFBOs ||
          this.feedbackWidth !== gl.canvas.width ||
          this.feedbackHeight !== gl.canvas.height) {
        this.initFeedbackFBOs();
      }
    }

    // Final render target: feedback FBO, explicit capture FBO, or the default framebuffer
    const finalTarget = feedbackActive ? this.feedbackFBOs![this.feedbackIndex] : output;

    this.trimPalettes(visibleLayers.length);
    if (visibleLayers.length === 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      this.ensureCompositeFBOs();
      const compositeFBOs = this.compositeFBOs!;
      const compositeTextures = this.compositeTextures!;
      const mvp = state.meshDistortionEnabled ? this.meshMvp() : null;

      // The layers draw into the lower-left passWidth x passHeight corner of
      // the (full-size) composite targets; the post pass reads just that part.
      const scale = this.layerPassScale(visibleLayers);
      this.passWidth = scale < 1 ? Math.max(1, Math.round(this.compositeWidth * scale)) : this.compositeWidth;
      this.passHeight = scale < 1 ? Math.max(1, Math.round(this.compositeHeight * scale)) : this.compositeHeight;
      const compositeScaleX = this.passWidth / this.compositeWidth;
      const compositeScaleY = this.passHeight / this.compositeHeight;
      this.drawnScale = compositeScaleX;

      let writeIdx = 0;
      for (let i = 0; i < visibleLayers.length; i++) {
        const layer = visibleLayers[i];
        gl.bindFramebuffer(gl.FRAMEBUFFER, compositeFBOs[writeIdx]);
        gl.viewport(0, 0, this.passWidth, this.passHeight);
        gl.disable(gl.BLEND);
        // Pixels a layer discards (3D projection) must not keep last frame's contents.
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Never leave the texture being rendered to bound to a sampler unit:
        // WebGL rejects that draw as a feedback loop.
        this.bindTexture(UNIT_SCENE, null);
        this.bindTexture(UNIT_COMPOSITE_PREV, i === 0 ? null : compositeTextures[1 - writeIdx]);

        this.useProgram(this.getLayerProgram(layer));
        this.setLayerGlobals(state, mvp);
        this.setLayerUniforms(layer, state.oklabEnabled, state.colorProfile);
        this.bindPalette(i, layer, state);
        this.set2f("u_compositeScale", compositeScaleX, compositeScaleY);
        this.seti("u_compositeEnabled", i === 0 ? 0 : 1);
        if (i > 0) this.seti("u_blendMode", GradientEngine.BLEND_MODE_MAP[layer.blendMode] ?? 0);
        this.drawGeometry(state.meshDistortionEnabled);

        writeIdx = 1 - writeIdx;
      }
      const sceneTexture = compositeTextures[1 - writeIdx];

      // Cinematic bloom: the scene's light, spread, for the post pass to add.
      const bloomActive = state.realBloomEnabled;
      if (bloomActive) this.renderBloomPyramid(sceneTexture, compositeScaleX, compositeScaleY);
      else if (this.bloomLevels.length > 0) this.destroyBloomLevels();

      // Post pass: global effects on the composited image.
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.disable(gl.BLEND);
      this.bindTexture(UNIT_COMPOSITE_PREV, null);
      this.bindTexture(UNIT_SCENE, sceneTexture);
      const trailActive = state.trailEnabled && this.trailTextures !== null;
      if (trailActive) this.bindTexture(UNIT_TRAIL, this.trailTextures![this.trailIndex]);
      if (bloomActive) this.bindTexture(UNIT_BLOOM, this.bloomLevels[0].texture);
      if (feedbackActive) {
        // The previous frame: the feedback target we are not drawing into.
        this.bindTexture(UNIT_PREV_FRAME, this.feedbackTextures![1 - this.feedbackIndex]);
      }
      this.useProgram(this.getPostProgram());
      const lastLayer = visibleLayers[visibleLayers.length - 1];
      this.setPostUniforms(state, lastLayer);
      this.bindPalette(visibleLayers.length - 1, lastLayer, state);
      this.set2f("u_compositeScale", compositeScaleX, compositeScaleY);
      this.seti("u_realBloomEnabled", bloomActive ? 1 : 0);
      if (bloomActive) this.setf("u_realBloomGain", BLOOM_STRENGTH * bloomNormalization(this.bloomLevels.length));
      this.drawGeometry(false);

      this.bindTexture(UNIT_SCENE, null);
      if (trailActive) this.bindTexture(UNIT_TRAIL, null);
      if (bloomActive) this.bindTexture(UNIT_BLOOM, null);
      if (feedbackActive) this.bindTexture(UNIT_PREV_FRAME, null);
    }

    // Restore quad VAO as default
    this.gl.bindVertexArray(this.quadVAO);

    if (this.shouldCleanupTextures(state.layers, performance.now())) {
      this.cleanupTextures(state.layers);
    }

    // Blit FBO to screen and swap buffers
    if (feedbackActive && this.feedbackFBOs) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.feedbackFBOs[this.feedbackIndex]);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, output);
      gl.blitFramebuffer(
        0, 0, gl.canvas.width, gl.canvas.height,
        0, 0, gl.canvas.width, gl.canvas.height,
        gl.COLOR_BUFFER_BIT, gl.NEAREST
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.feedbackIndex = 1 - this.feedbackIndex;
    }

    this.framesDrawn++;
    return true;
  }

  /**
   * Renders `getState()` every animation frame. A render error (a shader that
   * failed to compile, say) stops the loop and goes to `onError`, or is thrown
   * if there is none.
   */
  startLoop(
    getState: () => EngineState,
    onFrame?: (fps: number) => void,
    onError?: (error: Error) => void,
  ) {
    this.stopLoop();
    let lastFpsUpdate = performance.now();
    let frameCount = 0;
    let lastTime = performance.now() / 1000;
    let lastRenderMs = 0;
    let lastPausedState: EngineState | null = null;

    const frame = () => {
      const state = getState();
      const nowMs = performance.now();

      if (nowMs - lastRenderMs < this.minFrameIntervalMs) {
        return;
      }

      lastRenderMs = nowMs;
      const now = nowMs / 1000;
      const dt = now - lastTime;
      lastTime = now;

      // Real-time state: the pointer smoother and presence, the ripple, the
      // trail. It runs while paused too, so the pointer keeps answering.
      this.advancePointer(dt);

      if (!state.playing) {
        // Paused: the animation clock stands still, so redraw only for a new
        // state or while the pointer, ripple or trail is still moving.
        if (state !== lastPausedState || this.isPointerAnimating(state)) {
          const renderStart = performance.now();
          // Not drawn yet (a program is still compiling): try this state again next frame.
          if (this.render(state)) {
            this.recordFrameTiming(performance.now() - renderStart);
            lastPausedState = state;
          }
        }
        return;
      }
      lastPausedState = null;

      this.elapsedTime += dt * this.speedMultiplier;

      // Accumulate 3D auto-rotation
      if (state.threeDEnabled) {
        this.rotationAngle += state.threeDRotationSpeed * dt;
      }

      const renderStart = performance.now();
      if (this.render(state)) {
        this.recordFrameTiming(performance.now() - renderStart);
        frameCount++;
      }

      if (nowMs - lastFpsUpdate >= 500) {
        const fps = Math.round((frameCount / (nowMs - lastFpsUpdate)) * 1000);
        onFrame?.(fps);
        frameCount = 0;
        lastFpsUpdate = nowMs;
      }
    };

    // Without a render (a skipped, throttled or paused frame) there is nothing
    // to time, so a gap is only ever measured from a callback that drew.
    this.lastCallbackMs = null;
    this.lastCallbackDrew = false;
    this.renderScaleController?.reset(performance.now());

    const loop = (timestamp?: number) => {
      this.animationId = requestAnimationFrame(loop);
      const drawnBefore = this.framesDrawn;
      try {
        frame();
        this.observeFrame(timestamp ?? performance.now(), this.framesDrawn !== drawnBefore);
      } catch (e) {
        this.stopLoop();
        const error = e instanceof Error ? e : new Error(String(e));
        if (!onError) throw error;
        onError(error);
      }
    };
    loop();
  }

  /**
   * Feeds the adaptive render scale one callback of the render loop. What is
   * timed is the gap from a callback that drew to the next callback: while the
   * GPU keeps up that is one display refresh, and when it does not the browser
   * holds the next frame back, so the gap stretches. (The loop's own frame cap
   * leaves gaps too, but only after callbacks that skipped, which are not timed.)
   */
  private observeFrame(nowMs: number, drew: boolean) {
    const controller = this.renderScaleController;
    if (controller && this.lastCallbackDrew && this.lastCallbackMs !== null) {
      this.renderScale = controller.sample(nowMs, nowMs - this.lastCallbackMs);
    }
    this.lastCallbackMs = nowMs;
    this.lastCallbackDrew = drew;
  }

  stopLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  private lastState: EngineState | null = null;
  private captureFBO: WebGLFramebuffer | null = null;
  private captureTex: WebGLTexture | null = null;
  private captureWidth = 0;
  private captureHeight = 0;

  private destroyCaptureFBO() {
    const gl = this.gl;
    if (this.captureFBO) {
      gl.deleteFramebuffer(this.captureFBO);
      this.captureFBO = null;
    }
    if (this.captureTex) {
      gl.deleteTexture(this.captureTex);
      this.captureTex = null;
    }
    this.captureWidth = 0;
    this.captureHeight = 0;
  }

  private ensureCaptureFBO(width: number, height: number) {
    const gl = this.gl;
    if (this.captureFBO && this.captureWidth === width && this.captureHeight === height) {
      return;
    }
    this.destroyCaptureFBO();

    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    this.assertFramebufferComplete("capture");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.captureFBO = fbo;
    this.captureTex = tex;
    this.captureWidth = width;
    this.captureHeight = height;
  }

  /** Waits for (blocking) every program `state` draws with, compiling any not yet started. */
  private compileBlocking(state: EngineState) {
    const layers = state.layers.filter((l) => l.visible);
    if (layers.length === 0) return;
    this.finishProgram(this.getPostProgram());
    for (const layer of layers) this.finishProgram(this.getLayerProgram(layer));
  }

  /**
   * Render `state` into an offscreen FBO and return RGBA bytes.
   * Reading the default framebuffer after present is racy (and on SwiftShader,
   * gl.finish()+readPixels of the backbuffer can lose the context).
   * Blocks until every program the state needs has compiled, so a capture is
   * never a skipped (blank) frame. The layers are drawn at full resolution
   * whatever the live render scale is (`renderScale` asks for less).
   */
  capturePixels(state: EngineState, renderScale = 1): Uint8Array {
    const gl = this.gl;
    const width = Math.max(1, gl.canvas.width);
    const height = Math.max(1, gl.canvas.height);
    this.compileBlocking(state);
    this.ensureCaptureFBO(width, height);
    this.captureScale = Math.min(1, Math.max(MIN_RENDER_SCALE, renderScale));
    try {
      if (!this.render(state, this.captureFBO)) throw new Error("Cannot capture a frame: WebGL context lost");
    } finally {
      this.captureScale = null;
      // The next live frames are measured afresh: this one was not paced like them.
      this.renderScaleController?.reset(performance.now());
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.captureFBO);
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return pixels;
  }

  getElapsedTime(): number {
    return this.elapsedTime;
  }

  /** Largest width/height captureImageData() can render at on this GPU. */
  getMaxCaptureSize(): number {
    const gl = this.gl;
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array | null;
    return Math.min(
      gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
      viewport ? Math.min(viewport[0], viewport[1]) : Infinity,
    );
  }

  /**
   * Render a frame offscreen and return it as top-down ImageData. Use this
   * instead of reading the canvas: with preserveDrawingBuffer off, the
   * backbuffer is cleared once a frame is presented, so toBlob()/drawImage()
   * outside the render callback can return a blank image.
   *
   * Defaults to re-rendering the most recent state at the current time and
   * canvas size. The live clock, canvas size and "current state" are
   * restored afterwards. A larger size is scaled down (keeping aspect) to fit
   * GPU limits; pixel-sized effects (grain, dither, ASCII) render finer.
   * Returns null before the first frame or while the context is lost.
   */
  captureImageData(options: CaptureOptions = {}): ImageData | null {
    const gl = this.gl;
    const state = options.state ?? this.lastState;
    if (!state || gl.isContextLost()) return null;

    const canvas = gl.canvas;
    const liveWidth = canvas.width;
    const liveHeight = canvas.height;
    const { width, height } = fitSize(
      options.width ?? liveWidth,
      options.height ?? liveHeight,
      this.getMaxCaptureSize(),
    );
    const resized = width !== liveWidth || height !== liveHeight;
    const liveTime = this.elapsedTime;
    const liveState = this.lastState;

    try {
      if (options.time !== undefined) this.elapsedTime = options.time;
      if (resized) {
        canvas.width = width;
        canvas.height = height;
      }
      const pixels = this.capturePixels(state, options.renderScale);
      // Tagged with the scene's profile, so a 2D canvas or PNG reads its values as meant.
      return new ImageData(flipRowsRGBA(pixels, width, height), width, height, { colorSpace: state.colorProfile });
    } finally {
      this.elapsedTime = liveTime;
      if (resized) {
        canvas.width = liveWidth;
        canvas.height = liveHeight;
        gl.viewport(0, 0, liveWidth, liveHeight);
        // Don't keep a full-size capture target around after a hi-res export.
        this.destroyCaptureFBO();
        // Resizing cleared the visible canvas; redraw it so a paused editor
        // isn't left blank until the next state change.
        if (liveState) {
          this.compileBlocking(liveState);
          this.render(liveState);
        }
      }
      this.lastState = liveState;
    }
  }

  destroy() {
    this.stopLoop();
    this.releaseResources();
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
