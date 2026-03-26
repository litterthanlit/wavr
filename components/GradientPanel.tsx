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

export default function GradientPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-5 p-4">
      <Select
        label="Gradient Type"
        value={store.gradientType}
        options={GRADIENT_OPTIONS}
        onChange={(v) => store.set({ gradientType: v as typeof store.gradientType })}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs text-text-secondary">Colors</span>
        {store.colors.map((color, i) => (
          <ColorInput
            key={i}
            color={color}
            onChange={(c) => store.setColor(i, c)}
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

      <div className="flex flex-col gap-3">
        <Slider label="Speed" value={store.speed} min={0} max={2} step={0.01} onChange={(v) => store.set({ speed: v })} />
        <Slider label="Complexity" value={store.complexity} min={1} max={8} step={1} onChange={(v) => store.set({ complexity: v })} />
        <Slider label="Scale" value={store.scale} min={0.2} max={4} step={0.01} onChange={(v) => store.set({ scale: v })} />
        <Slider label="Distortion" value={store.distortion} min={0} max={1} step={0.01} onChange={(v) => store.set({ distortion: v })} />
        <Slider label="Brightness" value={store.brightness} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ brightness: v })} />
        <Slider label="Saturation" value={store.saturation} min={0} max={2} step={0.01} onChange={(v) => store.set({ saturation: v })} />
      </div>
    </div>
  );
}
