// Records the GL calls GradientEngine makes, so pass structure (which
// framebuffer each draw targets, which uniforms it sees, which textures are
// bound) and upload counts can be checked without a real WebGL context.
// Uniform values are tracked per program, like real GL.

export type Handle = { id: number; kind: string };
export type UniformValue = number | number[];

export interface DrawRecord {
  program: Handle | null;
  target: Handle | null;
  uniforms: Record<string, UniformValue>;
  boundTextures: Map<number, Handle | null>;
}

export function createFakeGL() {
  let nextId = 1;
  const make = (kind: string): Handle => ({ id: nextId++, kind });

  let activeUnit = 0;
  const units = new Map<number, Handle | null>();
  let drawFramebuffer: Handle | null = null;
  let program: Handle | null = null;
  const attachments = new Map<Handle, Handle>(); // fbo → colour texture
  const uniformsByProgram = new Map<Handle | null, Record<string, UniformValue>>();
  const uniformCalls: string[] = []; // location name per upload, in order
  const draws: DrawRecord[] = [];
  const feedbackLoops: string[] = [];

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
    if (typeof loc !== "string") return;
    uniformCalls.push(loc);
    uniformsFor()[loc] = value;
  };

  const methods: Record<string, (...args: never[]) => unknown> = {
    createTexture: () => make("texture"),
    createFramebuffer: () => make("framebuffer"),
    createProgram: () => make("program"),
    createShader: () => make("shader"),
    createBuffer: () => make("buffer"),
    createVertexArray: () => make("vao"),
    getUniformLocation: (_p: never, name: string) => name,
    getAttribLocation: () => 0,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    checkFramebufferStatus: () => "FRAMEBUFFER_COMPLETE",
    isContextLost: () => false,
    getExtension: () => null,
    getParameter: () => 4096,
    useProgram: (p: Handle) => { program = p; },
    activeTexture: (unit: string) => { activeUnit = Number(unit.replace("TEXTURE", "")); },
    bindTexture: (_t: never, tex: Handle | null) => { units.set(activeUnit, tex); },
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

  return { canvas, draws, feedbackLoops, attachments, uniformCalls };
}
