"use client";

import type { ReactNode } from "react";
import { useGradientStore } from "@/lib/store";
import Section from "@/components/ui/Section";
import Toggle from "@/components/ui/Toggle";
import Slider from "@/components/ui/Slider";
import { hdrPeakLabel } from "@/lib/units";
import { useHdrDisplay } from "@/lib/useHdrDisplay";
import { useHdrStatus, type HdrStatus } from "@/lib/hdr-status";
import { EFFECT_SWITCHES, isSwitchOn, switchPatch } from "@/lib/effect-switches";
import { sceneExtrasOn } from "@/lib/scene-extras";

/** What the HDR headroom does here, and why it may not show. */
function hdrCaption(headroom: number, display: boolean | null, status: HdrStatus): string {
  const what = `On an HDR screen, light shines up to ${hdrPeakLabel(headroom)} brighter than white`;
  const exports = "Exports stay standard range.";
  if (display === false) return `${what}. This screen shows standard range, so you see the scene without it. ${exports}`;
  if (status === "unsupported") return `${what}, but this browser can't show it from WebGPU yet (Chrome and Edge can). ${exports}`;
  if (status === "lost") return `HDR stopped when the GPU reset; showing standard range. Reload the page to try again. ${exports}`;
  return `${what}. ${exports}`;
}

function Caption({ children, live }: { children: ReactNode; live?: boolean }) {
  return <p className="text-litt-caption font-normal leading-snug text-litt-fg-subtle" aria-live={live ? "polite" : undefined}>{children}</p>;
}

export default function EffectsPanel() {
  const store = useGradientStore();
  const hdrDisplay = useHdrDisplay();
  const hdrStatus = useHdrStatus();
  const extras = sceneExtrasOn(store);
  const commit = () => store.commitSet();
  // The sliders stop above zero: off belongs to the switch, and a slider that
  // reached zero would unmount mid-drag.

  return (
    <div className="flex flex-col divide-y divide-litt-line p-4">
      <Section title="Effects">
        <Toggle label="Bloom" checked={store.realBloomEnabled} onChange={(v) => store.setDiscrete({ realBloomEnabled: v })} />
        {store.hdrHeadroom > 0 && <Caption live>{hdrCaption(store.hdrHeadroom, hdrDisplay, hdrStatus)}</Caption>}
        <Toggle label={EFFECT_SWITCHES.grain.label} checked={isSwitchOn(store.grain)} onChange={(on) => store.setDiscrete(switchPatch("grain", on))} />
        {isSwitchOn(store.grain) && <Slider label="Amount" value={store.grain} min={0.01} max={1} step={0.01} onChange={(v) => store.set({ grain: v })} onCommit={commit} />}
        <Toggle label={EFFECT_SWITCHES.mouseReact.label} checked={isSwitchOn(store.mouseReact)} onChange={(on) => store.setDiscrete(switchPatch("mouseReact", on))} />
        {isSwitchOn(store.mouseReact) && <Slider label="Strength" value={store.mouseReact} min={0.01} max={1} step={0.01} onChange={(v) => store.set({ mouseReact: v })} onCommit={commit} />}
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
