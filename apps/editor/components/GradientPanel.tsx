"use client";

import React, { useState } from "react";
import { useGradientStore } from "@/lib/store";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import { em, px, radiansAsDegrees, times } from "@/lib/units";
import ColorInput from "@/components/ui/ColorInput";
import GradientBar from "@/components/ui/GradientBar";
import { MAX_STOPS, barPalette, insertStop, reverseStops, sameStops, stopPosition, type Rgb } from "@/lib/color-stops";
import Toggle from "@/components/ui/Toggle";
import Section from "@/components/ui/Section";
import Segmented from "@/components/ui/Segmented";
import Disclosure from "@/components/ui/Disclosure";
import LookPicker from "@/components/LookPicker";
import type { MaskParams, TextMaskAlign } from "@wavr/core";
import { GRADIENT_OPTIONS, curatedPalette } from "@/lib/gradient-types";
import { maskMode, maskModePatch, type MaskMode } from "@/lib/layer-mask";
import { layerExtrasOn } from "@/lib/scene-extras";

const MASK_MODE_OPTIONS: { value: MaskMode; label: string }[] = [
  { value: "none", label: "None" },
  { value: "shape", label: "Shape" },
  { value: "text", label: "Text" },
];

const MASK_SHAPE_OPTIONS = [
  { value: "circle", label: "Circle" },
  { value: "roundedRect", label: "Rounded Rect" },
  { value: "ellipse", label: "Ellipse" },
  { value: "polygon", label: "Polygon" },
  { value: "star", label: "Star" },
  { value: "blob", label: "Blob" },
];

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const MAX_IMAGE_SIZE = 2048;
const WEBP_QUALITY = 0.92;

function resizeAndLoadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const original = reader.result as string;
      const img = new Image();
      img.onload = () => {
        if (!img.width || !img.height) {
          resolve(original); // e.g. an SVG without intrinsic size
          return;
        }
        const ratio = Math.min(1, MAX_IMAGE_SIZE / img.width, MAX_IMAGE_SIZE / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // WebP keeps alpha and is usually much smaller than PNG, which keeps
        // saved projects small. Browsers that can't encode WebP return PNG.
        const encoded = canvas.toDataURL("image/webp", WEBP_QUALITY);
        resolve(ratio === 1 && original.length <= encoded.length ? original : encoded);
      };
      img.onerror = reject;
      img.src = original;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ImageUpload({
  label,
  imageData,
  onUpload,
  onRemove,
}: {
  label: string;
  imageData: string | null;
  onUpload: (dataURL: string) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const dataURL = await resizeAndLoadImage(file);
    onUpload(dataURL);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (imageData) {
    return (
      <div className="relative group">
        {/* eslint-disable-next-line @next/next/no-img-element -- previews are local data URLs from user uploads */}
        <img
          src={imageData}
          alt={label}
          className="w-full h-24 object-cover rounded-md border border-border"
        />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-surface/80 text-text-secondary
            hover:bg-error hover:text-white text-xs flex items-center justify-center
            opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer
          hover:border-litt-line-strong hover:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)] transition-colors duration-(--litt-dur-instant) ease-litt"
      >
        <p className="text-xs text-text-tertiary">
          Drop image or click to upload
        </p>
        <p className="text-[10px] text-text-tertiary mt-1">PNG, JPG, WebP</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </>
  );
}

function ShapeMaskControls({
  mask,
  onUpdate,
}: {
  mask: MaskParams;
  onUpdate: (field: string, value: number | boolean | string | [number, number]) => void;
}) {
  const commit = () => useGradientStore.getState().commitSet();
  return (
    <>
      <Select label="Shape" value={mask.shape} options={MASK_SHAPE_OPTIONS} onChange={(v) => onUpdate("shape", v)} />
      <Disclosure label="More" ariaLabel="More mask controls">
        <Slider label="Position X" value={mask.position[0]} min={-1} max={1} step={0.01}
          onChange={(v) => onUpdate("position", [v, mask.position[1]])} onCommit={commit} />
        <Slider label="Position Y" value={mask.position[1]} min={-1} max={1} step={0.01}
          onChange={(v) => onUpdate("position", [mask.position[0], v])} onCommit={commit} />
        <Slider label="Scale X" value={mask.scale[0]} min={0.1} max={4} step={0.01} format={times}
          onChange={(v) => onUpdate("scale", [v, mask.scale[1]])} onCommit={commit} />
        <Slider label="Scale Y" value={mask.scale[1]} min={0.1} max={4} step={0.01} format={times}
          onChange={(v) => onUpdate("scale", [mask.scale[0], v])} onCommit={commit} />
        <Slider label="Rotation" value={mask.rotation} min={0} max={6.28} step={0.01} format={radiansAsDegrees}
          onChange={(v) => onUpdate("rotation", v)} onCommit={commit} />
        <Slider label="Feather" value={mask.feather} min={0} max={0.5} step={0.001}
          onChange={(v) => onUpdate("feather", v)} onCommit={commit} />
        <Toggle label="Invert" checked={mask.invert} onChange={(v) => onUpdate("invert", v)} />
        {mask.shape === "roundedRect" && (
          <Slider label="Corner Radius" value={mask.cornerRadius} min={0} max={0.5} step={0.01}
            onChange={(v) => onUpdate("cornerRadius", v)} onCommit={commit} />
        )}
        {(mask.shape === "polygon" || mask.shape === "star") && (
          <Slider label="Sides" value={mask.sides} min={3} max={12} step={1}
            onChange={(v) => onUpdate("sides", v)} onCommit={commit} />
        )}
        {mask.shape === "star" && (
          <Slider label="Inner Radius" value={mask.starInnerRadius} min={0.1} max={0.9} step={0.01}
            onChange={(v) => onUpdate("starInnerRadius", v)} onCommit={commit} />
        )}
        <Slider label="Noise Edge" value={mask.noiseDistortion} min={0} max={1} step={0.01}
          onChange={(v) => onUpdate("noiseDistortion", v)} onCommit={commit} />
      </Disclosure>
    </>
  );
}

export default function GradientPanel() {
  const store = useGradientStore();
  const activeLayer = store.layers[store.activeLayerIndex];
  const isImageType = store.gradientType === "image";
  const [selectedStop, setSelectedStop] = useState(0);
  const colors = store.colors as Rgb[];
  const stop = Math.min(selectedStop, colors.length - 1);

  // A new stop goes after the selected one (before it at the end), halfway
  // to its neighbour, in the colour the palette already has there.
  const addStop = () => {
    if (colors.length >= MAX_STOPS) return;
    const index = stop === colors.length - 1 ? stop : stop + 1;
    const t = (stopPosition(index - 1, colors.length) + stopPosition(index, colors.length)) / 2;
    const color = barPalette(colors, {
      oklab: store.oklabEnabled,
      softness: store.softness,
      colorProfile: store.colorProfile,
    }).sample(t);
    store.setDiscrete({ colors: insertStop(colors, index, color) });
    setSelectedStop(index);
  };

  const updateLayerField = (field: string, value: number | string | boolean | [number, number]) => {
    const newLayers = store.layers.map((l, i) =>
      i === store.activeLayerIndex ? { ...l, [field]: value } : l
    );
    store.set({ layers: newLayers } as Partial<typeof store>);
  };

  const updateMask = (field: string, value: number | boolean | string | [number, number]) => {
    const mask1 = { ...activeLayer.mask1, [field]: value };
    if (typeof value === "string" || typeof value === "boolean") {
      store.setLayerParam({ mask1 });
    } else {
      store.set({ layers: store.layers.map((l, i) => (i === store.activeLayerIndex ? { ...l, mask1 } : l)) });
    }
  };

  const look = GRADIENT_OPTIONS.find((option) => option.value === store.gradientType);
  const mask = maskMode(activeLayer);
  const extras = layerExtrasOn(activeLayer);
  const curated = curatedPalette(store.gradientType);
  const canReset = curated !== null && !sameStops(colors, curated);

  return (
    <div className="flex flex-col divide-y divide-border p-4">
      <Section title="Look" aside={<span className="text-xs font-medium text-text-primary">{look?.label}</span>}>
        <LookPicker value={store.gradientType} onPick={store.setLook} />
        <p className="text-[11px] leading-snug text-text-tertiary">{look?.description}</p>
      </Section>

      {isImageType && (
        <Section title="Image Source">
          <ImageUpload
            label="Color image"
            imageData={activeLayer.imageData}
            onUpload={(url) => store.setLayerImage(store.activeLayerIndex, url)}
            onRemove={() => store.setLayerImage(store.activeLayerIndex, null)}
          />
          {activeLayer.imageData && (
            <>
              <Slider label="Scale" value={activeLayer.imageScale} min={0.1} max={4} step={0.01} format={times}
                onChange={(v) => updateLayerField("imageScale", v)}
                onCommit={() => store.commitSet()} />
              <Slider label="Offset X" value={activeLayer.imageOffset[0]} min={-1} max={1} step={0.01}
                onChange={(v) => updateLayerField("imageOffset", [v, activeLayer.imageOffset[1]])}
                onCommit={() => store.commitSet()} />
              <Slider label="Offset Y" value={activeLayer.imageOffset[1]} min={-1} max={1} step={0.01}
                onChange={(v) => updateLayerField("imageOffset", [activeLayer.imageOffset[0], v])}
                onCommit={() => store.commitSet()} />
            </>
          )}
        </Section>
      )}

      {!isImageType && (
        <Section title="Colors">
          <GradientBar
            colors={colors}
            selected={stop}
            onSelect={setSelectedStop}
            onColorsChange={(next) => store.setDiscrete({ colors: next })}
            colorProfile={store.colorProfile}
            oklab={store.oklabEnabled}
            softness={store.softness}
          />
          <ColorInput
            key={`${store.activeLayerIndex}-${stop}`}
            color={colors[stop]}
            colorProfile={store.colorProfile}
            onChange={(c) => store.setColor(stop, c)}
            onCommit={() => store.commitSet()}
            onRemove={() => {
              store.removeColor(stop);
              setSelectedStop(Math.max(0, stop - 1));
            }}
            canRemove={colors.length > 2}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-tertiary">
              Color {stop + 1} of {colors.length}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  store.setDiscrete({ colors: reverseStops(colors) });
                  setSelectedStop(colors.length - 1 - stop);
                }}
                className="text-text-secondary hover:text-litt-fg transition-colors duration-(--litt-dur-instant) ease-litt py-1"
              >
                Reverse
              </button>
              {canReset && (
                <button
                  type="button"
                  onClick={() => store.setDiscrete({ colors: curated })}
                  className="text-text-secondary hover:text-litt-fg transition-colors duration-(--litt-dur-instant) ease-litt py-1"
                >
                  Reset
                </button>
              )}
              {colors.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={addStop}
                  className="text-text-secondary hover:text-litt-fg transition-colors duration-(--litt-dur-instant) ease-litt py-1"
                >
                  + Add color
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      <Section title="Mask">
        <Segmented
          label="Mask"
          value={mask}
          options={MASK_MODE_OPTIONS}
          onChange={(mode) => store.setLayerParam(maskModePatch(activeLayer, mode))}
        />
        {mask === "shape" && <ShapeMaskControls mask={activeLayer.mask1} onUpdate={updateMask} />}
        {mask === "text" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-text-tertiary">Text</span>
              <input
                type="text"
                value={activeLayer.textMaskContent}
                onChange={(e) => updateLayerField("textMaskContent", e.target.value)}
                onBlur={() => store.commitSet()}
                placeholder="Enter text..."
                className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded-md
                  text-text-primary placeholder:text-text-tertiary focus:outline-none
                  focus:border-litt-focus transition-colors duration-(--litt-dur-instant) ease-litt"
              />
            </label>
            <Disclosure label="More" ariaLabel="More text mask controls">
              <Slider label="Size" value={activeLayer.textMaskFontSize} min={32} max={200} step={1} format={px}
                onChange={(v) => updateLayerField("textMaskFontSize", v)}
                onCommit={() => store.commitSet()} />
              <Slider label="Weight" value={activeLayer.textMaskFontWeight} min={400} max={900} step={100}
                onChange={(v) => updateLayerField("textMaskFontWeight", v)}
                onCommit={() => store.commitSet()} />
              <Slider label="Spacing" value={activeLayer.textMaskLetterSpacing} min={-0.05} max={0.2} step={0.005} format={em}
                onChange={(v) => updateLayerField("textMaskLetterSpacing", v)}
                onCommit={() => store.commitSet()} />
              <Select
                label="Align"
                value={activeLayer.textMaskAlign}
                options={TEXT_ALIGN_OPTIONS}
                onChange={(v) => store.setLayerParam({ textMaskAlign: v as TextMaskAlign })}
              />
            </Disclosure>
          </>
        )}
      </Section>

      <Section title="Motion">
        <Slider label="Speed" value={store.speed} min={0} max={2} step={0.01} format={times} onChange={(v) => store.set({ speed: v })} onCommit={() => store.commitSet()} />
        <Slider label="Scale" value={store.scale} min={0.2} max={4} step={0.01} format={times} onChange={(v) => store.set({ scale: v })} onCommit={() => store.commitSet()} />
        <Slider label="Complexity" value={store.complexity} min={1} max={8} step={1} onChange={(v) => store.set({ complexity: v })} onCommit={() => store.commitSet()} />
        <Slider label="Distortion" value={store.distortion} min={0} max={1} step={0.01} onChange={(v) => store.set({ distortion: v })} onCommit={() => store.commitSet()} />
        <Slider label="Softness" value={store.softness} min={0} max={1} step={0.01} onChange={(v) => store.set({ softness: v })} onCommit={() => store.commitSet()} />
      </Section>

      {extras.length > 0 && (
        <Section title="Also on this layer">
          <p className="text-[11px] leading-snug text-text-tertiary">
            Parts of this layer the editor no longer offers. Remove one to drop it.
          </p>
          {extras.map((extra) => (
            <div key={extra.label} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">{extra.label}</span>
              <button
                type="button"
                aria-label={`Remove ${extra.label}`}
                onClick={() => store.setLayerParam(extra.clear(activeLayer))}
                className="text-text-secondary hover:text-litt-fg transition-colors duration-(--litt-dur-instant) ease-litt py-1"
              >
                Remove
              </button>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
