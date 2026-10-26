"use client";

import { useEffect, useRef, useState } from "react";
import type { GradientConfig, GradientHandle } from "@wavr/core";
import thumbnailHashes from "../../public/presets/thumbnails.json";

// The landing hero's live scene: real Wavr presets rendered by the engine, a
// few to switch between. The engine and presets load after the page has
// painted (a dynamic import, so they stay out of the landing bundle); until
// the first frame, or without WebGL, the preset's pre-rendered thumbnail
// stands in. It pauses off screen and holds a still frame for reduced motion.

const SCENES = [
  { id: "aperture", label: "Aperture" },
  { id: "duskAperture", label: "Dusk Aperture" },
  { id: "lightWall", label: "Light Wall" },
  { id: "liquidChrome", label: "Liquid Chrome" },
  { id: "aurora", label: "Aurora" },
] as const;

type SceneId = (typeof SCENES)[number]["id"];

const HASHES: Record<string, string | undefined> = thumbnailHashes;
const poster = (id: SceneId) => `url(/presets/${id}.webp?v=${HASHES[id] ?? ""})`;

export default function HeroScene() {
  const frameRef = useRef<HTMLDivElement>(null);
  // The canvas and the pointer live on their own layer, so a tap on a preset
  // chip isn't also a touch (or a ripple) on the scene.
  const stageRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<GradientHandle | null>(null);
  const presetsRef = useRef<Record<string, GradientConfig> | null>(null);
  const [scene, setScene] = useState<SceneId>("aperture");
  const [live, setLive] = useState(false);
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  useEffect(() => {
    const frame = frameRef.current;
    const stage = stageRef.current;
    if (!frame || !stage) return;
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    (async () => {
      const [{ createGradient, attachPointer }, presets] = await Promise.all([
        import("@wavr/core"),
        import("@wavr/core/presets"),
      ]);
      if (cancelled) return;
      presetsRef.current = presets as unknown as Record<string, GradientConfig>;
      const config = presetsRef.current[sceneRef.current];
      if (!config) return;

      const canvas = document.createElement("canvas");
      canvas.className = "absolute inset-0 w-full h-full";
      canvas.setAttribute("aria-hidden", "true");
      const { width, height } = frame.getBoundingClientRect();
      let handle: GradientHandle;
      try {
        handle = createGradient(canvas, config, { maxPixelRatio: 2, onError: () => setLive(false) });
      } catch {
        return; // No WebGL 2: the poster stays.
      }
      stage.appendChild(canvas);
      handleRef.current = handle;
      handle.resize(width, height);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (reduceMotion.matches) {
        handle.setTime(3);
        handle.pause();
      }
      // Fade in over the poster once the first frame has had time to draw.
      requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && setLive(true)));

      const resize = new ResizeObserver(([entry]) => handle.resize(entry.contentRect.width, entry.contentRect.height));
      resize.observe(frame);
      const visibility = new IntersectionObserver(([entry]) => {
        if (reduceMotion.matches) return;
        if (entry.isIntersecting) handle.play();
        else handle.pause();
      });
      visibility.observe(frame);
      const detachPointer = attachPointer(stage, handle, { ripple: true });

      cleanups.push(() => {
        detachPointer();
        visibility.disconnect();
        resize.disconnect();
        handle.destroy();
        canvas.remove();
        handleRef.current = null;
      });
    })();

    return () => {
      cancelled = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  const choose = (id: SceneId) => {
    const presets = presetsRef.current;
    const previous = presets?.[scene];
    const config = presets?.[id];
    setScene(id);
    if (!config) return;
    // update() merges into the current config, so clear what the last preset
    // set and this one doesn't (its tone map, bloom, ...): a switch shows the
    // preset exactly as it is.
    const cleared = Object.fromEntries(Object.keys(previous ?? {}).map((key) => [key, undefined]));
    handleRef.current?.update({ ...cleared, ...config });
  };

  return (
    <figure className="m-0">
      <div
        ref={frameRef}
        className="relative w-full aspect-[4/5] sm:aspect-[4/3] lg:aspect-[5/6] overflow-hidden rounded-2xl
          border border-border bg-black bg-cover bg-center shadow-[0_30px_80px_-24px_rgba(0,0,0,0.55)] touch-none"
        style={{ backgroundImage: poster(scene) }}
      >
        <div ref={stageRef} className="absolute inset-0" />
        {/* Hides the canvas until its first frame, so the swap from the poster is a fade, never a blank. */}
        <div
          className={`absolute inset-0 z-10 bg-cover bg-center pointer-events-none motion-safe:transition-opacity motion-safe:duration-700 ${
            live ? "opacity-0" : "opacity-100"
          }`}
          style={{ backgroundImage: poster(scene) }}
          aria-hidden="true"
        />
        {/* The scenes are dark rooms of light, so the chips are light on a scrim in either theme. */}
        <div className="absolute inset-x-0 bottom-0 z-20 p-3 sm:p-4 pointer-events-none bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <figcaption className="flex flex-wrap items-center gap-2 pointer-events-auto w-fit">
            <span className="sr-only">Live preview, rendered by the Wavr engine. Choose a preset:</span>
            {SCENES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => choose(s.id)}
                aria-pressed={scene === s.id}
                className={`px-3 py-1.5 rounded-full text-xs border backdrop-blur-md transition-colors ${
                  scene === s.id
                    ? "border-white/70 text-white bg-white/15"
                    : "border-white/25 text-white/85 bg-black/20 hover:text-white hover:border-white/50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </figcaption>
        </div>
      </div>
    </figure>
  );
}
