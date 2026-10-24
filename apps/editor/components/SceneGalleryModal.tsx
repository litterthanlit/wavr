"use client";

import { SCENES, type Scene } from "@/lib/scenes";
import { useGradientStore } from "@/lib/store";
import { Dialog, DialogContent } from "@/components/litt/dialog";
import { Tag } from "@/components/litt/tag";

interface SceneGalleryModalProps {
  open: boolean;
  onClose: () => void;
}

/** A scene to remix: its own colours as the cover (user data, not chrome), then a flat card body. */
function SceneCard({ scene, onRemix }: { scene: Scene; onRemix: (scene: Scene) => void }) {
  return (
    <button
      type="button"
      onClick={() => onRemix(scene)}
      aria-label={`Remix ${scene.name}`}
      className="group flex cursor-pointer flex-col gap-3 rounded-litt-surface border border-litt-line bg-litt-surface-1 p-1 pb-4 text-left transition-colors duration-(--litt-dur-instant) ease-litt hover:border-litt-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus"
    >
      <span aria-hidden="true" className="relative block h-28 rounded-litt-control" style={{ background: scene.thumbnail.background }}>
        <span className="absolute bottom-2 left-2 flex gap-1">
          {scene.colors.map((color) => (
            <span
              key={color}
              className="size-3 rounded-litt-control shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--litt-fg)_12%,transparent)]"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
      </span>
      <span className="flex flex-col gap-1 px-3">
        <span className="flex items-center justify-between gap-2">
          <span className="text-litt-small font-litt-title text-litt-fg text-balance">{scene.name}</span>
          {scene.featured && <Tag>Featured</Tag>}
        </span>
        <span className="text-litt-small text-litt-fg-muted text-pretty">{scene.tagline}</span>
      </span>
      <span className="flex flex-wrap gap-1 px-3">
        <Tag>{scene.useCase}</Tag>
        <Tag>{scene.mood}</Tag>
      </span>
    </button>
  );
}

export default function SceneGalleryModal({ open, onClose }: SceneGalleryModalProps) {
  const loadPreset = useGradientStore((s) => s.loadPreset);

  const handleRemix = (scene: Scene) => {
    loadPreset(scene.data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Scene gallery"
        description="Start from a finished motion look, then remix it in the editor."
        className="max-w-[880px]!"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENES.map((scene) => (
            <SceneCard key={scene.name} scene={scene} onRemix={handleRemix} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
