// Parity test runner page. Bundled via tsup into runner.js and loaded by
// runner.html. Exposes the contract described in specs/0002-parity-harness.md §3:
//
//   window.__wavrReady   : Promise<void>    resolves after shader warmup
//   window.__wavrRender  : (config, time) => Promise<Uint8Array>  raw RGBA bytes
//
// Spec §3 said pause + setTime + rAF, then readPixels. That path is racy:
// startLoop skips render() while paused, and waiting on rAF after a presented
// frame clears the backbuffer when preserveDrawingBuffer is false — every
// fixture then hashed identically. captureFrame() is the follow-up the spec
// called out (engine.renderNow + readPixels in the same turn).

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
        preserveDrawingBuffer: true,
        maxPixelRatio: 1,
        onError: (err) => {
          // Surface to the page so Playwright's console capture picks it up.
          // eslint-disable-next-line no-console
          console.error("[wavr runner] engine error", err);
        },
      });
      handle.resize(CANVAS_SIZE, CANVAS_SIZE);

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
  const { handle } = await bootstrap();
  log("bootstrap:done");

  handle.setSpeed(0);
  handle.pause();
  log("engine:paused");

  // Warmup draw so shader compile + uniform upload settle before the first
  // captured fixture. captureFrame() is synchronous (render + readPixels).
  handle.captureFrame();
  await waitFrames(1);
  log("warmup:done");

  log("exposing __wavrRender");

  window.__wavrRender = async (config: GradientConfig, time: number): Promise<Uint8Array> => {
    handle.update(config);
    handle.setSpeed(0);
    handle.pause();
    handle.setTime(time);
    return handle.captureFrame();
  };
})().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error("[wavr runner] bootstrap failed", err);
  throw err;
});

window.__wavrReady = ready;
