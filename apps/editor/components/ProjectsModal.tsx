"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useGradientStore } from "@/lib/store";
import { loadProjects, saveProject, deleteProject, projectStateForLoad, SavedProject } from "@/lib/projects";
import { importSceneDocumentJson, SceneDocumentImportError } from "@/lib/scene-document";
import { Dialog, DialogContent } from "@/components/litt/dialog";
import { Button } from "@/components/litt/button";
import { Input } from "@/components/litt/input";
import { Callout } from "@/components/litt/callout";
import { Empty } from "@/components/litt/states";
import { Tooltip } from "@/components/litt/tooltip";
import { toast } from "@/components/litt/toast";
import { TrashIcon } from "@/components/litt/icons";

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
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState("");
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
      toast({ title: "Project saved", description: trimmed, tone: "success" });
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent title="Projects" description="Save named versions in this browser, then load or remix them later.">
        <div className="flex flex-col gap-6">
          {/* Save */}
          <form
            className="flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <Input
              aria-label="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="primary" disabled={!name.trim()} loading={busy}>
              Save
            </Button>
          </form>

          {storageMessage && <Callout tone="warning" title={storageMessage} live />}

          {/* Projects list */}
          {projects.length === 0 ? (
            <Empty title="No saved projects yet">
              Name this scene to keep a version of it in this browser.
            </Empty>
          ) : (
            <ul className="flex flex-col" aria-label="Saved projects">
              {projects.map((project) => (
                <li
                  key={project.name}
                  className="flex items-center justify-between gap-3 border-b border-litt-line py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-litt-small font-litt-title text-litt-fg">{project.name}</div>
                    <div className="font-litt-mono text-litt-caption font-normal text-litt-fg-subtle">
                      {new Date(project.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" onClick={() => handleLoad(project)} disabled={busy}>
                      Load
                    </Button>
                    <Tooltip content="Delete project">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        aria-label={`Delete ${project.name}`}
                        icon={<TrashIcon />}
                        onClick={() => handleDelete(project.name)}
                        disabled={busy}
                      />
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Import */}
          <div className="flex flex-col gap-3 border-t border-litt-line pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-litt-small font-litt-title text-litt-fg">Scene document</div>
                <div className="text-litt-small text-litt-fg-muted">Load a WavrSceneDocument JSON file.</div>
              </div>
              <Button size="sm" onClick={() => fileInputRef.current?.click()} loading={importing}>
                Import JSON
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
            {importError && <Callout tone="warning" title="Import failed" description={importError} live />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
