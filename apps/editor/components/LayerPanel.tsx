"use client";

import { useGradientStore } from "@/lib/store";
import { MAX_LAYERS, BlendMode, LayerParams } from "@wavr/core";
import Slider from "@/components/ui/Slider";
import { LazyCombobox } from "@/components/lazy";
import { gradientTypeLabel } from "@/lib/gradient-types";
import { cssColor } from "@/lib/css-color";

const BLEND_GROUPS: { label: string; options: { value: BlendMode; label: string }[] }[] = [
  {
    label: "Normal",
    options: [{ value: "normal", label: "Normal" }],
  },
  {
    label: "Darken",
    options: [
      { value: "darken", label: "Darken" },
      { value: "multiply", label: "Multiply" },
      { value: "colorBurn", label: "Color burn" },
      { value: "linearBurn", label: "Linear burn" },
      { value: "darkerColor", label: "Darker color" },
    ],
  },
  {
    label: "Lighten",
    options: [
      { value: "lighten", label: "Lighten" },
      { value: "screen", label: "Screen" },
      { value: "colorDodge", label: "Color dodge" },
      { value: "add", label: "Linear dodge (add)" },
      { value: "lighterColor", label: "Lighter color" },
    ],
  },
  {
    label: "Contrast",
    options: [
      { value: "overlay", label: "Overlay" },
      { value: "softLight", label: "Soft light" },
      { value: "hardLight", label: "Hard light" },
      { value: "vividLight", label: "Vivid light" },
      { value: "linearLight", label: "Linear light" },
      { value: "pinLight", label: "Pin light" },
      { value: "hardMix", label: "Hard mix" },
    ],
  },
  {
    label: "Inversion",
    options: [
      { value: "difference", label: "Difference" },
      { value: "exclusion", label: "Exclusion" },
      { value: "subtract", label: "Subtract" },
      { value: "divide", label: "Divide" },
    ],
  },
  {
    label: "Component",
    options: [
      { value: "hue", label: "Hue" },
      { value: "saturation", label: "Saturation" },
      { value: "color", label: "Color" },
      { value: "luminosity", label: "Luminosity" },
    ],
  },
];

const BLEND_MODES = BLEND_GROUPS.flatMap((group) => group.options);

export default function LayerPanel() {
  const store = useGradientStore();

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-secondary">Layers</span>
        {store.layers.length < MAX_LAYERS && (
          <button
            onClick={() => store.addLayer()}
            className="text-xs text-text-tertiary hover:text-litt-fg transition-colors duration-(--litt-dur-instant) ease-litt"
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
            className={`flex items-center gap-2 p-2 rounded-litt-control cursor-pointer transition-colors duration-(--litt-dur-instant) ease-litt group ${
              // Selected is raised (litt R3): the press block, never the accent.
              i === store.activeLayerIndex
                ? "bg-litt-block shadow-(--litt-block-lift)"
                : "bg-transparent hover:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)]"
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
                  style={{ backgroundColor: cssColor(c, store.colorProfile) }}
                />
              ))}
            </div>

            {/* Layer type label */}
            <span className="text-[10px] text-text-tertiary flex-1">
              {gradientTypeLabel(layer.gradientType)}
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
            {/* litt's Combobox: a long list in groups (litt's Select is for a short one). A field left empty keeps the mode. */}
            <LazyCombobox
              label="Blend mode"
              size="sm"
              options={BLEND_GROUPS}
              value={store.layers[store.activeLayerIndex]?.blendMode ?? "normal"}
              onValueChange={(value: string | string[]) => {
                const mode = BLEND_MODES.find((m) => m.value === value);
                if (mode) store.setLayerBlendMode(store.activeLayerIndex, mode.value);
              }}
            />
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
