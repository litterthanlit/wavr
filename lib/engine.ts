import vertexSource from "./shaders/vertex.glsl";
import fragmentSource from "./shaders/fragment.glsl";
import { GradientState } from "./store";
import { BlendMode, LayerParams } from "./layers";

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
  // Feedback loop FBO ping-pong
  private feedbackFBOs: [WebGLFramebuffer, WebGLFramebuffer] | null = null;
  private feedbackTextures: [WebGLTexture, WebGLTexture] | null = null;
  private feedbackIndex = 0;
  private feedbackWidth = 0;
  private feedbackHeight = 0;

  // Image texture cache
  private textureCache: Map<string, WebGLTexture> = new Map();
  private pendingLoads: Set<string> = new Set();

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

    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
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

  private setLayerUniforms(layer: LayerParams) {
    const gl = this.gl;
    const typeMap: Record<string, number> = {
      mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4,
      dither: 5, scanline: 6, glitch: 7, image: 8,
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
  }

  private setGlobalUniforms(state: GradientState, isBaseLayer: boolean) {
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
  }

  private applyBlendMode(mode: BlendMode) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    switch (mode) {
      case "normal":
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case "add":
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
      case "multiply":
        gl.blendFunc(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA);
        break;
      case "screen":
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
        break;
      case "overlay":
        // Approximation: use additive for bright, multiply for dark
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        break;
    }
  }

  render(state: GradientState) {
    const gl = this.gl;
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
      // Render to current FBO
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.feedbackFBOs![this.feedbackIndex]);
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    const visibleLayers = state.layers.filter((l) => l.visible);

    if (visibleLayers.length === 0) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else if (visibleLayers.length === 1) {
      // Single layer: render directly (no blending overhead)
      gl.disable(gl.BLEND);
      const layer = visibleLayers[0];
      this.setGlobalUniforms(state, true);
      this.setLayerUniforms(layer);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      // Multi-layer: render base, then composite overlays
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      for (let i = 0; i < visibleLayers.length; i++) {
        const layer = visibleLayers[i];
        const isLast = i === visibleLayers.length - 1;

        if (i === 0) {
          gl.disable(gl.BLEND);
        } else {
          this.applyBlendMode(layer.blendMode);
        }

        // Apply global effects only on the last layer
        this.setGlobalUniforms(state, isLast);
        this.setLayerUniforms(layer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      gl.disable(gl.BLEND);
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

  startLoop(getState: () => GradientState, onFrame?: (fps: number) => void) {
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
      this.elapsedTime += dt;
      lastTime = now;

      // Smooth mouse with lerp (exponential decay, frame-rate independent)
      const lerpFactor = 1.0 - Math.exp(-8.0 * dt);
      this.prevSmoothX = this.smoothMouseX;
      this.prevSmoothY = this.smoothMouseY;
      this.smoothMouseX += (this.mouseX - this.smoothMouseX) * lerpFactor;
      this.smoothMouseY += (this.mouseY - this.smoothMouseY) * lerpFactor;

      if (dt > 0) {
        const rawVelX = (this.smoothMouseX - this.prevSmoothX) / dt;
        const rawVelY = (this.smoothMouseY - this.prevSmoothY) / dt;
        this.mouseVelX += (rawVelX - this.mouseVelX) * lerpFactor;
        this.mouseVelY += (rawVelY - this.mouseVelY) * lerpFactor;
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
    for (const tex of this.textureCache.values()) {
      this.gl.deleteTexture(tex);
    }
    this.textureCache.clear();
    if (this.program) this.gl.deleteProgram(this.program);
  }
}
