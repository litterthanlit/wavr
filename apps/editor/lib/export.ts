import { GRADIENT_TYPE_IDS, displayP3ToSrgb, fitSize, type CaptureOptions, type ColorProfile, type EngineState } from "@wavr/core";
import { cssColor } from "./css-color";
import { encodeGif } from "./gif";
import type { GifWorkerRequest, GifWorkerResponse } from "./gif.worker";
import { compactCode, indentCode, portableModule } from "./portable-runtime";
import { resolvePortableSettings, type PortableSettings, type PortableState } from "./portable-shader";

export function generateEmbedCode(stateHash: string, width = 800, height = 600): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://wavr.app";
  return `<iframe src="${baseUrl}/embed#${stateHash}" width="${width}" height="${height}" frameborder="0" style="border:0;border-radius:8px;" allow="autoplay"></iframe>`;
}

export interface PortableExportLayerInput {
  visible?: boolean;
  gradientType?: string;
  imageData?: string | null;
  distortionMapData?: string | null;
  maskEnabled?: boolean;
  textMaskEnabled?: boolean;
}

export interface PortableExportFidelityInput {
  layers?: PortableExportLayerInput[];
  scene3DEnabled?: boolean;
  timelineEnabled?: boolean;
  keyframeCount?: number;
  audioEnabled?: boolean;
  customGLSL?: string | null;
  /** Mouse reactivity, 0..1. Portable exports carry the pointer warp, but not the click ripple, trail or parallax below. */
  mouseReact?: number;
  rippleEnabled?: boolean;
  trailEnabled?: boolean;
  parallaxEnabled?: boolean;
}

export function getPortableExportWarnings(input: PortableExportFidelityInput): string[] {
  const warnings: string[] = [];
  const visibleLayers = (input.layers ?? []).filter((layer) => layer.visible !== false);

  if (visibleLayers.length > 1) {
    warnings.push("Portable code exports include one simplified gradient layer, not the full layer stack.");
  }

  if (visibleLayers.some((layer) => layer.imageData || layer.distortionMapData)) {
    warnings.push("Image and distortion-map textures are not included in portable code exports.");
  }

  if (visibleLayers.some((layer) => layer.gradientType === "image")) {
    warnings.push("The Image gradient needs its picture, so portable code exports draw a Mesh gradient in its place.");
  }

  if (visibleLayers.some((layer) => layer.maskEnabled || layer.textMaskEnabled)) {
    warnings.push("Masks and text masks are not included in portable code exports.");
  }

  if (input.scene3DEnabled) {
    warnings.push("3D scene overlays are included in image/video exports only.");
  }

  if (input.timelineEnabled && (input.keyframeCount ?? 0) > 0) {
    warnings.push("Timeline keyframes are not included in portable code exports.");
  }

  if (input.audioEnabled) {
    warnings.push("Audio reactivity is not included in portable code exports.");
  }

  if (input.rippleEnabled || input.trailEnabled || input.parallaxEnabled) {
    warnings.push(
      "Click ripple, pointer trail and parallax are not included in portable code exports; pointer reactivity is. Use the embed or the React component to keep them.",
    );
  }

  if (input.customGLSL?.trim()) {
    warnings.push("Custom GLSL is not included in portable code exports.");
  }

  return warnings;
}

function drawCompositeFrame(
  target: HTMLCanvasElement,
  gradientCanvas: HTMLCanvasElement,
  sceneCanvas?: HTMLCanvasElement | null,
) {
  if (target.width !== gradientCanvas.width) target.width = gradientCanvas.width;
  if (target.height !== gradientCanvas.height) target.height = gradientCanvas.height;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(gradientCanvas, 0, 0, target.width, target.height);
  if (sceneCanvas) {
    ctx.drawImage(sceneCanvas, 0, 0, target.width, target.height);
  }
}

/** Anything that can render frames offscreen on demand (GradientEngine). */
export interface FrameSource {
  captureImageData(options?: CaptureOptions): ImageData | null;
  getElapsedTime(): number;
  getMaxCaptureSize(): number;
}

/** Renders the 3D overlay right now and returns its canvas (see Scene3DCanvas). */
export type SceneCaptureFn = () => HTMLCanvasElement;

/**
 * A 2D canvas holding `frame`, in the frame's colour space: a Display P3 frame
 * stays P3 (a PNG of it carries a P3 profile), and drawing it onto an sRGB
 * canvas converts it, as the GIF export does.
 */
function imageDataToCanvas(frame: ImageData): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d", { colorSpace: frame.colorSpace });
  if (!ctx) return null;
  ctx.putImageData(frame, 0, 0);
  return canvas;
}

/**
 * Render the engine's current frame into a 2D canvas. The WebGL canvas itself
 * can't be read reliably: with preserveDrawingBuffer off, its backbuffer is
 * cleared once a frame is presented, so a toBlob() from a click handler may
 * produce a blank image. Returns null if nothing has rendered yet or the
 * capture fails, so callers can fall back to reading the canvas.
 */
export function snapshotFrame(source: FrameSource, options?: CaptureOptions): HTMLCanvasElement | null {
  let frame: ImageData | null;
  try {
    frame = source.captureImageData(options);
  } catch (err) {
    console.warn("[wavr] frame capture failed; falling back to the canvas", err);
    return null;
  }
  return frame ? imageDataToCanvas(frame) : null;
}

/** Draw the 3D overlay (rendered on demand) over `target`, scaled to fit. */
function drawSceneOverlay(target: HTMLCanvasElement, sceneCapture?: SceneCaptureFn | null) {
  if (!sceneCapture) return;
  const ctx = target.getContext("2d");
  if (!ctx) return;
  try {
    // Must draw in the same task as the render: the overlay's WebGL buffer is
    // cleared once presented.
    ctx.drawImage(sceneCapture(), 0, 0, target.width, target.height);
  } catch (err) {
    console.warn("[wavr] 3D overlay capture failed; exporting the gradient only", err);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PngExportOptions {
  /** The live WebGL canvas; its size is the 1× export size. */
  canvas: HTMLCanvasElement;
  frameSource?: FrameSource | null;
  sceneCapture?: SceneCaptureFn | null;
  /** Resolution multiplier. Clamped to what the GPU can render. */
  scale?: number;
  filename?: string;
}

/** PNG size for a given scale, after clamping to the GPU's limit. */
export function pngExportSize(
  canvas: { width: number; height: number },
  scale: number,
  maxSize: number,
): { width: number; height: number } {
  return fitSize(canvas.width * scale, canvas.height * scale, maxSize);
}

export function exportPNG({
  canvas,
  frameSource,
  sceneCapture,
  scale = 1,
  filename = "wavr-gradient.png",
}: PngExportOptions): Promise<void> {
  const size = frameSource
    ? pngExportSize(canvas, scale, frameSource.getMaxCaptureSize())
    : { width: canvas.width, height: canvas.height };
  const snapshot = frameSource ? snapshotFrame(frameSource, size) : null;

  // Last resort: read the WebGL canvas directly (may be blank; see snapshotFrame).
  const output = snapshot ?? document.createElement("canvas");
  if (!snapshot) {
    output.width = canvas.width;
    output.height = canvas.height;
    output.getContext("2d")?.drawImage(canvas, 0, 0);
  }
  drawSceneOverlay(output, sceneCapture);

  return new Promise((resolve, reject) => {
    output.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG encoding failed"));
        return;
      }
      downloadBlob(blob, filename);
      resolve();
    }, "image/png");
  });
}

/**
 * A plain CSS approximation: the palette as an animated linear gradient. A
 * Display P3 palette is written twice, as its nearest sRGB colours and then as
 * P3, so browsers that can show P3 do and the others keep the first.
 */
export function exportCSS(
  colors: [number, number, number][],
  textMask?: { enabled: boolean; content: string; fontSize: number; fontWeight: number; letterSpacing: number; align: string },
  colorProfile: ColorProfile = "srgb",
): string {
  const p3 = colorProfile === "display-p3";
  const srgbStops = (p3 ? colors.map(displayP3ToSrgb) : colors).map((c) => cssColor(c)).join(", ");
  const background = `background: linear-gradient(135deg, ${srgbStops});`
    + (p3 ? `\n  background: linear-gradient(135deg, ${colors.map((c) => cssColor(c, "display-p3")).join(", ")});` : "");

  if (textMask?.enabled && textMask.content) {
    return `.wavr-gradient-text {
  ${background}
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: ${textMask.fontSize}px;
  font-weight: ${textMask.fontWeight};
  letter-spacing: ${textMask.letterSpacing}em;
  text-align: ${textMask.align};
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
  }

  return `.wavr-gradient {
  ${background}
  background-size: 400% 400%;
  animation: wavr-shift 8s ease infinite;
}

@keyframes wavr-shift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`;
}

interface EmbedConfig {
  type: number;
  colors: [number, number, number][];
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  softness?: number;
  brightness?: number;
  saturation?: number;
  hueShift?: number;
  noiseEnabled?: boolean;
  noiseIntensity?: number;
  noiseScale?: number;
  grain?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  vignette?: number;
  chromaticAberration?: number;
  domainWarp?: number;
}

export function generateEmbedConfig(state: ExportableState & {
  noiseEnabled?: boolean;
  noiseIntensity?: number;
  noiseScale?: number;
  grain?: number;
  bloomEnabled?: boolean;
  bloomIntensity?: number;
  vignette?: number;
  chromaticAberration?: number;
  hueShift?: number;
  domainWarp?: number;
}): EmbedConfig {

  const config: EmbedConfig = {
    type: gradientTypeId(state.gradientType),
    colors: state.colors.map(c => c.map(v => +v.toFixed(3)) as [number, number, number]),
    speed: +state.speed.toFixed(2),
    complexity: Math.round(state.complexity),
    scale: +state.scale.toFixed(2),
    distortion: +state.distortion.toFixed(2),
  };

  // Only include non-default values to keep config small
  if (state.brightness !== undefined && state.brightness !== 1.0) config.brightness = +state.brightness.toFixed(2);
  if (state.saturation !== undefined && state.saturation !== 1.0) config.saturation = +state.saturation.toFixed(2);
  if (state.hueShift) config.hueShift = Math.round(state.hueShift);
  if (state.noiseEnabled) {
    config.noiseEnabled = true;
    config.noiseIntensity = +(state.noiseIntensity ?? 0.3).toFixed(2);
    config.noiseScale = +(state.noiseScale ?? 1.0).toFixed(2);
  }
  if (state.grain) config.grain = +state.grain.toFixed(2);
  if (state.bloomEnabled) {
    config.bloomEnabled = true;
    config.bloomIntensity = +(state.bloomIntensity ?? 0.3).toFixed(2);
  }
  if (state.vignette) config.vignette = +state.vignette.toFixed(2);
  if (state.chromaticAberration) config.chromaticAberration = +state.chromaticAberration.toFixed(3);
  if (state.domainWarp) config.domainWarp = +state.domainWarp.toFixed(2);
  if (state.softness) config.softness = +state.softness.toFixed(2);

  return config;
}

export function generateEmbedSnippet(config: EmbedConfig): string {
  const json = JSON.stringify(config);
  return `<script src="https://wavr.app/embed.js"></script>\n<wavr-gradient data-config='${json}' style="width:100%;height:400px;display:block"></wavr-gradient>`;
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function downloadTextFile(
  contents: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8",
) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function exportTailwindCSS(colors: [number, number, number][], speed: number): string {
  const hexColors = colors.map(([r, g, b]) => rgbToHex(r, g, b));
  const duration = Math.round(8 / Math.max(speed, 0.1));

  const fromColor = hexColors[0];
  const toColor = hexColors[hexColors.length - 1];
  const viaColor = hexColors.length > 2 ? hexColors[Math.floor(hexColors.length / 2)] : null;

  const gradientClasses = viaColor
    ? `from-[${fromColor}] via-[${viaColor}] to-[${toColor}]`
    : `from-[${fromColor}] to-[${toColor}]`;

  return `<!-- Wavr Gradient — Tailwind CSS -->
<div class="bg-gradient-to-br ${gradientClasses} bg-[length:400%_400%] animate-wavr-shift w-full h-full" />

<!-- Add to your tailwind.config.js -->
<script>
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      animation: {
        'wavr-shift': 'wavr-shift ${duration}s ease infinite',
      },
      keyframes: {
        'wavr-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
}
</script>`;
}

/**
 * What the code exports (React, web component, standalone player) are built
 * from. Beyond the layer's look it takes the colour grade and, for the pointer,
 * `mouseReact`; see PortableState for the defaults.
 */
export type ExportableState = PortableState;

/** Shader id for a gradient type, falling back to mesh for unknown values. */
function gradientTypeId(type: string): number {
  return (GRADIENT_TYPE_IDS as Record<string, number>)[type] ?? GRADIENT_TYPE_IDS.mesh;
}

/** The pointer is read over the canvas itself, so an export that reacts to it says what that means for the page. */
const POINTER_NOTE = [
  "The gradient bends around the pointer while it is over the canvas. Content layered on top of it",
  "needs pointer-events: none for the pointer to reach the canvas.",
];

/** The note as comment lines (`open` and `close` are the comment syntax), or nothing where the pointer is off. */
function pointerNote(settings: PortableSettings, open: string, close = ""): string {
  if (settings.mouseReact <= 0) return "";
  return `\n\n${POINTER_NOTE.map((line) => `${open}${line}${close}`).join("\n")}`;
}

export function exportReactComponent(state: ExportableState): string {
  const settings = resolvePortableSettings(state);

  return `"use client";
import { useEffect, useRef } from "react";

${portableModule(settings, "ts")}

interface WavrGradientProps {
  className?: string;
  scrollLinked?: boolean; // Drive animation by scroll position instead of time
}

export default function WavrGradient({ className = "", scrollLinked = false }: WavrGradientProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    return canvas ? startWavr(canvas, scrollLinked) : undefined;
  }, [scrollLinked]);

  return <canvas ref={canvasRef} className={\`block w-full h-full \${className}\`} />;
}

// Usage:
// <WavrGradient />                        — auto-animating
// <WavrGradient scrollLinked />           — driven by page scroll${pointerNote(settings, "// ")}`;
}

/** The script of the <wavr-gradient> element, shared by the web component and the standalone player. */
function webComponentScript(settings: PortableSettings): string {
  return `(() => {
${indentCode(portableModule(settings, "js"), "  ")}

  class WavrGradient extends HTMLElement {
    connectedCallback() {
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "display:block;width:100%;height:100%";
      (this.shadowRoot || this.attachShadow({ mode: "open" })).replaceChildren(canvas);
      this.stop = startWavr(canvas, this.getAttribute("mode") === "scroll");
      if (!this.stop) this.textContent = "WebGL 2 is not supported";
    }
    disconnectedCallback() {
      if (this.stop) this.stop();
      this.stop = undefined;
    }
  }
  if (!customElements.get("wavr-gradient")) customElements.define("wavr-gradient", WavrGradient);
})();`;
}

export function exportWebComponent(state: ExportableState): string {
  const settings = resolvePortableSettings(state);
  return `<!-- Wavr Gradient Web Component -->
<script>
${webComponentScript(settings)}
</script>

<!-- Usage: -->
<wavr-gradient style="width: 100%; height: 400px; display: block;"></wavr-gradient>

<!-- Scroll-linked (gradient animates as user scrolls the page): -->
<!-- <wavr-gradient mode="scroll" style="width: 100%; height: 400px; display: block;"></wavr-gradient> -->${pointerNote(settings, "<!-- ", " -->")}`;
}

/**
 * Percent-encodes only what a double-quoted `src` attribute and a data URL
 * can't carry (and everything outside printable ASCII), so the spaces that make
 * up much of the source stay one byte each.
 */
function dataUrlEncode(text: string): string {
  return text.replace(/[%"#&\\<>]|[^\x20-\x7e]/gu, (char) => encodeURIComponent(char));
}

export function exportStandalonePlayer(state: ExportableState): string {
  const settings = resolvePortableSettings(state);
  const playerSource = compactCode(webComponentScript(settings));
  return `<!-- Wavr Standalone Player — drop this script anywhere -->
<script src="data:text/javascript;charset=utf-8,${dataUrlEncode(playerSource)}"></script>

<!-- Usage: -->
<wavr-gradient style="width:100%;height:400px;display:block"></wavr-gradient>

<!-- Scroll-linked: -->
<!-- <wavr-gradient mode="scroll" style="width:100%;height:100vh;position:fixed;top:0;left:0;z-index:-1"></wavr-gradient> -->${pointerNote(settings, "<!-- ", " -->")}`;
}

/**
 * Encode in a Web Worker so the editor stays responsive; falls back to the
 * main thread where workers aren't available.
 */
export function encodeGifAsync(
  input: GifWorkerRequest,
  onProgress?: (fraction: number) => void,
): Promise<Uint8Array> {
  let worker: Worker;
  try {
    if (typeof Worker === "undefined") throw new Error("no Worker");
    worker = new Worker(new URL("./gif.worker.ts", import.meta.url));
  } catch {
    return Promise.resolve(encodeGif({ ...input, onProgress }));
  }
  return new Promise((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<GifWorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress?.(message.value);
        return;
      }
      worker.terminate();
      if (message.type === "done") resolve(message.bytes);
      else reject(new Error(message.message));
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "GIF encoder failed"));
    };
    worker.postMessage(input, input.frames.map((frame) => frame.buffer));
  });
}

export interface GifExportOptions {
  frameSource: FrameSource;
  /** Engine state at `seconds` into the clip (timeline keyframes applied). */
  stateAt: (seconds: number) => EngineState;
  sceneCapture?: SceneCaptureFn | null;
  durationMs?: number;
  fps?: number;
  maxWidth?: number;
  onProgress?: (fraction: number) => void;
  filename?: string;
}

/**
 * Deterministic GIF export: each frame is rendered offscreen at its exact
 * time, then everything is encoded in a worker. Capture is 0–50% of the
 * progress, encoding 50–100%.
 */
export async function exportGIF({
  frameSource,
  stateAt,
  sceneCapture,
  durationMs = 3000,
  fps = 12,
  maxWidth = 640,
  onProgress,
  filename = "wavr-gradient.gif",
}: GifExportOptions): Promise<void> {
  const frameCount = Math.max(1, Math.round((durationMs / 1000) * fps));
  const startTime = frameSource.getElapsedTime();

  // sRGB: a GIF has no colour profile, so a P3 frame is converted as it is drawn in.
  const scaled = document.createElement("canvas");
  const ctx = scaled.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.imageSmoothingQuality = "high";

  const frames: Uint8ClampedArray[] = [];
  for (let i = 0; i < frameCount; i++) {
    const seconds = i / fps;
    const frame = frameSource.captureImageData({ state: stateAt(seconds), time: startTime + seconds });
    if (!frame) throw new Error("Could not capture a frame (WebGL context lost?)");
    const full = imageDataToCanvas(frame);
    if (!full) throw new Error("Canvas 2D is not available");
    drawSceneOverlay(full, sceneCapture);

    if (i === 0) {
      scaled.width = Math.min(frame.width, maxWidth);
      scaled.height = Math.max(1, Math.round((scaled.width / frame.width) * frame.height));
    }
    ctx.clearRect(0, 0, scaled.width, scaled.height);
    ctx.drawImage(full, 0, 0, scaled.width, scaled.height);
    frames.push(ctx.getImageData(0, 0, scaled.width, scaled.height).data);

    onProgress?.(((i + 1) / frameCount) * 0.5);
    // Let the progress UI (and the live preview) update between frames.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const bytes = await encodeGifAsync(
    { width: scaled.width, height: scaled.height, frames, delayCs: 100 / fps },
    (fraction) => onProgress?.(0.5 + fraction * 0.5),
  );
  downloadBlob(new Blob([bytes as BlobPart], { type: "image/gif" }), filename);
  onProgress?.(1);
}

export function exportWebM(
  canvas: HTMLCanvasElement,
  duration = 5000,
  filename = "wavr-gradient.webm",
  onProgress?: (percent: number) => void,
  sceneCanvas?: HTMLCanvasElement | null
): Promise<void> {
  return new Promise((resolve, reject) => {
    const recordingCanvas = sceneCanvas ? document.createElement("canvas") : canvas;
    let raf = 0;
    let lastFrame = 0;
    if (sceneCanvas) {
      drawCompositeFrame(recordingCanvas, canvas, sceneCanvas);
      const drawLoop = (now: number) => {
        raf = requestAnimationFrame(drawLoop);
        if (now - lastFrame < 1000 / 30) return;
        lastFrame = now;
        drawCompositeFrame(recordingCanvas, canvas, sceneCanvas);
      };
      raf = requestAnimationFrame(drawLoop);
    }

    const stream = recordingCanvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      if (raf) cancelAnimationFrame(raf);
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    };

    recorder.onerror = () => {
      if (raf) cancelAnimationFrame(raf);
      reject(new Error("Recording failed"));
    };

    recorder.start();

    const startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      onProgress?.(Math.min(elapsed / duration, 1));
    }, 100);

    setTimeout(() => {
      clearInterval(progressInterval);
      recorder.stop();
      onProgress?.(1);
    }, duration);
  });
}
