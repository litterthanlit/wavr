"use client";

import { useGradientStore, GradientState } from "@/lib/store";
import { MAX_LAYERS, BlendMode, LayerParams } from "@/lib/layers";
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
        {(store.layers as LayerParams[]).map((layer, i) => (
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
              className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                layer.visible ? "text-text-secondary hover:text-text-primary" : "text-text-tertiary opacity-40"
              }`}
              aria-label={layer.visible ? "Hide layer" : "Show layer"}
            >
              {layer.visible ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
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
                className="text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove layer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
            {store.parallaxEnabled && (
              <Slider
                label="Depth"
                value={store.layers[store.activeLayerIndex]?.depth ?? 0}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => {
                  const newLayers = store.layers.map((l, i) =>
                    i === store.activeLayerIndex ? { ...l, depth: v } : l
                  );
                  store.set({ layers: newLayers });
                }}
                onCommit={() => store.commitSet()}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
