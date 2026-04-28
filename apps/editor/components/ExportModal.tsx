"use client";

import { useState, type RefObject } from "react";
import { useGradientStore } from "@/lib/store";
import {
  exportPNG, exportCSS, exportTailwindCSS, exportReactComponent,
  exportWebComponent, exportStandalonePlayer, exportGIF, copyToClipboard, exportWebM, generateEmbedCode,
  generateEmbedConfig, generateEmbedSnippet
} from "@/lib/export";
import { encodeState } from "@/lib/url";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sceneCanvasRef?: RefObject<HTMLCanvasElement | null>;
}

function ExportButton({
  title, desc, action, actionLabel = "Copy",
}: {
  title: string; desc: string; action: () => void; actionLabel?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        action();
        if (actionLabel === "Copy") {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        }
      }}
      className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
        hover:border-border-active transition-all duration-150 group"
    >
      <div className="text-left">
        <div className="text-xs font-medium text-text-primary">{title}</div>
        <div className="text-xs text-text-tertiary mt-0.5">{desc}</div>
      </div>
      <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
        {done ? "Copied!" : actionLabel}
      </span>
    </button>
  );
}

export default function ExportModal({ open, onClose, canvasRef, sceneCanvasRef }: ExportModalProps) {
  const [recording, setRecording] = useState(false);
  const [gifRecording, setGifRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifProgress, setGifProgress] = useState(0);
  const [tab, setTab] = useState<"ship" | "image" | "code" | "embed">("ship");
  const store = useGradientStore();
  const colors = store.colors as [number, number, number][];

  if (!open) return null;

  const stateForExport = {
    colors,
    gradientType: store.gradientType,
    speed: store.speed as number,
    complexity: store.complexity as number,
    scale: store.scale as number,
    distortion: store.distortion as number,
    softness: store.softness as number,
    brightness: store.brightness,
    saturation: store.saturation,
  };

  const stateHash = encodeState(store);
  const embedCode = generateEmbedCode(stateHash, 1200, 700);
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/editor#${stateHash}`
    : `https://wavr.app/editor#${stateHash}`;
  const framerSnippet = `<div style="width:100%;height:100%;min-height:560px;overflow:hidden;border-radius:16px;">
  ${embedCode}
</div>`;
  const webflowSnippet = `<section class="wavr-hero">
  ${embedCode}
</section>

<style>
.wavr-hero {
  width: 100%;
  min-height: 640px;
  overflow: hidden;
  border-radius: 16px;
}
.wavr-hero iframe {
  width: 100%;
  height: 640px;
}
</style>`;
  const nextSnippet = `import WavrGradient from "@wavr/gradient";

export function HeroVisual() {
  return (
    <div className="absolute inset-0 -z-10">
      <WavrGradient className="h-full w-full" />
    </div>
  );
}`;

  const tabs = [
    { key: "ship" as const, label: "Ship" },
    { key: "image" as const, label: "Image / Video" },
    { key: "code" as const, label: "Code" },
    { key: "embed" as const, label: "Embed" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Export options" className="relative bg-base border border-border rounded-xl p-6 w-[calc(100vw-32px)] max-w-[520px] shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-sm font-medium text-text-primary">Export</h2>
            <p className="text-[11px] text-text-tertiary mt-1">Ship the current scene as media, code, or an embed.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 bg-surface rounded-lg p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 ${
                tab === t.key
                  ? "bg-elevated text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {store.scene3DEnabled && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2 text-[11px] leading-4 text-text-tertiary">
              3D scene is included in image/video exports; code embeds are gradient-only in this version.
            </div>
          )}

          {tab === "ship" && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-1">
                <div className="bg-surface border border-border rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Target</div>
                  <div className="text-xs text-text-primary mt-1">Hero / embed</div>
                </div>
                <div className="bg-surface border border-border rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wider text-text-tertiary">Fallback</div>
                  <div className="text-xs text-text-primary mt-1">PNG / WebM</div>
                </div>
              </div>
              <ExportButton
                title="Share Remix Link"
                desc="Copy an editable URL for review, remixing, or handoff"
                action={async () => { await copyToClipboard(shareUrl); }}
              />
              <ExportButton
                title="Framer Embed"
                desc="Paste into an Embed component or custom code block"
                action={async () => { await copyToClipboard(framerSnippet); }}
              />
              <ExportButton
                title="Webflow Embed"
                desc="Drop into an Embed element with responsive hero sizing"
                action={async () => { await copyToClipboard(webflowSnippet); }}
              />
              <ExportButton
                title="Next.js Starter"
                desc="Copy a React wrapper for app-router hero backgrounds"
                action={async () => { await copyToClipboard(nextSnippet); }}
              />
            </>
          )}

          {tab === "image" && (
            <>
              <ExportButton
                title="PNG Image"
                desc="Full resolution screenshot"
                actionLabel="Download"
                action={() => { if (canvasRef.current) exportPNG(canvasRef.current, "wavr-gradient.png", sceneCanvasRef?.current); }}
              />
              <button
                onClick={async () => {
                  if (!canvasRef.current || recording) return;
                  setRecording(true); setProgress(0);
                  await exportWebM(canvasRef.current, 5000, "wavr-gradient.webm", setProgress, sceneCanvasRef?.current);
                  setRecording(false);
                }}
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
              <button
                onClick={async () => {
                  if (!canvasRef.current || gifRecording) return;
                  setGifRecording(true); setGifProgress(0);
                  await exportGIF(canvasRef.current, 3000, 12, setGifProgress, sceneCanvasRef?.current);
                  setGifRecording(false);
                }}
                disabled={gifRecording}
                className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg
                  hover:border-border-active transition-all duration-150 group disabled:opacity-50"
              >
                <div className="text-left">
                  <div className="text-xs font-medium text-text-primary">GIF Animation</div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {gifRecording ? `Encoding... ${Math.round(gifProgress * 100)}%` : "3 second loop, 640px wide"}
                  </div>
                </div>
                <span className="text-xs text-text-tertiary group-hover:text-accent transition-colors">
                  {gifRecording ? "..." : "Record"}
                </span>
              </button>
            </>
          )}

          {tab === "code" && (
            <>
              <ExportButton
                title="CSS"
                desc="Animated gradient with keyframes"
                action={async () => {
                  const layer = store.layers[store.activeLayerIndex];
                  const textMask = layer?.textMaskEnabled ? {
                    enabled: true,
                    content: layer.textMaskContent,
                    fontSize: layer.textMaskFontSize,
                    fontWeight: layer.textMaskFontWeight,
                    letterSpacing: layer.textMaskLetterSpacing,
                    align: layer.textMaskAlign,
                  } : undefined;
                  await copyToClipboard(exportCSS(colors, textMask));
                }}
              />
              <ExportButton
                title="Tailwind CSS"
                desc="Utility classes + config snippet"
                action={async () => { await copyToClipboard(exportTailwindCSS(colors, store.speed as number)); }}
              />
              <ExportButton
                title="React Component"
                desc="Production-ready component for app backgrounds"
                action={async () => { await copyToClipboard(exportReactComponent(stateForExport)); }}
              />
              <ExportButton
                title="Web Component"
                desc="Framework-agnostic <wavr-gradient> element"
                action={async () => { await copyToClipboard(exportWebComponent(stateForExport)); }}
              />
            </>
          )}

          {tab === "embed" && (
            <>
              <ExportButton
                title="Embed Code"
                desc="Shareable iframe for landing pages and docs"
                action={async () => {
                  await copyToClipboard(embedCode);
                }}
              />
              <ExportButton
                title="Standalone Player"
                desc="Single script tag — no dependencies, scroll-linkable"
                action={async () => { await copyToClipboard(exportStandalonePlayer(stateForExport)); }}
              />
              <ExportButton
                title="Config Widget"
                desc="Portable Web Component with effect settings"
                action={async () => {
                  const embedState = {
                    ...stateForExport,
                    noiseEnabled: store.noiseEnabled,
                    noiseIntensity: store.noiseIntensity,
                    noiseScale: store.noiseScale,
                    grain: store.grain,
                    bloomEnabled: store.bloomEnabled,
                    bloomIntensity: store.bloomIntensity,
                    vignette: store.vignette,
                    chromaticAberration: store.chromaticAberration,
                    hueShift: store.hueShift,
                    domainWarp: store.domainWarp,
                  };
                  const config = generateEmbedConfig(embedState);
                  await copyToClipboard(generateEmbedSnippet(config));
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
