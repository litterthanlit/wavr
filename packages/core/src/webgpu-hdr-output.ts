/// <reference types="@webgpu/types" />
import type { ColorProfile } from "./layers";
import type { HdrOutput } from "./hdr";

// The packing's inverse (hdr-pack.glsl): 12 bits a channel, the high 8 in
// tile 0, the low 4 of red and green in tile 1's red byte, of blue in its green
// byte; the alpha in its blue byte. The canvas takes premultiplied colour.
const DECODE_WGSL = /* wgsl */ `
@group(0) @binding(0) var high: texture_2d<f32>;
@group(0) @binding(1) var low: texture_2d<f32>;
@group(0) @binding(2) var<uniform> range: vec4f;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) position: vec4f) -> @location(0) vec4f {
  let p = vec2i(position.xy);
  let a = round(textureLoad(high, p, 0) * 255.0);
  let b = round(textureLoad(low, p, 0) * 255.0);
  let rg = floor(b.r / 16.0);
  let lo = vec3f(rg, b.r - 16.0 * rg, floor(b.g / 16.0));
  let color = (a.rgb * 16.0 + lo) * (range.x / 4095.0);
  let alpha = b.b / 255.0;
  return vec4f(color * alpha, alpha);
}
`;

const CANVAS_FORMAT: GPUTextureFormat = "rgba16float";

/**
 * An HDR output on a WebGPU canvas configured for extended range (half-float,
 * toneMapping "extended"), so display values past 1 show brighter than white
 * on an HDR screen, as far as the screen's headroom goes (past that the
 * compositor clips). Made by createWebGPUHdrOutput().
 */
export class WebGPUHdrOutput implements HdrOutput {
  /** Called once if the GPU device is lost or presenting fails; the output is dead after it. */
  onLost: (() => void) | null = null;
  private tiles: [GPUTexture, GPUTexture] | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private width = 0;
  private height = 0;
  private range = -1;
  private disposed = false;
  private failed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly pipeline: GPURenderPipeline,
    private readonly rangeBuffer: GPUBuffer,
    private profile: ColorProfile,
  ) {
    device.lost.then(() => this.fail());
  }

  copyTile(source: HTMLCanvasElement, tile: 0 | 1) {
    if (this.failed) return;
    try {
      this.ensureTiles(source.width, source.height);
      this.device.queue.copyExternalImageToTexture(
        { source },
        { texture: this.tiles![tile] },
        [this.width, this.height],
      );
    } catch {
      this.fail();
    }
  }

  present(range: number, profile: ColorProfile) {
    if (this.failed || !this.tiles) return;
    try {
      if (this.canvas.width !== this.width || this.canvas.height !== this.height) {
        this.canvas.width = this.width;
        this.canvas.height = this.height;
      }
      if (profile !== this.profile) {
        this.profile = profile;
        configureCanvas(this.context, this.device, profile);
      }
      if (range !== this.range) {
        this.range = range;
        this.device.queue.writeBuffer(this.rangeBuffer, 0, new Float32Array([range, 0, 0, 0]));
      }
      const encoder = this.device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          loadOp: "clear",
          clearValue: [0, 0, 0, 0],
          storeOp: "store",
        }],
      });
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup!);
      pass.draw(3);
      pass.end();
      this.device.queue.submit([encoder.finish()]);
    } catch {
      this.fail();
    }
  }

  /** Releases the GPU device; the canvas goes blank. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.failed = true;
    this.tiles?.forEach((texture) => texture.destroy());
    this.tiles = null;
    this.context.unconfigure();
    this.device.destroy();
  }

  private ensureTiles(width: number, height: number) {
    width = Math.max(1, width);
    height = Math.max(1, height);
    if (this.tiles && width === this.width && height === this.height) return;
    this.tiles?.forEach((texture) => texture.destroy());
    const tile = () => this.device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      // copyExternalImageToTexture writes through a render pass.
      usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.tiles = [tile(), tile()];
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.tiles[0].createView() },
        { binding: 1, resource: this.tiles[1].createView() },
        { binding: 2, resource: { buffer: this.rangeBuffer } },
      ],
    });
    this.width = width;
    this.height = height;
  }

  private fail() {
    if (this.failed) return;
    this.failed = true;
    if (!this.disposed) this.onLost?.();
  }
}

function configureCanvas(context: GPUCanvasContext, device: GPUDevice, profile: ColorProfile) {
  context.configure({
    device,
    format: CANVAS_FORMAT,
    colorSpace: profile,
    toneMapping: { mode: "extended" },
    alphaMode: "premultiplied",
  });
}

/**
 * An HDR output on `canvas` (which it takes over with a WebGPU context), or
 * null where the browser has no WebGPU, no GPU adapter, or no extended-range
 * canvas (one that doesn't know toneMapping ignores it and clips at white).
 */
export async function createWebGPUHdrOutput(
  canvas: HTMLCanvasElement,
  profile: ColorProfile = "srgb",
): Promise<WebGPUHdrOutput | null> {
  const gpu = typeof navigator !== "undefined" ? navigator.gpu : undefined;
  if (!gpu) return null;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) {
      device.destroy();
      return null;
    }
    configureCanvas(context, device, profile);
    if (context.getConfiguration?.()?.toneMapping?.mode !== "extended") {
      context.unconfigure();
      device.destroy();
      return null;
    }
    const module = device.createShaderModule({ code: DECODE_WGSL });
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "vs" },
      fragment: { module, entryPoint: "fs", targets: [{ format: CANVAS_FORMAT }] },
      primitive: { topology: "triangle-list" },
    });
    const rangeBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    return new WebGPUHdrOutput(canvas, device, context, pipeline, rangeBuffer, profile);
  } catch {
    return null;
  }
}
