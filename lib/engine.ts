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
      "u_particlesEnabled", "u_particleCount", "u_particleSize", "u_mouseReact",
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette", "u_radialBlurAmount",
      "u_mouseSmooth", "u_mouseVelocity", "u_colorBlend",
      "u_chromaticAberration", "u_hueShift",
      "u_asciiEnabled", "u_asciiSize", "u_ditherEnabled", "u_ditherSize",
      "u_layerOpacity", "u_isBaseLayer",
      "u_voronoiEnabled", "u_voronoiIntensity", "u_voronoiScale",
      "u_curlEnabled", "u_curlIntensity", "u_curlScale",
      "u_kaleidoscopeEnabled", "u_kaleidoscopeSegments", "u_kaleidoscopeRotation",
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
    const typeMap: Record<string, number> = { mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4 };
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
    this.seti("u_particlesEnabled", isBaseLayer && state.particlesEnabled ? 1 : 0);
    this.setf("u_particleCount", state.particleCount);
    this.setf("u_particleSize", state.particleSize);
    this.seti("u_bloomEnabled", isBaseLayer && state.bloomEnabled ? 1 : 0);
    this.setf("u_bloomIntensity", state.bloomIntensity);
    this.setf("u_vignette", isBaseLayer ? state.vignette : 0);
    this.setf("u_radialBlurAmount", state.radialBlurAmount);
    this.setf("u_colorBlend", state.colorBlend);
    this.setf("u_chromaticAberration", isBaseLayer ? state.chromaticAberration : 0);
    this.setf("u_hueShift", isBaseLayer ? state.hueShift : 0);
    this.seti("u_asciiEnabled", isBaseLayer && state.asciiEnabled ? 1 : 0);
    this.setf("u_asciiSize", state.asciiSize);
    this.seti("u_ditherEnabled", isBaseLayer && state.ditherEnabled ? 1 : 0);
    this.setf("u_ditherSize", state.ditherSize);
    this.seti("u_voronoiEnabled", isBaseLayer && state.voronoiEnabled ? 1 : 0);
    this.setf("u_voronoiIntensity", state.voronoiIntensity);
    this.setf("u_voronoiScale", state.voronoiScale);
    this.seti("u_curlEnabled", isBaseLayer && state.curlEnabled ? 1 : 0);
    this.setf("u_curlIntensity", state.curlIntensity);
    this.setf("u_curlScale", state.curlScale);
    this.seti("u_kaleidoscopeEnabled", isBaseLayer && state.kaleidoscopeEnabled ? 1 : 0);
    this.setf("u_kaleidoscopeSegments", state.kaleidoscopeSegments);
    this.setf("u_kaleidoscopeRotation", state.kaleidoscopeRotation);
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
    const visibleLayers = state.layers.filter((l) => l.visible);

    if (visibleLayers.length === 0) {
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    // Single layer: render directly (no blending overhead)
    if (visibleLayers.length === 1) {
      gl.disable(gl.BLEND);
      const layer = visibleLayers[0];
      this.setGlobalUniforms(state, true);
      this.setLayerUniforms(layer);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      return;
    }

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
    if (this.program) this.gl.deleteProgram(this.program);
  }
}
