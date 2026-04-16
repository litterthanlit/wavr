import { GradientEngine } from "./engine";
import { GradientConfig, GradientHandle, CreateGradientOptions, AnimateOptions } from "./types";
import { resolveConfig } from "./config";
import { TweenManager } from "./animate";

export function createGradient(
  canvas: HTMLCanvasElement,
  config: GradientConfig,
  options?: CreateGradientOptions,
): GradientHandle {
  let currentConfig = { ...config };
  let state = resolveConfig(currentConfig);
  let destroyed = false;

  const engine = new GradientEngine(canvas);
  const tweenManager = new TweenManager();

  // Timeline progress support
  let timelineDuration = 10; // default timeline length in seconds
  let timelineMode = false;

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

  // Start render loop with tween tick
  engine.startLoop(() => {
    // Tick active animations
    const tweenUpdate = tweenManager.tick(currentConfig);
    if (tweenUpdate) {
      currentConfig = { ...currentConfig, ...tweenUpdate };
      if (tweenUpdate.layers) currentConfig.layers = tweenUpdate.layers;
      state = resolveConfig(currentConfig);
    }
    return state;
  });

  const handle: GradientHandle = {
    update(partial: Partial<GradientConfig>) {
      if (destroyed) return;
      currentConfig = { ...currentConfig, ...partial };
      if (partial.layers) currentConfig.layers = partial.layers;
      state = resolveConfig(currentConfig);
    },

    play() {
      if (destroyed) return;
      timelineMode = false;
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

    setTimelineProgress(t: number) {
      if (destroyed) return;
      // t is 0-1 normalized, maps to elapsed time
      const clamped = Math.max(0, Math.min(1, t));
      engine.setElapsedTime(clamped * timelineDuration);
    },

    animateTo(targetConfig: Partial<GradientConfig>, animOptions: AnimateOptions) {
      if (destroyed) return;
      tweenManager.animateTo(currentConfig, targetConfig, animOptions);
    },

    resize(width: number, height: number) {
      if (destroyed) return;
      engine.resize(width, height);
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      tweenManager.cancel();
      engine.stopLoop();
      engine.destroy();
    },
  };

  return handle;
}
