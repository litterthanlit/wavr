"use client";

import { useGradientStore } from "@/lib/store";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import ColorInput from "@/components/ui/ColorInput";

const GRADIENT_OPTIONS = [
  { value: "mesh", label: "Mesh" },
  { value: "radial", label: "Radial" },
  { value: "linear", label: "Linear" },
  { value: "conic", label: "Conic" },
  { value: "plasma", label: "Plasma" },
];

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
      {children}
    </span>
  );
}

export default function GradientPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Type */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Type</SectionHeader>
        <Select
          label="Gradient Type"
          value={store.gradientType}
          options={GRADIENT_OPTIONS}
          onChange={(v) => store.setDiscrete({ gradientType: v as typeof store.gradientType })}
        />
      </div>

      <div className="border-t border-border" />

      {/* Colors */}
      <div className="flex flex-col gap-2">
        <SectionHeader>Colors</SectionHeader>
        {(store.colors as [number, number, number][]).map((color, i) => (
          <ColorInput
            key={i}
            color={color}
            onChange={(c) => store.setColor(i, c)}
            onCommit={() => store.commitSet()}
            onRemove={() => store.removeColor(i)}
            canRemove={store.colors.length > 2}
          />
        ))}
        {store.colors.length < 8 && (
          <button
            onClick={() => store.addColor()}
            className="text-xs text-text-tertiary hover:text-accent transition-colors py-1"
          >
            + Add Color
          </button>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Animation */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Animation</SectionHeader>
        <Slider label="Speed" value={store.speed} min={0} max={2} step={0.01} onChange={(v) => store.set({ speed: v })} onCommit={() => store.commitSet()} />
        <Slider label="Complexity" value={store.complexity} min={1} max={8} step={1} onChange={(v) => store.set({ complexity: v })} onCommit={() => store.commitSet()} />
        <Slider label="Scale" value={store.scale} min={0.2} max={4} step={0.01} onChange={(v) => store.set({ scale: v })} onCommit={() => store.commitSet()} />
        <Slider label="Distortion" value={store.distortion} min={0} max={1} step={0.01} onChange={(v) => store.set({ distortion: v })} onCommit={() => store.commitSet()} />
        {store.gradientType === "mesh" && (
          <Slider label="Domain Warp" value={store.domainWarp} min={0} max={1} step={0.01} onChange={(v) => store.set({ domainWarp: v })} onCommit={() => store.commitSet()} />
        )}
      </div>

      <div className="border-t border-border" />

      {/* Appearance */}
      <div className="flex flex-col gap-3">
        <SectionHeader>Appearance</SectionHeader>
        <Slider label="Brightness" value={store.brightness} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ brightness: v })} onCommit={() => store.commitSet()} />
        <Slider label="Saturation" value={store.saturation} min={0} max={2} step={0.01} onChange={(v) => store.set({ saturation: v })} onCommit={() => store.commitSet()} />
        <Slider label="Hue Shift" value={store.hueShift} min={0} max={360} step={1} onChange={(v) => store.set({ hueShift: v })} onCommit={() => store.commitSet()} />
      </div>
    </div>
  );
}
