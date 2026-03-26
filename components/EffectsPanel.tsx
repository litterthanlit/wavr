"use client";

import { useGradientStore } from "@/lib/store";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";

export default function EffectsPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Noise & Grain */}
      <div className="flex flex-col gap-3">
        <Toggle label="Noise Overlay" checked={store.noiseEnabled} onChange={(v) => store.setDiscrete({ noiseEnabled: v })} />
        <Slider label="Intensity" value={store.noiseIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ noiseIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.noiseEnabled} />
        <Slider label="Scale" value={store.noiseScale} min={0.1} max={5} step={0.1} onChange={(v) => store.set({ noiseScale: v })} onCommit={() => store.commitSet()} disabled={!store.noiseEnabled} />
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-3">
        <Slider label="Film Grain" value={store.grain} min={0} max={1} step={0.01} onChange={(v) => store.set({ grain: v })} onCommit={() => store.commitSet()} />
      </div>

      <div className="border-t border-border" />

      {/* Mouse Reactivity */}
      <div className="flex flex-col gap-3">
        <Slider label="Mouse React" value={store.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} onCommit={() => store.commitSet()} />
      </div>

      <div className="border-t border-border" />

      {/* Particles */}
      <div className="flex flex-col gap-3">
        <Toggle label="Particles" checked={store.particlesEnabled} onChange={(v) => store.setDiscrete({ particlesEnabled: v })} />
        <Slider label="Count" value={store.particleCount} min={10} max={300} step={1} onChange={(v) => store.set({ particleCount: v })} onCommit={() => store.commitSet()} disabled={!store.particlesEnabled} />
        <Slider label="Size" value={store.particleSize} min={0.5} max={6} step={0.1} onChange={(v) => store.set({ particleSize: v })} onCommit={() => store.commitSet()} disabled={!store.particlesEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Bloom & Vignette */}
      <div className="flex flex-col gap-3">
        <Toggle label="Bloom" checked={store.bloomEnabled} onChange={(v) => store.setDiscrete({ bloomEnabled: v })} />
        <Slider label="Intensity" value={store.bloomIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ bloomIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.bloomEnabled} />
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-3">
        <Slider label="Vignette" value={store.vignette} min={0} max={1} step={0.01} onChange={(v) => store.set({ vignette: v })} onCommit={() => store.commitSet()} />
      </div>

      <div className="border-t border-border" />

      {/* Color Blending & Chromatic Aberration */}
      <div className="flex flex-col gap-3">
        <Slider label="Color Blend" value={store.colorBlend} min={0} max={1} step={0.01} onChange={(v) => store.set({ colorBlend: v })} onCommit={() => store.commitSet()} />
        <Slider label="Chromatic Aberration" value={store.chromaticAberration} min={0} max={1} step={0.01} onChange={(v) => store.set({ chromaticAberration: v })} onCommit={() => store.commitSet()} />
      </div>

      <div className="border-t border-border" />

      {/* Blur */}
      <div className="flex flex-col gap-3">
        <Toggle label="Gaussian Blur" checked={store.blurEnabled} onChange={(v) => store.setDiscrete({ blurEnabled: v })} />
        <Slider label="Amount" value={store.blurAmount} min={0} max={20} step={0.5} onChange={(v) => store.set({ blurAmount: v })} onCommit={() => store.commitSet()} disabled={!store.blurEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Radial Blur */}
      <div className="flex flex-col gap-3">
        <Slider label="Radial Blur" value={store.radialBlurAmount} min={0} max={1} step={0.01} onChange={(v) => store.set({ radialBlurAmount: v })} onCommit={() => store.commitSet()} />
      </div>
    </div>
  );
}
