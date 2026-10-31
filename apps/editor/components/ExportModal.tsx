"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { Dialog, DialogContent } from "@/components/litt/dialog";
import { useReturnFocus } from "@/lib/useReturnFocus";
import { Button } from "@/components/litt/button";
import { Callout } from "@/components/litt/callout";
import { Segmented } from "@/components/litt/segmented";
import { Tag } from "@/components/litt/tag";
import { Tabs, TabsList, TabsTrigger, TabsPanels, TabsPanel } from "@/components/litt/tabs";
import { useGradientStore } from "@/lib/store";
import {
  exportPNG, exportCSS, exportTailwindCSS, exportReactComponent,
  exportWebComponent, exportStandalonePlayer, exportGIF, copyToClipboard, exportWebM, generateEmbedCode,
  generateEmbedConfig, generateEmbedSnippet, getPortableExportWarnings, downloadTextFile,
  pngExportSize, type FrameSource, type SceneCaptureFn,
} from "@/lib/export";
import { displayP3ToSrgb } from "@wavr/core";
import { applyTimeline, withPerformanceMode } from "@/lib/frame-state";
import { encodeState } from "@/lib/url-codec";
import {
  getRuntimeEmbedFidelityReport,
  sceneDocumentToJson,
  storeToSceneDocument,
  type RuntimeEmbedFidelityReport,
} from "@/lib/scene-document";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sceneCanvasRef?: RefObject<HTMLCanvasElement | null>;
  sceneCaptureRef?: RefObject<SceneCaptureFn | null>;
  engineRef?: RefObject<FrameSource | null>;
}

const PNG_SCALES = [1, 2, 4] as const;

/** One export: what it is, one line on what it gives, and its action at the end. Rows sit in a hairline list. */
function ExportRow({ title, desc, children }: { title: string; desc: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-litt-small text-litt-fg">{title}</div>
        <div className="text-litt-small text-litt-fg-subtle">{desc}</div>
      </div>
      {children}
    </li>
  );
}

function ExportButton({
  title, desc, action, actionLabel = "Copy",
}: {
  title: string; desc: string; action: () => void; actionLabel?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <ExportRow title={title} desc={desc}>
      <Button
        size="sm"
        aria-label={`${actionLabel} ${title}`}
        onClick={() => {
          action();
          if (actionLabel === "Copy") {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          }
        }}
      >
        {done ? "Copied" : actionLabel}
      </Button>
    </ExportRow>
  );
}

function ExportList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-litt-line">{children}</ul>;
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function RuntimeFidelityReport({ report }: { report: RuntimeEmbedFidelityReport }) {
  const warningCount = report.compatibilityWarnings.length;
  const hasWarnings = warningCount > 0;
  const activeEffects = report.activeEffects.length > 0
    ? report.activeEffects.map((effect) => effect.label).join(", ")
    : "None";
  const stats = [
    { label: "Passes", value: report.passCount },
    { label: "Resources", value: report.resourceCount },
    { label: "Full-res", value: report.estimatedCost.fullResolutionPasses },
  ];

  return (
    <section aria-label="Runtime embed fidelity" className="litt-raised grid gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-litt-small font-litt-title text-litt-fg">Runtime embed fidelity</div>
          <div className="text-litt-small text-litt-fg-subtle">
            {hasWarnings ? "Compatibility warnings need review." : "Ready for supported runtime embed."}
          </div>
        </div>
        <Tag status={hasWarnings ? "warning" : "neutral"}>
          {hasWarnings ? `${warningCount} ${plural(warningCount, "warning")}` : "Ready"}
        </Tag>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-litt-caption font-normal text-litt-fg-subtle">{stat.label}</dt>
            <dd className="text-litt-small text-litt-fg tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="text-litt-small text-litt-fg-subtle break-words">
        Active effects: <span className="text-litt-fg">{activeEffects}</span>
      </div>

      {hasWarnings && (
        <ul className="grid gap-1 text-litt-small text-litt-fg">
          {report.compatibilityWarnings.map((warning) => (
            <li key={warning.code}>{warning.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ExportModal({
  open, onClose, canvasRef, sceneCanvasRef, sceneCaptureRef, engineRef,
}: ExportModalProps) {
  useReturnFocus(open);
  const [recording, setRecording] = useState(false);
  const [gifRecording, setGifRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifProgress, setGifProgress] = useState(0);
  const [pngScale, setPngScale] = useState<(typeof PNG_SCALES)[number]>(1);
  const [pngExporting, setPngExporting] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [tab, setTab] = useState("image");

  const exportPng = async () => {
    const canvas = canvasRef.current;
    if (!canvas || pngExporting) return;
    setPngExporting(true);
    setMediaError(null);
    try {
      await exportPNG({
        canvas,
        frameSource: engineRef?.current,
        sceneCapture: sceneCaptureRef?.current,
        scale: pngScale,
      });
    } catch (err) {
      setMediaError(`PNG export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPngExporting(false);
    }
  };

  const exportGif = async () => {
    const engine = engineRef?.current;
    if (!engine || gifRecording) return;
    setGifRecording(true);
    setGifProgress(0);
    setMediaError(null);
    // Snapshot the scene now so edits made while exporting don't leak in.
    const snapshot = useGradientStore.getState();
    try {
      await exportGIF({
        frameSource: engine,
        stateAt: (seconds) => withPerformanceMode(applyTimeline(snapshot, snapshot.timelinePosition + seconds)),
        sceneCapture: sceneCaptureRef?.current,
        durationMs: 3000,
        fps: 12,
        onProgress: setGifProgress,
      });
    } catch (err) {
      setMediaError(`GIF export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGifRecording(false);
    }
  };

  const pngSizeLabel = (scale: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef?.current;
    if (!canvas) return `${scale}× current view`;
    const size = engine
      ? pngExportSize(canvas, scale, engine.getMaxCaptureSize())
      : { width: canvas.width, height: canvas.height };
    return `${size.width} × ${size.height} px`;
  };

  const recordWebm = async () => {
    if (!canvasRef.current || recording) return;
    setRecording(true); setProgress(0);
    await exportWebM(canvasRef.current, 5000, "wavr-gradient.webm", setProgress, sceneCanvasRef?.current);
    setRecording(false);
  };

  // The media state lives here, so a recording keeps its progress while the dialog is closed; the tabs (and the
  // store subscription behind them) mount only while it is open.
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent title="Export" description="Ship the current scene as media, code or an embed." className="sm:max-w-140">
        <ExportTabs
          tab={tab}
          onTabChange={setTab}
          canvasRef={canvasRef}
          media={{
            pngScale, setPngScale, pngSizeLabel, pngExporting, exportPng,
            recording, progress, recordWebm,
            gifRecording, gifProgress, exportGif,
            mediaError,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

interface MediaControls {
  pngScale: (typeof PNG_SCALES)[number];
  setPngScale: (scale: (typeof PNG_SCALES)[number]) => void;
  /** The PNG's size at a scale, read from the canvas when the tab renders. */
  pngSizeLabel: (scale: number) => string;
  pngExporting: boolean;
  exportPng: () => void;
  recording: boolean;
  progress: number;
  recordWebm: () => void;
  gifRecording: boolean;
  gifProgress: number;
  exportGif: () => void;
  mediaError: string | null;
}

function ExportTabs({
  tab, onTabChange, canvasRef, media,
}: {
  tab: string;
  onTabChange: (tab: string) => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  media: MediaControls;
}) {
  const {
    pngScale, setPngScale, pngSizeLabel, pngExporting, exportPng,
    recording, progress, recordWebm,
    gifRecording, gifProgress, exportGif, mediaError,
  } = media;
  const store = useGradientStore();
  const colors = store.colors as [number, number, number][];

  const stateForExport = {
    colors,
    gradientType: store.gradientType,
    speed: store.speed as number,
    complexity: store.complexity as number,
    scale: store.scale as number,
    distortion: store.distortion as number,
    softness: store.softness as number,
    fill: store.fill,
    focus: store.focus,
    brightness: store.brightness,
    saturation: store.saturation,
    hueShift: store.hueShift,
    oklabEnabled: store.oklabEnabled,
    toneMapMode: store.toneMapMode,
    colorProfile: store.colorProfile,
    mouseReact: store.mouseReact,
    debandEnabled: store.debandEnabled,
    debandStrength: store.debandStrength,
  };

  const stateHash = encodeState(store);
  const embedCode = generateEmbedCode(stateHash, 1200, 700);
  const portableWarnings = getPortableExportWarnings({
    layers: store.layers,
    scene3DEnabled: store.scene3DEnabled,
    timelineEnabled: store.timelineEnabled,
    keyframeCount: store.keyframes.length,
    customGLSL: store.customGLSL,
    mouseReact: store.mouseReact,
    rippleEnabled: store.rippleEnabled,
    trailEnabled: store.trailEnabled,
    parallaxEnabled: store.parallaxEnabled,
  });
  const runtimeReport = getRuntimeEmbedFidelityReport(store);
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
  const nextSnippet = `export function HeroVisual() {
  return (
    <div className="absolute inset-0 -z-10">
      <iframe
        src="${typeof window !== "undefined" ? window.location.origin : "https://wavr.app"}/embed#${stateHash}"
        className="h-full w-full border-0"
        allow="autoplay"
      />
    </div>
  );
}`;
  const exportSceneDocument = () => {
    const canvas = canvasRef.current;
    const canvasSize = canvas && canvas.width > 0 && canvas.height > 0
      ? { width: canvas.width, height: canvas.height }
      : undefined;
    const document = storeToSceneDocument(store, {
      name: "Wavr scene",
      canvas: canvasSize,
      updatedAt: new Date().toISOString(),
    });
    downloadTextFile(sceneDocumentToJson(document), "wavr-scene.json", "application/json;charset=utf-8");
  };

  const tabs = [
    { key: "image", label: "Image and video" },
    { key: "code", label: "Code" },
    { key: "embed", label: "Embed" },
    { key: "ship", label: "Ship" },
  ];

  const sceneNote = store.scene3DEnabled && (
    <Callout title="The 3D scene is in image and video exports only" description="Code and embeds carry the gradient." />
  );
  const simplifiedNote = portableWarnings.length > 0 && (
    <Callout
      title="Simplified export"
      description={
        portableWarnings.length > 1
          ? `${portableWarnings[0]} ${portableWarnings.length - 1} more scene feature${portableWarnings.length === 2 ? "" : "s"} omitted.`
          : portableWarnings[0]
      }
    />
  );

  return (
    <Tabs value={tab} onValueChange={onTabChange} size="sm">
      <TabsList aria-label="Export formats">
        {tabs.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="flex-1">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsPanels className="pt-4">
        <TabsPanel value="image" tabIndex={-1} className="grid gap-4">
          {sceneNote}
          <ExportList>
            <ExportRow title="PNG image" desc={<span className="tabular-nums">{pngSizeLabel(pngScale)}</span>}>
              <Segmented
                legend="PNG resolution"
                size="sm"
                value={String(pngScale)}
                options={PNG_SCALES.map((scale) => ({ value: String(scale), label: `${scale}×` }))}
                onValueChange={(v) => {
                  const scale = PNG_SCALES.find((s) => String(s) === v);
                  if (scale) setPngScale(scale);
                }}
              />
              <Button size="sm" variant="primary" onClick={exportPng} loading={pngExporting}>
                Download
              </Button>
            </ExportRow>
            <ExportRow
              title="WebM video"
              desc={recording ? `Recording, ${Math.round(progress * 100)}%` : "5 second recording"}
            >
              <Button
                size="sm"
                loading={recording}
                onClick={recordWebm}
              >
                Record
              </Button>
            </ExportRow>
            <ExportRow
              title="GIF animation"
              desc={gifRecording
                ? `${gifProgress < 0.5 ? "Rendering" : "Encoding"}, ${Math.round(gifProgress * 100)}%`
                : "3 second loop, 640px wide"}
            >
              <Button size="sm" loading={gifRecording} onClick={exportGif}>
                Record
              </Button>
            </ExportRow>
          </ExportList>
          {mediaError && <Callout live tone="danger" title={mediaError} />}
        </TabsPanel>

        <TabsPanel value="code" tabIndex={-1} className="grid gap-4">
          {sceneNote}
          {simplifiedNote}
          <ExportList>
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
                await copyToClipboard(exportCSS(colors, textMask, store.colorProfile));
              }}
            />
            <ExportButton
              title="Tailwind CSS"
              desc="Utility classes and a config snippet"
              action={async () => { await copyToClipboard(exportTailwindCSS(store.colorProfile === "display-p3" ? colors.map(displayP3ToSrgb) : colors, store.speed as number)); }}
            />
            <ExportButton
              title="React component"
              desc="Simplified portable shader component"
              action={async () => { await copyToClipboard(exportReactComponent(stateForExport)); }}
            />
            <ExportButton
              title="Web component"
              desc="Simplified framework-agnostic <wavr-gradient> element"
              action={async () => { await copyToClipboard(exportWebComponent(stateForExport)); }}
            />
          </ExportList>
        </TabsPanel>

        <TabsPanel value="embed" tabIndex={-1} className="grid gap-4">
          {sceneNote}
          {simplifiedNote}
          <RuntimeFidelityReport report={runtimeReport} />
          <ExportList>
            <ExportButton
              title="Embed code"
              desc="Shareable iframe for landing pages and docs"
              action={async () => {
                await copyToClipboard(embedCode);
              }}
            />
            <ExportButton
              title="Standalone player"
              desc="Single simplified script tag, scroll-linkable"
              action={async () => { await copyToClipboard(exportStandalonePlayer(stateForExport)); }}
            />
            <ExportButton
              title="Config widget"
              desc="Portable widget for supported gradient settings"
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
                };
                const config = generateEmbedConfig(embedState);
                await copyToClipboard(generateEmbedSnippet(config));
              }}
            />
          </ExportList>
        </TabsPanel>

        <TabsPanel value="ship" tabIndex={-1} className="grid gap-4">
          {sceneNote}
          <RuntimeFidelityReport report={runtimeReport} />
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-litt-caption font-normal text-litt-fg-subtle">Target</dt>
              <dd className="text-litt-small text-litt-fg">Hero or embed</dd>
            </div>
            <div>
              <dt className="text-litt-caption font-normal text-litt-fg-subtle">Fallback</dt>
              <dd className="text-litt-small text-litt-fg">PNG or WebM</dd>
            </div>
          </dl>
          <ExportList>
            <ExportButton
              title="Remix link"
              desc="An editable URL for review, remixing or handoff"
              action={async () => { await copyToClipboard(shareUrl); }}
            />
            <ExportButton
              title="Scene document JSON"
              desc="Canonical scene, effects and timeline data"
              actionLabel="Download"
              action={exportSceneDocument}
            />
            <ExportButton
              title="Framer embed"
              desc="Paste into an Embed component or custom code block"
              action={async () => { await copyToClipboard(framerSnippet); }}
            />
            <ExportButton
              title="Webflow embed"
              desc="Drop into an Embed element with responsive hero sizing"
              action={async () => { await copyToClipboard(webflowSnippet); }}
            />
            <ExportButton
              title="Next.js starter"
              desc="An iframe wrapper for this exact scene hash"
              action={async () => { await copyToClipboard(nextSnippet); }}
            />
          </ExportList>
        </TabsPanel>
      </TabsPanels>
    </Tabs>
  );
}
