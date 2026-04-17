"use client";

import { useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { useGradientStore } from "@/lib/store";
import { MAX_LAYERS, BlendMode, LayerParams } from "@wavr/core";
import Slider from "@/components/ui/Slider";
import { computeMoveFromDragEnd, layerIdFor } from "@/lib/layer-dnd";

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
      { value: "colorBurn", label: "Color Burn" },
      { value: "linearBurn", label: "Linear Burn" },
      { value: "darkerColor", label: "Darker Color" },
    ],
  },
  {
    group: "Lighten",
    modes: [
      { value: "lighten", label: "Lighten" },
      { value: "screen", label: "Screen" },
      { value: "colorDodge", label: "Color Dodge" },
      { value: "add", label: "Linear Dodge (Add)" },
      { value: "lighterColor", label: "Lighter Color" },
    ],
  },
  {
    group: "Contrast",
    modes: [
      { value: "overlay", label: "Overlay" },
      { value: "softLight", label: "Soft Light" },
      { value: "hardLight", label: "Hard Light" },
      { value: "vividLight", label: "Vivid Light" },
      { value: "linearLight", label: "Linear Light" },
      { value: "pinLight", label: "Pin Light" },
      { value: "hardMix", label: "Hard Mix" },
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

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Respect prefers-reduced-motion: disable dnd-kit's layout transition when set.
const animateLayoutChanges: AnimateLayoutChanges = (args) => {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return false;
  }
  return defaultAnimateLayoutChanges(args);
};

interface SortableLayerRowProps {
  id: string;
  index: number;
  layer: LayerParams;
  isActive: boolean;
  canDrag: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
}

function SortableLayerRow({
  id,
  index,
  layer,
  isActive,
  canDrag,
  canRemove,
  onSelect,
  onToggleVisibility,
  onRemove,
}: SortableLayerRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, animateLayoutChanges });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all duration-150 group ${
        isActive
          ? "bg-surface border border-accent/40"
          : "bg-transparent border border-transparent hover:bg-surface/50"
      }`}
    >
      {/* Drag handle — only this element activates dragging */}
      {canDrag ? (
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-5 flex items-center justify-center text-text-tertiary hover:text-text-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-grab active:cursor-grabbing touch-none"
          aria-label={`Reorder layer ${index + 1}`}
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
            <circle cx="2" cy="2" r="1" />
            <circle cx="8" cy="2" r="1" />
            <circle cx="2" cy="7" r="1" />
            <circle cx="8" cy="7" r="1" />
            <circle cx="2" cy="12" r="1" />
            <circle cx="8" cy="12" r="1" />
          </svg>
        </button>
      ) : (
        <div className="w-4 h-5" aria-hidden="true" />
      )}

      {/* Visibility toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleVisibility();
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
      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
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
  );
}

export default function LayerPanel() {
  const store = useGradientStore();
  const layers = store.layers as LayerParams[];

  const layerIds = useMemo(() => layers.map((_, i) => layerIdFor(i)), [layers]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require a small movement before a drag starts so the handle can still
      // receive focus/click events.
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const move = computeMoveFromDragEnd(
      { active: event.active, over: event.over },
      useGradientStore.getState().layers.length,
    );
    if (!move) return;
    const [from, to] = move;
    useGradientStore.getState().moveLayer(from, to);
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-secondary">Layers</span>
        {layers.length < MAX_LAYERS && (
          <button
            onClick={() => store.addLayer()}
            className="text-xs text-text-tertiary hover:text-accent transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={layerIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {layers.map((layer, i) => (
              <SortableLayerRow
                key={layerIds[i]}
                id={layerIds[i]}
                index={i}
                layer={layer}
                isActive={i === store.activeLayerIndex}
                canDrag={layers.length > 1}
                canRemove={layers.length > 1}
                onSelect={() => store.selectLayer(i)}
                onToggleVisibility={() => store.toggleLayerVisibility(i)}
                onRemove={() => store.removeLayer(i)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Active layer controls */}
      {layers.length > 1 && (
        <>
          <div className="border-t border-border" />
          <div className="flex flex-col gap-3">
            <Slider
              label="Opacity"
              value={layers[store.activeLayerIndex]?.opacity ?? 1}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => store.setLayerOpacity(store.activeLayerIndex, v)}
              onCommit={() => store.commitSet()}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-text-secondary">Blend Mode</span>
              <select
                value={layers[store.activeLayerIndex]?.blendMode ?? "normal"}
                onChange={(e) =>
                  store.setLayerBlendMode(store.activeLayerIndex, e.target.value as BlendMode)
                }
                className="bg-surface border border-border rounded-md px-2.5 py-1.5 text-xs text-text-primary
                  appearance-none cursor-pointer focus:outline-none focus:border-border-active transition-colors duration-150"
              >
                {BLEND_GROUPS.map((group) => (
                  <optgroup key={group.group} label={group.group}>
                    {group.modes.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {store.parallaxEnabled && (
              <Slider
                label="Depth"
                value={layers[store.activeLayerIndex]?.depth ?? 0}
                min={-1}
                max={1}
                step={0.01}
                onChange={(v) => {
                  const newLayers = layers.map((l, i) =>
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
