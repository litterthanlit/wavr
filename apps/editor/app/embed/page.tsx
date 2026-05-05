"use client";

import { useCallback, useEffect, useRef } from "react";
import { GradientEngine } from "@wavr/core";
import { useGradientStore } from "@/lib/store";
import { applyHashToStore } from "@/lib/url-sync";

const EMBED_MAX_PIXEL_RATIO = 1.5;
const EMBED_MAX_FRAME_RATE = 45;

export default function EmbedPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);

  useEffect(() => {
    applyHashToStore();

    window.addEventListener("hashchange", applyHashToStore);
    window.addEventListener("popstate", applyHashToStore);

    return () => {
      window.removeEventListener("hashchange", applyHashToStore);
      window.removeEventListener("popstate", applyHashToStore);
    };
  }, []);

  const setMouseFromEvent = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engine.setMouse(x, y);
  }, []);

  const triggerRipple = useCallback((e: MouseEvent) => {
    setMouseFromEvent(e);
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engine.triggerRipple(x, y);
  }, [setMouseFromEvent]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    let engine: GradientEngine;
    try {
      engine = new GradientEngine(canvas);
    } catch (e) {
      console.info("[wavr] embed render failed:", e);
      return;
    }

    engineRef.current = engine;
    engine.setMaxPixelRatio(EMBED_MAX_PIXEL_RATIO);
    engine.setMaxFrameRate(EMBED_MAX_FRAME_RATE);

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      engine.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };

    const startLoop = () => {
      engine.startLoop(() => useGradientStore.getState(), () => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        engine.stopLoop();
        return;
      }
      startLoop();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    canvas.addEventListener("mousemove", setMouseFromEvent);
    canvas.addEventListener("click", triggerRipple);

    if (document.visibilityState === "visible") startLoop();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("mousemove", setMouseFromEvent);
      canvas.removeEventListener("click", triggerRipple);
      engine.destroy();
      engineRef.current = null;
    };
  }, [setMouseFromEvent, triggerRipple]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </main>
  );
}
