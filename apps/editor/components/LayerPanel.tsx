"use client";

import { useGradientStore } from "@/lib/store";
import { MAX_LAYERS, BlendMode, LayerParams } from "@wavr/core";
import Slider from "@/components/ui/Slider";
import Select from "@/components/ui/Select";
import { Button } from "@/components/litt/button";
import { Tooltip } from "@/components/litt/tooltip";
import { EyeIcon, EyeOffIcon, PlusIcon, XIcon } from "@/components/litt/icons";
import { ROW, ROW_BUTTON, ROW_IDLE, ROW_SELECTED } from "@/components/ui/row-styles";
import { gradientTypeLabel } from "@/lib/gradient-types";

const BLEND_GROUPS: { group: string; modes: { value: BlendMode; label: string }[] }[] = [
  {
    group: "Normal",
    modes: [{ value: "normal", label: "Normal" }],
  },
  {
    group: "Darken",
    modes: [
      { value: "darken", label: "Darken" },
      { value: "multiply", label: "Multiply" },
      { value: "colorBurn", label: "Color burn" },
      { value: "linearBurn", label: "Linear burn" },
      { value: "darkerColor", label: "Darker color" },
    ],
  },
  {
    group: "Lighten",
    modes: [
      { value: "lighten", label: "Lighten" },
      { value: "screen", label: "Screen" },
      { value: "colorDodge", label: "Color dodge" },
      { value: "add", label: "Linear dodge (Add)" },
      { value: "lighterColor", label: "Lighter color" },
    ],
  },
  {
    group: "Contrast",
    modes: [
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
    group: "Inversion",
    modes: [
      { value: "difference", label: "Difference" },
      { value: "exclusion", label: "Exclusion" },
      { value: "subtract", label: "Subtract" },
      { value: "divide", label: "Divide" },
    ],
  },
  {
    group: "Component",
    modes: [
      { value: "hue", label: "Hue" },
      { value: "saturation", label: "Saturation" },
      { value: "color", label: "Color" },
      { value: "luminosity", label: "Luminosity" },
    ],
  },
];

const BLEND_OPTIONS = BLEND_GROUPS.flatMap(({ group, modes }) =>
  modes.map((mode) => ({ value: mode.value, label: mode.label, group })),
);

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function LayerPanel() {
  const store = useGradientStore();
  const active = store.layers[store.activeLayerIndex];

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex h-litt-control-sm items-center justify-between">
        <h2 className="text-litt-caption font-litt-label text-litt-fg-subtle">Layers</h2>
        {store.layers.length < MAX_LAYERS && (
          <Button variant="ghost" size="sm" icon={<PlusIcon />} onClick={() => store.addLayer()}>
            Add layer
          </Button>
        )}
      </div>

      <ul className="flex flex-col gap-1" aria-label="Layers">
        {(store.layers as LayerParams[]).map((layer, i) => {
          const selected = i === store.activeLayerIndex;
          const name = gradientTypeLabel(layer.gradientType);
          return (
            <li key={i} className={`${ROW} pr-1 ${selected ? ROW_SELECTED : ROW_IDLE}`}>
              <button
                type="button"
                onClick={() => store.selectLayer(i)}
                aria-pressed={selected}
                aria-label={`Layer ${i + 1}, ${name}${layer.visible ? "" : ", hidden"}`}
                className={ROW_BUTTON}
              >
                <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                  {layer.colors.slice(0, 4).map((c, ci) => (
                    <span
                      key={ci}
                      className="size-2.5 rounded-litt-control shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-fg)_12%,transparent)]"
                      style={{ backgroundColor: rgbToHex(...c) }}
                    />
                  ))}
                </span>
                <span
                  className={`truncate ${
                    !layer.visible ? "text-litt-fg-disabled" : selected ? "text-litt-fg" : "text-litt-fg-muted"
                  }`}
                >
                  {name}
                </span>
              </button>
              <Tooltip content={layer.visible ? "Hide layer" : "Show layer"}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label={layer.visible ? `Hide layer ${i + 1}` : `Show layer ${i + 1}`}
                  icon={layer.visible ? <EyeIcon /> : <EyeOffIcon />}
                  onClick={() => store.toggleLayerVisibility(i)}
                />
              </Tooltip>
              {store.layers.length > 1 && (
                <Tooltip content="Remove layer">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={`Remove layer ${i + 1}`}
                    icon={<XIcon />}
                    onClick={() => store.removeLayer(i)}
                  />
                </Tooltip>
              )}
            </li>
          );
        })}
      </ul>

      {/* Active layer controls */}
      {store.layers.length > 1 && (
        <div className="flex flex-col gap-4 pt-2">
          <Slider
            label="Opacity"
            value={active?.opacity ?? 1}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => store.setLayerOpacity(store.activeLayerIndex, v)}
            onCommit={() => store.commitSet()}
          />
          <Select
            label="Blend mode"
            value={active?.blendMode ?? "normal"}
            options={BLEND_OPTIONS}
            onChange={(v) => store.setLayerBlendMode(store.activeLayerIndex, v as BlendMode)}
          />
          {store.parallaxEnabled && (
            <Slider
              label="Depth"
              value={active?.depth ?? 0}
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
      )}
    </div>
  );
}
