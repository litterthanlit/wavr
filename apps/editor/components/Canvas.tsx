"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GradientEngine, attachPointer, type EngineMetrics } from "@wavr/core";
import type { WebGPUHdrOutput } from "@wavr/core/webgpu-hdr-output";
import { useGradientStore, getEditorPerformanceSettings } from "@/lib/store";
import { normalizeTimelineTime, type PlaybackMode } from "@/lib/timeline";
import { applyEnginePerformanceSettings, applyTimeline, withPerformanceMode } from "@/lib/frame-state";
import { setHdrStatus } from "@/lib/hdr-status";
import { useHdrDisplay } from "@/lib/useHdrDisplay";
import { useRenderStats } from "@/lib/useRenderStats";
import Toast from "@/components/ui/Toast";

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onEngineReady?: (engine: GradientEngine) => void;
}

export default function Canvas({ onCanvasReady, onEngineReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hdrCanvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  const hdrWanted = useGradientStore((state) => state.hdrHeadroom > 0);
  const hdrDisplay = useHdrDisplay();
  const showStats = useRenderStats();
  const [fps, setFps] = useState(0);
  const [metrics, setMetrics] = useState<EngineMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const degradedRef = useRef(false);
  const textCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTextParamsRef = useRef<string>("");
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
      applyEnginePerformanceSettings(engine, getEditorPerformanceSettings(useGradientStore.getState().performanceMode));
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
        // initProgram dropped the text mask texture along with everything else.
        lastTextParamsRef.current = "";
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

      // In auto mode the engine lowers its render scale on its own when frames
      // run late (and raises it again later). The user's settings are not
      // touched; tell them once why the picture may be softer.
      if (!degradedRef.current && engine.getRenderScale() < 1 && useGradientStore.getState().performanceMode === "auto") {
        degradedRef.current = true;
        setToastMsg("Lowered render resolution to keep playback smooth");
      }
    };

    // Gradient types compile the first time they are drawn. Frames are skipped
    // until then (the last one stays on screen); only hint at it when a
    // compile takes noticeable time.
    let compilingSince = 0;
    let compilingShown = false;
    const trackCompiling = () => {
      if (!engine.isCompiling()) {
        compilingSince = 0;
        if (compilingShown) {
          compilingShown = false;
          setCompiling(false);
        }
        return;
      }
      const now = performance.now();
      if (compilingSince === 0) compilingSince = now;
      if (!compilingShown && now - compilingSince > 300) {
        compilingShown = true;
        setCompiling(true);
      }
    };

    let lastTimelineUpdate = performance.now();
    let timelineSampleTime = useGradientStore.getState().timelinePosition;
    let lastSyncedTimelinePosition = timelineSampleTime;
    let lastTimelineCursorSync = 0;
    const getFrameState = () => {
      trackCompiling();
      const state = useGradientStore.getState();

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

        const withTimeline = applyTimeline(state, timelineSampleTime);
        if (withTimeline !== state) return withPerformanceMode(withTimeline);
      } else {
        lastTimelineUpdate = performance.now();
        timelineSampleTime = state.timelinePosition;
        lastSyncedTimelinePosition = state.timelinePosition;
      }

      return withPerformanceMode(state);
    };

    const startEngineLoop = () => {
      lastTimelineUpdate = performance.now();
      // A shader that fails to compile surfaces here, from the first frame that needs it.
      engine.startLoop(getFrameState, handleFps, (err) => setError(err.message));
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
    // The pointer reacts while it is over the canvas, not anywhere on the page.
    const detachPointer = attachPointer(canvas, engine, { ripple: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

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
      detachPointer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribePerformance();
      engine.destroy();
    };
  }, [onCanvasReady, onEngineReady, syncTextMaskTexture]);

  // HDR: while the scene asks for headroom and the screen can show it, frames
  // go to an extended-range WebGPU canvas laid over the WebGL one (which the
  // engine then only packs frames onto). The WebGL canvas stays in place,
  // invisible, so it keeps the layout and the pointer. Attaching and detaching
  // draw a frame at once, so the swap shows no blank frame. The effect runs
  // after the engine's own, and again whenever that rebuilds the engine.
  useEffect(() => {
    const engine = engineRef.current;
    const glCanvas = canvasRef.current;
    const hdrCanvas = hdrCanvasRef.current;
    if (!hdrWanted || hdrDisplay !== true || !engine || !glCanvas || !hdrCanvas) {
      setHdrStatus("off");
      return;
    }
    let cancelled = false;
    let output: WebGPUHdrOutput | null = null;
    const detach = () => {
      engine.setHdrOutput(null);
      glCanvas.style.opacity = "";
      hdrCanvas.style.display = "";
    };
    setHdrStatus("starting");
    import("@wavr/core/webgpu-hdr-output")
      .then(({ createWebGPUHdrOutput }) => createWebGPUHdrOutput(hdrCanvas, useGradientStore.getState().colorProfile))
      .then((created) => {
        if (cancelled) {
          created?.dispose();
          return;
        }
        if (!created) {
          setHdrStatus("unsupported");
          return;
        }
        output = created;
        created.onLost = () => {
          detach();
          setHdrStatus("lost");
        };
        engine.setHdrOutput(created);
        hdrCanvas.style.display = "block";
        glCanvas.style.opacity = "0";
        setHdrStatus("on");
      })
      .catch(() => {
        if (!cancelled) setHdrStatus("unsupported");
      });
    return () => {
      cancelled = true;
      if (output) {
        detach();
        output.dispose();
      }
    };
  }, [hdrWanted, hdrDisplay, onCanvasReady, onEngineReady]);

  // Reduced motion: pause by default
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      useGradientStore.getState().set({ playing: false });
    }
  }, []);

  if (error) {
    return (
      <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-litt-canvas">
        <div className="text-center max-w-sm px-4">
          <p className="text-litt-fg text-litt-body font-litt-title mb-2">Unable to render</p>
          <p className="text-litt-fg-subtle text-litt-small">{error}</p>
          <p className="text-litt-fg-subtle text-litt-small mt-1">
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
      <canvas
        ref={hdrCanvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden h-full w-full"
      />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-litt-canvas/80">
          <p className="text-litt-fg-muted text-litt-body">Recovering WebGL context...</p>
        </div>
      )}
      {compiling && !contextLost && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="rounded-litt-control bg-litt-surface-1/70 px-2 py-1 text-litt-small text-litt-fg-muted">Compiling shader...</p>
        </div>
      )}
      {showStats && (
        <div className="absolute bottom-3 left-3 font-mono text-litt-caption font-normal text-litt-fg-subtle bg-litt-surface-1/70 px-2 py-0.5 rounded-litt-control">
          {fps} FPS
          {metrics && (
            <> · {metrics.lastCpuFrameMs.toFixed(1)}ms CPU · {metrics.framebufferCount} FBO · {formatBytes(metrics.estimatedBytes)}</>
        )}
        {metrics && metrics.renderScale < 1 && <> · {Math.round(metrics.renderScale * 100)}% res</>}
      </div>
      )}
      <Toast
        message={toastMsg ?? ""}
        visible={toastMsg !== null}
        onDismiss={() => setToastMsg(null)}
      />
    </div>
  );
}
