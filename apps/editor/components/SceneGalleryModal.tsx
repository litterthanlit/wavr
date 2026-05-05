"use client";

import { SCENES, type Scene } from "@/lib/scenes";
import { useGradientStore } from "@/lib/store";
import type { CSSProperties } from "react";

interface SceneGalleryModalProps {
  open: boolean;
  onClose: () => void;
}

function SceneCard({ scene, onRemix }: { scene: Scene; onRemix: (scene: Scene) => void }) {
  return (
    <button
      onClick={() => onRemix(scene)}
      className={`group text-left rounded-lg border bg-surface overflow-hidden transition-all duration-150 hover:border-border-active ${
        scene.featured ? "border-accent/50 shadow-lg shadow-black/20" : "border-border"
      }`}
    >
      <div
        className="relative h-28 border-b border-border overflow-hidden"
        style={{ background: scene.thumbnail.background }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),rgba(0,0,0,0.22))]" />
        <div
          className="absolute left-5 right-5 top-1/2 h-px -translate-y-1/2 opacity-80 transition-transform duration-150 group-hover:scale-x-110"
          style={{ backgroundColor: scene.thumbnail.accent }}
        />
        <div
          className="absolute left-1/2 top-1/2 size-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-white/10 shadow-lg shadow-black/20"
          style={{ boxShadow: `0 0 28px ${scene.thumbnail.accent}` } as CSSProperties}
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-1">
          {scene.colors.map((color) => (
            <span
              key={color}
              className="size-3 rounded-full border border-white/35 shadow-sm shadow-black/20"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        {scene.featured ? (
          <span className="absolute right-3 top-3 rounded-full border border-white/25 bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white">
            Featured
          </span>
        ) : null}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-text-primary text-balance">{scene.name}</h3>
          <span className="text-[10px] text-accent bg-accent/10 rounded-full px-2 py-0.5">
            Remix
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-text-tertiary text-pretty">{scene.tagline}</p>
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[10px] text-text-secondary bg-elevated rounded-full px-2 py-0.5">
            {scene.useCase}
          </span>
          <span className="text-[10px] text-text-tertiary bg-elevated rounded-full px-2 py-0.5">
            {scene.mood}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function SceneGalleryModal({ open, onClose }: SceneGalleryModalProps) {
  const loadPreset = useGradientStore((s) => s.loadPreset);

  if (!open) return null;

  const handleRemix = (scene: Scene) => {
    loadPreset(scene.data);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scene gallery"
        className="relative bg-base border border-border rounded-xl p-6 w-[calc(100vw-32px)] max-w-[880px] max-h-[82vh] flex flex-col shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Scene Gallery</h2>
            <p className="text-[11px] text-text-tertiary mt-1">
              Start from production-ready motion looks, then remix them in the editor.
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-1">
          {SCENES.map((scene) => (
            <SceneCard key={scene.name} scene={scene} onRemix={handleRemix} />
          ))}
        </div>
      </div>
    </div>
  );
}
