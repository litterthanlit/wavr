"use client";

import { useState, useRef } from "react";
import { useGradientStore } from "@/lib/store";
import { getAudioAnalyzer } from "@/components/Canvas";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";
import Select from "@/components/ui/Select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/litt/accordion";
import { Segmented } from "@/components/litt/segmented";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={title}>
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col gap-4">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

/** Open on first view: the sections most scenes use. */
const OPEN_SECTIONS = ["Texture", "Lighting"];

export default function EffectsPanel() {
  const store = useGradientStore();

  return (
    <Accordion type="multiple" defaultValue={OPEN_SECTIONS} className="mx-4 mt-2 mb-6">
      {/* Output quality (spec 0004) — on by default, grouped separately so users
          don't confuse it with creative effects. Leave on unless exporting a
          posterized look. */}
      <Section
        title="Output quality"
      >
        <Toggle
          label="Anti-banding"
          description="Sub-pixel noise that hides 8-bit banding. Leave on unless you want a posterized look."
          checked={store.debandEnabled}
          onChange={(v) => store.setDiscrete({ debandEnabled: v })}
        />
        <Slider
          label="Strength"
          value={store.debandStrength}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => store.set({ debandStrength: v })}
          onCommit={() => store.commitSet()}
          disabled={!store.debandEnabled}
        />
      </Section>


      {/* Texture */}
      <Section title="Texture">
        <Toggle label="Noise overlay" checked={store.noiseEnabled} onChange={(v) => store.setDiscrete({ noiseEnabled: v })} />
        <Slider label="Intensity" value={store.noiseIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ noiseIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.noiseEnabled} />
        <Slider label="Scale" value={store.noiseScale} min={0.1} max={5} step={0.1} onChange={(v) => store.set({ noiseScale: v })} onCommit={() => store.commitSet()} disabled={!store.noiseEnabled} />
        <Slider label="Film grain" value={store.grain} min={0} max={1} step={0.01} onChange={(v) => store.set({ grain: v })} onCommit={() => store.commitSet()} />
        <Toggle label="Reaction-Diffusion" checked={store.reactionDiffEnabled} onChange={(v) => store.setDiscrete({ reactionDiffEnabled: v })} />
        <Slider label="Intensity" value={store.reactionDiffIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ reactionDiffIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.reactionDiffEnabled} />
        <Slider label="Scale" value={store.reactionDiffScale} min={0.2} max={5} step={0.1} onChange={(v) => store.set({ reactionDiffScale: v })} onCommit={() => store.commitSet()} disabled={!store.reactionDiffEnabled} />
      </Section>


      {/* Lighting */}
      <Section title="Lighting">
        <Toggle label="Bloom" checked={store.bloomEnabled} onChange={(v) => store.setDiscrete({ bloomEnabled: v })} />
        <Slider label="Intensity" value={store.bloomIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ bloomIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.bloomEnabled} />
        <Toggle label="Cinematic bloom" checked={store.realBloomEnabled} onChange={(v) => store.setDiscrete({ realBloomEnabled: v })} />
        <Toggle label="Soft glow" checked={store.glowEnabled} onChange={(v) => store.setDiscrete({ glowEnabled: v })} />
        <Slider label="Intensity" value={store.glowIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ glowIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.glowEnabled} />
        <Slider label="Radius" value={store.glowRadius} min={0.01} max={0.1} step={0.005} onChange={(v) => store.set({ glowRadius: v })} onCommit={() => store.commitSet()} disabled={!store.glowEnabled} />
        <Toggle label="Caustics" checked={store.causticEnabled} onChange={(v) => store.setDiscrete({ causticEnabled: v })} />
        <Slider label="Intensity" value={store.causticIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ causticIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.causticEnabled} />
        <Slider label="Vignette" value={store.vignette} min={0} max={1} step={0.01} onChange={(v) => store.set({ vignette: v })} onCommit={() => store.commitSet()} />
      </Section>


      {/* Color */}
      <Section title="Color">
        <Toggle label="Oklab blending" checked={store.oklabEnabled} onChange={(v) => store.setDiscrete({ oklabEnabled: v })} />
        <Select label="Tone mapping" value={String(store.toneMapMode)} options={[{ value: "0", label: "None" }, { value: "1", label: "Soft highlights" }, { value: "2", label: "ACES Filmic" }]} onChange={(v) => store.setDiscrete({ toneMapMode: Number(v) })} />
        <Slider label="Color blend" value={store.colorBlend} min={0} max={1} step={0.01} onChange={(v) => store.set({ colorBlend: v })} onCommit={() => store.commitSet()} />
        <Slider label="Chromatic aberration" value={store.chromaticAberration} min={0} max={1} step={0.01} onChange={(v) => store.set({ chromaticAberration: v })} onCommit={() => store.commitSet()} />
      </Section>


      {/* Blur */}
      <Section title="Blur">
        <Toggle label="Gaussian blur" checked={store.blurEnabled} onChange={(v) => store.setDiscrete({ blurEnabled: v })} />
        <Slider label="Amount" value={store.blurAmount} min={0} max={20} step={0.5} onChange={(v) => store.set({ blurAmount: v })} onCommit={() => store.commitSet()} disabled={!store.blurEnabled} />
        <Slider label="Radial blur" value={store.radialBlurAmount} min={0} max={1} step={0.01} onChange={(v) => store.set({ radialBlurAmount: v })} onCommit={() => store.commitSet()} />
      </Section>


      {/* Distortion */}
      <Section title="Distortion">
        <Toggle label="Curl noise" checked={store.curlEnabled} onChange={(v) => store.setDiscrete({ curlEnabled: v })} />
        <Slider label="Intensity" value={store.curlIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ curlIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.curlEnabled} />
        <Slider label="Scale" value={store.curlScale} min={0.2} max={5} step={0.1} onChange={(v) => store.set({ curlScale: v })} onCommit={() => store.commitSet()} disabled={!store.curlEnabled} />
        <Toggle label="Liquify" checked={store.liquifyEnabled} onChange={(v) => store.setDiscrete({ liquifyEnabled: v })} />
        <Slider label="Intensity" value={store.liquifyIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ liquifyIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.liquifyEnabled} />
        <Slider label="Scale" value={store.liquifyScale} min={1} max={5} step={0.1} onChange={(v) => store.set({ liquifyScale: v })} onCommit={() => store.commitSet()} disabled={!store.liquifyEnabled} />
        <Toggle label="Kaleidoscope" checked={store.kaleidoscopeEnabled} onChange={(v) => store.setDiscrete({ kaleidoscopeEnabled: v })} />
        <Slider label="Segments" value={store.kaleidoscopeSegments} min={2} max={12} step={1} onChange={(v) => store.set({ kaleidoscopeSegments: v })} onCommit={() => store.commitSet()} disabled={!store.kaleidoscopeEnabled} />
        <Slider label="Rotation" value={store.kaleidoscopeRotation} min={0} max={360} step={1} onChange={(v) => store.set({ kaleidoscopeRotation: v })} onCommit={() => store.commitSet()} disabled={!store.kaleidoscopeEnabled} />
      </Section>


      {/* Stylize */}
      <Section title="Stylize">
        <Toggle label="Dither" checked={store.ditherEnabled} onChange={(v) => store.setDiscrete({ ditherEnabled: v })} />
        <Slider label="Pixel size" value={store.ditherSize} min={1} max={12} step={1} onChange={(v) => store.set({ ditherSize: v })} onCommit={() => store.commitSet()} disabled={!store.ditherEnabled} />
        <Toggle label="ASCII" checked={store.asciiEnabled} onChange={(v) => store.setDiscrete({ asciiEnabled: v })} />
        <Slider label="Cell size" value={store.asciiSize} min={2} max={24} step={1} onChange={(v) => store.set({ asciiSize: v })} onCommit={() => store.commitSet()} disabled={!store.asciiEnabled} />
        <Toggle label="Pixel sort" checked={store.pixelSortEnabled} onChange={(v) => store.setDiscrete({ pixelSortEnabled: v })} />
        <Slider label="Intensity" value={store.pixelSortIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ pixelSortIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.pixelSortEnabled} />
        <Slider label="Threshold" value={store.pixelSortThreshold} min={0} max={1} step={0.01} onChange={(v) => store.set({ pixelSortThreshold: v })} onCommit={() => store.commitSet()} disabled={!store.pixelSortEnabled} />
      </Section>

      {/* 3D Depth */}
      <Section title="3D depth">
        <Toggle label="Parallax" checked={store.parallaxEnabled} onChange={(v) => store.setDiscrete({ parallaxEnabled: v })} />
        <Slider label="Strength" value={store.parallaxStrength} min={0} max={1} step={0.01} onChange={(v) => store.set({ parallaxStrength: v })} onCommit={() => store.commitSet()} disabled={!store.parallaxEnabled} />
        <Toggle
          label="Mesh distortion"
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
        <div className="flex flex-col gap-4 pt-2">
          <h4 className="text-litt-small font-litt-title text-litt-fg">Legacy 3D projection</h4>
          <Toggle
            label="Shader shape projection"
            checked={store.threeDEnabled}
            onChange={(v) => {
              if (v && store.meshDistortionEnabled) {
                store.setDiscrete({ threeDEnabled: v, meshDistortionEnabled: false });
              } else {
                store.setDiscrete({ threeDEnabled: v });
              }
            }}
          />
        </div>
        {store.threeDEnabled && (
          <>
            <Select
              label="Legacy shape"
              value={String(store.threeDShape)}
              options={[
                { value: "0", label: "Sphere" },
                { value: "1", label: "Torus" },
                { value: "2", label: "Plane" },
                { value: "3", label: "Cylinder" },
                { value: "4", label: "Cube" },
              ]}
              onChange={(v) => store.setDiscrete({ threeDShape: Number(v) })}
            />
            <Slider label="Perspective" value={store.threeDPerspective} min={0.5} max={3} step={0.1} onChange={(v) => store.set({ threeDPerspective: v })} onCommit={() => store.commitSet()} />
            <Slider label="Rotation speed" value={store.threeDRotationSpeed} min={0} max={2} step={0.01} onChange={(v) => store.set({ threeDRotationSpeed: v })} onCommit={() => store.commitSet()} />
            <Slider label="Zoom" value={store.threeDZoom} min={0.5} max={2} step={0.01} onChange={(v) => store.set({ threeDZoom: v })} onCommit={() => store.commitSet()} />
            <Slider label="Lighting" value={store.threeDLighting} min={0} max={1} step={0.01} onChange={(v) => store.set({ threeDLighting: v })} onCommit={() => store.commitSet()} />
          </>
        )}
      </Section>


      {/* Advanced */}
      <Section title="Interaction">
        <Slider label="Mouse react" value={store.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} onCommit={() => store.commitSet()} />
        <Toggle label="Mouse trail" checked={store.trailEnabled} onChange={(v) => store.setDiscrete({ trailEnabled: v })} />
        <Slider label="Trail length" value={store.trailLength} min={0.9} max={0.99} step={0.01} onChange={(v) => store.set({ trailLength: v })} onCommit={() => store.commitSet()} disabled={!store.trailEnabled} />
        <Slider label="Trail width" value={store.trailWidth} min={0.01} max={0.15} step={0.005} onChange={(v) => store.set({ trailWidth: v })} onCommit={() => store.commitSet()} disabled={!store.trailEnabled} />
        <Toggle label="Click ripple" checked={store.rippleEnabled} onChange={(v) => store.setDiscrete({ rippleEnabled: v })} />
        <Slider label="Intensity" value={store.rippleIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ rippleIntensity: v })} onCommit={() => store.commitSet()} disabled={!store.rippleEnabled} />
        <Toggle label="Feedback loop" checked={store.feedbackEnabled} onChange={(v) => store.setDiscrete({ feedbackEnabled: v })} />
        <Slider label="Decay" value={store.feedbackDecay} min={0} max={0.98} step={0.01} onChange={(v) => store.set({ feedbackDecay: v })} onCommit={() => store.commitSet()} disabled={!store.feedbackEnabled} />
      </Section>


      {/* Audio Reactivity */}
      <AudioSection />
    </Accordion>
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
    <Section title="Audio reactivity">
      <Toggle label="Audio reactive" checked={store.audioEnabled} onChange={handleToggle} />
      {store.audioEnabled && (
        <>
          <Segmented
            legend="Audio source"
            size="sm"
            block
            value={store.audioSource}
            onValueChange={(source) => {
              if (source === "mic") {
                store.setDiscrete({ audioSource: "mic" as const });
                handleToggle(true);
              } else {
                // The source switches to the file once one has loaded.
                fileRef.current?.click();
              }
            }}
            options={[
              { value: "mic", label: "Microphone" },
              { value: "file", label: "Audio file" },
            ]}
          />
          <input ref={fileRef} type="file" accept="audio/*" className="hidden" onChange={handleFile} />
          {status && <p className="truncate text-litt-small text-litt-fg-muted">{status}</p>}
          <Slider label="Sensitivity" value={store.audioSensitivity} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ audioSensitivity: v })} onCommit={() => store.commitSet()} />
          <Select label="Bass drives" value={store.audioBassTarget} options={AUDIO_TARGETS} onChange={(v) => store.setDiscrete({ audioBassTarget: v })} />
          <Select label="Treble drives" value={store.audioTrebleTarget} options={AUDIO_TARGETS} onChange={(v) => store.setDiscrete({ audioTrebleTarget: v })} />
          <Select label="Energy drives" value={store.audioEnergyTarget} options={AUDIO_TARGETS} onChange={(v) => store.setDiscrete({ audioEnergyTarget: v })} />
        </>
      )}
    </Section>
  );
}
