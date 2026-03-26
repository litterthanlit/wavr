"use client";

import { useState } from "react";
import { useGradientStore } from "@/lib/store";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";

function Section({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-1.5 group"
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary group-hover:text-text-secondary transition-colors">
          {title}
        </span>
        <svg
          className={`w-3 h-3 text-text-tertiary transition-transform duration-150 ${open ? "rotate-0" : "-rotate-90"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="flex flex-col gap-3 pt-2 pb-1">{children}</div>}
    </div>
  );
}

export default function EffectsPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-1 p-4">
      {/* Texture */}
      <Section title="Texture" defaultOpen>
        <Toggle label="Noise Overlay" checked={store.noiseEnabled} onChange={(v) => store.setDiscrete({ noiseEnabled: v })} />
        <Slider label="Intensity" value={store.noiseIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ noiseIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.noiseEnabled} />
        <Slider label="Scale" value={store.noiseScale} min={0.1} max={5} step={0.1} onChange={(v) => store.set({ noiseScale: v })} onCommit={() => store.commitSet()} disabled={!store.noiseEnabled} />
        <Slider label="Film Grain" value={store.grain} min={0} max={1} step={0.01} onChange={(v) => store.set({ grain: v })} onCommit={() => store.commitSet()} />
        <Toggle label="Reaction-Diffusion" checked={store.reactionDiffEnabled} onChange={(v) => store.setDiscrete({ reactionDiffEnabled: v })} />
        <Slider label="Intensity" value={store.reactionDiffIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ reactionDiffIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.reactionDiffEnabled} />
        <Slider label="Scale" value={store.reactionDiffScale} min={0.2} max={5} step={0.1} onChange={(v) => store.set({ reactionDiffScale: v })} onCommit={() => store.commitSet()} disabled={!store.reactionDiffEnabled} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Lighting */}
      <Section title="Lighting" defaultOpen>
        <Toggle label="Bloom" checked={store.bloomEnabled} onChange={(v) => store.setDiscrete({ bloomEnabled: v })} />
        <Slider label="Intensity" value={store.bloomIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ bloomIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.bloomEnabled} />
        <Slider label="Vignette" value={store.vignette} min={0} max={1} step={0.01} onChange={(v) => store.set({ vignette: v })} onCommit={() => store.commitSet()} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Color */}
      <Section title="Color">
        <Slider label="Color Blend" value={store.colorBlend} min={0} max={1} step={0.01} onChange={(v) => store.set({ colorBlend: v })} onCommit={() => store.commitSet()} />
        <Slider label="Chromatic Aberration" value={store.chromaticAberration} min={0} max={1} step={0.01} onChange={(v) => store.set({ chromaticAberration: v })} onCommit={() => store.commitSet()} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Blur */}
      <Section title="Blur">
        <Toggle label="Gaussian Blur" checked={store.blurEnabled} onChange={(v) => store.setDiscrete({ blurEnabled: v })} />
        <Slider label="Amount" value={store.blurAmount} min={0} max={20} step={0.5} onChange={(v) => store.set({ blurAmount: v })} onCommit={() => store.commitSet()} disabled={!store.blurEnabled} />
        <Slider label="Radial Blur" value={store.radialBlurAmount} min={0} max={1} step={0.01} onChange={(v) => store.set({ radialBlurAmount: v })} onCommit={() => store.commitSet()} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Distortion */}
      <Section title="Distortion">
        <Toggle label="Curl Noise" checked={store.curlEnabled} onChange={(v) => store.setDiscrete({ curlEnabled: v })} />
        <Slider label="Intensity" value={store.curlIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ curlIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.curlEnabled} />
        <Slider label="Scale" value={store.curlScale} min={0.2} max={5} step={0.1} onChange={(v) => store.set({ curlScale: v })} onCommit={() => store.commitSet()} disabled={!store.curlEnabled} />
        <Toggle label="Kaleidoscope" checked={store.kaleidoscopeEnabled} onChange={(v) => store.setDiscrete({ kaleidoscopeEnabled: v })} />
        <Slider label="Segments" value={store.kaleidoscopeSegments} min={2} max={12} step={1} onChange={(v) => store.set({ kaleidoscopeSegments: v })} onCommit={() => store.commitSet()} disabled={!store.kaleidoscopeEnabled} />
        <Slider label="Rotation" value={store.kaleidoscopeRotation} min={0} max={360} step={1} onChange={(v) => store.set({ kaleidoscopeRotation: v })} onCommit={() => store.commitSet()} disabled={!store.kaleidoscopeEnabled} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Stylize */}
      <Section title="Stylize">
        <Toggle label="Dither" checked={store.ditherEnabled} onChange={(v) => store.setDiscrete({ ditherEnabled: v })} />
        <Slider label="Pixel Size" value={store.ditherSize} min={1} max={12} step={1} onChange={(v) => store.set({ ditherSize: v })} onCommit={() => store.commitSet()} disabled={!store.ditherEnabled} />
        <Toggle label="ASCII" checked={store.asciiEnabled} onChange={(v) => store.setDiscrete({ asciiEnabled: v })} />
        <Slider label="Cell Size" value={store.asciiSize} min={2} max={24} step={1} onChange={(v) => store.set({ asciiSize: v })} onCommit={() => store.commitSet()} disabled={!store.asciiEnabled} />
        <Toggle label="Pixel Sort" checked={store.pixelSortEnabled} onChange={(v) => store.setDiscrete({ pixelSortEnabled: v })} />
        <Slider label="Intensity" value={store.pixelSortIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ pixelSortIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.pixelSortEnabled} />
        <Slider label="Threshold" value={store.pixelSortThreshold} min={0} max={1} step={0.01} onChange={(v) => store.set({ pixelSortThreshold: v })} onCommit={() => store.commitSet()} disabled={!store.pixelSortEnabled} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Advanced */}
      <Section title="Advanced">
        <Slider label="Mouse React" value={store.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} onCommit={() => store.commitSet()} />
        <Toggle label="Feedback Loop" checked={store.feedbackEnabled} onChange={(v) => store.setDiscrete({ feedbackEnabled: v })} />
        <Slider label="Decay" value={store.feedbackDecay} min={0} max={0.98} step={0.01} onChange={(v) => store.set({ feedbackDecay: v })} onCommit={() => store.commitSet()} disabled={!store.feedbackEnabled} />
      </Section>
    </div>
  );
}
