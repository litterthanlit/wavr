import vertexSource from "./shaders/vertex.glsl";
import _fragmentSource from "./shaders/fragment.glsl";
import hslSource from "./shaders/hsl.glsl";
import blendModesSource from "./shaders/blend-modes.glsl";
import trailFragSource from "./shaders/trail.glsl";
import bloomExtractSource from "./shaders/bloom-extract.glsl";
import blurSource from "./shaders/blur.glsl";
import { BlendMode, LayerParams } from "./layers";

// Assemble full fragment source with blend mode includes
const fragmentSource = _fragmentSource.replace(
  'precision highp float;',
  'precision highp float;\n\n' + hslSource + '\n' + blendModesSource
);
import { mat4Perspective, mat4LookAt, mat4RotateX, mat4RotateY, mat4Multiply } from "./math";

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
  playing: boolean;
  customGLSL: string | null;
}

type UniformMap = Record<string, WebGLUniformLocation>;

export class GradientEngine {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private uniforms: UniformMap = {};
  private elapsedTime = 0;
  private animationId: number | null = null;
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
  private pendingLoads: Set<string> = new Set();
  private textMaskTexture: WebGLTexture | null = null;

  // Layer compositing FBOs (Phase 12)
  private compositeFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private compositeTextures: [WebGLTexture, WebGLTexture] | null = null;
  private compositeWidth = 0;
  private compositeHeight = 0;

  // Grid mesh for mesh distortion (Phase 7)
  private quadVAO!: WebGLVertexArrayObject;
  private gridVAO: WebGLVertexArrayObject | null = null;
  private gridIndexCount = 0;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL 2 not supported");
    this.gl = gl;
    this.initProgram();
  }

  initProgram() {
    const gl = this.gl;

    if (this.program) {
      gl.deleteProgram(this.program);
    }

    const vertShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      throw new Error(`Program link failed: ${log}`);
    }

    this.program = program;
    gl.useProgram(program);

    this.quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVAO);
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {};
    this.cacheUniforms();
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

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

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

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  private cacheUniforms() {
    const gl = this.gl;
    const names = [
      "u_time", "u_resolution", "u_mouse", "u_gradientType",
      "u_speed", "u_complexity", "u_scale", "u_distortion",
      "u_brightness", "u_saturation", "u_colorCount",
      "u_noiseEnabled", "u_noiseIntensity", "u_noiseScale", "u_grain",
      "u_mouseReact",
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette", "u_radialBlurAmount",
      "u_blurEnabled", "u_blurAmount",
      "u_mouseSmooth", "u_mouseVelocity", "u_colorBlend",
      "u_chromaticAberration", "u_hueShift",
      "u_asciiEnabled", "u_asciiSize", "u_ditherEnabled", "u_ditherSize",
      "u_layerOpacity", "u_isBaseLayer",
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
      // Custom GLSL
      "u_customEnabled",
      // Layer compositing (Phase 12)
      "u_blendMode", "u_compositeEnabled", "u_compositePrev",
      // Phase 7: Parallax
      "u_parallaxEnabled", "u_parallaxStrength", "u_layerDepth",
      // Phase 7: 3D Shape Projection
      "u_3dEnabled", "u_3dShape", "u_3dPerspective",
      "u_3dRotationSpeed", "u_3dRotation", "u_3dZoom", "u_3dLighting",
      // Phase 7: Mesh Distortion
      "u_meshEnabled", "u_meshDisplacement", "u_meshFrequency", "u_meshSpeed", "u_mvp",
      // Phase 11: Shader Quality
      "u_oklabEnabled", "u_toneMapMode",
      // Phase 11 Week 2: Ripple, Glow, Caustics
      "u_rippleOrigin", "u_rippleTime", "u_rippleEnabled", "u_rippleIntensity",
      "u_glowEnabled", "u_glowIntensity", "u_glowRadius",
      "u_causticEnabled", "u_causticIntensity",
      "u_liquifyEnabled", "u_liquifyIntensity", "u_liquifyScale",
      "u_trailEnabled", "u_trailTexture",
    ];
    for (const name of names) {
      const loc = gl.getUniformLocation(this.program, name);
      if (loc) this.uniforms[name] = loc;
    }
    for (let i = 0; i < 8; i++) {
      const loc = gl.getUniformLocation(this.program, `u_colors[${i}]`);
      if (loc) this.uniforms[`u_colors[${i}]`] = loc;
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

  resize(width: number, height: number) {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    gl.canvas.width = width * dpr;
    gl.canvas.height = height * dpr;
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
    // Simple fullscreen vertex shader (reuse same quad)
    const vertSrc = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
    const vertShader = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, trailFragSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

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
    const vertSrc = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

    // Extract program
    const extractVert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const extractFrag = this.compileShader(gl.FRAGMENT_SHADER, bloomExtractSource);
    const extractProg = gl.createProgram()!;
    gl.attachShader(extractProg, extractVert);
    gl.attachShader(extractProg, extractFrag);
    gl.linkProgram(extractProg);
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
    const blurVert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const blurFrag = this.compileShader(gl.FRAGMENT_SHADER, blurSource);
    const blurProg = gl.createProgram()!;
    gl.attachShader(blurProg, blurVert);
    gl.attachShader(blurProg, blurFrag);
    gl.linkProgram(blurProg);
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
      fbos.push(fbo);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.compositeFBOs = [fbos[0], fbos[1]];
    this.compositeTextures = [textures[0], textures[1]];
    this.compositeWidth = width;
    this.compositeHeight = height;
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

  private renderBloomPass(state: EngineState) {
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

    // Step 1: Render gradient to scene FBO (the gradient was already rendered
    // to the screen — blit screen to scene FBO)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.bloomSceneFBO!);
    gl.blitFramebuffer(
      0, 0, gl.canvas.width, gl.canvas.height,
      0, 0, gl.canvas.width, gl.canvas.height,
      gl.COLOR_BUFFER_BIT, gl.LINEAR
    );

    // Step 2: Extract bright pixels → bloomFBO_A (1/4 res)
    gl.useProgram(this.bloomExtractProgram!);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomFBO_A!);
    gl.viewport(0, 0, this.bloomWidth, this.bloomHeight);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.bloomSceneTex!);
    const eu = this.bloomExtractUniforms;
    if (eu["u_source"]) gl.uniform1i(eu["u_source"], 0);
    if (eu["u_threshold"]) gl.uniform1f(eu["u_threshold"], 0.5);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Step 3: Horizontal blur bloomTex_A → bloomFBO_B
    gl.useProgram(this.bloomBlurProgram!);
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

    // Step 5: Composite — draw scene + bloom to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // First, restore the scene
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.bloomSceneFBO!);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.blitFramebuffer(
      0, 0, gl.canvas.width, gl.canvas.height,
      0, 0, gl.canvas.width, gl.canvas.height,
      gl.COLOR_BUFFER_BIT, gl.NEAREST
    );
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

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

    // Switch back to main program
    gl.useProgram(this.program);
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

    gl.useProgram(this.trailProgram!);
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

    // Switch back to main program
    gl.useProgram(this.program);
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
      if (img.width > 2048 || img.height > 2048) {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(2048 / img.width, 2048 / img.height);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        source = canvas;
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

  setCustomShader(code: string | null): { success: boolean; error?: string } {
    const gl = this.gl;

    if (code === null) {
      // Revert to default shader
      try {
        this.initProgram();
        this.seti("u_customEnabled", 0);
        return { success: true };
      } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : "Reset failed" };
      }
    }

    // Wrap user code in customGradient function and inject into shader
    const customFunc = `vec3 customGradient(vec2 uv, float time) {\n${code}\n}`;

    // Replace the placeholder customGradient in the fragment source
    const modifiedFragment = fragmentSource.replace(
      /vec3 customGradient\(vec2 uv, float time\) \{[^}]*\}/,
      customFunc
    );

    try {
      const vertShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
      const fragShader = this.compileShader(gl.FRAGMENT_SHADER, modifiedFragment);

      const newProgram = gl.createProgram()!;
      gl.attachShader(newProgram, vertShader);
      gl.attachShader(newProgram, fragShader);
      gl.linkProgram(newProgram);

      if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(newProgram);
        gl.deleteProgram(newProgram);
        return { success: false, error: log ?? "Link failed" };
      }

      // Success — swap programs
      if (this.program) gl.deleteProgram(this.program);
      this.program = newProgram;
      gl.useProgram(newProgram);

      // Re-bind the VAO (fullscreen quad)
      this.quadVAO = gl.createVertexArray()!;
      gl.bindVertexArray(this.quadVAO);
      const buffer = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const posLoc = gl.getAttribLocation(newProgram, "a_position");
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      this.uniforms = {};
      this.cacheUniforms();
      this.seti("u_customEnabled", 1);

      return { success: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Compilation failed";
      // Extract GLSL error from "Shader compile failed: " prefix
      const cleaned = msg.replace(/^Shader compile failed:\s*/, "");
      return { success: false, error: cleaned };
    }
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
      }
    }
  }

  private setf(name: string, val: number) {
    const loc = this.uniforms[name];
    if (loc !== undefined) this.gl.uniform1f(loc, val);
  }

  private seti(name: string, val: number) {
    const loc = this.uniforms[name];
    if (loc !== undefined) this.gl.uniform1i(loc, val);
  }

  private set2f(name: string, x: number, y: number) {
    const loc = this.uniforms[name];
    if (loc !== undefined) this.gl.uniform2f(loc, x, y);
  }

  private setMat4(name: string, val: Float32Array) {
    const loc = this.uniforms[name];
    if (loc !== undefined) this.gl.uniformMatrix4fv(loc, false, val);
  }

  private setLayerUniforms(layer: LayerParams) {
    const gl = this.gl;
    const typeMap: Record<string, number> = {
      mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4,
      dither: 5, scanline: 6, glitch: 7, image: 8, voronoi: 9,
    };
    this.seti("u_gradientType", typeMap[layer.gradientType]);
    this.setf("u_speed", layer.speed);
    this.setf("u_complexity", layer.complexity);
    this.setf("u_scale", layer.scale);
    this.setf("u_distortion", layer.distortion);
    this.seti("u_colorCount", layer.colors.length);
    for (let i = 0; i < 8; i++) {
      const key = `u_colors[${i}]`;
      if (this.uniforms[key] !== undefined && i < layer.colors.length) {
        gl.uniform3fv(this.uniforms[key], layer.colors[i]);
      }
    }
    this.setf("u_layerOpacity", layer.opacity);
    // Parallax depth (per-layer)
    this.setf("u_layerDepth", layer.depth);

    // Image texture (unit 1)
    const imageTex = layer.imageData ? this.loadImageTexture(layer.imageData) : null;
    if (imageTex) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, imageTex);
      this.seti("u_imageTexture", 1);
      this.setf("u_hasImage", 1.0);
    } else {
      this.setf("u_hasImage", 0.0);
    }

    // Distortion map (unit 2)
    const distortionTex = (layer.distortionMapEnabled && layer.distortionMapData)
      ? this.loadImageTexture(layer.distortionMapData)
      : null;
    if (distortionTex) {
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, distortionTex);
      this.seti("u_distortionMap", 2);
      this.setf("u_hasDistortionMap", 1.0);
    } else {
      this.setf("u_hasDistortionMap", 0.0);
    }

    // Image transform uniforms
    this.setf("u_imageScale", layer.imageScale);
    this.set2f("u_imageOffset", layer.imageOffset[0], layer.imageOffset[1]);
    this.setf("u_distortionMapIntensity", layer.distortionMapIntensity);

    // Blend mode: replace=0, normal=1, multiply=2, screen=3, overlay=4
    const blendModeMap: Record<string, number> = {
      replace: 0, normal: 1, multiply: 2, screen: 3, overlay: 4,
    };
    this.seti("u_imageBlendMode", blendModeMap[layer.imageBlendMode]);
    this.setf("u_imageBlendOpacity", layer.imageBlendOpacity);

    // Mask uniforms
    const maskShapeMap: Record<string, number> = {
      none: 0, circle: 1, roundedRect: 2, ellipse: 3, polygon: 4, star: 5, blob: 6,
    };
    const maskBlendMap: Record<string, number> = {
      union: 0, subtract: 1, intersect: 2, smoothUnion: 3,
    };

    this.seti("u_maskEnabled", layer.maskEnabled ? 1 : 0);

    this.seti("u_mask1Type", maskShapeMap[layer.mask1.shape]);
    this.set2f("u_mask1Position", layer.mask1.position[0], layer.mask1.position[1]);
    this.set2f("u_mask1Scale", layer.mask1.scale[0], layer.mask1.scale[1]);
    this.setf("u_mask1Rotation", layer.mask1.rotation);
    this.setf("u_mask1Feather", layer.mask1.feather);
    this.setf("u_mask1Invert", layer.mask1.invert ? 1.0 : 0.0);
    this.setf("u_mask1CornerRadius", layer.mask1.cornerRadius);
    this.setf("u_mask1Sides", layer.mask1.sides);
    this.setf("u_mask1StarInner", layer.mask1.starInnerRadius);
    this.setf("u_mask1NoiseDist", layer.mask1.noiseDistortion);

    this.seti("u_mask2Type", maskShapeMap[layer.mask2.shape]);
    this.set2f("u_mask2Position", layer.mask2.position[0], layer.mask2.position[1]);
    this.set2f("u_mask2Scale", layer.mask2.scale[0], layer.mask2.scale[1]);
    this.setf("u_mask2Rotation", layer.mask2.rotation);
    this.setf("u_mask2Feather", layer.mask2.feather);
    this.setf("u_mask2Invert", layer.mask2.invert ? 1.0 : 0.0);
    this.setf("u_mask2CornerRadius", layer.mask2.cornerRadius);
    this.setf("u_mask2Sides", layer.mask2.sides);
    this.setf("u_mask2StarInner", layer.mask2.starInnerRadius);
    this.setf("u_mask2NoiseDist", layer.mask2.noiseDistortion);

    this.seti("u_maskBlendMode", maskBlendMap[layer.maskBlendMode]);
    this.setf("u_maskSmoothness", layer.maskSmoothness);

    // Text mask
    this.setf("u_textMaskEnabled", layer.textMaskEnabled ? 1.0 : 0.0);
    if (layer.textMaskEnabled && this.textMaskTexture) {
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.textMaskTexture);
      this.seti("u_textMaskTexture", 3);
    }
  }

  private setGlobalUniforms(state: EngineState, isBaseLayer: boolean) {
    this.setf("u_time", this.elapsedTime);
    this.set2f("u_resolution", this.gl.canvas.width, this.gl.canvas.height);
    this.set2f("u_mouse", this.mouseX, this.mouseY);
    this.set2f("u_mouseSmooth", this.smoothMouseX, this.smoothMouseY);
    this.set2f("u_mouseVelocity", this.mouseVelX, this.mouseVelY);
    this.setf("u_mouseReact", state.mouseReact);

    // Only apply post-processing on the final layer
    this.seti("u_isBaseLayer", isBaseLayer ? 1 : 0);
    this.setf("u_brightness", isBaseLayer ? state.brightness : 1.0);
    this.setf("u_saturation", isBaseLayer ? state.saturation : 1.0);
    this.seti("u_noiseEnabled", isBaseLayer && state.noiseEnabled ? 1 : 0);
    this.setf("u_noiseIntensity", state.noiseIntensity);
    this.setf("u_noiseScale", state.noiseScale);
    this.setf("u_grain", isBaseLayer ? state.grain : 0);
    this.seti("u_bloomEnabled", isBaseLayer && state.bloomEnabled ? 1 : 0);
    this.setf("u_bloomIntensity", state.bloomIntensity);
    this.setf("u_vignette", isBaseLayer ? state.vignette : 0);
    this.setf("u_radialBlurAmount", state.radialBlurAmount);
    this.seti("u_blurEnabled", isBaseLayer && state.blurEnabled ? 1 : 0);
    this.setf("u_blurAmount", state.blurAmount);
    this.setf("u_colorBlend", state.colorBlend);
    this.setf("u_chromaticAberration", isBaseLayer ? state.chromaticAberration : 0);
    this.setf("u_hueShift", isBaseLayer ? state.hueShift : 0);
    this.seti("u_asciiEnabled", isBaseLayer && state.asciiEnabled ? 1 : 0);
    this.setf("u_asciiSize", state.asciiSize);
    this.seti("u_ditherEnabled", isBaseLayer && state.ditherEnabled ? 1 : 0);
    this.setf("u_ditherSize", state.ditherSize);
    this.seti("u_curlEnabled", isBaseLayer && state.curlEnabled ? 1 : 0);
    this.setf("u_curlIntensity", state.curlIntensity);
    this.setf("u_curlScale", state.curlScale);
    this.seti("u_kaleidoscopeEnabled", isBaseLayer && state.kaleidoscopeEnabled ? 1 : 0);
    this.setf("u_kaleidoscopeSegments", state.kaleidoscopeSegments);
    this.setf("u_kaleidoscopeRotation", state.kaleidoscopeRotation);
    this.seti("u_reactionDiffEnabled", isBaseLayer && state.reactionDiffEnabled ? 1 : 0);
    this.setf("u_reactionDiffIntensity", state.reactionDiffIntensity);
    this.setf("u_reactionDiffScale", state.reactionDiffScale);
    this.seti("u_pixelSortEnabled", isBaseLayer && state.pixelSortEnabled ? 1 : 0);
    this.setf("u_pixelSortIntensity", state.pixelSortIntensity);
    this.setf("u_pixelSortThreshold", state.pixelSortThreshold);
    this.setf("u_domainWarp", state.domainWarp);
    this.seti("u_feedbackEnabled", isBaseLayer && state.feedbackEnabled ? 1 : 0);
    this.setf("u_feedbackDecay", state.feedbackDecay);
    // Parallax (active on all layers, not just base)
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
    // Shader quality
    this.seti("u_oklabEnabled", state.oklabEnabled ? 1 : 0);
    this.seti("u_toneMapMode", isBaseLayer ? state.toneMapMode : 1);
    // Ripple
    const rippleTime = this.elapsedTime - this.rippleStartTime;
    this.setf("u_rippleEnabled", isBaseLayer && state.rippleEnabled && rippleTime < 2.0 ? 1.0 : 0.0);
    this.set2f("u_rippleOrigin", this.rippleOriginX, this.rippleOriginY);
    this.setf("u_rippleTime", rippleTime);
    this.setf("u_rippleIntensity", state.rippleIntensity);
    // Soft glow
    this.seti("u_glowEnabled", isBaseLayer && state.glowEnabled ? 1 : 0);
    this.setf("u_glowIntensity", state.glowIntensity);
    this.setf("u_glowRadius", state.glowRadius);
    // Caustics
    this.seti("u_causticEnabled", isBaseLayer && state.causticEnabled ? 1 : 0);
    this.setf("u_causticIntensity", state.causticIntensity);
    // Trail
    const trailActive = isBaseLayer && state.trailEnabled && this.trailTextures;
    this.seti("u_trailEnabled", trailActive ? 1 : 0);
    if (trailActive) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.trailTextures![this.trailIndex]);
      this.seti("u_trailTexture", 4);
    }
    // Liquify
    this.seti("u_liquifyEnabled", isBaseLayer && state.liquifyEnabled ? 1 : 0);
    this.setf("u_liquifyIntensity", state.liquifyIntensity);
    this.setf("u_liquifyScale", state.liquifyScale);
    // Mesh Distortion
    this.seti("u_meshEnabled", state.meshDistortionEnabled ? 1 : 0);
    this.setf("u_meshDisplacement", state.meshDisplacement);
    this.setf("u_meshFrequency", state.meshFrequency);
    this.setf("u_meshSpeed", state.meshSpeed);

    // MVP matrix for mesh distortion
    if (state.meshDistortionEnabled) {
      const canvas = this.gl.canvas as HTMLCanvasElement;
      const aspect = canvas.width / canvas.height;
      const proj = mat4Perspective(Math.PI / 3, aspect, 0.1, 100.0);
      const view = mat4LookAt([0, 0.8, 2.0], [0, 0, 0], [0, 1, 0]);
      // Subtle mouse-driven rotation
      const azimuth = (this.smoothMouseX - 0.5) * 0.5;
      const elevation = (this.smoothMouseY - 0.5) * 0.3;
      let mv = mat4RotateY(view, azimuth);
      mv = mat4RotateX(mv, elevation);
      const mvp = mat4Multiply(proj, mv);
      this.setMat4("u_mvp", mvp);
    }
  }

  render(state: EngineState) {
    const gl = this.gl;

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
      // Bind previous frame texture
      const prevIdx = 1 - this.feedbackIndex;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.feedbackTextures![prevIdx]);
      this.seti("u_prevFrame", 0);
    }

    // Final render target: feedback FBO or screen
    const finalTarget = feedbackActive ? this.feedbackFBOs![this.feedbackIndex] : null;

    const visibleLayers = state.layers.filter((l) => l.visible);

    if (visibleLayers.length === 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else if (visibleLayers.length === 1) {
      // Single layer: render directly (no compositing overhead)
      gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.disable(gl.BLEND);
      const layer = visibleLayers[0];
      this.setGlobalUniforms(state, true);
      this.setLayerUniforms(layer);
      this.seti("u_compositeEnabled", 0);
      this.drawGeometry(state.meshDistortionEnabled);
    } else {
      // Multi-layer: shader-based compositing via FBO ping-pong
      this.ensureCompositeFBOs();

      let compIdx = 0;
      for (let i = 0; i < visibleLayers.length; i++) {
        const layer = visibleLayers[i];
        const isFirst = i === 0;
        const isLast = i === visibleLayers.length - 1;

        if (isFirst) {
          // First layer: render to composite FBO, no blending
          gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBOs![compIdx]);
          gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
          gl.disable(gl.BLEND);
          this.seti("u_compositeEnabled", 0);
        } else {
          // Subsequent layers: read previous composite, apply blend mode
          const readIdx = 1 - compIdx;
          gl.activeTexture(gl.TEXTURE5);
          gl.bindTexture(gl.TEXTURE_2D, this.compositeTextures![readIdx]);
          this.seti("u_compositePrev", 5);
          this.seti("u_compositeEnabled", 1);
          this.seti("u_blendMode", GradientEngine.BLEND_MODE_MAP[layer.blendMode]);

          if (isLast) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, finalTarget);
          } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.compositeFBOs![compIdx]);
          }
          gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
          gl.disable(gl.BLEND);
        }

        // Apply global effects only on the last layer
        this.setGlobalUniforms(state, isLast);
        this.setLayerUniforms(layer);
        this.drawGeometry(state.meshDistortionEnabled);

        if (!isLast) {
          compIdx = 1 - compIdx;
        }
      }
    }

    // Restore quad VAO as default
    this.gl.bindVertexArray(this.quadVAO);

    // Real bloom pass (extract + blur + composite)
    if (!feedbackActive) {
      // Only run when not using feedback FBOs (they use different framebuffer flow)
      this.renderBloomPass(state);
    }

    // Clean up unused cached textures
    this.cleanupTextures(state.layers);

    // Blit FBO to screen and swap buffers
    if (feedbackActive && this.feedbackFBOs) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.feedbackFBOs[this.feedbackIndex]);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(
        0, 0, gl.canvas.width, gl.canvas.height,
        0, 0, gl.canvas.width, gl.canvas.height,
        gl.COLOR_BUFFER_BIT, gl.NEAREST
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.feedbackIndex = 1 - this.feedbackIndex;
    }
  }

  startLoop(getState: () => EngineState, onFrame?: (fps: number) => void) {
    let lastFpsUpdate = performance.now();
    let frameCount = 0;
    let lastTime = performance.now() / 1000;

    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      const state = getState();
      const now = performance.now() / 1000;

      if (!state.playing) {
        lastTime = now;
        return;
      }

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

      this.render(state);

      frameCount++;
      const nowMs = now * 1000;
      if (nowMs - lastFpsUpdate >= 500) {
        const fps = Math.round((frameCount / (nowMs - lastFpsUpdate)) * 1000);
        onFrame?.(fps);
        frameCount = 0;
        lastFpsUpdate = nowMs;
      }
    };
    loop();
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

  destroy() {
    this.stopLoop();
    this.destroyFeedbackFBOs();
    this.destroyTrailFBOs();
    this.destroyBloomFBOs();
    this.destroyCompositeFBOs();
    if (this.trailProgram) {
      this.gl.deleteProgram(this.trailProgram);
      this.trailProgram = null;
    }
    if (this.bloomExtractProgram) {
      this.gl.deleteProgram(this.bloomExtractProgram);
      this.bloomExtractProgram = null;
    }
    if (this.bloomBlurProgram) {
      this.gl.deleteProgram(this.bloomBlurProgram);
      this.bloomBlurProgram = null;
    }
    for (const tex of this.textureCache.values()) {
      this.gl.deleteTexture(tex);
    }
    this.textureCache.clear();
    if (this.textMaskTexture) {
      this.gl.deleteTexture(this.textMaskTexture);
      this.textMaskTexture = null;
    }
    if (this.program) this.gl.deleteProgram(this.program);
  }
}
