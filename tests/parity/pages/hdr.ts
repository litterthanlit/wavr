// HDR output check page. Bundled via tsup into hdr.global.js and loaded by
// hdr.html; hdr.test.ts drives it.
//
//   window.__wavrHdr(config, headroom) renders `config` twice at t = 1s: as a
//   standard-range capture (captureImageData, RGBA8) and as a live frame
//   through the real HDR output (engine -> hdr-pack -> WebGPU decode onto an
//   extended-range canvas), whose half-float pixels it reads back. Resolves
//   { unsupported: true } without a WebGPU adapter.

import { GradientEngine, resolveConfig, type GradientConfig } from "@wavr/core";
import { createWebGPUHdrOutput } from "@wavr/core/webgpu-hdr-output";

export interface HdrRun {
  unsupported?: true;
  width: number;
  height: number;
  /** The standard-range capture, RGBA 0..255, top row first. */
  sdr: number[];
  /** The HDR canvas, RGBA display values (premultiplied, past 1 where brighter than white), top row first. */
  hdr: number[];
}

declare global {
  interface Window {
    __wavrHdr: (config: GradientConfig, headroom: number) => Promise<HdrRun>;
  }
}

const WIDTH = 64;
const HEIGHT = 48;

function halfToFloat(h: number): number {
  const sign = h & 0x8000 ? -1 : 1;
  const exponent = (h >> 10) & 0x1f;
  const fraction = h & 0x3ff;
  if (exponent === 0) return sign * (fraction / 1024) * 2 ** -14;
  if (exponent === 31) return fraction ? NaN : sign * Infinity;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

window.__wavrHdr = async (config, headroom) => {
  const empty: HdrRun = { width: WIDTH, height: HEIGHT, sdr: [], hdr: [] };
  if (!navigator.gpu || !(await navigator.gpu.requestAdapter())) return { ...empty, unsupported: true };

  const glCanvas = document.createElement("canvas");
  glCanvas.width = WIDTH;
  glCanvas.height = HEIGHT;
  const hdrCanvas = document.createElement("canvas");
  document.body.append(glCanvas, hdrCanvas);

  const engine = new GradientEngine(glCanvas, {});
  engine.resize(WIDTH, HEIGHT);
  const state = { ...resolveConfig(config), hdrHeadroom: headroom, playing: false };
  // Compiles what the state needs, so the live render below draws.
  const capture = engine.captureImageData({ state, time: 1 });
  if (!capture) throw new Error("hdr page: capture failed");

  const output = await createWebGPUHdrOutput(hdrCanvas, state.colorProfile);
  if (!output) throw new Error("hdr page: no extended-range WebGPU canvas although there is an adapter");
  // Make the canvas texture readable (the output keeps this configuration).
  const context = hdrCanvas.getContext("webgpu")!;
  const configuration = context.getConfiguration()!;
  context.configure({ ...configuration, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });

  engine.setElapsedTime(1);
  engine.setHdrOutput(output);
  if (!engine.render(state) || !engine.isPresentingHdr()) throw new Error("hdr page: the live frame did not go to the HDR output");

  // The frame just presented, read back in the same task.
  const { device } = configuration;
  const texture = context.getCurrentTexture();
  const bytesPerRow = Math.ceil((WIDTH * 8) / 256) * 256;
  const buffer = device.createBuffer({ size: bytesPerRow * HEIGHT, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const encoder = device.createCommandEncoder();
  encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow }, [WIDTH, HEIGHT]);
  device.queue.submit([encoder.finish()]);
  await buffer.mapAsync(GPUMapMode.READ);
  const halves = new Uint16Array(buffer.getMappedRange());
  const hdr: number[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    for (let i = 0; i < WIDTH * 4; i++) hdr.push(halfToFloat(halves[(y * bytesPerRow) / 2 + i]));
  }
  buffer.unmap();

  engine.setHdrOutput(null);
  output.dispose();
  engine.destroy();
  glCanvas.remove();
  hdrCanvas.remove();
  return { width: WIDTH, height: HEIGHT, sdr: Array.from(capture.data), hdr };
};
