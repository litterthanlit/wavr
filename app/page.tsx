"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/* ── ASCII / Dither decorative patterns ─────────────────────────── */

const DITHER_BLOCK = `░▒▓█▓▒░░▒▓█▓▒░
▒▓█▓▒░░▒▓█▓▒░░
▓█▓▒░░▒▓█▓▒░░▒
█▓▒░░▒▓█▓▒░░▒▓
▓▒░░▒▓█▓▒░░▒▓█
▒░░▒▓█▓▒░░▒▓█▓
░░▒▓█▓▒░░▒▓█▓▒
░▒▓█▓▒░░▒▓█▓▒░`;

const ASCII_WAVE = `
    .  ·  ˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·  .
 ·  ˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·  .     .
˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙
 ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·
.     .  ·  ˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·  .
   .  ·  ˙  ·  .     .  ·  ˙  ·  .     .  ·  ˙  ·  .   `;

const GRID_CHARS = "·+·+·+·+·+·+·+·+·+·+·+·+·+·+·+·+";

/* ── Animated dither noise canvas ───────────────────────────────── */

function DitherCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 160;
    const H = 90;
    canvas.width = W;
    canvas.height = H;

    const chars = " .:-=+*#%@";
    let frame = 0;

    const draw = () => {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
      ctx.font = "3px Geist Mono, monospace";

      for (let y = 0; y < H; y += 4) {
        for (let x = 0; x < W; x += 3) {
          const noise =
            Math.sin(x * 0.08 + frame * 0.02) *
              Math.cos(y * 0.06 + frame * 0.015) *
              0.5 +
            0.5;
          const idx = Math.floor(noise * (chars.length - 1));
          const alpha = 0.08 + noise * 0.12;
          ctx.fillStyle = `rgba(99, 91, 255, ${alpha})`;
          ctx.fillText(chars[idx], x, y);
        }
      }
      frame++;
      requestAnimationFrame(draw);
    };

    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <canvas
      ref={ref}
      className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

/* ── Feature data ───────────────────────────────────────────────── */

const FEATURES = [
  {
    label: "Gradient Engine",
    title: "Five modes, one shader",
    desc: "Mesh, radial, linear, conic, and plasma gradients — all GPU-rendered in a single WebGL 2 fragment shader at 60fps.",
    ascii: "█▓▒░",
  },
  {
    label: "Layer System",
    title: "Stack and blend",
    desc: "Up to 4 layers with blend modes — normal, multiply, screen, overlay, add. Each layer has independent parameters.",
    ascii: "╔═══╗",
  },
  {
    label: "Effects Pipeline",
    title: "Dither. ASCII. Bloom.",
    desc: "Film grain, noise overlay, chromatic aberration, particles, pixel sorting, reaction-diffusion — all in the shader.",
    ascii: ".:*#@",
  },
  {
    label: "Mouse Physics",
    title: "Reactive to touch",
    desc: "Fluid displacement, ripple waves, vortex swirl. Three physics modes that respond to cursor position and velocity.",
    ascii: "~≈≋~",
  },
  {
    label: "Timeline",
    title: "Keyframe anything",
    desc: "Animate any parameter over time. Loop, bounce, or one-shot playback with precise keyframe control.",
    ascii: "▸▸▸▸",
  },
  {
    label: "Export",
    title: "Ship it anywhere",
    desc: "PNG, CSS, Tailwind config, WebM video, React component, Web Component, iframe embed, or shareable URL.",
    ascii: "→⤓↗",
  },
];

/* ── Stat counters ──────────────────────────────────────────────── */

const STATS = [
  { value: "60", unit: "fps", label: "GPU-rendered" },
  { value: "20+", unit: "", label: "Effects" },
  { value: "8", unit: "", label: "Export formats" },
  { value: "0", unit: "", label: "Signups needed" },
];

/* ── Main page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-root text-text-primary overflow-x-hidden">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl bg-root/80">
        <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-[0.2em]">
              WAVR
            </span>
            <span className="text-[10px] font-mono text-text-tertiary border border-border rounded px-1.5 py-0.5 ml-1">
              beta
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              className="text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
            <button
              onClick={() => router.push("/editor")}
              className="text-xs font-medium text-root bg-text-primary hover:bg-text-secondary
                px-4 py-1.5 rounded-md transition-colors"
            >
              Open Editor
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6">
        {/* Subtle animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <DitherCanvas />
          <div className="absolute inset-0 bg-gradient-to-b from-root via-root/90 to-root" />
        </div>

        <div className="relative max-w-[1200px] mx-auto">
          {/* ASCII decorative line */}
          <div className="font-mono text-[10px] text-text-tertiary/40 mb-8 tracking-[0.5em] select-none overflow-hidden whitespace-nowrap">
            {GRID_CHARS}
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[88px] font-medium tracking-[-0.04em] leading-[0.95] mb-6">
            Animated gradients,
            <br />
            <span className="text-text-secondary">crafted visually.</span>
          </h1>

          <p className="text-base md:text-lg text-text-secondary max-w-[520px] leading-relaxed mb-10">
            A WebGL-powered editor for creating mesh gradients, layered effects,
            and exportable motion — all in the browser.
          </p>

          <div className="flex items-center gap-4 mb-16">
            <button
              onClick={() => router.push("/editor")}
              className="px-6 py-2.5 text-sm font-medium text-root bg-text-primary hover:bg-text-secondary
                rounded-md transition-all duration-150"
            >
              Open Editor
            </button>
            <span className="text-xs text-text-tertiary font-mono">
              No account · Free · Open source
            </span>
          </div>

          {/* ASCII art hero accent */}
          <pre className="font-mono text-[9px] leading-[1.4] text-accent/20 select-none whitespace-pre max-w-max">
            {DITHER_BLOCK}
          </pre>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <section className="border-y border-border bg-base/50">
        <div className="max-w-[1200px] mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-medium tracking-tight">
                  {s.value}
                </span>
                {s.unit && (
                  <span className="text-sm text-text-secondary font-mono">
                    {s.unit}
                  </span>
                )}
              </div>
              <span className="text-xs text-text-tertiary">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="flex items-center gap-4 mb-4">
          <span className="font-mono text-[10px] text-text-tertiary tracking-widest uppercase">
            Capabilities
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mb-16">
          Everything you need to create
          <br />
          <span className="text-text-secondary">and ship visual effects.</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className="bg-root p-8 group cursor-default transition-colors hover:bg-surface/50"
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-[10px] text-text-tertiary tracking-widest uppercase">
                  {f.label}
                </span>
                <span
                  className="font-mono text-sm text-accent/30 group-hover:text-accent/60 transition-colors select-none"
                >
                  {f.ascii}
                </span>
              </div>
              <h3 className="text-lg font-medium mb-2 tracking-[-0.01em]">
                {f.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ASCII texture divider ───────────────────────────── */}
      <div className="max-w-[1200px] mx-auto px-6 select-none">
        <pre className="font-mono text-[8px] leading-[1.6] text-text-tertiary/15 overflow-hidden whitespace-pre">
          {ASCII_WAVE}
        </pre>
      </div>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="max-w-[1200px] mx-auto px-6 py-24">
        <div className="flex items-center gap-4 mb-4">
          <span className="font-mono text-[10px] text-text-tertiary tracking-widest uppercase">
            Workflow
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mb-16">
          Create → Effect → Export
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            {
              step: "01",
              title: "Pick a gradient mode",
              desc: "Choose mesh, radial, linear, conic, or plasma. Adjust colors, speed, complexity, and scale with real-time preview.",
              glyph: "░░▒▒▓▓██",
            },
            {
              step: "02",
              title: "Layer effects",
              desc: "Stack noise, bloom, dither, ASCII, chromatic aberration, particles, and more. Each effect has fine-grained controls.",
              glyph: ".:=+*#%@",
            },
            {
              step: "03",
              title: "Export anywhere",
              desc: "Grab a PNG, copy CSS, download WebM video, generate a React component, or share a URL. One click.",
              glyph: "→ → → →",
            },
          ].map((s) => (
            <div key={s.step} className="group">
              <div className="flex items-center gap-3 mb-4">
                <span className="font-mono text-xs text-accent">{s.step}</span>
                <span className="font-mono text-[10px] text-text-tertiary/30 tracking-[0.3em] select-none">
                  {s.glyph}
                </span>
              </div>
              <h3 className="text-base font-medium mb-2">{s.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-24 flex flex-col items-center text-center">
          {/* Dither accent */}
          <pre className="font-mono text-[10px] leading-[1.2] text-accent/15 mb-8 select-none">
            {"▓▒░  ░▒▓█▓▒░  ░▒▓"}
          </pre>

          <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] mb-4">
            Start creating.
          </h2>
          <p className="text-base text-text-secondary max-w-md mb-8">
            No signup, no install, no paywall. Open the editor and start
            building animated gradients in seconds.
          </p>
          <button
            onClick={() => router.push("/editor")}
            className="px-8 py-3 text-sm font-medium text-root bg-text-primary hover:bg-text-secondary
              rounded-md transition-all duration-150"
          >
            Open Editor
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-text-tertiary tracking-[0.15em]">
              WAVR
            </span>
            <span className="text-[10px] text-text-tertiary/40">
              Built with WebGL 2 + Next.js
            </span>
          </div>
          <div className="font-mono text-[9px] text-text-tertiary/25 tracking-wider select-none">
            ░▒▓█▓▒░
          </div>
        </div>
      </footer>
    </div>
  );
}
