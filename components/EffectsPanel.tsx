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

      <div className="border-t border-border" />

      {/* Dither */}
      <div className="flex flex-col gap-3">
        <Toggle label="Dither" checked={store.ditherEnabled} onChange={(v) => store.setDiscrete({ ditherEnabled: v })} />
        <Slider label="Pixel Size" value={store.ditherSize} min={1} max={12} step={1} onChange={(v) => store.set({ ditherSize: v })} onCommit={() => store.commitSet()} disabled={!store.ditherEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* ASCII */}
      <div className="flex flex-col gap-3">
        <Toggle label="ASCII" checked={store.asciiEnabled} onChange={(v) => store.setDiscrete({ asciiEnabled: v })} />
        <Slider label="Cell Size" value={store.asciiSize} min={2} max={24} step={1} onChange={(v) => store.set({ asciiSize: v })} onCommit={() => store.commitSet()} disabled={!store.asciiEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Voronoi */}
      <div className="flex flex-col gap-3">
        <Toggle label="Voronoi" checked={store.voronoiEnabled} onChange={(v) => store.setDiscrete({ voronoiEnabled: v })} />
        <Slider label="Intensity" value={store.voronoiIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ voronoiIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.voronoiEnabled} />
        <Slider label="Scale" value={store.voronoiScale} min={0.2} max={5} step={0.1} onChange={(v) => store.set({ voronoiScale: v })} onCommit={() => store.commitSet()} disabled={!store.voronoiEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Curl Noise */}
      <div className="flex flex-col gap-3">
        <Toggle label="Curl Noise" checked={store.curlEnabled} onChange={(v) => store.setDiscrete({ curlEnabled: v })} />
        <Slider label="Intensity" value={store.curlIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ curlIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.curlEnabled} />
        <Slider label="Scale" value={store.curlScale} min={0.2} max={5} step={0.1} onChange={(v) => store.set({ curlScale: v })} onCommit={() => store.commitSet()} disabled={!store.curlEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Kaleidoscope */}
      <div className="flex flex-col gap-3">
        <Toggle label="Kaleidoscope" checked={store.kaleidoscopeEnabled} onChange={(v) => store.setDiscrete({ kaleidoscopeEnabled: v })} />
        <Slider label="Segments" value={store.kaleidoscopeSegments} min={2} max={12} step={1} onChange={(v) => store.set({ kaleidoscopeSegments: v })} onCommit={() => store.commitSet()} disabled={!store.kaleidoscopeEnabled} />
        <Slider label="Rotation" value={store.kaleidoscopeRotation} min={0} max={360} step={1} onChange={(v) => store.set({ kaleidoscopeRotation: v })} onCommit={() => store.commitSet()} disabled={!store.kaleidoscopeEnabled} />
      </div>

      <div className="border-t border-border" />

      {/* Metaballs */}
      <div className="flex flex-col gap-3">
        <Toggle label="Metaballs" checked={store.metaballsEnabled} onChange={(v) => store.setDiscrete({ metaballsEnabled: v })} />
        <Slider label="Intensity" value={store.metaballsIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ metaballsIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.metaballsEnabled} />
        <Slider label="Count" value={store.metaballsCount} min={2} max={12} step={1} onChange={(v) => store.set({ metaballsCount: v })} onCommit={() => store.commitSet()} disabled={!store.metaballsEnabled} />
        <Slider label="Size" value={store.metaballsScale} min={0.2} max={3} step={0.1} onChange={(v) => store.set({ metaballsScale: v })} onCommit={() => store.commitSet()} disabled={!store.metaballsEnabled} />
      </div>
    </div>
  );
}
