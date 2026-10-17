// Snapshot page, driven by tests/parity/snapshot.mjs. Bundled by the same tsup
// config as runner.ts (`pnpm build:parity-runner`) into snapshot.global.js and
// loaded by snapshot.html. Unlike the runner it has no animation loop: it owns
// a GradientEngine and renders one frame per call with engine.captureImageData
// (offscreen, never a read of the WebGL canvas), so frames come out exactly
// as an export would render them.
//
//   window.__wavrSnapshotReady : Promise<void>
//   window.__wavrGradientTypes : the gradient types, in GRADIENT_TYPES order
//   window.__wavrSnapshot      : (job, SnapshotOptions) => Promise<SnapshotResult>
//
// A frame has no history, so the pointer is staged: `mouse` puts it somewhere
// and lets it settle (the mouse effects at rest under the pointer); `stroke`
// moves it along a line at constant speed and captures mid-motion (the
// velocity-driven parts, and the trail); `ripple` starts a click ripple and
// ages it.

import {
  GRADIENT_TYPES,
  GradientEngine,
  createLayer,
  resolveConfig,
  type EngineState,
  type GradientConfig,
  type GradientType,
} from "@wavr/core";

/** A default layer of one gradient type, or a whole parity-fixture config. */
export type SnapshotJob = { type: GradientType } | { config: GradientConfig };

/** Positions are uv: 0..1 across, y up. */
export interface SnapshotOptions {
  /** Animation time, seconds. */
  time: number;
  /** Capture size in pixels. */
  width: number;
  height: number;
  /** The pointer, settled here: present, at rest. Absent when neither this nor `stroke` is given. */
  mouse?: [number, number];
  /** The pointer travels from `from` to `to` over `seconds`, stepped at 60 Hz, and the frame is captured as it arrives. */
  stroke?: { from: [number, number]; to: [number, number]; seconds: number };
  /** A click at `at`, `age` seconds ago (rippleEnabled is switched on). */
  ripple?: { at: [number, number]; age: number };
  /** Overrides for the engine state (mouseReact, trailEnabled, ...). */
  state?: Record<string, number | boolean>;
}

export interface SnapshotResult {
  /** PNG, top-down. */
  dataUrl: string;
  width: number;
  height: number;
  /** captureImageData wall time; includes the first draw of a gradient type, which is where SwiftShader compiles. */
  captureMs: number;
  /** Time the driver took to report the programs this capture needed as ready (link, not first draw). */
  programsReadyMs: number;
  /** Share of pixels with any non-zero colour channel, 0-1. */
  litFraction: number;
  /** Mean of the pixels' luminance, 0-1. */
  meanLuma: number;
}

declare global {
  interface Window {
    __wavrSnapshotReady: Promise<void>;
    __wavrGradientTypes: readonly GradientType[];
    __wavrSnapshot: (job: SnapshotJob, options: SnapshotOptions) => Promise<SnapshotResult>;
  }
}

// The canvas starts at the default snapshot size, so the usual capture needs no resize.
const DEFAULT_SIZE = 512;

/** A picture for the `image` type, which draws nothing without one: colour bands, a grid and a ring. */
function makeTestImage(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext("2d")!;
  const bands = g.createLinearGradient(0, 0, 256, 256);
  bands.addColorStop(0, "#ff5f6d");
  bands.addColorStop(0.5, "#ffc371");
  bands.addColorStop(1, "#47e0d0");
  g.fillStyle = bands;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(255, 255, 255, 0.7)";
  g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  g.beginPath();
  g.arc(128, 128, 70, 0, Math.PI * 2);
  g.lineWidth = 12;
  g.strokeStyle = "#3b2f8f";
  g.stroke();
  return canvas.toDataURL("image/png");
}

/** Image textures upload asynchronously; wait until the engine has this one. */
async function textureReady(engine: GradientEngine, url: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (engine.loadImageTexture(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("snapshot: test image did not load");
}

window.__wavrSnapshotReady = new Promise<void>((resolve, reject) => {
  // Let the HTML parser finish before any shader work.
  setTimeout(() => {
    try {
      const canvas = document.getElementById("wavr") as HTMLCanvasElement | null;
      if (!canvas) throw new Error("snapshot: #wavr canvas not found in snapshot.html");
      // At the capture size already, so captureImageData doesn't resize the canvas around every frame.
      canvas.width = DEFAULT_SIZE;
      canvas.height = DEFAULT_SIZE;
      const engine = new GradientEngine(canvas);
      const testImage = makeTestImage();

      window.__wavrGradientTypes = GRADIENT_TYPES;
      window.__wavrSnapshot = async (job, options) => {
        const { time, width, height } = options;
        let state: EngineState;
        if ("type" in job) {
          const layer = createLayer({
            gradientType: job.type,
            imageData: job.type === "image" ? testImage : null,
          });
          state = { ...resolveConfig({ layers: [] }), layers: [layer] };
          if (layer.imageData) await textureReady(engine, layer.imageData);
        } else {
          state = resolveConfig(job.config);
        }
        if (options.state) state = { ...state, ...options.state } as EngineState;
        if (options.ripple) state = { ...state, rippleEnabled: true };

        // At the capture size already: the trail field is sized from the canvas,
        // and a resize inside captureImageData would throw a staged stroke away.
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }

        // Stage the pointer. The engine is shared between jobs, so start from
        // nothing: pointer absent, no ripple running, an empty trail.
        engine.setPointerActive(false);
        engine.settlePointer();
        engine.advancePointer(10);
        engine.updateTrail({ ...state, trailEnabled: false });
        if (options.mouse) {
          engine.setMouse(options.mouse[0], options.mouse[1]);
          engine.settlePointer();
        }
        if (options.stroke) {
          const { from, to, seconds } = options.stroke;
          const frames = Math.max(1, Math.round(seconds * 60));
          engine.setMouse(from[0], from[1]);
          engine.settlePointer();
          for (let i = 1; i <= frames; i++) {
            const t = i / frames;
            engine.setMouse(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
            engine.advancePointer(1 / 60);
            engine.updateTrail(state);
          }
        }
        if (options.ripple) {
          engine.triggerRipple(options.ripple.at[0], options.ripple.at[1]);
          engine.advancePointer(options.ripple.age);
        }

        const readyBefore = engine.getMetrics().totalShaderCompileMs;
        const start = performance.now();
        const frame = engine.captureImageData({ state, time, width, height });
        const captureMs = performance.now() - start;
        if (!frame) throw new Error("captureImageData returned null");
        const programsReadyMs = engine.getMetrics().totalShaderCompileMs - readyBefore;

        let lit = 0;
        let luma = 0;
        const { data } = frame;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          if (r !== 0 || g !== 0 || b !== 0) lit++;
          luma += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        }
        const pixels = data.length / 4;

        // A 2D canvas, not the WebGL one, turns the pixels into a PNG.
        const out = document.createElement("canvas");
        out.width = frame.width;
        out.height = frame.height;
        out.getContext("2d")!.putImageData(frame, 0, 0);

        return {
          dataUrl: out.toDataURL("image/png"),
          width: frame.width,
          height: frame.height,
          captureMs,
          programsReadyMs,
          litFraction: lit / pixels,
          meanLuma: luma / pixels / 255,
        };
      };
      resolve();
    } catch (err) {
      reject(err as Error);
    }
  }, 0);
});
