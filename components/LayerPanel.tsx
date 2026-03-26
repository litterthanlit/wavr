"use client";

import { useGradientStore } from "@/lib/store";
import { MAX_LAYERS, BlendMode } from "@/lib/layers";
import Slider from "@/components/ui/Slider";

const BLEND_OPTIONS: { value: BlendMode; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "add", label: "Add" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
];

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function LayerPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-secondary">Layers</span>
        {store.layers.length < MAX_LAYERS && (
          <button
            onClick={() => store.addLayer()}
            className="text-xs text-text-tertiary hover:text-accent transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {store.layers.map((layer, i) => (
          <div
            key={i}
            onClick={() => store.selectLayer(i)}
            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-150 group ${
              i === store.activeLayerIndex
                ? "bg-surface border border-accent/40"
                : "bg-transparent border border-transparent hover:bg-surface/50"
            }`}
          >
            {/* Visibility toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                store.toggleLayerVisibility(i);
              }}
              className={`text-[10px] w-5 h-5 flex items-center justify-center rounded transition-colors ${
                layer.visible ? "text-text-secondary" : "text-text-tertiary opacity-40"
              }`}
              aria-label={layer.visible ? "Hide layer" : "Show layer"}
            >
              {layer.visible ? "O" : "-"}
            </button>

            {/* Color preview dots */}
            <div className="flex gap-0.5">
              {layer.colors.slice(0, 4).map((c, ci) => (
                <div
                  key={ci}
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: rgbToHex(...c) }}
                />
              ))}
            </div>

            {/* Layer type label */}
            <span className="text-[10px] text-text-tertiary capitalize flex-1">
              {layer.gradientType}
            </span>

            {/* Remove button */}
            {store.layers.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  store.removeLayer(i);
                }}
                className="text-text-tertiary hover:text-text-primary text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove layer"
              >
                x
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Active layer controls */}
      {store.layers.length > 1 && (
        <>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-3">
            <Slider
              label="Opacity"
              value={store.layers[store.activeLayerIndex]?.opacity ?? 1}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => store.setLayerOpacity(store.activeLayerIndex, v)}
              onCommit={() => store.commitSet()}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-text-secondary">Blend Mode</span>
              <select
                value={store.layers[store.activeLayerIndex]?.blendMode ?? "normal"}
                onChange={(e) =>
                  store.setLayerBlendMode(store.activeLayerIndex, e.target.value as BlendMode)
                }
                className="bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary
                  appearance-none cursor-pointer focus:outline-none focus:border-border-active transition-colors duration-150"
              >
                {BLEND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
