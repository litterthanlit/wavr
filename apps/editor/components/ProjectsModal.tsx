"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { Dialog, DialogContent } from "@/components/litt/dialog";
import { useReturnFocus } from "@/lib/useReturnFocus";
import { Button } from "@/components/litt/button";
import { Input } from "@/components/litt/input";
import { Callout } from "@/components/litt/callout";
import { useGradientStore } from "@/lib/store";
import { loadProjects, saveProject, deleteProject, projectStateForLoad, SavedProject } from "@/lib/projects";
import { importSceneDocumentJson, SceneDocumentImportError } from "@/lib/scene-document";

interface ProjectsModalProps {
  open: boolean;
  onClose: () => void;
}

function importErrorMessage(error: unknown): string {
  if (error instanceof SceneDocumentImportError) {
    if (error.code === "invalid-json") return "That file is not valid JSON.";
    return error.issues[0]
      ? `Scene document is invalid: ${error.issues[0]}`
      : "Scene document does not match the Wavr schema.";
  }
  return "Could not import that scene document.";
}

export default function ProjectsModal({ open, onClose }: ProjectsModalProps) {
  useReturnFocus(open);
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const store = useGradientStore();

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setProjects(loadProjects()));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setStorageMessage(null);
    try {
      await saveProject(trimmed, store);
      setName("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setStorageMessage(`Could not save: ${errorText(err)}`);
    } finally {
      setProjects(loadProjects());
      setBusy(false);
    }
  };

  const handleLoad = async (project: SavedProject) => {
    if (busy) return;
    setBusy(true);
    setStorageMessage(null);
    try {
      const { patch, missingImages } = await projectStateForLoad(project);
      store.loadPreset(patch);
      if (missingImages > 0) {
        setStorageMessage(
          `Loaded "${project.name}", but ${missingImages} image${missingImages === 1 ? " was" : "s were"} ` +
          "no longer in this browser's storage.",
        );
      } else {
        onClose();
      }
    } catch (err) {
      setStorageMessage(`Could not load: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (projectName: string) => {
    if (busy) return;
    setBusy(true);
    setStorageMessage(null);
    try {
      await deleteProject(projectName);
    } catch (err) {
      setStorageMessage(`Could not delete: ${errorText(err)}`);
    } finally {
      setProjects(loadProjects());
      setBusy(false);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setImporting(true);
    setImportError(null);
    try {
      const imported = importSceneDocumentJson(await file.text());
      store.loadPreset(imported.patch);
      onClose();
    } catch (error) {
      setImportError(importErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent title="Projects" description="Save named versions in this browser, then load or remix them later.">
        <div className="grid gap-6">
          {/* Save: the inline form, the dialog's one primary action. */}
          <form
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this scene"
              aria-label="Project name"
              data-autofocus
            />
            <Button type="submit" variant="primary" disabled={!name.trim()} loading={busy}>
              {saved ? "Saved" : "Save"}
            </Button>
          </form>

          {storageMessage && <Callout live tone="warning" title={storageMessage} />}

          {projects.length === 0 ? (
            <p className="text-litt-small text-litt-fg-subtle">
              Saved projects appear here. Name this scene and save it to keep a version in this browser.
            </p>
          ) : (
            <ul aria-label="Saved projects" className="divide-y divide-litt-line border-y border-litt-line">
              {projects.map((project) => (
                <li key={project.name} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-litt-small text-litt-fg">{project.name}</div>
                    <div className="text-litt-caption font-normal text-litt-fg-subtle tabular-nums">
                      {new Date(project.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleLoad(project)} disabled={busy}>
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(project.name)}
                    disabled={busy}
                    aria-label={`Delete ${project.name}`}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-litt-small text-litt-fg">Scene document</div>
              <div className="text-litt-small text-litt-fg-subtle">Load a WavrSceneDocument JSON file.</div>
            </div>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={importing}>
              Import JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          {importError && <Callout live tone="danger" title={importError} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
