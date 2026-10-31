"use client";

import { useGradientStore } from "@/lib/store";
import { MAX_LAYERS, BlendMode, LayerParams } from "@wavr/core";
import Slider from "@/components/ui/Slider";
import { LazyCombobox } from "@/components/lazy";
import { Button } from "@/components/litt/button";
import { EyeIcon, EyeOffIcon, PlusIcon, XIcon } from "@/components/litt/icons";
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
        <span className="text-litt-small text-litt-fg-muted">Layers</span>
        {store.layers.length < MAX_LAYERS && (
          <Button size="sm" variant="ghost" icon={<PlusIcon />} onClick={() => store.addLayer()}>
            Add
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {(store.layers as LayerParams[]).map((layer, i) => {
          const selected = i === store.activeLayerIndex;
          const name = gradientTypeLabel(layer.gradientType);
          return (
            <div
              key={i}
              className={`flex items-center gap-2 p-1 rounded-litt-control transition-colors duration-(--litt-dur-instant) ease-litt ${
                // Selected is raised (litt R3): the press block, never the accent.
                selected ? "bg-litt-block shadow-(--litt-block-lift)" : "bg-transparent hover:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)]"
              }`}
            >
              <Button
                iconOnly
                size="sm"
                variant="ghost"
                onClick={() => store.toggleLayerVisibility(i)}
                aria-label={layer.visible ? `Hide layer ${i + 1}` : `Show layer ${i + 1}`}
              >
                {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
              </Button>

              {/* The row's own control: selects the layer, as the 3D panel's object rows do. */}
              <button
                type="button"
                aria-pressed={selected}
                aria-label={`Layer ${i + 1}: ${name}`}
                onClick={() => store.selectLayer(i)}
                className="flex h-litt-control-sm min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-litt-control text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus"
              >
                <span aria-hidden className="flex gap-1">
                  {layer.colors.slice(0, 4).map((c, ci) => (
                    <span
                      key={ci}
                      className="size-2 rounded-litt-pill"
                      style={{ backgroundColor: cssColor(c, store.colorProfile) }}
                    />
                  ))}
                </span>
                <span className="truncate text-litt-small text-litt-fg">{name}</span>
              </button>

              {store.layers.length > 1 && (
                <Button iconOnly size="sm" variant="ghost" onClick={() => store.removeLayer(i)} aria-label={`Remove layer ${i + 1}`}>
                  <XIcon />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Active layer controls */}
      {store.layers.length > 1 && (
        <>
          <div className="border-t border-litt-line" />
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
