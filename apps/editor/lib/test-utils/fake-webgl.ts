// Records the GL calls GradientEngine makes, so pass structure (which
// framebuffer each draw targets, which uniforms it sees, which textures are
// bound), program creation and upload counts can be checked without a real
// WebGL context. Uniform values are tracked per program, and uniform locations
// are per-program objects, like real GL.

export type Handle = { id: number; kind: string };
export type UniformValue = number | number[];

export interface DrawRecord {
  program: Handle | null;
  target: Handle | null;
  uniforms: Record<string, UniformValue>;
  boundTextures: Map<number, Handle | null>;
}

export interface ProgramInfo {
  handle: Handle;
  vertexSource: string;
  fragmentSource: string;
  linkCalls: number;
  deleted: boolean;
  /** `#define WAVR_GRADIENT n` of the fragment source, or null (post program). */
  gradientId: number | null;
  /** Whether the fragment source defines WAVR_CUSTOM. */
  custom: boolean;
}

export interface FakeGLOptions {
  /** Expose KHR_parallel_shader_compile. Compiles then stay pending until `controls.compileComplete`. */
  parallelCompile?: boolean;
  /** Expose EXT_color_buffer_float. */
  floatTargets?: boolean;
}

interface UniformLocation {
  program: Handle;
  name: string;
}

export function createFakeGL(options: FakeGLOptions = {}) {
  let nextId = 1;
  const make = (kind: string): Handle => ({ id: nextId++, kind });

  const controls = {
    /** With parallelCompile: whether COMPLETION_STATUS_KHR reads true. */
    compileComplete: !options.parallelCompile,
    failCompile: false,
    failLink: false,
    infoLog: "",
    /** Report RGBA16F framebuffers as unsupported. */
    rejectFloatTargets: false,
    contextLost: false,
  };

  let activeUnit = 0;
  const units = new Map<number, Handle | null>();
  let drawFramebuffer: Handle | null = null;
  let program: Handle | null = null;
  const attachments = new Map<Handle, Handle>(); // fbo → colour texture
  const textureFormats = new Map<Handle, string>(); // texture → internal format
  const uniformsByProgram = new Map<Handle | null, Record<string, UniformValue>>();
  const locations = new Map<Handle, Map<string, UniformLocation>>();
  const shaderSources = new Map<Handle, string>();
  const programShaders = new Map<Handle, Handle[]>();
  const uniformCalls: string[] = []; // location name per upload, in order
  const programs: ProgramInfo[] = [];
  const draws: DrawRecord[] = [];
  const feedbackLoops: string[] = [];
  /** Status queries that would block on a real driver (made before the compile finished). */
  const blockingQueries: string[] = [];

  const uniformsFor = () => {
    let u = uniformsByProgram.get(program);
    if (!u) {
      u = {};
      uniformsByProgram.set(program, u);
    }
    return u;
  };

  const recordDraw = () => {
    const target = drawFramebuffer;
    const attached = target ? attachments.get(target) : undefined;
    for (const [unit, tex] of units) {
      if (attached && tex === attached) {
        feedbackLoops.push(`draw ${draws.length}: texture ${tex.id} bound to unit ${unit} while rendering into it`);
      }
    }
    draws.push({ program, target, uniforms: { ...uniformsFor() }, boundTextures: new Map(units) });
  };

  const setUniform = (loc: unknown, value: UniformValue) => {
    const location = loc as UniformLocation | null;
    if (!location || typeof location !== "object") return;
    uniformCalls.push(location.name);
    uniformsFor()[location.name] = value;
  };

  const parallelExtension = { COMPLETION_STATUS_KHR: "COMPLETION_STATUS_KHR" };

  const queryStatus = (what: string) => {
    if (options.parallelCompile && !controls.compileComplete) blockingQueries.push(what);
  };

  const methods: Record<string, (...args: never[]) => unknown> = {
    createTexture: () => make("texture"),
    createFramebuffer: () => make("framebuffer"),
    createProgram: () => {
      const handle = make("program");
      programs.push({
        handle,
        vertexSource: "",
        fragmentSource: "",
        linkCalls: 0,
        deleted: false,
        gradientId: null,
        custom: false,
      });
      programShaders.set(handle, []);
      return handle;
    },
    createShader: () => make("shader"),
    createBuffer: () => make("buffer"),
    createVertexArray: () => make("vao"),
    shaderSource: (shader: Handle, source: string) => { shaderSources.set(shader, source); },
    attachShader: (p: Handle, shader: Handle) => { programShaders.get(p)?.push(shader); },
    linkProgram: (p: Handle) => {
      const info = programs.find((candidate) => candidate.handle === p)!;
      info.linkCalls++;
      const [vertex, fragment] = (programShaders.get(p) ?? []).map((s) => shaderSources.get(s) ?? "");
      info.vertexSource = vertex ?? "";
      info.fragmentSource = fragment ?? "";
      const define = /#define WAVR_GRADIENT (-?\d+)/.exec(info.fragmentSource);
      info.gradientId = define ? Number(define[1]) : null;
      info.custom = /#define WAVR_CUSTOM\b/.test(info.fragmentSource);
    },
    deleteProgram: (p: Handle) => {
      const info = programs.find((candidate) => candidate.handle === p);
      if (info) info.deleted = true;
    },
    getUniformLocation: (p: Handle, name: string) => {
      let byName = locations.get(p);
      if (!byName) {
        byName = new Map();
        locations.set(p, byName);
      }
      let loc = byName.get(name);
      if (!loc) {
        loc = { program: p, name };
        byName.set(name, loc);
      }
      return loc;
    },
    getAttribLocation: () => 0,
    getShaderParameter: (_s: Handle, pname: string) => {
      queryStatus(`getShaderParameter(${pname})`);
      return !controls.failCompile;
    },
    getProgramParameter: (_p: Handle, pname: string) => {
      if (pname === parallelExtension.COMPLETION_STATUS_KHR) return controls.compileComplete;
      queryStatus(`getProgramParameter(${pname})`);
      return !controls.failLink;
    },
    getShaderInfoLog: () => controls.infoLog,
    getProgramInfoLog: () => controls.infoLog,
    checkFramebufferStatus: () => {
      const attached = drawFramebuffer ? attachments.get(drawFramebuffer) : undefined;
      if (controls.rejectFloatTargets && attached && textureFormats.get(attached) === "RGBA16F") {
        return "FRAMEBUFFER_UNSUPPORTED";
      }
      return "FRAMEBUFFER_COMPLETE";
    },
    isContextLost: () => controls.contextLost,
    getExtension: (name: string) => {
      if (name === "KHR_parallel_shader_compile") return options.parallelCompile ? parallelExtension : null;
      if (name === "EXT_color_buffer_float") return options.floatTargets ? {} : null;
      return null;
    },
    getParameter: (name: string) => (name === "MAX_VIEWPORT_DIMS" ? new Int32Array([4096, 4096]) : 4096),
    useProgram: (p: Handle | null) => { program = p; },
    activeTexture: (unit: string) => { activeUnit = Number(unit.replace("TEXTURE", "")); },
    bindTexture: (_t: never, tex: Handle | null) => { units.set(activeUnit, tex); },
    texImage2D: (_target: never, _level: never, internalFormat: string) => {
      const tex = units.get(activeUnit);
      if (tex) textureFormats.set(tex, String(internalFormat));
    },
    bindFramebuffer: (target: string, fbo: Handle | null) => {
      if (target === "FRAMEBUFFER" || target === "DRAW_FRAMEBUFFER") drawFramebuffer = fbo;
    },
    framebufferTexture2D: (_t: never, _a: never, _tt: never, tex: Handle) => {
      if (drawFramebuffer) attachments.set(drawFramebuffer, tex);
    },
    uniform1i: (loc: never, v: number) => setUniform(loc, v),
    uniform1f: (loc: never, v: number) => setUniform(loc, v),
    uniform2f: (loc: never, x: number, y: number) => setUniform(loc, [x, y]),
    uniform3f: (loc: never, x: number, y: number, z: number) => setUniform(loc, [x, y, z]),
    uniform3fv: (loc: never, v: ArrayLike<number>) => setUniform(loc, Array.from(v)),
    uniformMatrix4fv: (loc: never, _t: never, v: ArrayLike<number>) => setUniform(loc, Array.from(v)),
    drawArrays: () => recordDraw(),
    drawElements: () => recordDraw(),
  };

  const canvas = { width: 16, height: 8 } as unknown as HTMLCanvasElement;
  const gl = new Proxy({ canvas } as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop in methods) return methods[prop];
      if (/^[A-Z0-9_]+$/.test(prop)) return prop; // GL enum → its own name
      return () => undefined; // every other GL call is a no-op
    },
  });
  (canvas as unknown as { getContext: () => unknown }).getContext = () => gl;

  /** The recorded program a draw used. */
  const programOf = (draw: DrawRecord): ProgramInfo | undefined =>
    programs.find((info) => info.handle === draw.program);

  return {
    canvas,
    draws,
    feedbackLoops,
    attachments,
    textureFormats,
    uniformCalls,
    programs,
    blockingQueries,
    controls,
    programOf,
  };
}
