import Link from "next/link";
import HeroScene from "@/components/landing/HeroScene";

// The landing page. A server component: everything is static except the
// hero's live scene (components/landing/HeroScene.tsx), which loads the engine
// after the page has painted.
//
// Avoid `text-base` here: the theme's `--color-base` surface token makes it
// set the text colour as well as the size (near-white headings on the light
// theme). Use `text-[15px]`/`text-[16px]` for a body size.

const FEATURES = [
  {
    label: "Light Fields",
    title: "Coloured light, not just colour",
    desc: "Apertures, halos and light walls mixed in linear light, after light installations. Every glow is computed exactly, with no blur.",
    ascii: "▢◯▤",
  },
  {
    label: "Gradient Modes",
    title: "26 modes, compiled on demand",
    desc: "Liquid chrome, silk, aurora, iridescent foil, mesh, plasma, dither and more. Each mode is its own GPU program, built only when used.",
    ascii: "█▓▒░",
  },
  {
    label: "Colour",
    title: "Display P3 and HDR",
    desc: "Wide-gamut scenes, Oklab blending and light that shines brighter than white on HDR screens. Exports stay true on standard ones.",
    ascii: "◐◑◒",
  },
  {
    label: "Layers & Effects",
    title: "Stack, blend, finish",
    desc: "Up to 4 layers with blend modes, then cinematic bloom, film grain, chromatic aberration, dither, ASCII and pixel sorting.",
    ascii: ".:*#@",
  },
  {
    label: "Interaction",
    title: "Reacts to touch",
    desc: "Push, lens, swirl, magnet and wave: each mode answers the pointer or a finger, with click ripples and trails.",
    ascii: "~≈≋~",
  },
  {
    label: "Export",
    title: "Ship it anywhere",
    desc: "PNG up to 4×, GIF, WebM, a React component or web component built from the engine's own shader, an embed, or a link.",
    ascii: "→⤓↗",
  },
];

const STATS = [
  { value: "26", unit: "", label: "Gradient modes" },
  { value: "P3", unit: "+ HDR", label: "Wide-gamut colour" },
  { value: "8", unit: "", label: "Export formats" },
  { value: "0", unit: "", label: "Signups needed" },
];

const STEPS = [
  {
    step: "01",
    title: "Start from a preset",
    desc: "Light fields, liquid chrome, soft silks and textures, each shown as it renders. Or pick a mode and build from nothing.",
    glyph: "░░▒▒▓▓██",
  },
  {
    step: "02",
    title: "Shape it",
    desc: "Edit the palette on a live gradient bar, tune motion and softness, stack layers and effects. Every change is one undo step.",
    glyph: ".:=+*#%@",
  },
  {
    step: "03",
    title: "Export",
    desc: "Download a PNG, GIF or video, copy a React component, or share a link that opens the exact scene.",
    glyph: "→ → → →",
  },
];

const primaryButton =
  "inline-flex items-center justify-center font-medium text-white bg-accent hover:opacity-90 rounded-lg transition-opacity";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-root text-text-primary overflow-x-hidden">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <nav aria-label="Main" className="fixed top-0 left-0 right-0 z-50 border-b border-border backdrop-blur-xl bg-root/80">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-[0.2em]">WAVR</span>
            <span className="text-[10px] font-mono text-text-tertiary border border-border rounded px-1.5 py-0.5 ml-1">
              beta
            </span>
          </Link>
          <Link href="/editor" className={`${primaryButton} text-xs px-4 py-2`}>
            Open editor
          </Link>
        </div>
      </nav>

      <main>
        {/* ── Hero: copy on the left, the engine running on the right ── */}
        <section className="relative pt-24 sm:pt-28 lg:pt-32 pb-16 lg:pb-24 px-4 sm:px-6">
          <div className="max-w-[1200px] mx-auto grid gap-10 lg:gap-14 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-5 lg:pb-6 order-2 lg:order-1">
              <p className="font-mono text-[11px] text-text-tertiary tracking-[0.2em] uppercase mb-5">
                Animated gradient editor
              </p>
              <h1 className="text-[44px] sm:text-6xl lg:text-[58px] xl:text-[66px] font-medium tracking-[-0.04em] leading-[0.95] mb-6">
                Gradients that
                <br />
                <span className="text-text-secondary">move like light.</span>
              </h1>
              <p className="text-[16px] md:text-lg text-text-secondary max-w-[460px] leading-relaxed mb-8">
                Design moving light fields, chrome and soft gradients in the browser, in Display P3 and HDR, then
                export them as code, video or a link.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href="/editor" className={`${primaryButton} text-sm px-6 py-3`}>
                  Open the editor
                </Link>
                <span className="text-xs text-text-tertiary font-mono">No account · Free</span>
              </div>
            </div>
            <div className="lg:col-span-7 order-1 lg:order-2">
              <HeroScene />
            </div>
          </div>
        </section>

        {/* ── Stats bar ───────────────────────────────────────── */}
        <section aria-label="At a glance" className="border-y border-border bg-base/50">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-medium tracking-tight">{s.value}</span>
                  {s.unit && <span className="text-sm text-text-secondary font-mono">{s.unit}</span>}
                </div>
                <span className="text-xs text-text-tertiary">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ────────────────────────────────────────── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-20 lg:py-24">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-[10px] text-text-tertiary tracking-widest uppercase">Capabilities</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mb-12 lg:mb-16">
            Everything you need to create{" "}
            <br className="hidden sm:block" />
            <span className="text-text-secondary">and ship visual effects.</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-root p-6 sm:p-8 group transition-colors hover:bg-surface/50">
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-[10px] text-text-tertiary tracking-widest uppercase">{f.label}</span>
                  <span
                    aria-hidden="true"
                    className="font-mono text-sm text-accent/40 group-hover:text-accent/70 transition-colors select-none"
                  >
                    {f.ascii}
                  </span>
                </div>
                <h3 className="text-lg font-medium mb-2 tracking-[-0.01em]">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────── */}
        <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-20 lg:py-24">
          <div className="flex items-center gap-4 mb-4">
            <span className="font-mono text-[10px] text-text-tertiary tracking-widest uppercase">Workflow</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <h2 className="text-3xl md:text-4xl font-medium tracking-[-0.03em] mb-12 lg:mb-16">
            Preset → Shape → Export
          </h2>

          <ol className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
            {STEPS.map((s) => (
              <li key={s.step}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-xs text-accent">{s.step}</span>
                  <span aria-hidden="true" className="font-mono text-[10px] text-text-tertiary/40 tracking-[0.3em] select-none">
                    {s.glyph}
                  </span>
                </div>
                <h3 className="text-[16px] font-medium mb-2">{s.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section className="border-t border-border">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-20 lg:py-24 flex flex-col items-center text-center">
            <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] mb-4">Start creating.</h2>
            <p className="text-[16px] text-text-secondary max-w-md mb-8">
              No signup, no install, no paywall. Open the editor and start from a preset in seconds.
            </p>
            <Link href="/editor" className={`${primaryButton} text-sm px-8 py-3`}>
              Open the editor
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row justify-between items-center gap-3">
          <span className="font-mono text-xs text-text-tertiary tracking-[0.15em]">WAVR</span>
          <span className="text-xs text-text-tertiary">Rendered with WebGL 2 in your browser</span>
        </div>
      </footer>
    </div>
  );
}
