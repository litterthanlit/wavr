import trailFragSource from "./shaders/trail.glsl";
import bloomExtractSource from "./shaders/bloom-extract.glsl";
import blurSource from "./shaders/blur.glsl";
import {
  FULLSCREEN_VERTEX_SOURCE,
  LAYER_VERTEX_SOURCE,
  assembleLayerSource,
  assemblePostSource,
} from "./shader-sources";
import { BlendMode, ImageBlendMode, LayerParams, MaskBlendMode, MaskShape } from "./layers";
import {
  createEmptyEngineMetrics,
  summarizeGpuResources,
  type EngineMetrics,
  type GpuResourceSample,
} from "./instrumentation";
import { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply, flipRowsRGBA } from "./math";
import {
  PALETTE_SIZE,
  bakePalette,
  createPaletteKey,
  effectiveBlend,
  paletteDomain,
  paletteKeyMatches,
  setPaletteKey,
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
  "u_mouseReact",
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
  "u_domainWarp",
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
  "u_trailEnabled", "u_trailTexture",
  // Spec 0004: Deband (blue-noise anti-banding, on by default)
  "u_debandEnabled", "u_debandStrength",
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
  private mouseX = 0.5;
  private mouseY = 0.5;
  // Smoothed mouse for physics
  private smoothMouseX = 0.5;
  private smoothMouseY = 0.5;
  private mouseVelX = 0;
  private mouseVelY = 0;
  private prevSmoothX = 0.5;
  private prevSmoothY = 0.5;
  // Click ripple state
  private rippleOriginX = 0;
  private rippleOriginY = 0;
  private rippleStartTime = -10;
  // Spring mouse velocity (separate from smoothed velocity for physics)
  private springVelX = 0;
  private springVelY = 0;
  // 3D rotation accumulator
  private rotationAngle = 0;
  private speedMultiplier = 1.0;
  // Feedback loop FBO ping-pong
  private feedbackFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private feedbackTextures: [WebGLTexture, WebGLTexture] | null = null;
  private feedbackIndex = 0;
  private feedbackWidth = 0;
  private feedbackHeight = 0;

  // Real bloom FBO pipeline
  private bloomExtractProgram: WebGLProgram | null = null;
  private bloomBlurProgram: WebGLProgram | null = null;
  private bloomExtractUniforms: UniformMap = {};
  private bloomBlurUniforms: UniformMap = {};
  private bloomSceneFBO: WebGLFramebuffer | null = null;
  private bloomSceneTex: WebGLTexture | null = null;
  private bloomFBO_A: WebGLFramebuffer | null = null;
  private bloomTex_A: WebGLTexture | null = null;
  private bloomFBO_B: WebGLFramebuffer | null = null;
  private bloomTex_B: WebGLTexture | null = null;
  private bloomWidth = 0;
  private bloomHeight = 0;
  private bloomSceneWidth = 0;
  private bloomSceneHeight = 0;

  // Trail FBO ping-pong
  private trailProgram: WebGLProgram | null = null;
  private trailUniforms: UniformMap = {};
  private trailFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private trailTextures: [WebGLTexture, WebGLTexture] | null = null;
  private trailIndex = 0;
  private trailWidth = 0;
  private trailHeight = 0;

  // Image texture cache
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
    this.destroyBloomFBOs();
    this.destroyCompositeFBOs();
    this.destroyCaptureFBO();
    this.trimPalettes(0);

    for (const record of this.layerPrograms.values()) this.disposeProgram(record);
    this.layerPrograms.clear();
    if (this.postProgram) this.disposeProgram(this.postProgram);
    this.postProgram = null;
    this.active = null;
    this.lastUniformValues.clear();
    for (const program of [this.trailProgram, this.bloomExtractProgram, this.bloomBlurProgram]) {
      if (program) gl.deleteProgram(program);
    }
    this.trailProgram = null;
    this.bloomExtractProgram = null;
    this.bloomBlurProgram = null;
    this.trailUniforms = {};
    this.bloomExtractUniforms = {};
    this.bloomBlurUniforms = {};

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
    ] as const) {
      this.seti(name, unit);
    }
  }

  /** Frees a program and forgets its cached uniform values. */
  private disposeProgram(record: ProgramRecord) {
    const gl = this.gl;
    for (const loc of Object.values(record.uniforms)) this.lastUniformValues.delete(loc);
    for (const loc of record.colorLocations) {
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

  /** Whether any program is still compiling (so frames that need it are being skipped). Cheap enough to poll every frame. */
  isCompiling(): boolean {
    const pending = (record: ProgramRecord) => !record.ready && !record.error;
    if (this.postProgram && pending(this.postProgram)) return true;
    for (const record of this.layerPrograms.values()) {
      if (pending(record)) return true;
    }
    return false;
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

  setMouse(x: number, y: number) {
    this.mouseX = x;
    this.mouseY = y;
  }

  triggerRipple(x: number, y: number) {
    this.rippleOriginX = x;
    this.rippleOriginY = y;
    this.rippleStartTime = this.elapsedTime;
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
    const names = ["u_trailPass", "u_trailPrev", "u_trailDecay", "u_trailMouse", "u_trailWidth"];
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

  private initBloomPrograms() {
    const gl = this.gl;

    // Extract program
    const extractVert = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SOURCE);
    const extractFrag = this.compileShader(gl.FRAGMENT_SHADER, bloomExtractSource);
    const extractProg = gl.createProgram()!;
    gl.attachShader(extractProg, extractVert);
    gl.attachShader(extractProg, extractFrag);
    let linkStart = performance.now();
    gl.linkProgram(extractProg);
    this.recordShaderTiming(performance.now() - linkStart);
    if (!gl.getProgramParameter(extractProg, gl.LINK_STATUS)) {
      throw new Error(`Bloom extract link failed: ${gl.getProgramInfoLog(extractProg)}`);
    }
    this.bloomExtractProgram = extractProg;
    this.bloomExtractUniforms = {};
    for (const name of ["u_source", "u_threshold"]) {
      const loc = gl.getUniformLocation(extractProg, name);
      if (loc) this.bloomExtractUniforms[name] = loc;
    }

    // Blur program
    const blurVert = this.compileShader(gl.VERTEX_SHADER, FULLSCREEN_VERTEX_SOURCE);
    const blurFrag = this.compileShader(gl.FRAGMENT_SHADER, blurSource);
    const blurProg = gl.createProgram()!;
    gl.attachShader(blurProg, blurVert);
    gl.attachShader(blurProg, blurFrag);
    linkStart = performance.now();
    gl.linkProgram(blurProg);
    this.recordShaderTiming(performance.now() - linkStart);
    if (!gl.getProgramParameter(blurProg, gl.LINK_STATUS)) {
      throw new Error(`Bloom blur link failed: ${gl.getProgramInfoLog(blurProg)}`);
    }
    this.bloomBlurProgram = blurProg;
    this.bloomBlurUniforms = {};
    for (const name of ["u_source", "u_direction"]) {
      const loc = gl.getUniformLocation(blurProg, name);
      if (loc) this.bloomBlurUniforms[name] = loc;
    }
  }

  private initBloomFBOs() {
    const gl = this.gl;
    this.destroyBloomFBOs();

    const sceneW = gl.canvas.width;
    const sceneH = gl.canvas.height;
    const bloomW = Math.max(1, Math.floor(sceneW / 4));
    const bloomH = Math.max(1, Math.floor(sceneH / 4));

    // Scene FBO (full res — captures rendered gradient)
    this.bloomSceneTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.bloomSceneTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sceneW, sceneH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.bloomSceneFBO = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomSceneFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.bloomSceneTex, 0);
    this.assertFramebufferComplete("bloom-scene");

    // Bloom ping-pong FBOs (1/4 res)
    const makeFBO = () => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, bloomW, bloomH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      this.assertFramebufferComplete("bloom");
      return { fbo, tex };
    };

    const a = makeFBO();
    const b = makeFBO();
    this.bloomFBO_A = a.fbo;
    this.bloomTex_A = a.tex;
    this.bloomFBO_B = b.fbo;
    this.bloomTex_B = b.tex;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.bloomWidth = bloomW;
    this.bloomHeight = bloomH;
    this.bloomSceneWidth = sceneW;
    this.bloomSceneHeight = sceneH;
  }

  private destroyBloomFBOs() {
    const gl = this.gl;
    if (this.bloomSceneFBO) { gl.deleteFramebuffer(this.bloomSceneFBO); this.bloomSceneFBO = null; }
    if (this.bloomSceneTex) { gl.deleteTexture(this.bloomSceneTex); this.bloomSceneTex = null; }
    if (this.bloomFBO_A) { gl.deleteFramebuffer(this.bloomFBO_A); this.bloomFBO_A = null; }
    if (this.bloomTex_A) { gl.deleteTexture(this.bloomTex_A); this.bloomTex_A = null; }
    if (this.bloomFBO_B) { gl.deleteFramebuffer(this.bloomFBO_B); this.bloomFBO_B = null; }
    if (this.bloomTex_B) { gl.deleteTexture(this.bloomTex_B); this.bloomTex_B = null; }
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

  private renderBloomPass(state: EngineState, output: WebGLFramebuffer | null = null) {
    if (!state.realBloomEnabled) return;
    const gl = this.gl;

    // Lazy init programs
    if (!this.bloomExtractProgram) this.initBloomPrograms();
    // Ensure FBOs match canvas size
    if (!this.bloomSceneFBO ||
        this.bloomSceneWidth !== gl.canvas.width ||
        this.bloomSceneHeight !== gl.canvas.height) {
      this.initBloomFBOs();
    }

    gl.bindVertexArray(this.quadVAO);
    gl.disable(gl.BLEND);

    // Step 1: Copy the just-rendered gradient (screen or capture FBO) into the scene FBO
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, output);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.bloomSceneFBO!);
    gl.blitFramebuffer(
      0, 0, gl.canvas.width, gl.canvas.height,
      0, 0, gl.canvas.width, gl.canvas.height,
      gl.COLOR_BUFFER_BIT, gl.LINEAR
    );

    // Step 2: Extract bright pixels → bloomFBO_A (1/4 res)
    this.useAuxProgram(this.bloomExtractProgram!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO_A!);
    gl.viewport(0, 0, this.bloomWidth, this.bloomHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomSceneTex!);
    const eu = this.bloomExtractUniforms;
    if (eu["u_source"]) gl.uniform1i(eu["u_source"], 0);
    if (eu["u_threshold"]) gl.uniform1f(eu["u_threshold"], 0.5);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step 3: Horizontal blur bloomTex_A → bloomFBO_B
    this.useAuxProgram(this.bloomBlurProgram!);
    const bu = this.bloomBlurUniforms;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO_B!);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTex_A!);
    if (bu["u_source"]) gl.uniform1i(bu["u_source"], 0);
    if (bu["u_direction"]) gl.uniform2f(bu["u_direction"], 1.0 / this.bloomWidth, 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step 4: Vertical blur bloomTex_B → bloomFBO_A
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO_A!);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTex_B!);
    if (bu["u_direction"]) gl.uniform2f(bu["u_direction"], 0.0, 1.0 / this.bloomHeight);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step 5: Composite — draw scene + bloom to the original target
    gl.bindFramebuffer(gl.FRAMEBUFFER, output);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // First, restore the scene
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.bloomSceneFBO!);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, output);
    gl.blitFramebuffer(
      0, 0, gl.canvas.width, gl.canvas.height,
      0, 0, gl.canvas.width, gl.canvas.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, output);

    // Then additively blend the bloom on top
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    // Re-use the blur program to just pass through bloomTex_A
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomTex_A!);
    // Zero direction = no blur, just passthrough
    if (bu["u_direction"]) gl.uniform2f(bu["u_direction"], 0.0, 0.0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disable(gl.BLEND);
  }

  private renderTrailPass(state: EngineState) {
    const gl = this.gl;
    if (!state.trailEnabled) return;

    // Lazy init
    if (!this.trailProgram) this.initTrailProgram();
    const expectedW = Math.max(1, Math.floor(gl.canvas.width / 4));
    const expectedH = Math.max(1, Math.floor(gl.canvas.height / 4));
    if (!this.trailFBOs || this.trailWidth !== expectedW || this.trailHeight !== expectedH) {
      this.initTrailFBOs();
    }

    const prev = 1 - this.trailIndex;
    const curr = this.trailIndex;

    this.useAuxProgram(this.trailProgram!);
    gl.bindVertexArray(this.quadVAO);

    // Pass 1: Decay previous trail into current FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.trailFBOs![curr]);
    gl.viewport(0, 0, this.trailWidth, this.trailHeight);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.trailTextures![prev]);
    const tu = this.trailUniforms;
    if (tu["u_trailPass"]) gl.uniform1i(tu["u_trailPass"], 0);
    if (tu["u_trailPrev"]) gl.uniform1i(tu["u_trailPrev"], 0);
    if (tu["u_trailDecay"]) gl.uniform1f(tu["u_trailDecay"], state.trailLength);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Pass 2: Draw circle at mouse position (additive)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    if (tu["u_trailPass"]) gl.uniform1i(tu["u_trailPass"], 1);
    if (tu["u_trailMouse"]) gl.uniform2f(tu["u_trailMouse"], this.smoothMouseX, this.smoothMouseY);
    if (tu["u_trailWidth"]) gl.uniform1f(tu["u_trailWidth"], state.trailWidth);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Swap
    this.trailIndex = prev;
  }

  loadImageTexture(dataURL: string): WebGLTexture | null {
    if (this.textureCache.has(dataURL)) {
      return this.textureCache.get(dataURL)!;
    }
    if (this.pendingLoads.has(dataURL)) {
      return null;
    }
    this.pendingLoads.add(dataURL);
    const img = new Image();
    img.onload = () => {
      this.pendingLoads.delete(dataURL);
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, null);
      this.textureCache.set(dataURL, tex);
      this.textureSizes.set(dataURL, { width: uploadWidth, height: uploadHeight });
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

  cleanupTextures(layers: LayerParams[]) {
    const referenced = new Set<string>();
    for (const layer of layers) {
      if (layer.imageData) referenced.add(layer.imageData);
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
    if (this.bloomSceneFBO) {
      resources.push({ kind: "framebuffer", count: 1 });
      resources.push({ kind: "texture", width: this.bloomSceneWidth, height: this.bloomSceneHeight, count: 1 });
    }
    if (this.bloomFBO_A && this.bloomFBO_B) {
      resources.push({ kind: "framebuffer", count: 2 });
      resources.push({ kind: "texture", width: this.bloomWidth, height: this.bloomHeight, count: 2 });
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
    if (!entry.allocated || !paletteKeyMatches(entry.key, layer.colors, state.oklabEnabled, blend)) {
      bakePalette(layer.colors, state.oklabEnabled, blend, this.paletteData);
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
      setPaletteKey(entry.key, layer.colors, state.oklabEnabled, blend);
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

  /** The raw stops, for the gradients that read `u_colors` themselves. */
  private setPalette(layer: LayerParams) {
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
    }
  }

  private setLayerUniforms(layer: LayerParams) {
    this.setf("u_speed", layer.speed);
    this.setf("u_complexity", layer.complexity);
    this.setf("u_scale", layer.scale);
    this.setf("u_distortion", layer.distortion);
    this.setPalette(layer);
    this.setf("u_layerOpacity", layer.opacity);
    // Parallax depth (per-layer)
    this.setf("u_layerDepth", layer.depth);

    // Image texture
    const imageTex = layer.imageData ? this.loadImageTexture(layer.imageData) : null;
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
    const azimuth = (this.smoothMouseX - 0.5) * 0.5;
    const elevation = (this.smoothMouseY - 0.5) * 0.3;
    let mv = mat4RotateY(view, azimuth);
    mv = mat4RotateX(mv, elevation);
    return mat4Multiply(proj, mv);
  }

  /** Uniforms shared by every layer draw (the layer program is bound). `mvp` is meshMvp() when mesh distortion is on. */
  private setLayerGlobals(state: EngineState, mvp: Float32Array | null) {
    this.setf("u_time", this.elapsedTime);
    this.set2f("u_resolution", this.passWidth, this.passHeight);
    this.set2f("u_mouse", this.mouseX, this.mouseY);
    this.set2f("u_mouseSmooth", this.smoothMouseX, this.smoothMouseY);
    this.set2f("u_mouseVelocity", this.mouseVelX, this.mouseVelY);
    this.setf("u_mouseReact", state.mouseReact);
    this.setf("u_domainWarp", state.domainWarp);
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
      const azimuth = this.rotationAngle + (this.smoothMouseX - 0.5) * 2.0;
      const elevation = (this.smoothMouseY - 0.5) * 1.5;
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
    // Ripple
    const rippleTime = this.elapsedTime - this.rippleStartTime;
    this.setf("u_rippleEnabled", state.rippleEnabled && rippleTime < 2.0 ? 1.0 : 0.0);
    this.set2f("u_rippleOrigin", this.rippleOriginX, this.rippleOriginY);
    this.setf("u_rippleTime", rippleTime);
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
    // Liquify
    this.seti("u_liquifyEnabled", state.liquifyEnabled ? 1 : 0);
    this.setf("u_liquifyIntensity", state.liquifyIntensity);
    this.setf("u_liquifyScale", state.liquifyScale);
    // Deband (blue-noise anti-banding) — only on the final composited output
    this.seti("u_debandEnabled", state.debandEnabled ? 1 : 0);
    this.setf("u_debandStrength", state.debandStrength);
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

    // Trail pass (before main render — writes to separate FBO)
    this.renderTrailPass(state);

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
        this.setLayerUniforms(layer);
        this.bindPalette(i, layer, state);
        this.set2f("u_compositeScale", compositeScaleX, compositeScaleY);
        this.seti("u_compositeEnabled", i === 0 ? 0 : 1);
        if (i > 0) this.seti("u_blendMode", GradientEngine.BLEND_MODE_MAP[layer.blendMode] ?? 0);
        this.drawGeometry(state.meshDistortionEnabled);

        writeIdx = 1 - writeIdx;
      }
      const sceneTexture = compositeTextures[1 - writeIdx];

      // Post pass: global effects on the composited image.
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.disable(gl.BLEND);
      this.bindTexture(UNIT_COMPOSITE_PREV, null);
      this.bindTexture(UNIT_SCENE, sceneTexture);
      const trailActive = state.trailEnabled && this.trailTextures !== null;
      if (trailActive) this.bindTexture(UNIT_TRAIL, this.trailTextures![this.trailIndex]);
      if (feedbackActive) {
        // The previous frame: the feedback target we are not drawing into.
        this.bindTexture(UNIT_PREV_FRAME, this.feedbackTextures![1 - this.feedbackIndex]);
      }
      this.useProgram(this.getPostProgram());
      const lastLayer = visibleLayers[visibleLayers.length - 1];
      this.setPostUniforms(state, lastLayer);
      this.bindPalette(visibleLayers.length - 1, lastLayer, state);
      this.set2f("u_compositeScale", compositeScaleX, compositeScaleY);
      this.drawGeometry(false);

      this.bindTexture(UNIT_SCENE, null);
      if (trailActive) this.bindTexture(UNIT_TRAIL, null);
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

    // Cinematic bloom on the final image. Runs after the feedback blit so the
    // two effects can be combined (bloom used to be skipped under feedback).
    this.renderBloomPass(state, output);
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

      if (!state.playing) {
        lastTime = now;
        if (state !== lastPausedState) {
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

      const dt = now - lastTime;
      this.elapsedTime += dt * this.speedMultiplier;
      lastTime = now;

      // Spring mouse physics (stiffness=120, damping=12 for overshoot + settle)
      const springDt = Math.min(dt, 0.033); // cap at ~30fps equivalent
      const stiffness = 120;
      const damping = 12;

      const dx = this.mouseX - this.smoothMouseX;
      const dy = this.mouseY - this.smoothMouseY;

      this.springVelX += (dx * stiffness - this.springVelX * damping) * springDt;
      this.springVelY += (dy * stiffness - this.springVelY * damping) * springDt;

      this.prevSmoothX = this.smoothMouseX;
      this.prevSmoothY = this.smoothMouseY;
      this.smoothMouseX += this.springVelX * springDt;
      this.smoothMouseY += this.springVelY * springDt;

      // Derive mouse velocity for shader (smoothed from spring motion)
      if (springDt > 0) {
        const rawVelX = (this.smoothMouseX - this.prevSmoothX) / springDt;
        const rawVelY = (this.smoothMouseY - this.prevSmoothY) / springDt;
        const velLerp = 1.0 - Math.exp(-8.0 * springDt);
        this.mouseVelX += (rawVelX - this.mouseVelX) * velLerp;
        this.mouseVelY += (rawVelY - this.mouseVelY) * velLerp;
      }

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
      return new ImageData(flipRowsRGBA(pixels, width, height), width, height);
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
