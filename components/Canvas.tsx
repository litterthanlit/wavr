"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GradientEngine } from "@/lib/engine";
import { useGradientStore } from "@/lib/store";

interface CanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export default function Canvas({ onCanvasReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  const [fps, setFps] = useState(0);

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

    const engine = new GradientEngine(canvas);
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

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    engine.startLoop(() => useGradientStore.getState(), setFps);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(resizeTimeout);
      engine.destroy();
    };
  }, [handleMouseMove, onCanvasReady]);

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute bottom-3 left-3 font-mono text-[11px] text-text-tertiary bg-base/70 px-2 py-0.5 rounded">
        {fps} FPS
      </div>
    </div>
  );
}
