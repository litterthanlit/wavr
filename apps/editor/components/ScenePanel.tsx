"use client";

import type { ReactNode } from "react";
import Slider from "@/components/ui/Slider";
import Select from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import { useGradientStore } from "@/lib/store";
import type { ParticleField, SceneObject3D, SceneObjectKind, Vec3 } from "@/lib/scene3d";

const OBJECT_OPTIONS: { value: SceneObjectKind; label: string }[] = [
  { value: "sphere", label: "Sphere" },
  { value: "torus", label: "Torus" },
  { value: "plane", label: "Plane" },
  { value: "box", label: "Box" },
  { value: "cylinder", label: "Cylinder" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-tertiary">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange, onCommit }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-2 py-1.5">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onCommit}
        className="h-6 w-8 rounded border border-border bg-transparent"
      />
    </label>
  );
}

function vectorWith(axis: number, value: number, vector: Vec3): Vec3 {
  const next = [...vector] as Vec3;
  next[axis] = value;
  return next;
}

function ObjectControls({ object }: { object: SceneObject3D }) {
  const store = useGradientStore();
  const update = (partial: Partial<SceneObject3D>) => store.updateSceneObject(object.id, partial);

  return (
    <Section title="Selected Object">
      <Select
        label="Kind"
        value={object.kind}
        options={OBJECT_OPTIONS}
        onChange={(value) => store.updateSceneObject(object.id, { kind: value as SceneObjectKind })}
      />
      <ColorField
        label="Material"
        value={object.color}
        onChange={(color) => update({ color })}
        onCommit={() => store.commitSet()}
      />
      <Slider label="X Position" value={object.position[0]} min={-3} max={3} step={0.05} onChange={(v) => update({ position: vectorWith(0, v, object.position) })} onCommit={() => store.commitSet()} />
      <Slider label="Y Position" value={object.position[1]} min={-2} max={2} step={0.05} onChange={(v) => update({ position: vectorWith(1, v, object.position) })} onCommit={() => store.commitSet()} />
      <Slider label="Depth" value={object.position[2]} min={-3} max={3} step={0.05} onChange={(v) => update({ position: vectorWith(2, v, object.position) })} onCommit={() => store.commitSet()} />
      <Slider label="Scale" value={object.scale[0]} min={0.2} max={3} step={0.05} onChange={(v) => update({ scale: [v, v, v] })} onCommit={() => store.commitSet()} />
      <Slider label="Metalness" value={object.metalness} min={0} max={1} step={0.01} onChange={(v) => update({ metalness: v })} onCommit={() => store.commitSet()} />
      <Slider label="Roughness" value={object.roughness} min={0} max={1} step={0.01} onChange={(v) => update({ roughness: v })} onCommit={() => store.commitSet()} />
      <Slider label="Opacity" value={object.opacity} min={0.1} max={1} step={0.01} onChange={(v) => update({ opacity: v })} onCommit={() => store.commitSet()} />
      <Slider label="Motion" value={object.motionSpeed} min={0} max={2} step={0.01} onChange={(v) => update({ motionSpeed: v })} onCommit={() => store.commitSet()} />
      <Slider label="Float" value={object.floatAmplitude} min={0} max={1} step={0.01} onChange={(v) => update({ floatAmplitude: v })} onCommit={() => store.commitSet()} />
      <Toggle label="Wireframe" checked={object.wireframe} onChange={(wireframe) => store.updateSceneObject(object.id, { wireframe })} />
      <button
        onClick={() => store.removeSceneObject(object.id)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-border-active hover:text-text-primary"
      >
        Remove object
      </button>
    </Section>
  );
}

function ParticleControls({ field }: { field: ParticleField }) {
  const store = useGradientStore();
  const update = (partial: Partial<ParticleField>) => store.updateParticleField(field.id, partial);

  return (
    <Section title={field.name}>
      <ColorField label="Particle Color" value={field.color} onChange={(color) => update({ color })} onCommit={() => store.commitSet()} />
      <Slider label="Count" value={field.count} min={40} max={900} step={20} onChange={(v) => update({ count: v })} onCommit={() => store.commitSet()} />
      <Slider label="Spread" value={field.spread} min={1} max={10} step={0.1} onChange={(v) => update({ spread: v })} onCommit={() => store.commitSet()} />
      <Slider label="Size" value={field.size} min={0.005} max={0.08} step={0.005} onChange={(v) => update({ size: v })} onCommit={() => store.commitSet()} />
      <Slider label="Opacity" value={field.opacity} min={0} max={1} step={0.01} onChange={(v) => update({ opacity: v })} onCommit={() => store.commitSet()} />
      <Slider label="Speed" value={field.speed} min={0} max={1.5} step={0.01} onChange={(v) => update({ speed: v })} onCommit={() => store.commitSet()} />
      <Slider label="Depth" value={field.depth} min={0.2} max={5} step={0.1} onChange={(v) => update({ depth: v })} onCommit={() => store.commitSet()} />
      <Slider label="Mouse React" value={field.mouseReact} min={0} max={1} step={0.01} onChange={(v) => update({ mouseReact: v })} onCommit={() => store.commitSet()} />
      <button
        onClick={() => store.removeParticleField(field.id)}
        className="rounded-md border border-border bg-surface px-3 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-border-active hover:text-text-primary"
      >
        Remove particle field
      </button>
    </Section>
  );
}

export default function ScenePanel() {
  const store = useGradientStore();
  const scene = store.scene3D;
  const selectedObject = scene.objects.find((object) => object.id === scene.selectedObjectId) ?? scene.objects[0] ?? null;

  return (
    <div className="flex flex-col gap-4 p-4 pb-24">
      <Section title="Scene Layer">
        <Toggle label="Enable Scene" checked={store.scene3DEnabled} onChange={(scene3DEnabled) => store.setDiscrete({ scene3DEnabled })} />
        <p className="text-[11px] leading-4 text-text-tertiary">
          Transparent Three/R3F overlay. Image and video exports include it; code embeds stay gradient-only.
        </p>
      </Section>

      <div className="border-t border-border" />

      <Section title="Add">
        <div className="grid grid-cols-2 gap-2">
          {OBJECT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => store.addSceneObject(option.value)}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-border-active hover:text-text-primary"
            >
              {option.label}
            </button>
          ))}
          <button
            onClick={() => store.addParticleField()}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-left text-xs text-text-secondary transition-colors hover:border-border-active hover:text-text-primary"
          >
            Particles
          </button>
        </div>
      </Section>

      <div className="border-t border-border" />

      <Section title="Objects">
        {scene.objects.length === 0 ? (
          <p className="text-[11px] text-text-tertiary">Add a primitive to start shaping the scene.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {scene.objects.map((object) => (
              <button
                key={object.id}
                onClick={() => store.selectSceneObject(object.id)}
                className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${
                  object.id === selectedObject?.id
                    ? "border-border-active bg-elevated text-text-primary"
                    : "border-border bg-surface text-text-secondary hover:border-border-active"
                }`}
              >
                {object.name}
              </button>
            ))}
          </div>
        )}
      </Section>

      {selectedObject && <ObjectControls object={selectedObject} />}

      <div className="border-t border-border" />

      <Section title="Camera + Lights">
        <Slider label="Camera Z" value={scene.camera.position[2]} min={2.5} max={8} step={0.1} onChange={(v) => store.setScene3D({ camera: { ...scene.camera, position: vectorWith(2, v, scene.camera.position) } })} onCommit={() => store.commitSet()} />
        <Slider label="Camera FOV" value={scene.camera.fov} min={24} max={75} step={1} onChange={(v) => store.setScene3D({ camera: { ...scene.camera, fov: v } })} onCommit={() => store.commitSet()} />
        <Slider label="Ambient" value={scene.lights.ambient} min={0} max={2} step={0.01} onChange={(v) => store.setScene3D({ lights: { ...scene.lights, ambient: v } })} onCommit={() => store.commitSet()} />
        <Slider label="Key Light" value={scene.lights.directional} min={0} max={3} step={0.01} onChange={(v) => store.setScene3D({ lights: { ...scene.lights, directional: v } })} onCommit={() => store.commitSet()} />
        <Slider label="Scene Mouse" value={scene.interaction.mouseReact} min={0} max={1} step={0.01} onChange={(v) => store.setScene3D({ interaction: { mouseReact: v } })} onCommit={() => store.commitSet()} />
      </Section>

      <div className="border-t border-border" />

      {scene.particles.map((field) => (
        <ParticleControls key={field.id} field={field} />
      ))}

      <div className="border-t border-border" />

      <Section title="Quality">
        <Slider label="DPR Cap" value={scene.quality.dpr} min={1} max={2} step={0.1} onChange={(v) => store.setScene3D({ quality: { ...scene.quality, dpr: v } })} onCommit={() => store.commitSet()} />
        <Slider label="Max FPS" value={scene.quality.maxFps} min={24} max={60} step={1} onChange={(v) => store.setScene3D({ quality: { ...scene.quality, maxFps: v } })} onCommit={() => store.commitSet()} />
      </Section>
    </div>
  );
}
