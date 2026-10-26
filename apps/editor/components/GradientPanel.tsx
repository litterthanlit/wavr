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
import LookPicker from "@/components/LookPicker";
import { LayerParams, MaskParams, TextMaskAlign } from "@wavr/core";
import { GRADIENT_OPTIONS, curatedPalette } from "@/lib/gradient-types";

const MASK_SHAPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "circle", label: "Circle" },
  { value: "roundedRect", label: "Rounded Rect" },
  { value: "ellipse", label: "Ellipse" },
  { value: "polygon", label: "Polygon" },
  { value: "star", label: "Star" },
  { value: "blob", label: "Blob" },
];

const MASK_BLEND_OPTIONS = [
  { value: "union", label: "Union" },
  { value: "subtract", label: "Subtract" },
  { value: "intersect", label: "Intersect" },
  { value: "smoothUnion", label: "Smooth Union" },
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
          hover:border-accent hover:bg-accent/5 transition-colors"
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

function MaskControls({
  label,
  mask,
  onUpdate,
}: {
  label: string;
  mask: MaskParams;
  onUpdate: (field: string, value: number | boolean | string | [number, number]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[10px] font-medium text-text-tertiary">{label}</span>
      <Select
        label="Shape"
        value={mask.shape}
        options={MASK_SHAPE_OPTIONS}
        onChange={(v) => onUpdate("shape", v)}
      />
      {mask.shape !== "none" && (
        <>
          <Slider label="Position X" value={mask.position[0]} min={-1} max={1} step={0.01}
            onChange={(v) => onUpdate("position", [v, mask.position[1]])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Position Y" value={mask.position[1]} min={-1} max={1} step={0.01}
            onChange={(v) => onUpdate("position", [mask.position[0], v])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Scale X" value={mask.scale[0]} min={0.1} max={4} step={0.01} format={times}
            onChange={(v) => onUpdate("scale", [v, mask.scale[1]])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Scale Y" value={mask.scale[1]} min={0.1} max={4} step={0.01} format={times}
            onChange={(v) => onUpdate("scale", [mask.scale[0], v])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Rotation" value={mask.rotation} min={0} max={6.28} step={0.01} format={radiansAsDegrees}
            onChange={(v) => onUpdate("rotation", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Feather" value={mask.feather} min={0} max={0.5} step={0.001}
            onChange={(v) => onUpdate("feather", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Toggle label="Invert" checked={mask.invert} onChange={(v) => onUpdate("invert", v)} />
          {mask.shape === "roundedRect" && (
            <Slider label="Corner Radius" value={mask.cornerRadius} min={0} max={0.5} step={0.01}
              onChange={(v) => onUpdate("cornerRadius", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          {(mask.shape === "polygon" || mask.shape === "star") && (
            <Slider label="Sides" value={mask.sides} min={3} max={12} step={1}
              onChange={(v) => onUpdate("sides", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          {mask.shape === "star" && (
            <Slider label="Inner Radius" value={mask.starInnerRadius} min={0.1} max={0.9} step={0.01}
              onChange={(v) => onUpdate("starInnerRadius", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          <Slider label="Noise Edge" value={mask.noiseDistortion} min={0} max={1} step={0.01}
            onChange={(v) => onUpdate("noiseDistortion", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
        </>
      )}
    </div>
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

  const updateMask = (maskKey: "mask1" | "mask2", field: string, value: number | boolean | string | [number, number]) => {
    const currentMask = activeLayer[maskKey];
    const updatedMask = { ...currentMask, [field]: value };
    if (typeof value === "string" && field === "shape") {
      store.setLayerParam({ [maskKey]: updatedMask });
    } else if (typeof value === "boolean") {
      store.setLayerParam({ [maskKey]: updatedMask });
    } else {
      const newLayers = store.layers.map((l, i) =>
        i === store.activeLayerIndex ? { ...l, [maskKey]: updatedMask } : l
      );
      store.set({ layers: newLayers } as Partial<typeof store>);
    }
  };

  const look = GRADIENT_OPTIONS.find((option) => option.value === store.gradientType);
  // The look's own palette, offered back once the colours differ from it.
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
                className="text-text-secondary hover:text-accent transition-colors py-1"
              >
                Reverse
              </button>
              {canReset && (
                <button
                  type="button"
                  onClick={() => store.setDiscrete({ colors: curated })}
                  className="text-text-secondary hover:text-accent transition-colors py-1"
                >
                  Reset
                </button>
              )}
              {colors.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={addStop}
                  className="text-text-secondary hover:text-accent transition-colors py-1"
                >
                  + Add color
                </button>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* Texture Overlay — for non-image types */}
      {!isImageType && (
        <Section title="Texture Overlay">
          <ImageUpload
            label="Blend image"
            imageData={activeLayer.imageData}
            onUpload={(url) => store.setLayerImage(store.activeLayerIndex, url)}
            onRemove={() => store.setLayerImage(store.activeLayerIndex, null)}
          />
          {activeLayer.imageData && (
            <>
              <Select
                label="Blend Mode"
                value={activeLayer.imageBlendMode}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "multiply", label: "Multiply" },
                  { value: "screen", label: "Screen" },
                  { value: "overlay", label: "Overlay" },
                  { value: "replace", label: "Replace" },
                ]}
                onChange={(v) => store.setLayerParam({ imageBlendMode: v as LayerParams["imageBlendMode"] })}
              />
              <Slider label="Blend Opacity" value={activeLayer.imageBlendOpacity} min={0} max={1} step={0.01}
                onChange={(v) => updateLayerField("imageBlendOpacity", v)}
                onCommit={() => store.commitSet()} />
              <Slider label="Image Scale" value={activeLayer.imageScale} min={0.1} max={4} step={0.01} format={times}
                onChange={(v) => updateLayerField("imageScale", v)}
                onCommit={() => store.commitSet()} />
            </>
          )}
        </Section>
      )}

      <Section title="Distortion Map">
        <Toggle
          label="Enable Distortion Map"
          checked={activeLayer.distortionMapEnabled}
          onChange={(v) => store.setLayerParam({ distortionMapEnabled: v })}
        />
        {activeLayer.distortionMapEnabled && (
          <>
            <ImageUpload
              label="Distortion map"
              imageData={activeLayer.distortionMapData}
              onUpload={(url) => store.setLayerDistortionMap(store.activeLayerIndex, url)}
              onRemove={() => store.setLayerDistortionMap(store.activeLayerIndex, null)}
            />
            {activeLayer.distortionMapData && (
              <Slider label="Intensity" value={activeLayer.distortionMapIntensity} min={0} max={1} step={0.01}
                onChange={(v) => updateLayerField("distortionMapIntensity", v)}
                onCommit={() => store.commitSet()} />
            )}
          </>
        )}
      </Section>

      <Section title="Mask">
        <Toggle
          label="Enable Mask"
          checked={activeLayer.maskEnabled}
          onChange={(v) => {
            const updates: Partial<LayerParams> = { maskEnabled: v };
            if (v) updates.textMaskEnabled = false;
            store.setLayerParam(updates);
          }}
        />
        {activeLayer.maskEnabled && (
          <>
            <MaskControls
              label="Mask 1"
              mask={activeLayer.mask1}
              onUpdate={(field, value) => updateMask("mask1", field, value)}
            />
            {activeLayer.mask1.shape !== "none" && (
              <>
                <MaskControls
                  label="Mask 2"
                  mask={activeLayer.mask2}
                  onUpdate={(field, value) => updateMask("mask2", field, value)}
                />
                {activeLayer.mask2.shape !== "none" && (
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-medium text-text-tertiary">Combine</span>
                    <Select
                      label="Blend Mode"
                      value={activeLayer.maskBlendMode}
                      options={MASK_BLEND_OPTIONS}
                      onChange={(v) => store.setLayerParam({ maskBlendMode: v as LayerParams["maskBlendMode"] })}
                    />
                    {activeLayer.maskBlendMode === "smoothUnion" && (
                      <Slider label="Smoothness" value={activeLayer.maskSmoothness} min={0} max={0.5} step={0.01}
                        onChange={(v) => updateLayerField("maskSmoothness", v)}
                        onCommit={() => store.commitSet()} />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </Section>

      <Section title="Text Mask">
        <Toggle
          label="Enable Text Mask"
          checked={activeLayer.textMaskEnabled}
          onChange={(v) => {
            // Mutually exclusive with shape mask
            const updates: Partial<LayerParams> = { textMaskEnabled: v };
            if (v) updates.maskEnabled = false;
            store.setLayerParam(updates);
          }}
        />
        {activeLayer.textMaskEnabled && (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-text-tertiary">Text</span>
              <input
                type="text"
                value={activeLayer.textMaskContent}
                onChange={(e) => {
                  const newLayers = store.layers.map((l, i) =>
                    i === store.activeLayerIndex ? { ...l, textMaskContent: e.target.value } : l
                  );
                  store.set({ layers: newLayers } as Partial<typeof store>);
                }}
                onBlur={() => store.commitSet()}
                placeholder="Enter text..."
                className="w-full px-2 py-1.5 text-xs bg-surface border border-border rounded-md
                  text-text-primary placeholder:text-text-tertiary focus:outline-none
                  focus:border-accent transition-colors"
              />
            </div>
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
    </div>
  );
}
