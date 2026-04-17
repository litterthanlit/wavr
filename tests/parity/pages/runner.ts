// Parity test runner page. Bundled via tsup into runner.js and loaded by
// runner.html. Exposes the contract described in specs/0002-parity-harness.md §3:
//
//   window.__wavrReady   : Promise<void>    resolves after shader warmup
//   window.__wavrRender  : (config, time) => Promise<Uint8Array>  raw RGBA bytes
//
// Adaptation vs §3: the spec says "handle.pause() then handle.setTime(time)
// then await rAF". In practice `GradientEngine.startLoop` early-returns when
// `state.playing === false`, so a paused engine never renders a fresh frame.
// Instead we freeze animation by setting speed multiplier to 0 (elapsedTime
// doesn't advance) and keeping the engine playing, which lets the rAF tick
// actually call render(). This is the "rAF-tick coordination" the spec said
// to revisit if flaky — documenting explicitly rather than silently deviating.

import { createGradient, type GradientConfig, type GradientHandle } from "@wavr/core";

declare global {
  interface Window {
    __wavrReady: Promise<void>;
    __wavrRender: (config: GradientConfig, time: number) => Promise<Uint8Array>;
  }
}

const CANVAS_SIZE = 512;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitFrames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) {
    await nextFrame();
  }
}

function readFramebuffer(canvas: HTMLCanvasElement): Uint8Array {
  const gl =
    (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
    (canvas.getContext("webgl") as WebGLRenderingContext | null);
  if (!gl) throw new Error("runner: failed to acquire WebGL context for readPixels");
  const width = canvas.width;
  const height = canvas.height;
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
}

function bootstrap(): Promise<{ canvas: HTMLCanvasElement; handle: GradientHandle }> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.getElementById("wavr") as HTMLCanvasElement | null;
      if (!canvas) throw new Error("runner: #wavr canvas not found in runner.html");
      // Lock backing-store size so devicePixelRatio can't re-scale us.
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;

      // Minimal valid config — gets overwritten on first __wavrRender call.
      const seed: GradientConfig = {
        layers: [
          {
            type: "linear",
            colors: [
              [0, 0, 0],
              [1, 1, 1],
            ],
            speed: 0,
            complexity: 1,
            distortion: 0,
          },
        ],
      };

      const handle = createGradient(canvas, seed, {
        onError: (err) => {
          // Surface to the page so Playwright's console capture picks it up.
          // eslint-disable-next-line no-console
          console.error("[wavr runner] engine error", err);
        },
      });

      resolve({ canvas, handle });
    } catch (err) {
      reject(err as Error);
    }
  });
}

const log = (msg: string): void => {
  // eslint-disable-next-line no-console
  console.log(`[wavr runner] ${msg}`);
};

const ready = (async () => {
  log("bootstrap:start");
  const { canvas, handle } = await bootstrap();
  log("bootstrap:done");

  // Freeze animation: speed=0 means elapsedTime advances by 0 each rAF tick,
  // so setTime(t) sticks. We keep the engine "playing" because pause() skips
  // render() entirely.
  handle.setSpeed(0);
  handle.play();
  log("engine:play");

  // Warmup: run a few frames so shader compile + uniform upload settle.
  await waitFrames(3);
  log("warmup:done");

  log("exposing __wavrRender");

  window.__wavrRender = async (config: GradientConfig, time: number): Promise<Uint8Array> => {
    handle.update(config);
    handle.setSpeed(0);
    handle.play();
    handle.setTime(time);
    // Two frames: first tick applies the freshly-uploaded uniforms + runs
    // render(), second guarantees the draw call has flushed to the framebuffer
    // before readPixels. preserveDrawingBuffer:true on the GL context keeps
    // the backbuffer valid after the frame settles.
    await waitFrames(2);
    return readFramebuffer(canvas);
  };
})().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error("[wavr runner] bootstrap failed", err);
  throw err;
});

window.__wavrReady = ready;
