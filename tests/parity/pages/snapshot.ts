// Snapshot page, driven by tests/parity/snapshot.mjs. Bundled by the same tsup
// config as runner.ts (`pnpm build:parity-runner`) into snapshot.global.js and
// loaded by snapshot.html. Unlike the runner it has no animation loop: it owns
// a GradientEngine and renders one frame per call with engine.captureImageData
// (offscreen, never a read of the WebGL canvas), so frames come out exactly
// as an export would render them.
//
//   window.__wavrSnapshotReady : Promise<void>
//   window.__wavrGradientTypes : the gradient types, in GRADIENT_TYPES order
//   window.__wavrPresets       : the ids of the built-in presets (PRESET_CATALOG order)
//   window.__wavrSnapshot      : (job, timeSeconds, sizePx, aspect = 1) => Promise<SnapshotResult>
//                                (size is the height; the width is size * aspect)

import {
  GRADIENT_TYPES,
  GradientEngine,
  createLayer,
  resolveConfig,
  type EngineState,
  type GradientConfig,
  type GradientType,
  type LayerParams,
} from "@wavr/core";
import { PRESET_CATALOG } from "@wavr/core/presets";

/**
 * A default layer of one gradient type, optionally with another palette and
 * layer / global-state overrides, or a whole parity-fixture config.
 */
export type SnapshotJob =
  | {
      type: GradientType;
      colors?: [number, number, number][];
      layer?: Partial<LayerParams>;
      state?: Partial<EngineState>;
    }
  | { config: GradientConfig }
  | { preset: string };

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
    __wavrPresets: readonly string[];
    __wavrSnapshot: (job: SnapshotJob, time: number, size: number, aspect?: number) => Promise<SnapshotResult>;
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
      window.__wavrPresets = PRESET_CATALOG.map((entry) => entry.id);
      window.__wavrSnapshot = async (job, time, size, aspect = 1) => {
        let state;
        if ("type" in job) {
          const layer = createLayer({
            gradientType: job.type,
            colors: job.colors,
            imageData: job.type === "image" ? testImage : null,
            ...job.layer,
          });
          state = { ...resolveConfig({ layers: [] }), layers: [layer], ...job.state };
          if (layer.imageData) await textureReady(engine, layer.imageData);
        } else if ("preset" in job) {
          const entry = PRESET_CATALOG.find((candidate) => candidate.id === job.preset);
          if (!entry) throw new Error(`snapshot: no preset "${job.preset}"`);
          state = resolveConfig(entry.config);
        } else {
          state = resolveConfig(job.config);
        }

        const readyBefore = engine.getMetrics().totalShaderCompileMs;
        const start = performance.now();
        const frame = engine.captureImageData({ state, time, width: Math.round(size * aspect), height: size });
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
