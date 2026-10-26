"use client";

import type { ReactNode } from "react";
import { useGradientStore, type PerformanceMode } from "@/lib/store";
import Section from "@/components/ui/Section";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";
import { degrees, hdrPeakLabel, percent, px } from "@/lib/units";
import Select from "@/components/ui/Select";
import { useWideGamutDisplay } from "@/lib/useWideGamutDisplay";
import { useHdrDisplay } from "@/lib/useHdrDisplay";
import { useHdrStatus, type HdrStatus } from "@/lib/hdr-status";
import { sceneExtrasOn } from "@/lib/scene-extras";

const TONE_MAP_OPTIONS = [
  { value: "0", label: "None" },
  { value: "1", label: "Soft highlights" },
  { value: "2", label: "ACES Filmic" },
];

const COLOR_PROFILE_OPTIONS = [
  { value: "srgb", label: "sRGB" },
  { value: "display-p3", label: "Display P3 (wide gamut)" },
];

const PERFORMANCE_OPTIONS: { value: PerformanceMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "quality", label: "Quality" },
  { value: "battery", label: "Battery" },
];

/** What the HDR headroom does here, and why it may not show. */
function hdrCaption(headroom: number, display: boolean | null, status: HdrStatus): string {
  const what = `On an HDR screen, light shines up to ${hdrPeakLabel(headroom)} brighter than white`;
  const exports = "Exports stay standard range.";
  if (display === false) return `${what}. This screen shows standard range, so you see the scene without it. ${exports}`;
  if (status === "unsupported") return `${what}, but this browser can't show it from WebGPU yet (Chrome and Edge can). ${exports}`;
  if (status === "lost") return `HDR stopped when the GPU reset; showing standard range. Set the headroom to 0 and back to try again. ${exports}`;
  return `${what}. ${exports}`;
}

function Caption({ children, live }: { children: ReactNode; live?: boolean }) {
  return <p className="text-[11px] leading-snug text-text-tertiary" aria-live={live ? "polite" : undefined}>{children}</p>;
}

export default function EffectsPanel() {
  const store = useGradientStore();
  const wideGamut = useWideGamutDisplay();
  const hdrDisplay = useHdrDisplay();
  const hdrStatus = useHdrStatus();
  const extras = sceneExtrasOn(store);
  const commit = () => store.commitSet();

  return (
    <div className="flex flex-col divide-y divide-border p-4">
      <Section title="Light">
        <Toggle label="Bloom" checked={store.realBloomEnabled} onChange={(v) => store.setDiscrete({ realBloomEnabled: v })} />
        <Slider label="Vignette" value={store.vignette} min={0} max={1} step={0.01} onChange={(v) => store.set({ vignette: v })} onCommit={commit} />
        <Slider label="Film Grain" value={store.grain} min={0} max={1} step={0.01} onChange={(v) => store.set({ grain: v })} onCommit={commit} />
      </Section>

      <Section title="Color">
        <Select label="Tone Mapping" value={String(store.toneMapMode)} options={TONE_MAP_OPTIONS} onChange={(v) => store.setDiscrete({ toneMapMode: Number(v) })} />
        <Slider label="Brightness" value={store.brightness} min={0.1} max={2} step={0.01} format={percent} onChange={(v) => store.set({ brightness: v })} onCommit={commit} />
        <Slider label="Saturation" value={store.saturation} min={0} max={2} step={0.01} format={percent} onChange={(v) => store.set({ saturation: v })} onCommit={commit} />
        <Slider label="Hue Shift" value={store.hueShift} min={0} max={360} step={1} format={degrees} onChange={(v) => store.set({ hueShift: v })} onCommit={commit} />
      </Section>

      <Section title="Lens">
        <Toggle label="Blur" checked={store.blurEnabled} onChange={(v) => store.setDiscrete({ blurEnabled: v })} />
        {store.blurEnabled && <Slider label="Amount" value={store.blurAmount} min={0} max={20} step={0.5} format={px} onChange={(v) => store.set({ blurAmount: v })} onCommit={commit} />}
        <Slider label="Chromatic Aberration" value={store.chromaticAberration} min={0} max={1} step={0.01} onChange={(v) => store.set({ chromaticAberration: v })} onCommit={commit} />
      </Section>

      <Section title="Pointer">
        <Slider label="Mouse React" value={store.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} onCommit={commit} />
        <Toggle label="Click Ripple" checked={store.rippleEnabled} onChange={(v) => store.setDiscrete({ rippleEnabled: v })} />
        {store.rippleEnabled && <Slider label="Intensity" value={store.rippleIntensity} min={0} max={1} step={0.01} onChange={(v) => store.set({ rippleIntensity: v })} onCommit={commit} />}
        <Toggle label="Mouse Trail" checked={store.trailEnabled} onChange={(v) => store.setDiscrete({ trailEnabled: v })} />
        {store.trailEnabled && <Slider label="Length" value={store.trailLength} min={0.9} max={0.99} step={0.01} onChange={(v) => store.set({ trailLength: v })} onCommit={commit} />}
        {store.trailEnabled && <Slider label="Width" value={store.trailWidth} min={0.01} max={0.15} step={0.005} onChange={(v) => store.set({ trailWidth: v })} onCommit={commit} />}
      </Section>

      <Section title="Output">
        <Select label="Color Profile" value={store.colorProfile} options={COLOR_PROFILE_OPTIONS} onChange={(v) => store.setDiscrete({ colorProfile: v as typeof store.colorProfile })} />
        {store.colorProfile === "display-p3" && (
          <Caption>
            Every colour is read as Display P3, a wider gamut than sRGB: richer, more saturated light on P3 screens.
            {wideGamut === false && " This screen shows sRGB, so here you see the nearest sRGB colours."}
          </Caption>
        )}
        <Slider label="HDR Headroom" value={store.hdrHeadroom} min={0} max={3} step={0.25} format={hdrPeakLabel} onChange={(v) => store.set({ hdrHeadroom: v })} onCommit={commit} />
        {store.hdrHeadroom > 0 && <Caption live>{hdrCaption(store.hdrHeadroom, hdrDisplay, hdrStatus)}</Caption>}
        {/* Sub-pixel noise that hides 8-bit banding; on unless a posterized look is the point. */}
        <Toggle label="Anti-banding" checked={store.debandEnabled} onChange={(v) => store.setDiscrete({ debandEnabled: v })} />
        {store.debandEnabled && <Slider label="Strength" value={store.debandStrength} min={0} max={2} step={0.1} onChange={(v) => store.set({ debandStrength: v })} onCommit={commit} />}
        <Select label="Performance" value={store.performanceMode} options={PERFORMANCE_OPTIONS} onChange={(v) => store.setDiscrete({ performanceMode: v as PerformanceMode })} />
      </Section>

      {extras.length > 0 && (
        <Section title="Also in this scene">
          <Caption>Effects this scene uses that the editor no longer offers. Switch one off to drop it.</Caption>
          {extras.map((extra) => (
            <Toggle key={extra.label} label={extra.label} checked onChange={() => store.setDiscrete(extra.off)} />
          ))}
        </Section>
      )}
    </div>
  );
}
