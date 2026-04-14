"use client";

import { useRef, useEffect } from "react";
import { createGradient } from "@wavr/core";
import type { GradientConfig, GradientHandle } from "@wavr/core";

export interface WavrGradientProps {
  config: GradientConfig;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  paused?: boolean;
  scrollLinked?: boolean;
  scrollDuration?: number;
  speed?: number;
  onError?: (error: Error) => void;
}

export function WavrGradient({
  config,
  className,
  style,
  interactive = true,
  paused = false,
  scrollLinked = false,
  scrollDuration = 10,
  speed = 1.0,
  onError,
}: WavrGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GradientHandle | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    const { width, height } = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const handle = createGradient(canvas, configRef.current, { onError });
    handleRef.current = handle;

    const ro = new ResizeObserver(([entry]) => {
      handle.resize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      handle.destroy();
      handleRef.current = null;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    handleRef.current?.update(config);
  }, [config]);

  useEffect(() => {
    if (paused) {
      handleRef.current?.pause();
    } else if (!scrollLinked) {
      handleRef.current?.play();
    }
  }, [paused, scrollLinked]);

  useEffect(() => {
    handleRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    if (!interactive) return;
    const el = containerRef.current;
    if (!el) return;

    const handlePointer = (x: number, y: number) => {
      const rect = el.getBoundingClientRect();
      handleRef.current?.setMouse(
        (x - rect.left) / rect.width,
        1 - (y - rect.top) / rect.height,
      );
    };

    const onMouse = (e: MouseEvent) => handlePointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) handlePointer(t.clientX, t.clientY);
    };

    el.addEventListener("mousemove", onMouse);
    el.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      el.removeEventListener("mousemove", onMouse);
      el.removeEventListener("touchmove", onTouch);
    };
  }, [interactive]);

  useEffect(() => {
    if (!scrollLinked) return;
    handleRef.current?.pause();

    const onScroll = () => {
      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
      handleRef.current?.setTime(progress * scrollDuration);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollLinked, scrollDuration]);

  return <div ref={containerRef} className={className} style={style} />;
}
