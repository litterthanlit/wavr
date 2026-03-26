import vertexSource from "./shaders/vertex.glsl";
import fragmentSource from "./shaders/fragment.glsl";
import { GradientState } from "./store";

type UniformMap = Record<string, WebGLUniformLocation>;

export class GradientEngine {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms: UniformMap = {};
  private startTime: number;
  private animationId: number | null = null;
  private mouseX = 0.5;
  private mouseY = 0.5;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL 2 not supported");
    this.gl = gl;
    this.startTime = performance.now() / 1000;

    // Compile shaders
    const vertShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    // Link program
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

    // Setup fullscreen quad
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

    // Cache uniform locations
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
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette",
    ];
    for (const name of names) {
      const loc = gl.getUniformLocation(this.program, name);
      if (loc) this.uniforms[name] = loc;
    }
    // Color array
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

  private setUniforms(state: GradientState) {
    const gl = this.gl;
    const u = this.uniforms;

    const now = performance.now() / 1000 - this.startTime;
    if (u.u_time) gl.uniform1f(u.u_time, now);
    if (u.u_resolution) gl.uniform2f(u.u_resolution, gl.canvas.width, gl.canvas.height);
    if (u.u_mouse) gl.uniform2f(u.u_mouse, this.mouseX, this.mouseY);

    const typeMap: Record<string, number> = { mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4 };
    if (u.u_gradientType) gl.uniform1i(u.u_gradientType, typeMap[state.gradientType]);

    if (u.u_speed) gl.uniform1f(u.u_speed, state.speed);
    if (u.u_complexity) gl.uniform1f(u.u_complexity, state.complexity);
    if (u.u_scale) gl.uniform1f(u.u_scale, state.scale);
    if (u.u_distortion) gl.uniform1f(u.u_distortion, state.distortion);
    if (u.u_brightness) gl.uniform1f(u.u_brightness, state.brightness);
    if (u.u_saturation) gl.uniform1f(u.u_saturation, state.saturation);

    // Colors
    if (u.u_colorCount) gl.uniform1i(u.u_colorCount, state.colors.length);
    for (let i = 0; i < 8; i++) {
      const key = `u_colors[${i}]`;
      if (u[key] && i < state.colors.length) {
        gl.uniform3fv(u[key], state.colors[i]);
      }
    }

    // Effects
    if (u.u_noiseEnabled) gl.uniform1i(u.u_noiseEnabled, state.noiseEnabled ? 1 : 0);
    if (u.u_noiseIntensity) gl.uniform1f(u.u_noiseIntensity, state.noiseIntensity);
    if (u.u_noiseScale) gl.uniform1f(u.u_noiseScale, state.noiseScale);
    if (u.u_grain) gl.uniform1f(u.u_grain, state.grain);
    if (u.u_particlesEnabled) gl.uniform1i(u.u_particlesEnabled, state.particlesEnabled ? 1 : 0);
    if (u.u_particleCount) gl.uniform1f(u.u_particleCount, state.particleCount);
    if (u.u_particleSize) gl.uniform1f(u.u_particleSize, state.particleSize);
    if (u.u_mouseReact) gl.uniform1f(u.u_mouseReact, state.mouseReact);
    if (u.u_bloomEnabled) gl.uniform1i(u.u_bloomEnabled, state.bloomEnabled ? 1 : 0);
    if (u.u_bloomIntensity) gl.uniform1f(u.u_bloomIntensity, state.bloomIntensity);
    if (u.u_vignette) gl.uniform1f(u.u_vignette, state.vignette);
  }

  render(state: GradientState) {
    const gl = this.gl;
    this.setUniforms(state);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  startLoop(getState: () => GradientState, onFrame?: (fps: number) => void) {
    let lastFpsUpdate = performance.now();
    let frameCount = 0;

    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      const state = getState();
      if (!state.playing) return;

      this.render(state);

      // FPS tracking
      frameCount++;
      const now = performance.now();
      if (now - lastFpsUpdate >= 500) {
        const fps = Math.round((frameCount / (now - lastFpsUpdate)) * 1000);
        onFrame?.(fps);
        frameCount = 0;
        lastFpsUpdate = now;
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
    this.gl.deleteProgram(this.program);
  }
}
