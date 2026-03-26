"use client";

import { useState, useEffect } from "react";
import { useGradientStore } from "@/lib/store";
import { loadProjects, saveProject, deleteProject, SavedProject } from "@/lib/projects";

interface ProjectsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ProjectsModal({ open, onClose }: ProjectsModalProps) {
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);
  const store = useGradientStore();

  useEffect(() => {
    if (open) setProjects(loadProjects());
  }, [open]);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveProject(trimmed, store);
    setProjects(loadProjects());
    setName("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoad = (project: SavedProject) => {
    store.loadPreset(project.state as Partial<typeof store>);
    onClose();
  };

  const handleDelete = (projectName: string) => {
    deleteProject(projectName);
    setProjects(loadProjects());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Projects" className="relative bg-base border border-border rounded-xl p-6 w-[400px] max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-medium text-text-primary">Projects</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary text-lg transition-colors">
            x
          </button>
        </div>

        {/* Save section */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Project name..."
            className="flex-1 bg-surface border border-border rounded-md px-3 py-1.5 text-xs text-text-primary
              focus:outline-none focus:border-border-active transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs text-white bg-accent hover:bg-accent/80
              rounded-md transition-all duration-150 disabled:opacity-40"
          >
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {/* Projects list */}
        <div className="flex-1 overflow-y-auto">
          {projects.length === 0 ? (
            <p className="text-xs text-text-tertiary text-center py-8">
              No saved projects yet
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {projects.map((project) => (
                <div
                  key={project.name}
                  className="flex items-center justify-between p-2.5 bg-surface border border-border rounded-lg group"
                >
                  <div>
                    <div className="text-xs font-medium text-text-primary">{project.name}</div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">
                      {new Date(project.timestamp).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleLoad(project)}
                      className="px-2 py-1 text-[10px] text-text-secondary hover:text-accent
                        bg-elevated rounded transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(project.name)}
                      className="px-2 py-1 text-[10px] text-text-tertiary hover:text-text-primary
                        bg-elevated rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
