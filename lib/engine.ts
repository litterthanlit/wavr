import vertexSource from "./shaders/vertex.glsl";
import fragmentSource from "./shaders/fragment.glsl";
import { GradientState } from "./store";

type UniformMap = Record<string, WebGLUniformLocation>;

export class GradientEngine {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private uniforms: UniformMap = {};
  private elapsedTime = 0;
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
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette",
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

  private setUniforms(state: GradientState) {
    const gl = this.gl;
    const u = this.uniforms;

    const set1f = (name: string, val: number) => {
      if (u[name] !== undefined) gl.uniform1f(u[name], val);
    };
    const set1i = (name: string, val: number) => {
      if (u[name] !== undefined) gl.uniform1i(u[name], val);
    };
    const set2f = (name: string, x: number, y: number) => {
      if (u[name] !== undefined) gl.uniform2f(u[name], x, y);
    };

    set1f("u_time", this.elapsedTime);
    set2f("u_resolution", gl.canvas.width, gl.canvas.height);
    set2f("u_mouse", this.mouseX, this.mouseY);

    const typeMap: Record<string, number> = { mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4 };
    set1i("u_gradientType", typeMap[state.gradientType]);

    set1f("u_speed", state.speed);
    set1f("u_complexity", state.complexity);
    set1f("u_scale", state.scale);
    set1f("u_distortion", state.distortion);
    set1f("u_brightness", state.brightness);
    set1f("u_saturation", state.saturation);

    set1i("u_colorCount", state.colors.length);
    for (let i = 0; i < 8; i++) {
      const key = `u_colors[${i}]`;
      if (u[key] !== undefined && i < state.colors.length) {
        gl.uniform3fv(u[key], state.colors[i]);
      }
    }

    set1i("u_noiseEnabled", state.noiseEnabled ? 1 : 0);
    set1f("u_noiseIntensity", state.noiseIntensity);
    set1f("u_noiseScale", state.noiseScale);
    set1f("u_grain", state.grain);
    set1i("u_particlesEnabled", state.particlesEnabled ? 1 : 0);
    set1f("u_particleCount", state.particleCount);
    set1f("u_particleSize", state.particleSize);
    set1f("u_mouseReact", state.mouseReact);
    set1i("u_bloomEnabled", state.bloomEnabled ? 1 : 0);
    set1f("u_bloomIntensity", state.bloomIntensity);
    set1f("u_vignette", state.vignette);
  }

  render(state: GradientState) {
    const gl = this.gl;
    this.setUniforms(state);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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

      this.elapsedTime += now - lastTime;
      lastTime = now;

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
