"use client";

import { useState, useRef } from "react";
import { useGradientStore } from "@/lib/store";
import { getAudioAnalyzer } from "@/components/Canvas";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";
import Select from "@/components/ui/Select";

const AUDIO_TARGETS = [
  { value: "distortion", label: "Distortion" },
  { value: "scale", label: "Scale" },
  { value: "speed", label: "Speed" },
  { value: "brightness", label: "Brightness" },
  { value: "complexity", label: "Complexity" },
  { value: "noiseIntensity", label: "Noise" },
  { value: "grain", label: "Grain" },
  { value: "bloomIntensity", label: "Bloom" },
];

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
        <Toggle label="Soft Glow" checked={store.glowEnabled} onChange={(v) => store.setDiscrete({ glowEnabled: v })} />
        <Slider label="Intensity" value={store.glowIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ glowIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.glowEnabled} />
        <Slider label="Radius" value={store.glowRadius} min={0.01} max={0.1} step={0.005} onChange={(v) => store.set({ glowRadius: v })} onCommit={() => store.commitSet()} disabled={!store.glowEnabled} />
        <Toggle label="Caustics" checked={store.causticEnabled} onChange={(v) => store.setDiscrete({ causticEnabled: v })} />
        <Slider label="Intensity" value={store.causticIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ causticIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.causticEnabled} />
        <Slider label="Vignette" value={store.vignette} min={0} max={1} step={0.01} onChange={(v) => store.set({ vignette: v })} onCommit={() => store.commitSet()} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Color */}
      <Section title="Color">
        <Toggle label="Oklab Blending" checked={store.oklabEnabled} onChange={(v) => store.setDiscrete({ oklabEnabled: v })} />
        <Select label="Tone Mapping" value={String(store.toneMapMode)} options={[{ value: "0", label: "None" }, { value: "1", label: "Reinhard" }, { value: "2", label: "ACES Filmic" }]} onChange={(v) => store.setDiscrete({ toneMapMode: Number(v) })} />
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

      {/* 3D Depth */}
      <Section title="3D Depth">
        <Toggle label="Parallax" checked={store.parallaxEnabled} onChange={(v) => store.setDiscrete({ parallaxEnabled: v })} />
        <Slider label="Strength" value={store.parallaxStrength} min={0} max={1} step={0.01} onChange={(v) => store.set({ parallaxStrength: v })} onCommit={() => store.commitSet()} disabled={!store.parallaxEnabled} />
        <Toggle
          label="Mesh Distortion"
          checked={store.meshDistortionEnabled}
          onChange={(v) => {
            if (v && store.threeDEnabled) {
              store.setDiscrete({ meshDistortionEnabled: v, threeDEnabled: false });
            } else {
              store.setDiscrete({ meshDistortionEnabled: v });
            }
          }}
        />
        <Slider label="Displacement" value={store.meshDisplacement} min={0} max={1} step={0.01} onChange={(v) => store.set({ meshDisplacement: v })} onCommit={() => store.commitSet()} disabled={!store.meshDistortionEnabled} />
        <Slider label="Frequency" value={store.meshFrequency} min={0.5} max={5} step={0.1} onChange={(v) => store.set({ meshFrequency: v })} onCommit={() => store.commitSet()} disabled={!store.meshDistortionEnabled} />
        <Slider label="Speed" value={store.meshSpeed} min={0} max={2} step={0.01} onChange={(v) => store.set({ meshSpeed: v })} onCommit={() => store.commitSet()} disabled={!store.meshDistortionEnabled} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Advanced */}
      <Section title="Advanced">
        <Slider label="Mouse React" value={store.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} onCommit={() => store.commitSet()} />
        <Toggle label="Click Ripple" checked={store.rippleEnabled} onChange={(v) => store.setDiscrete({ rippleEnabled: v })} />
        <Slider label="Intensity" value={store.rippleIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ rippleIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.rippleEnabled} />
        <Toggle label="Feedback Loop" checked={store.feedbackEnabled} onChange={(v) => store.setDiscrete({ feedbackEnabled: v })} />
        <Slider label="Decay" value={store.feedbackDecay} min={0} max={0.98} step={0.01} onChange={(v) => store.set({ feedbackDecay: v })} onCommit={() => store.commitSet()} disabled={!store.feedbackEnabled} />
      </Section>

      <div className="border-t border-border my-1" />

      {/* Audio Reactivity */}
      <AudioSection />
    </div>
  );
}

function AudioSection() {
  const store = useGradientStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>("");

  const handleToggle = async (enabled: boolean) => {
    const analyzer = getAudioAnalyzer();
    if (enabled) {
      try {
        if (store.audioSource === "mic") {
          await analyzer.connectMicrophone();
          setStatus("Listening...");
        }
        store.setDiscrete({ audioEnabled: true });
      } catch {
        setStatus("Mic access denied");
      }
    } else {
      await analyzer.disconnect();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      store.setDiscrete({ audioEnabled: false });
      setStatus("");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const analyzer = getAudioAnalyzer();
    try {
      if (audioRef.current) audioRef.current.pause();
      const audio = await analyzer.connectFile(file);
      audioRef.current = audio;
      audio.play();
      store.setDiscrete({ audioEnabled: true, audioSource: "file" as const });
      setStatus(file.name);
    } catch {
      setStatus("Failed to load audio");
    }
  };

  return (
    <Section title="Audio Reactivity">
      <Toggle label="Audio Reactive" checked={store.audioEnabled} onChange={handleToggle} />
      {store.audioEnabled && (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => { store.setDiscrete({ audioSource: "mic" as const }); handleToggle(true); }}
              className={`flex-1 py-1.5 text-[11px] rounded-md border transition-all ${
                store.audioSource === "mic"
                  ? "bg-accent/10 border-accent/40 text-accent"
                  : "bg-surface border-border text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Microphone
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className={`flex-1 py-1.5 text-[11px] rounded-md border transition-all ${
                store.audioSource === "file"
                  ? "bg-accent/10 border-accent/40 text-accent"
                  : "bg-surface border-border text-text-tertiary hover:text-text-secondary"
              }`}
            >
              Audio File
            </button>
            <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
          </div>
          {status && <p className="text-[10px] text-text-tertiary truncate">{status}</p>}
          <Slider label="Sensitivity" value={store.audioSensitivity} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ audioSensitivity: v })} onCommit={() => store.commitSet()} />
          <Select label="Bass drives" value={store.audioBassTarget} options={AUDIO_TARGETS} onChange={(v) => store.setDiscrete({ audioBassTarget: v })} />
          <Select label="Treble drives" value={store.audioTrebleTarget} options={AUDIO_TARGETS} onChange={(v) => store.setDiscrete({ audioTrebleTarget: v })} />
          <Select label="Energy drives" value={store.audioEnergyTarget} options={AUDIO_TARGETS} onChange={(v) => store.setDiscrete({ audioEnergyTarget: v })} />
        </>
      )}
    </Section>
  );
}
