"use client";

import { useState, type RefObject } from "react";
import { useGradientStore } from "@/lib/store";
import { exportPNG, exportCSS, copyToClipboard, exportWebM } from "@/lib/export";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export default function ExportModal({ open, onClose, canvasRef }: ExportModalProps) {
  const [copied, setCopied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const colors = useGradientStore((s) => s.colors);

  if (!open) return null;

  const handlePNG = () => {
    if (canvasRef.current) exportPNG(canvasRef.current);
  };

  const handleCSS = async () => {
    const css = exportCSS(colors);
    await copyToClipboard(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWebM = async () => {
    if (!canvasRef.current || recording) return;
    setRecording(true);
    setProgress(0);
    await exportWebM(canvasRef.current, 5000, "wavr-gradient.webm", setProgress);
    setRecording(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-base border border-border rounded-xl p-6 w-[380px] shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-sm font-medium text-text-primary">Export</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary text-lg transition-colors">
            x
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handlePNG}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
              hover:border-border-active transition-all duration-150 group"
          >
            <div className="text-left">
              <div className="text-xs font-medium text-text-primary">PNG Image</div>
              <div className="text-xs text-text-tertiary mt-0.5">Full resolution screenshot</div>
            </div>
            <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">Download</span>
          </button>

          <button
            onClick={handleCSS}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
              hover:border-border-active transition-all duration-150 group"
          >
            <div className="text-left">
              <div className="text-xs font-medium text-text-primary">CSS Code</div>
              <div className="text-xs text-text-tertiary mt-0.5">Animated gradient CSS</div>
            </div>
            <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
              {copied ? "Copied!" : "Copy"}
            </span>
          </button>

          <button
            onClick={handleWebM}
            disabled={recording}
            className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
              hover:border-border-active transition-all duration-150 group disabled:opacity-50"
          >
            <div className="text-left">
              <div className="text-xs font-medium text-text-primary">WebM Video</div>
              <div className="text-xs text-text-tertiary mt-0.5">
                {recording ? `Recording... ${Math.round(progress * 100)}%` : "5 second recording"}
              </div>
            </div>
            <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
              {recording ? "..." : "Record"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
