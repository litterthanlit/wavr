"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GradientEngine, type EngineMetrics } from "@wavr/core";
import {
  useGradientStore,
  GradientState,
  getEditorPerformanceSettings,
} from "@/lib/store";
import { interpolateKeyframes, normalizeTimelineTime, type Keyframe, type PlaybackMode } from "@/lib/timeline";
import { AudioAnalyzer, AudioBands } from "@/lib/audio";
import Toast from "@/components/ui/Toast";

// Shared audio analyzer instance (persists across re-renders)
let sharedAnalyzer: AudioAnalyzer | null = null;
export function getAudioAnalyzer(): AudioAnalyzer {
  if (!sharedAnalyzer) sharedAnalyzer = new AudioAnalyzer();
  return sharedAnalyzer;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function applyAudioBands(state: GradientState, bands: AudioBands): Partial<GradientState> {
  const s = state.audioSensitivity;
  const mods: Partial<GradientState> = {};
  const targets: Record<string, keyof GradientState> = {
    distortion: "distortion",
    scale: "scale",
    speed: "speed",
    brightness: "brightness",
    complexity: "complexity",
    noiseIntensity: "noiseIntensity",
    grain: "grain",
    bloomIntensity: "bloomIntensity",
  };

  function apply(target: string, value: number) {
    const key = targets[target];
    if (!key) return;
    const base = state[key] as number;
    (mods as Record<string, number>)[key] = base + value * s;
  }

  apply(state.audioBassTarget, bands.bass);
  apply(state.audioTrebleTarget, bands.treble);
  apply(state.audioEnergyTarget, bands.energy);

  return mods;
}

interface CanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onEngineReady?: (engine: GradientEngine) => void;
}

export default function Canvas({ onCanvasReady, onEngineReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  const [fps, setFps] = useState(0);
  const [metrics, setMetrics] = useState<EngineMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const degradedRef = useRef(false);
  const textCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTextParamsRef = useRef<string>("");
  const lowFpsStartRef = useRef<number | null>(null);
  const initErrorRef = useRef<string | null>(null);
  const textMaskParamsKey = useGradientStore((state) => {
    const layer = state.layers[state.activeLayerIndex];
    if (!layer) return `${state.activeLayerIndex}:missing`;

    return JSON.stringify({
      activeLayerIndex: state.activeLayerIndex,
      enabled: layer.textMaskEnabled,
      content: layer.textMaskContent,
      fontSize: layer.textMaskFontSize,
      fontWeight: layer.textMaskFontWeight,
      letterSpacing: layer.textMaskLetterSpacing,
      align: layer.textMaskAlign,
    });
  });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engineRef.current.setMouse(x, y);
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engineRef.current.triggerRipple(x, y);
  }, []);

  const syncTextMaskTexture = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const state = useGradientStore.getState();
    const layer = state.layers[state.activeLayerIndex];
    const mainCanvas = canvasRef.current;
    if (!layer || !mainCanvas) return;

    // Build a key from text params to detect changes, including texture size.
    const paramKey = JSON.stringify({
      width: mainCanvas.width,
      height: mainCanvas.height,
      enabled: layer.textMaskEnabled,
      content: layer.textMaskContent,
      fontSize: layer.textMaskFontSize,
      fontWeight: layer.textMaskFontWeight,
      letterSpacing: layer.textMaskLetterSpacing,
      align: layer.textMaskAlign,
    });

    if (paramKey === lastTextParamsRef.current) return;
    lastTextParamsRef.current = paramKey;

    // Create offscreen canvas on first use
    if (!textCanvasRef.current) {
      textCanvasRef.current = document.createElement("canvas");
    }
    const tc = textCanvasRef.current;

    tc.width = mainCanvas.width;
    tc.height = mainCanvas.height;

    const ctx = tc.getContext("2d");
    if (!ctx) return;

    // Black background (mask = 0)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, tc.width, tc.height);

    if (!layer.textMaskEnabled || !layer.textMaskContent) {
      engine.updateTextMaskTexture(tc);
      return;
    }

    // White text (mask = 1)
    const pixelRatio = mainCanvas.clientWidth > 0 ? mainCanvas.width / mainCanvas.clientWidth : 1;
    const fontSize = layer.textMaskFontSize * pixelRatio;
    ctx.font = `${layer.textMaskFontWeight} ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "white";
    ctx.textBaseline = "middle";

    let x: number;
    if (layer.textMaskAlign === "left") {
      ctx.textAlign = "left";
      x = fontSize * 0.5;
    } else if (layer.textMaskAlign === "right") {
      ctx.textAlign = "right";
      x = tc.width - fontSize * 0.5;
    } else {
      ctx.textAlign = "center";
      x = tc.width / 2;
    }

    ctx.fillText(layer.textMaskContent, x, tc.height / 2);

    engine.updateTextMaskTexture(tc);
  }, []);

  useEffect(() => {
    syncTextMaskTexture();
  }, [textMaskParamsKey, syncTextMaskTexture]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: GradientEngine;
    try {
      engine = new GradientEngine(canvas, { preserveDrawingBuffer: false });
    } catch (e) {
      initErrorRef.current = e instanceof Error ? e.message : "Failed to initialize WebGL";
      // Defer state update to avoid sync setState in effect
      requestAnimationFrame(() => setError(initErrorRef.current));
      return;
    }
    engineRef.current = engine;
    const applyPerformanceMode = () => {
      const settings = getEditorPerformanceSettings(useGradientStore.getState().performanceMode);
      engine.setMaxPixelRatio(settings.maxPixelRatio);
      engine.setMaxFrameRate(settings.maxFrameRate);
    };
    applyPerformanceMode();
    onCanvasReady?.(canvas);
    onEngineReady?.(engine);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      engine.resize(parent.clientWidth, parent.clientHeight);
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = parent.clientHeight + "px";
      syncTextMaskTexture();
    };

    resize();

    const resizeObserver = new ResizeObserver(resize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      engine.stopLoop();
    };

    const handleContextRestored = () => {
      try {
        engine.initProgram();
        resize();
        startEngineLoop();
        setContextLost(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore WebGL context");
      }
    };

    const handleFps = (newFps: number) => {
      setFps(newFps);
      setMetrics(engine.getMetrics());

      if (degradedRef.current) return;

      if (newFps < 30) {
        if (lowFpsStartRef.current === null) {
          lowFpsStartRef.current = performance.now();
        } else if (performance.now() - lowFpsStartRef.current > 2000) {
          degradedRef.current = true;
          const state = useGradientStore.getState();
          const updates: Partial<typeof state> = {};
          if (state.complexity > 1) updates.complexity = state.complexity - 1;
          if (Object.keys(updates).length > 0) {
            useGradientStore.getState().set(updates);
            setToastMsg("Reduced quality for performance");
          }
        }
      } else {
        lowFpsStartRef.current = null;
      }
    };

    let lastTimelineUpdate = performance.now();
    let timelineSampleTime = useGradientStore.getState().timelinePosition;
    let lastSyncedTimelinePosition = timelineSampleTime;
    let lastTimelineCursorSync = 0;
    const getFrameState = () => {
      const state = useGradientStore.getState();
      const withPerformanceMode = (nextState: GradientState): GradientState => {
        const settings = getEditorPerformanceSettings(nextState.performanceMode);
        if (settings.realBloom === "off" && nextState.realBloomEnabled) {
          return { ...nextState, realBloomEnabled: false };
        }
        return nextState;
      };

      // Advance timeline position and apply interpolated params
      if (state.timelineEnabled && state.playing && state.keyframes.length > 0) {
        const now = performance.now();
        const dt = (now - lastTimelineUpdate) / 1000;
        lastTimelineUpdate = now;

        if (Math.abs(state.timelinePosition - lastSyncedTimelinePosition) > 0.05) {
          timelineSampleTime = state.timelinePosition;
        }

        timelineSampleTime += dt;
        const visibleTimelinePosition = normalizeTimelineTime(
          timelineSampleTime,
          state.timelineDuration,
          state.timelinePlaybackMode as PlaybackMode,
        );

        if (now - lastTimelineCursorSync >= 1000 / 15) {
          state.setTimelinePosition(visibleTimelinePosition);
          lastSyncedTimelinePosition = visibleTimelinePosition;
          lastTimelineCursorSync = now;
        }

        const interpolated = interpolateKeyframes(
          state.keyframes as Keyframe[],
          timelineSampleTime,
          state.timelineDuration,
          state.timelinePlaybackMode as PlaybackMode,
        );
        if (interpolated) {
          return withPerformanceMode({ ...state, ...interpolated });
        }
      } else {
        lastTimelineUpdate = performance.now();
        timelineSampleTime = state.timelinePosition;
        lastSyncedTimelinePosition = state.timelinePosition;
      }

      // Audio reactivity: modulate params from frequency bands
      if (state.audioEnabled) {
        const analyzer = getAudioAnalyzer();
        if (analyzer.active) {
          const bands = analyzer.getBands();
          const mods = applyAudioBands(state, bands);
          return withPerformanceMode({ ...state, ...mods });
        }
      }

      return withPerformanceMode(state);
    };

    const startEngineLoop = () => {
      lastTimelineUpdate = performance.now();
      engine.startLoop(getFrameState, handleFps);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        engine.stopLoop();
        return;
      }
      startEngineLoop();
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    canvas.addEventListener("click", handleClick);

    const unsubscribePerformance = useGradientStore.subscribe((state, prev) => {
      if (state.performanceMode !== prev.performanceMode) {
        applyPerformanceMode();
      }
    });

    if (document.visibilityState === "visible") {
      startEngineLoop();
    }

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      resizeObserver.disconnect();
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("click", handleClick);
      unsubscribePerformance();
      engine.destroy();
    };
  }, [handleMouseMove, handleClick, onCanvasReady, onEngineReady, syncTextMaskTexture]);

  // Reduced motion: pause by default
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      useGradientStore.getState().set({ playing: false });
    }
  }, []);

  if (error) {
    return (
      <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-root">
        <div className="text-center max-w-sm px-4">
          <p className="text-text-primary text-sm font-medium mb-2">Unable to render</p>
          <p className="text-text-tertiary text-xs">{error}</p>
          <p className="text-text-tertiary text-xs mt-1">
            Please use a modern browser (Chrome, Firefox, Edge, Safari 15+).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
      />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-root/80">
          <p className="text-text-secondary text-sm">Recovering WebGL context...</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 font-mono text-[11px] text-text-tertiary bg-base/70 px-2 py-0.5 rounded hidden lg:block">
        {fps} FPS
        {metrics && (
          <> · {metrics.lastCpuFrameMs.toFixed(1)}ms CPU · {metrics.framebufferCount} FBO · {formatBytes(metrics.estimatedBytes)}</>
        )}
      </div>
      <Toast
        message={toastMsg ?? ""}
        visible={toastMsg !== null}
        onDismiss={() => setToastMsg(null)}
      />
    </div>
  );
}
