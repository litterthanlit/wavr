"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { useGradientStore } from "@/lib/store";
import {
  exportPNG, exportCSS, exportTailwindCSS, exportReactComponent,
  exportWebComponent, exportStandalonePlayer, exportGIF, copyToClipboard, exportWebM, generateEmbedCode,
  generateEmbedConfig, generateEmbedSnippet, getPortableExportWarnings, downloadTextFile,
  pngExportSize, type FrameSource, type SceneCaptureFn,
} from "@/lib/export";
import { applyTimeline, withPerformanceMode } from "@/lib/frame-state";
import { encodeState } from "@/lib/url-codec";
import {
  getRuntimeEmbedFidelityReport,
  sceneDocumentToJson,
  storeToSceneDocument,
  type RuntimeEmbedFidelityReport,
} from "@/lib/scene-document";
import { Dialog, DialogContent } from "@/components/litt/dialog";
import { Tabs, TabsList, TabsPanel, TabsPanels, TabsTrigger } from "@/components/litt/tabs";
import { Segmented } from "@/components/litt/segmented";
import { Button } from "@/components/litt/button";
import { Callout } from "@/components/litt/callout";
import { Progress } from "@/components/litt/progress";
import { Tag } from "@/components/litt/tag";
import { toast } from "@/components/litt/toast";
import { WarningIcon } from "@/components/litt/icons";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sceneCanvasRef?: RefObject<HTMLCanvasElement | null>;
  sceneCaptureRef?: RefObject<SceneCaptureFn | null>;
  engineRef?: RefObject<FrameSource | null>;
}

const PNG_SCALES = [1, 2, 4] as const;

/** One export: what it is on the left, its action on the right. A copy says so in a toast. */
function ExportRow({
  title, desc, action, actionLabel = "Copy", disabled, children,
}: {
  title: string; desc: ReactNode; action: () => void | Promise<void>; actionLabel?: string; disabled?: boolean; children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-litt-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-litt-small font-litt-title text-litt-fg">{title}</div>
        <div className="text-litt-small text-litt-fg-muted">{desc}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <Button
          size="sm"
          disabled={disabled}
          aria-label={`${actionLabel} ${title}`}
          onClick={async () => {
            await action();
            if (actionLabel === "Copy") toast({ title: "Copied to clipboard", description: title, tone: "success" });
          }}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
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
  const facts = [
    { label: "Passes", value: report.passCount },
    { label: "Resources", value: report.resourceCount },
    { label: "Full-res passes", value: report.estimatedCost.fullResolutionPasses },
  ];

  return (
    <section aria-label="Runtime embed fidelity" className="flex flex-col gap-3 rounded-litt-surface border border-litt-line p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-litt-small font-litt-title text-litt-fg">Runtime embed fidelity</h3>
          <p className="text-litt-small text-litt-fg-muted">
            {hasWarnings ? "Compatibility warnings need review." : "Ready for the supported runtime embed."}
          </p>
        </div>
        <Tag status={hasWarnings ? "warning" : "success"}>
          {hasWarnings ? `${warningCount} ${plural(warningCount, "warning")}` : "Ready"}
        </Tag>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-litt-caption font-litt-label text-litt-fg-subtle">{fact.label}</dt>
            <dd className="font-litt-mono text-litt-small text-litt-fg">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-litt-small text-litt-fg-muted break-words">
        Active effects: <span className="text-litt-fg">{activeEffects}</span>
      </p>

      {hasWarnings && (
        <ul className="flex flex-col gap-1">
          {report.compatibilityWarnings.map((warning) => (
            <li key={warning.code} className="flex gap-2 text-litt-small text-litt-fg-muted">
              <WarningIcon className="mt-0.5 shrink-0 text-litt-warning" />
              {warning.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ExportTab = "ship" | "image" | "code" | "embed";

const TABS: { key: ExportTab; label: string }[] = [
  { key: "ship", label: "Ship" },
  { key: "image", label: "Image & video" },
  { key: "code", label: "Code" },
  { key: "embed", label: "Embed" },
];

type ExportBodyProps = Omit<ExportModalProps, "open" | "onClose"> & {
  tab: ExportTab;
  setTab: (tab: ExportTab) => void;
  recording: boolean;
  setRecording: (recording: boolean) => void;
  progress: number;
  setProgress: (progress: number) => void;
  gifRecording: boolean;
  setGifRecording: (recording: boolean) => void;
  gifProgress: number;
  setGifProgress: (progress: number) => void;
  pngScale: (typeof PNG_SCALES)[number];
  setPngScale: (scale: (typeof PNG_SCALES)[number]) => void;
  pngExporting: boolean;
  setPngExporting: (exporting: boolean) => void;
  mediaError: string | null;
  setMediaError: (error: string | null) => void;
};

/**
 * Holds the export state, so a tab, a scale or a running recording survives
 * closing and reopening, and the dialog. The body, which reads the whole store
 * and encodes the scene, renders only while the dialog is open.
 */
export default function ExportModal({ open, onClose, ...refs }: ExportModalProps) {
  const [recording, setRecording] = useState(false);
  const [gifRecording, setGifRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [gifProgress, setGifProgress] = useState(0);
  const [pngScale, setPngScale] = useState<(typeof PNG_SCALES)[number]>(1);
  const [pngExporting, setPngExporting] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [tab, setTab] = useState<ExportTab>("ship");

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        title="Export"
        description="Ship the current scene as media, code or an embed."
        className="max-w-[560px]!"
      >
        <ExportBody
          {...refs}
          tab={tab} setTab={setTab}
          recording={recording} setRecording={setRecording}
          progress={progress} setProgress={setProgress}
          gifRecording={gifRecording} setGifRecording={setGifRecording}
          gifProgress={gifProgress} setGifProgress={setGifProgress}
          pngScale={pngScale} setPngScale={setPngScale}
          pngExporting={pngExporting} setPngExporting={setPngExporting}
          mediaError={mediaError} setMediaError={setMediaError}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExportBody({
  canvasRef, sceneCanvasRef, sceneCaptureRef, engineRef,
  tab, setTab, recording, setRecording, progress, setProgress, gifRecording, setGifRecording,
  gifProgress, setGifProgress, pngScale, setPngScale, pngExporting, setPngExporting, mediaError, setMediaError,
}: ExportBodyProps) {
  const store = useGradientStore();
  const colors = store.colors as [number, number, number][];

  const pngSizeLabel = (scale: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef?.current;
    if (!canvas) return `${scale}× current view`;
    const size = engine
      ? pngExportSize(canvas, scale, engine.getMaxCaptureSize())
      : { width: canvas.width, height: canvas.height };
    return `${size.width} × ${size.height} px`;
  };

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

  const exportWebm = async () => {
    if (!canvasRef.current || recording) return;
    setRecording(true);
    setProgress(0);
    await exportWebM(canvasRef.current, 5000, "wavr-gradient.webm", setProgress, sceneCanvasRef?.current);
    setRecording(false);
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
    hueShift: store.hueShift,
    domainWarp: store.domainWarp,
    colorBlend: store.colorBlend,
    oklabEnabled: store.oklabEnabled,
    toneMapMode: store.toneMapMode,
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
    audioEnabled: store.audioEnabled,
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

  return (
    <div className="flex flex-col gap-4">
      {store.scene3DEnabled && (
        <Callout
          title="The 3D scene is in image and video exports"
          description="Code embeds are gradient-only in this version."
        />
      )}

      <Tabs value={tab} onValueChange={(next) => setTab(next as ExportTab)} size="sm">
        <TabsList aria-label="Export type">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsPanels className="pt-4">
          <TabsPanel value="ship" tabIndex={-1}>
            <div className="flex flex-col gap-4">
              <RuntimeFidelityReport report={runtimeReport} />
              <div>
                <ExportRow
                  title="Share remix link"
                  desc="An editable URL for review, remixing or handoff"
                  action={async () => { await copyToClipboard(shareUrl); }}
                />
                <ExportRow
                  title="Scene document"
                  desc="Canonical scene, effects and timeline data as JSON"
                  actionLabel="Download"
                  action={exportSceneDocument}
                />
                <ExportRow
                  title="Framer embed"
                  desc="Paste into an Embed component or a custom code block"
                  action={async () => { await copyToClipboard(framerSnippet); }}
                />
                <ExportRow
                  title="Webflow embed"
                  desc="An Embed element with responsive hero sizing"
                  action={async () => { await copyToClipboard(webflowSnippet); }}
                />
                <ExportRow
                  title="Next.js starter"
                  desc="An iframe wrapper for this exact scene"
                  action={async () => { await copyToClipboard(nextSnippet); }}
                />
              </div>
            </div>
          </TabsPanel>

          <TabsPanel value="image" tabIndex={-1}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-litt-surface border border-litt-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-litt-small font-litt-title text-litt-fg">PNG image</div>
                    <div className="font-litt-mono text-litt-small text-litt-fg-muted">{pngSizeLabel(pngScale)}</div>
                  </div>
                  <Segmented
                    legend="PNG resolution"
                    size="sm"
                    value={String(pngScale)}
                    onValueChange={(value) => setPngScale(Number(value) as (typeof PNG_SCALES)[number])}
                    options={PNG_SCALES.map((scale) => ({ value: String(scale), label: `${scale}×` }))}
                  />
                </div>
                <Button variant="primary" onClick={exportPng} loading={pngExporting} block>
                  Download PNG
                </Button>
              </div>

              <div>
                <ExportRow
                  title="WebM video"
                  desc="A 5 second recording"
                  actionLabel="Record"
                  action={exportWebm}
                  disabled={recording}
                />
                {recording && (
                  <Progress label="Recording WebM" value={progress} max={1} className="pb-3" />
                )}
                <ExportRow
                  title="GIF animation"
                  desc="A 3 second loop, 640px wide"
                  actionLabel="Record"
                  action={exportGif}
                  disabled={gifRecording}
                />
                {gifRecording && (
                  <Progress
                    label={gifProgress < 0.5 ? "Rendering GIF frames" : "Encoding GIF"}
                    value={gifProgress}
                    max={1}
                    className="pb-3"
                  />
                )}
              </div>

              {mediaError && <Callout tone="danger" title="Export failed" description={mediaError} live />}
            </div>
          </TabsPanel>

          <TabsPanel value="code" tabIndex={-1}>
            <div className="flex flex-col gap-4">
              {portableWarnings.length > 0 && <SimplifiedNotice warnings={portableWarnings} />}
              <div>
                <ExportRow
                  title="CSS"
                  desc="An animated gradient with keyframes"
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
                <ExportRow
                  title="Tailwind CSS"
                  desc="Utility classes and a config snippet"
                  action={async () => { await copyToClipboard(exportTailwindCSS(colors, store.speed as number)); }}
                />
                <ExportRow
                  title="React component"
                  desc="A simplified portable shader component"
                  action={async () => { await copyToClipboard(exportReactComponent(stateForExport)); }}
                />
                <ExportRow
                  title="Web component"
                  desc={<>A simplified, framework-agnostic <code className="font-litt-mono">&lt;wavr-gradient&gt;</code> element</>}
                  action={async () => { await copyToClipboard(exportWebComponent(stateForExport)); }}
                />
              </div>
            </div>
          </TabsPanel>

          <TabsPanel value="embed" tabIndex={-1}>
            <div className="flex flex-col gap-4">
              {portableWarnings.length > 0 && <SimplifiedNotice warnings={portableWarnings} />}
              <RuntimeFidelityReport report={runtimeReport} />
              <div>
                <ExportRow
                  title="Embed code"
                  desc="A shareable iframe for landing pages and docs"
                  action={async () => { await copyToClipboard(embedCode); }}
                />
                <ExportRow
                  title="Standalone player"
                  desc="One simplified script tag, scroll-linkable"
                  action={async () => { await copyToClipboard(exportStandalonePlayer(stateForExport)); }}
                />
                <ExportRow
                  title="Config widget"
                  desc="A portable widget for the supported gradient settings"
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
              </div>
            </div>
          </TabsPanel>
        </TabsPanels>
      </Tabs>
    </div>
  );
}

function SimplifiedNotice({ warnings }: { warnings: string[] }) {
  const more = warnings.length - 1;
  return (
    <Callout
      tone="warning"
      title="Simplified export"
      description={more > 0 ? `${warnings[0]} ${more} more scene ${plural(more, "feature")} omitted.` : warnings[0]}
    />
  );
}
