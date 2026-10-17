"use client";

import { useEffect, useRef } from "react";
import { GradientEngine, attachPointer } from "@wavr/core";
import { useGradientStore } from "@/lib/store";
import { applyHashToStore } from "@/lib/url-sync";

const EMBED_MAX_PIXEL_RATIO = 1.5;
const EMBED_MAX_FRAME_RATE = 45;

export default function EmbedPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    applyHashToStore();

    window.addEventListener("hashchange", applyHashToStore);
    window.addEventListener("popstate", applyHashToStore);

    return () => {
      window.removeEventListener("hashchange", applyHashToStore);
      window.removeEventListener("popstate", applyHashToStore);
    };
  }, []);

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
    const detachPointer = attachPointer(canvas, engine, { ripple: true });

    if (document.visibilityState === "visible") startLoop();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      detachPointer();
      engine.destroy();
    };
  }, []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </main>
  );
}
