"use client";

import { SCENES, type Scene } from "@/lib/scenes";
import { useGradientStore } from "@/lib/store";

interface SceneGalleryModalProps {
  open: boolean;
  onClose: () => void;
}

function SceneCard({ scene, onRemix }: { scene: Scene; onRemix: (scene: Scene) => void }) {
  return (
    <button
      onClick={() => onRemix(scene)}
      className="group text-left rounded-lg border border-border bg-surface overflow-hidden hover:border-border-active transition-all duration-150"
    >
      <div
        className="h-24 border-b border-border transition-transform duration-300 group-hover:scale-[1.03]"
        style={{ background: `linear-gradient(135deg, ${scene.colors.join(", ")})` }}
      />
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium text-text-primary">{scene.name}</h3>
          <span className="text-[10px] text-accent bg-accent/10 rounded-full px-2 py-0.5">
            Remix
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-4 text-text-tertiary">{scene.tagline}</p>
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
