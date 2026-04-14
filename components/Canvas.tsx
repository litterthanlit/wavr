"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GradientEngine } from "@/lib/engine";
import { useGradientStore, GradientState, getInterpolatedParams } from "@/lib/store";
import { AudioAnalyzer, AudioBands } from "@/lib/audio";
import Toast from "@/components/ui/Toast";

// Shared audio analyzer instance (persists across re-renders)
let sharedAnalyzer: AudioAnalyzer | null = null;
export function getAudioAnalyzer(): AudioAnalyzer {
  if (!sharedAnalyzer) sharedAnalyzer = new AudioAnalyzer();
  return sharedAnalyzer;
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
}

export default function Canvas({ onCanvasReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const degradedRef = useRef(false);
  const textCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastTextParamsRef = useRef<string>("");
  const lowFpsStartRef = useRef<number | null>(null);
  const initErrorRef = useRef<string | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engineRef.current.setMouse(x, y);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: GradientEngine;
    try {
      engine = new GradientEngine(canvas);
    } catch (e) {
      initErrorRef.current = e instanceof Error ? e.message : "Failed to initialize WebGL";
      // Defer state update to avoid sync setState in effect
      requestAnimationFrame(() => setError(initErrorRef.current));
      return;
    }
    engineRef.current = engine;
    onCanvasReady?.(canvas);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      engine.resize(parent.clientWidth, parent.clientHeight);
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = parent.clientHeight + "px";
    };

    resize();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      engine.stopLoop();
    };

    const handleContextRestored = () => {
      try {
        engine.initProgram();
        resize();
        engine.startLoop(() => useGradientStore.getState(), handleFps);
        setContextLost(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore WebGL context");
      }
    };

    const handleFps = (newFps: number) => {
      setFps(newFps);

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

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    let lastTimelineUpdate = performance.now();
    engine.startLoop(() => {
      const state = useGradientStore.getState();

      // Advance timeline position and apply interpolated params
      if (state.timelineEnabled && state.playing && state.keyframes.length > 0) {
        const now = performance.now();
        const dt = (now - lastTimelineUpdate) / 1000;
        lastTimelineUpdate = now;
        const newPos = state.timelinePosition + dt;
        state.setTimelinePosition(newPos);

        const interpolated = getInterpolatedParams();
        if (interpolated) {
          return { ...state, ...interpolated };
        }
      } else {
        lastTimelineUpdate = performance.now();
      }

      // Audio reactivity: modulate params from frequency bands
      if (state.audioEnabled) {
        const analyzer = getAudioAnalyzer();
        if (analyzer.active) {
          const bands = analyzer.getBands();
          const mods = applyAudioBands(state, bands);
          return { ...state, ...mods };
        }
      }

      return state;
    }, handleFps);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(resizeTimeout);
      engine.destroy();
    };
  }, [handleMouseMove, onCanvasReady]);

  // Reduced motion: pause by default
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      useGradientStore.getState().set({ playing: false });
    }
  }, []);

  // Text mask: render text to offscreen canvas and upload as texture
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const state = useGradientStore.getState();
    const layer = state.layers[state.activeLayerIndex];
    if (!layer) return;

    // Build a key from text params to detect changes
    const paramKey = JSON.stringify({
      enabled: layer.textMaskEnabled,
      content: layer.textMaskContent,
      fontSize: layer.textMaskFontSize,
      fontWeight: layer.textMaskFontWeight,
      letterSpacing: layer.textMaskLetterSpacing,
      align: layer.textMaskAlign,
    });

    if (paramKey === lastTextParamsRef.current) return;
    lastTextParamsRef.current = paramKey;

    if (!layer.textMaskEnabled || !layer.textMaskContent) return;

    // Create offscreen canvas on first use
    if (!textCanvasRef.current) {
      textCanvasRef.current = document.createElement("canvas");
    }
    const tc = textCanvasRef.current;
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;

    tc.width = mainCanvas.width;
    tc.height = mainCanvas.height;

    const ctx = tc.getContext("2d");
    if (!ctx) return;

    // Black background (mask = 0)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, tc.width, tc.height);

    // White text (mask = 1)
    const fontSize = layer.textMaskFontSize * (window.devicePixelRatio || 1);
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
  });

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
      <div className="absolute bottom-3 left-3 font-mono text-[11px] text-text-tertiary bg-base/70 px-2 py-0.5 rounded hidden sm:block">
        {fps} FPS
      </div>
      <Toast
        message={toastMsg ?? ""}
        visible={toastMsg !== null}
        onDismiss={() => setToastMsg(null)}
      />
    </div>
  );
}
