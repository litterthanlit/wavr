"use client";

import { useRef, useEffect, useState } from "react";
import { createGradient } from "@wavr/core";
import type { EventTriggers, GradientConfig, GradientHandle } from "./types";

type OverlayHandle = {
  update(config: GradientConfig): void;
  destroy(): void;
};

function queryEditorFlag(): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const query = new URLSearchParams(window.location.search).get("editor");
  if (query === "1" || query === "true") return true;
  if (query === "0" || query === "false") return false;
  return undefined;
}

export interface WavrGradientProps {
  config: GradientConfig;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  paused?: boolean;
  scrollLinked?: boolean;
  scrollDuration?: number;
  speed?: number;
  maxPixelRatio?: number;
  maxFrameRate?: number;
  events?: EventTriggers;
  onError?: (error: Error) => void;
  /** Compact overlay for Cursor / Claude Code / Codex previews. Keep false in production. */
  editor?: boolean;
  onConfigChange?: (config: GradientConfig) => void;
  onApply?: (config: GradientConfig) => Promise<void> | void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function remap(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
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
  maxPixelRatio = 1.5,
  maxFrameRate = 60,
  events,
  onError,
  editor = false,
  onConfigChange,
  onApply,
}: WavrGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GradientHandle | null>(null);
  const editorRef = useRef<OverlayHandle | null>(null);
  const [liveConfig, setLiveConfig] = useState(config);
  const configRef = useRef(liveConfig);
  configRef.current = liveConfig;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const onConfigChangeRef = useRef(onConfigChange);
  const onApplyRef = useRef(onApply);
  onConfigChangeRef.current = onConfigChange;
  onApplyRef.current = onApply;

  useEffect(() => {
    setLiveConfig(config);
    editorRef.current?.update(config);
  }, [config]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement("canvas");
    const { width, height } = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    container.appendChild(canvas);

    const handle = createGradient(canvas, configRef.current, {
      onError,
      maxPixelRatio,
      maxFrameRate,
    });
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
  }, [maxFrameRate, maxPixelRatio, onError]);

  useEffect(() => {
    handleRef.current?.update(liveConfig);
  }, [liveConfig]);

  useEffect(() => {
    const container = containerRef.current;
    const enabled = queryEditorFlag() ?? editor;
    if (!container || !enabled) return;
    let cancelled = false;

    void import("@wavr/preview").then(({ mountWavrEditor }) => {
      if (cancelled || !container) return;
      const overlay = mountWavrEditor(container, {
        config: configRef.current,
        visible: true,
        onChange(next) {
          setLiveConfig(next);
          onConfigChangeRef.current?.(next);
        },
        onApply(next) {
          return onApplyRef.current?.(next);
        },
      });
      editorRef.current = overlay;
    });

    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [editor]);

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

  // Mouse interaction
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

  // Legacy scroll-linked mode (kept for backward compat)
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

  // --- Event Triggers ---

  // Hover trigger: mouseenter/mouseleave → animateTo
  useEffect(() => {
    const hover = eventsRef.current?.onHover;
    if (!hover) return;
    const el = containerRef.current;
    if (!el) return;

    const handleEnter = () => {
      handleRef.current?.animateTo(hover.enter, {
        duration: hover.duration,
        easing: hover.easing,
      });
    };

    const handleLeave = () => {
      handleRef.current?.animateTo(hover.leave, {
        duration: hover.duration,
        easing: hover.easing,
      });
    };

    el.addEventListener("mouseenter", handleEnter);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mouseenter", handleEnter);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, [events?.onHover]);

  // Scroll trigger: scrub or trigger mode
  useEffect(() => {
    const scroll = eventsRef.current?.onScroll;
    if (!scroll) return;

    if (scroll.mode === "scrub") {
      // Pause playback — timeline is driven by scroll position
      handleRef.current?.pause();

      const onScroll = () => {
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
        const t = remap(progress, scroll.start, scroll.end, 0, 1);
        handleRef.current?.setTimelineProgress(clamp(t, 0, 1));
      };

      onScroll(); // initial position
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    if (scroll.mode === "trigger") {
      // Play when scroll enters range, pause when it leaves
      const onScroll = () => {
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;
        if (progress >= scroll.start && progress <= scroll.end) {
          handleRef.current?.play();
        } else {
          handleRef.current?.pause();
        }
      };

      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
  }, [events?.onScroll]);

  // Click trigger
  useEffect(() => {
    const click = eventsRef.current?.onClick;
    if (!click) return;
    const el = containerRef.current;
    if (!el) return;

    const handleClick = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;

      if (click.effect === "ripple") {
        // Use the engine's built-in ripple at click position
        handleRef.current?.setMouse(x, y);
        handleRef.current?.update({
          ...configRef.current,
          ripple: { enabled: true, intensity: 0.8 },
        });
      }

      if (click.config) {
        handleRef.current?.animateTo(click.config, {
          duration: click.duration ?? 300,
          easing: click.easing ?? "ease-out",
        });
      }
    };

    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [events?.onClick]);

  // InView trigger: IntersectionObserver → play/pause or scrub
  useEffect(() => {
    const inView = eventsRef.current?.onInView;
    if (!inView) return;
    const el = containerRef.current;
    if (!el) return;

    // Start paused — play only when visible
    handleRef.current?.pause();

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (inView.animation === "play") {
            handleRef.current?.play();
          }
        } else {
          handleRef.current?.pause();
        }
      },
      { threshold: inView.threshold },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [events?.onInView]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: style?.position ?? "relative", ...style }}
    />
  );
}
