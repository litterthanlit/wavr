"use client";

import React from "react";
import { useGradientStore } from "@/lib/store";
import Select from "@/components/ui/Select";
import Slider from "@/components/ui/Slider";
import ColorInput from "@/components/ui/ColorInput";
import Toggle from "@/components/ui/Toggle";
import PanelSection, { PanelSubsection } from "@/components/ui/PanelSection";
import { Button } from "@/components/litt/button";
import { Callout } from "@/components/litt/callout";
import { FileDrop } from "@/components/litt/file-drop";
import { TextField } from "@/components/litt/input";
import { Media } from "@/components/litt/media";
import { PlusIcon, TrashIcon } from "@/components/litt/icons";
import {
  LIGHT_FIELD_PALETTES,
  LIGHT_FIELD_PALETTE_ROLES,
  LIGHT_GRADIENT_PALETTES,
  LayerParams,
  MaskParams,
  TextMaskAlign,
  isLightFieldType,
  isLightGradientType,
  isLightRampPalette,
} from "@wavr/core";
import { GRADIENT_OPTIONS, defaultSoftnessForType } from "@/lib/gradient-types";

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

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    onUpload(await resizeAndLoadImage(file));
  };

  if (imageData) {
    return (
      <div className="flex flex-col gap-2">
        <Media src={imageData} alt={label} ratio={16 / 9} radius="surface" />
        <Button variant="ghost" size="sm" icon={<TrashIcon />} onClick={onRemove} className="self-start">
          Remove image
        </Button>
      </div>
    );
  }

  return (
    <FileDrop
      label={label}
      accept={IMAGE_TYPES}
      multiple={false}
      onFiles={handleFiles}
      hint="PNG, JPG or WebP"
    />
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
    <PanelSubsection title={label}>
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
          <Slider label="Scale X" value={mask.scale[0]} min={0.1} max={4} step={0.01}
            onChange={(v) => onUpdate("scale", [v, mask.scale[1]])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Scale Y" value={mask.scale[1]} min={0.1} max={4} step={0.01}
            onChange={(v) => onUpdate("scale", [mask.scale[0], v])}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Rotation" value={mask.rotation} min={0} max={6.28} step={0.01}
            onChange={(v) => onUpdate("rotation", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Slider label="Feather" value={mask.feather} min={0} max={0.5} step={0.001}
            onChange={(v) => onUpdate("feather", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
          <Toggle label="Invert" checked={mask.invert} onChange={(v) => onUpdate("invert", v)} />
          {mask.shape === "roundedRect" && (
            <Slider label="Corner radius" value={mask.cornerRadius} min={0} max={0.5} step={0.01}
              onChange={(v) => onUpdate("cornerRadius", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          {(mask.shape === "polygon" || mask.shape === "star") && (
            <Slider label="Sides" value={mask.sides} min={3} max={12} step={1}
              onChange={(v) => onUpdate("sides", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          {mask.shape === "star" && (
            <Slider label="Inner radius" value={mask.starInnerRadius} min={0.1} max={0.9} step={0.01}
              onChange={(v) => onUpdate("starInnerRadius", v)}
              onCommit={() => useGradientStore.getState().commitSet()} />
          )}
          <Slider label="Noise edge" value={mask.noiseDistortion} min={0} max={1} step={0.01}
            onChange={(v) => onUpdate("noiseDistortion", v)}
            onCommit={() => useGradientStore.getState().commitSet()} />
        </>
      )}
    </PanelSubsection>
  );
}

export default function GradientPanel() {
  const store = useGradientStore();
  const activeLayer = store.layers[store.activeLayerIndex];
  const isImageType = store.gradientType === "image";

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

  return (
    <div className="flex flex-col px-4 pb-6">
      {/* Type */}
      <PanelSection title="Type">
        <Select
          label="Gradient type"
          value={store.gradientType}
          options={GRADIENT_OPTIONS}
          onChange={(v) => {
            const gradientType = v as typeof store.gradientType;
            store.setDiscrete({
              gradientType,
              softness: defaultSoftnessForType(gradientType),
            });
          }}
        />
        {/* The light modes read the palette as darkest-to-brightest; offer theirs when it doesn't run that way. */}
        {isLightGradientType(store.gradientType) && !isLightRampPalette(store.colors) && (
          <Callout
            title="Reads the palette as light"
            description="Darkest colour first, brightest last."
            action={
              <Button
                size="sm"
                onClick={() => {
                  if (!isLightGradientType(store.gradientType)) return;
                  const palette = LIGHT_GRADIENT_PALETTES[store.gradientType];
                  store.setDiscrete({ colors: palette.map((c) => [...c] as [number, number, number]) });
                }}
              >
                Use its palette
              </Button>
            }
          />
        )}
        {/* The aperture and light wall read the palette by role; say which, and offer theirs. */}
        {isLightFieldType(store.gradientType) && (
          <Callout
            title="Reads the palette by role"
            description={LIGHT_FIELD_PALETTE_ROLES[store.gradientType]}
            action={
              JSON.stringify(store.colors) !== JSON.stringify(LIGHT_FIELD_PALETTES[store.gradientType]) ? (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!isLightFieldType(store.gradientType)) return;
                    const palette = LIGHT_FIELD_PALETTES[store.gradientType];
                    store.setDiscrete({ colors: palette.map((c) => [...c] as [number, number, number]) });
                  }}
                >
                  Use its palette
                </Button>
              ) : undefined
            }
          />
        )}
      </PanelSection>

      {/* Image Source — shown when type is "image" */}
      {isImageType && (
        <PanelSection title="Image source">
            <ImageUpload
              label="Color image"
              imageData={activeLayer.imageData}
              onUpload={(url) => store.setLayerImage(store.activeLayerIndex, url)}
              onRemove={() => store.setLayerImage(store.activeLayerIndex, null)}
            />
            {activeLayer.imageData && (
              <>
                <Slider label="Scale" value={activeLayer.imageScale} min={0.1} max={4} step={0.01}
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
        </PanelSection>
      )}

      {/* Colors — hidden when type is "image" */}
      {!isImageType && (
        <>
          <PanelSection title="Colors">
            <div className="flex flex-wrap items-center gap-2">
              {(store.colors as [number, number, number][]).map((color, i) => (
                <ColorInput
                  key={i}
                  label={`Color ${i + 1}`}
                  color={color}
                  onChange={(c) => store.setColor(i, c)}
                  onCommit={() => store.commitSet()}
                  onRemove={() => store.removeColor(i)}
                  canRemove={store.colors.length > 2}
                />
              ))}
              {store.colors.length < 8 && (
                <Button variant="ghost" size="sm" iconOnly aria-label="Add color" icon={<PlusIcon />} onClick={() => store.addColor()} />
              )}
            </div>
          </PanelSection>

          {/* Texture Overlay — for non-image types */}
          <PanelSection title="Texture overlay">
            <ImageUpload
              label="Blend image"
              imageData={activeLayer.imageData}
              onUpload={(url) => store.setLayerImage(store.activeLayerIndex, url)}
              onRemove={() => store.setLayerImage(store.activeLayerIndex, null)}
            />
            {activeLayer.imageData && (
              <>
                <Select
                  label="Blend mode"
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
                <Slider label="Blend opacity" value={activeLayer.imageBlendOpacity} min={0} max={1} step={0.01}
                  onChange={(v) => updateLayerField("imageBlendOpacity", v)}
                  onCommit={() => store.commitSet()} />
                <Slider label="Image scale" value={activeLayer.imageScale} min={0.1} max={4} step={0.01}
                  onChange={(v) => updateLayerField("imageScale", v)}
                  onCommit={() => store.commitSet()} />
              </>
            )}
          </PanelSection>
        </>
      )}

      {/* Distortion Map — available for all types */}
      <PanelSection title="Distortion map">
        <Toggle
          label="Enable distortion map"
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
      </PanelSection>

      {/* Mask */}
      <PanelSection title="Mask">
        <Toggle
          label="Enable mask"
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
                  <PanelSubsection title="Combine">
                    <Select
                      label="Blend mode"
                      value={activeLayer.maskBlendMode}
                      options={MASK_BLEND_OPTIONS}
                      onChange={(v) => store.setLayerParam({ maskBlendMode: v as LayerParams["maskBlendMode"] })}
                    />
                    {activeLayer.maskBlendMode === "smoothUnion" && (
                      <Slider label="Smoothness" value={activeLayer.maskSmoothness} min={0} max={0.5} step={0.01}
                        onChange={(v) => updateLayerField("maskSmoothness", v)}
                        onCommit={() => store.commitSet()} />
                    )}
                  </PanelSubsection>
                )}
              </>
            )}
          </>
        )}
      </PanelSection>

      {/* Text Mask */}
      <PanelSection title="Text mask">
        <Toggle
          label="Enable text mask"
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
            <TextField
              label="Text"
              size="sm"
              value={activeLayer.textMaskContent}
                onChange={(e) => {
                  const newLayers = store.layers.map((l, i) =>
                    i === store.activeLayerIndex ? { ...l, textMaskContent: e.target.value } : l
                  );
                  store.set({ layers: newLayers } as Partial<typeof store>);
                }}
              onBlur={() => store.commitSet()}
              placeholder="Enter text…"
            />
            <Slider label="Size" value={activeLayer.textMaskFontSize} min={32} max={200} step={1}
              onChange={(v) => updateLayerField("textMaskFontSize", v)}
              onCommit={() => store.commitSet()} />
            <Slider label="Weight" value={activeLayer.textMaskFontWeight} min={400} max={900} step={100}
              onChange={(v) => updateLayerField("textMaskFontWeight", v)}
              onCommit={() => store.commitSet()} />
            <Slider label="Spacing" value={activeLayer.textMaskLetterSpacing} min={-0.05} max={0.2} step={0.005}
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
      </PanelSection>

      {/* Animation */}
      <PanelSection title="Animation">
        <Slider label="Speed" value={store.speed} min={0} max={2} step={0.01} onChange={(v) => store.set({ speed: v })} onCommit={() => store.commitSet()} />
        <Slider label="Complexity" value={store.complexity} min={1} max={8} step={1} onChange={(v) => store.set({ complexity: v })} onCommit={() => store.commitSet()} />
        <Slider label="Scale" value={store.scale} min={0.2} max={4} step={0.01} onChange={(v) => store.set({ scale: v })} onCommit={() => store.commitSet()} />
        <Slider label="Distortion" value={store.distortion} min={0} max={1} step={0.01} onChange={(v) => store.set({ distortion: v })} onCommit={() => store.commitSet()} />
        <Slider label="Softness" value={store.softness} min={0} max={1} step={0.01} onChange={(v) => store.set({ softness: v })} onCommit={() => store.commitSet()} />
        {(store.gradientType === "mesh" || store.gradientType === "silk" || store.gradientType === "aurora") && (
          <Slider label="Domain warp" value={store.domainWarp} min={0} max={1} step={0.01} onChange={(v) => store.set({ domainWarp: v })} onCommit={() => store.commitSet()} />
        )}
      </PanelSection>

      {/* Appearance */}
      <PanelSection title="Appearance">
        <Slider label="Brightness" value={store.brightness} min={0.1} max={2} step={0.01} onChange={(v) => store.set({ brightness: v })} onCommit={() => store.commitSet()} />
        <Slider label="Saturation" value={store.saturation} min={0} max={2} step={0.01} onChange={(v) => store.set({ saturation: v })} onCommit={() => store.commitSet()} />
        <Slider label="Hue shift" value={store.hueShift} min={0} max={360} step={1} onChange={(v) => store.set({ hueShift: v })} onCommit={() => store.commitSet()} />
      </PanelSection>
    </div>
  );
}
