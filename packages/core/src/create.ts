import { GradientEngine } from "./engine";
import { GradientConfig, GradientHandle, CreateGradientOptions } from "./types";
import { resolveConfig } from "./config";

export function createGradient(
  canvas: HTMLCanvasElement,
  config: GradientConfig,
  options?: CreateGradientOptions,
): GradientHandle {
  let currentConfig = { ...config };
  let state = resolveConfig(currentConfig);
  let destroyed = false;

  const engine = new GradientEngine(canvas);

  // Context loss handling
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    options?.onContextLost?.();
    options?.onError?.(new Error("WebGL context lost"));
  });
  canvas.addEventListener("webglcontextrestored", () => {
    options?.onContextRestored?.();
    engine.initProgram();
  });

  // Start render loop
  engine.startLoop(() => state);

  const handle: GradientHandle = {
    update(partial: Partial<GradientConfig>) {
      if (destroyed) return;
      // Merge config — layers replace entirely if provided
      currentConfig = { ...currentConfig, ...partial };
      if (partial.layers) currentConfig.layers = partial.layers;
      state = resolveConfig(currentConfig);
    },

    play() {
      if (destroyed) return;
      state = { ...state, playing: true };
    },

    pause() {
      if (destroyed) return;
      state = { ...state, playing: false };
    },

    setMouse(x: number, y: number) {
      if (destroyed) return;
      engine.setMouse(x, y);
    },

    setTime(t: number) {
      if (destroyed) return;
      engine.setElapsedTime(t);
    },

    setSpeed(multiplier: number) {
      if (destroyed) return;
      engine.setSpeedMultiplier(multiplier);
    },

    resize(width: number, height: number) {
      if (destroyed) return;
      engine.resize(width, height);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      engine.stopLoop();
      engine.destroy();
    },
  };

  return handle;
}
