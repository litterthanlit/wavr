"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClassName } from "@/components/litt/button";
import { Media } from "@/components/litt/media";
import type { PresetId } from "@/lib/preset-entry";
import { presetThumbnail } from "@/lib/preset-thumbnail";

// The landing's one visual: a preset running live, the product itself.
// - The preset's thumbnail paints first and stays under the canvas, so a
//   browser without WebGL 2 (or one whose shader fails) keeps a picture.
// - The engine and the catalogue load with a dynamic import once the page has
//   hydrated, so neither weighs on the first paint. The engine lives in the
//   effect, never in React state.
// - The clock starts at the thumbnail's time (thumbnails.mjs renders at 3s),
//   so the swap from picture to canvas doesn't jump.
// - Reduced motion draws one still frame and leaves the pointer out. Otherwise
//   it moves, so Pause stops it (WCAG 2.2.2), and it stops while off screen.

const THUMBNAIL_TIME = 3;
const MAX_PIXEL_RATIO = 1.5;

export type LandingHeroProps = {
  /** The catalogue preset to run. Its thumbnail shows until the first frame. */
  preset: PresetId;
  /** What the picture shows, in a sentence. */
  alt: string;
  /** The line under the frame. */
  caption: string;
};

export function LandingHero({ preset, alt, caption }: LandingHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playingRef = useRef(true);
  const [live, setLive] = useState(false);
  const [moving, setMoving] = useState(false);
  const [playing, setPlaying] = useState(true);
  const thumbnail = presetThumbnail(preset);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup = () => {};

    void Promise.all([import("@wavr/core"), import("@wavr/core/presets")]).then(
      ([{ GradientEngine, attachPointer, resolveConfig }, { PRESET_CATALOG }]) => {
        const entry = PRESET_CATALOG.find((p) => p.id === preset);
        if (disposed || !entry) return;
        let engine: InstanceType<typeof GradientEngine>;
        try {
          engine = new GradientEngine(canvas, { powerPreference: "low-power" });
        } catch {
          return; // No WebGL 2: the thumbnail stays.
        }
        engine.setMaxPixelRatio(MAX_PIXEL_RATIO);
        engine.setElapsedTime(THUMBNAIL_TIME);
        const state = resolveConfig(entry.config);
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        setMoving(!still);

        let raf = 0;
        let last = 0;
        let time = THUMBNAIL_TIME;
        let drawn = false;
        let onScreen = false;

        const tick = (now: number) => {
          raf = 0;
          const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
          last = now;
          engine.advancePointer(dt);
          const advancing = !still && playingRef.current;
          if (advancing) time += dt;
          engine.setElapsedTime(time);
          // Draw while it moves, and once more for a still frame or a moving pointer.
          if (advancing || !drawn || engine.isPointerAnimating(state)) {
            try {
              if (engine.render(state) && !drawn) {
                drawn = true;
                setLive(true);
              }
            } catch {
              stop(); // A shader that fails to compile: the thumbnail stays.
              setLive(false);
              setMoving(false);
              return;
            }
          }
          if (onScreen && (!still || !drawn)) raf = requestAnimationFrame(tick);
        };
        const start = () => {
          if (!raf) raf = requestAnimationFrame(tick);
        };
        const stop = () => {
          cancelAnimationFrame(raf);
          raf = 0;
          last = 0;
        };
        // A resize clears the canvas, so draw again.
        const resize = () => {
          engine.resize(canvas.clientWidth, canvas.clientHeight);
          drawn = false;
          if (onScreen) start();
        };

        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        const visibility = new IntersectionObserver(([seen]) => {
          onScreen = seen.isIntersecting;
          if (onScreen) start();
          else stop();
        });
        visibility.observe(canvas);
        const detachPointer = still ? () => {} : attachPointer(canvas, engine);

        const onLost = (event: Event) => {
          event.preventDefault();
          stop();
          setLive(false);
        };
        const onRestored = () => {
          engine.initProgram();
          drawn = false;
          if (onScreen) start();
        };
        canvas.addEventListener("webglcontextlost", onLost);
        canvas.addEventListener("webglcontextrestored", onRestored);
        resize();

        cleanup = () => {
          stop();
          resizeObserver.disconnect();
          visibility.disconnect();
          detachPointer();
          canvas.removeEventListener("webglcontextlost", onLost);
          canvas.removeEventListener("webglcontextrestored", onRestored);
          engine.destroy();
        };
      },
      () => {}, // The chunk didn't load: the thumbnail stays.
    );

    return () => {
      disposed = true;
      cleanup();
    };
  }, [preset]);

  return (
    <figure className="grid gap-2">
      <Media alt={alt} ratio="4/3">
        <span className="relative block">
          {thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element -- pre-rendered, already-sized WebPs (`pnpm thumbnails`); the optimizer would only re-encode them
            <img src={thumbnail} alt={alt} fetchPriority="high" className="absolute inset-0 size-full object-cover" />
          )}
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className={
              "absolute inset-0 size-full transition-opacity duration-(--litt-dur-instant) ease-litt " +
              (live ? "opacity-100" : "opacity-0")
            }
          />
        </span>
      </Media>
      <figcaption className="flex min-h-litt-control-sm items-center justify-between gap-4 text-litt-small text-litt-fg-subtle">
        <span>{caption}</span>
        {live && moving && (
          // litt's ghost sm Button, as a plain button (the component brings motion for its fun mode). Its label sits flush
          // with the frame's right edge.
          <button
            type="button"
            className={buttonClassName({ variant: "ghost", size: "sm" }) + " -mr-litt-control-pad-sm pointer-coarse:h-litt-control-md"}
            onClick={() => setPlaying((p) => !p)}
          >
            <span className="litt-trim">{playing ? "Pause" : "Play"}</span>
          </button>
        )}
      </figcaption>
    </figure>
  );
}
