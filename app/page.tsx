"use client";

import { useRouter } from "next/navigation";

const FEATURES = [
  { title: "5 Gradient Modes", desc: "Mesh, radial, linear, conic, and plasma — all GPU-rendered at 60fps" },
  { title: "Layer System", desc: "Stack up to 4 layers with blend modes: normal, multiply, screen, overlay, add" },
  { title: "Physics Mouse", desc: "Fluid displacement, ripples, vortex swirl — each mode reacts differently" },
  { title: "Effects Stack", desc: "Noise, bloom, particles, chromatic aberration, ASCII, dither, and more" },
  { title: "Animation Timeline", desc: "Keyframe parameters over time with loop, bounce, and one-shot playback" },
  { title: "Export Anywhere", desc: "PNG, animated CSS, WebM video, iframe embed, or shareable URL" },
];

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-root text-text-primary">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-purple-500/10" />
        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center">
          <h1 className="font-mono text-4xl md:text-6xl font-bold tracking-tight mb-4">
            WAVR
          </h1>
          <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-8">
            Create stunning animated gradients with a visual editor. WebGL-powered, real-time, exportable everywhere.
          </p>
          <button
            onClick={() => router.push("/editor")}
            className="px-8 py-3 text-sm font-medium text-white bg-accent hover:bg-accent/80
              rounded-lg transition-all duration-200 shadow-lg shadow-accent/25"
          >
            Open Editor
          </button>
          <p className="text-xs text-text-tertiary mt-3">No signup required. Free and open source.</p>
        </div>
      </div>

      {/* Features grid */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="p-5 bg-surface border border-border rounded-lg hover:border-border-active transition-colors"
            >
              <h3 className="text-sm font-medium text-text-primary mb-1.5">{f.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center border-t border-border">
        <h2 className="text-xl font-medium mb-3">Ready to create?</h2>
        <p className="text-sm text-text-secondary mb-6">
          Design your gradient, export as CSS, PNG, video, or embed — all in your browser.
        </p>
        <button
          onClick={() => router.push("/editor")}
          className="px-8 py-3 text-sm font-medium text-white bg-accent hover:bg-accent/80
            rounded-lg transition-all duration-200"
        >
          Launch Editor
        </button>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <span className="font-mono text-xs text-text-tertiary tracking-wider">WAVR</span>
          <span className="text-xs text-text-tertiary">Built with WebGL 2 + Next.js</span>
        </div>
      </footer>
    </div>
  );
}
