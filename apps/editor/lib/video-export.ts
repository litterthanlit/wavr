import type { EngineState } from "@wavr/core";
import { downloadBlob, drawSceneOverlay, imageDataToCanvas, type FrameSource, type SceneCaptureFn } from "./export";

/**
 * Deterministic video export with WebCodecs (via Mediabunny, loaded on demand).
 * Every frame is rendered offscreen at its exact time, like GIF export, so the
 * result doesn't depend on how fast the machine renders in real time.
 */

export type VideoContainer = "mp4" | "webm";
export type VideoCodecName = "avc" | "vp9" | "vp8";

export interface VideoFormatChoice {
  container: VideoContainer;
  codec: VideoCodecName;
}

/** Preference order: MP4/H.264 plays almost everywhere; WebM covers browsers without an H.264 encoder. */
export const VIDEO_FORMAT_PREFERENCE: VideoFormatChoice[] = [
  { container: "mp4", codec: "avc" },
  { container: "webm", codec: "vp9" },
  { container: "webm", codec: "vp8" },
];

/**
 * Output size: at most `maxWidth` wide, keeping aspect, with even dimensions
 * (4:2:0 video encoders reject odd sizes).
 */
export function videoSize(width: number, height: number, maxWidth: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width);
  const even = (n: number) => Math.max(2, Math.floor((n * scale) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** First format in `preference` the browser can encode at this size, or null. */
export async function pickVideoFormat(
  width: number,
  height: number,
  canEncode: (codec: VideoCodecName, size: { width: number; height: number }) => Promise<boolean>,
  preference: VideoFormatChoice[] = VIDEO_FORMAT_PREFERENCE,
): Promise<VideoFormatChoice | null> {
  for (const choice of preference) {
    if (await canEncode(choice.codec, { width, height })) return choice;
  }
  return null;
}

/** No WebCodecs encoder for any supported format; callers fall back to MediaRecorder. */
export class NoVideoEncoderError extends Error {
  constructor() {
    super("This browser can't encode MP4 or WebM video");
    this.name = "NoVideoEncoderError";
  }
}

export function supportsWebCodecsEncoding(): boolean {
  return typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined";
}

export interface VideoExportOptions {
  frameSource: FrameSource;
  /** Engine state at `seconds` into the clip (timeline keyframes applied). */
  stateAt: (seconds: number) => EngineState;
  sceneCapture?: SceneCaptureFn | null;
  durationMs?: number;
  fps?: number;
  maxWidth?: number;
  onProgress?: (fraction: number) => void;
  /** File name without extension; the extension follows the chosen container. */
  basename?: string;
}

export interface VideoExportResult {
  blob: Blob;
  filename: string;
  format: VideoFormatChoice;
  width: number;
  height: number;
  frames: number;
}

/**
 * Render and encode a clip. Throws NoVideoEncoderError if the browser can't
 * encode any supported format.
 */
export async function renderVideo({
  frameSource,
  stateAt,
  sceneCapture,
  durationMs = 5000,
  fps = 30,
  maxWidth = 1920,
  onProgress,
  basename = "wavr-gradient",
}: VideoExportOptions): Promise<VideoExportResult> {
  const mb = await import("mediabunny");

  const startTime = frameSource.getElapsedTime();
  const first = frameSource.captureImageData({ state: stateAt(0), time: startTime });
  if (!first) throw new Error("Could not capture a frame (WebGL context lost?)");
  const { width, height } = videoSize(first.width, first.height, maxWidth);

  const format = await pickVideoFormat(width, height, (codec, size) =>
    mb.canEncodeVideo(codec, { ...size, quality: mb.QUALITY_HIGH }),
  );
  if (!format) throw new NoVideoEncoderError();

  const frame = document.createElement("canvas");
  frame.width = width;
  frame.height = height;
  const ctx = frame.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.imageSmoothingQuality = "high";

  const target = new mb.BufferTarget();
  const output = new mb.Output({
    format: format.container === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
    target,
  });
  const source = new mb.CanvasSource(frame, { codec: format.codec, quality: mb.QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();

  const frameCount = Math.max(1, Math.round((durationMs / 1000) * fps));
  try {
    for (let i = 0; i < frameCount; i++) {
      const seconds = i / fps;
      const image = i === 0 ? first : frameSource.captureImageData({ state: stateAt(seconds), time: startTime + seconds });
      if (!image) throw new Error("Could not capture a frame (WebGL context lost?)");
      const full = imageDataToCanvas(image);
      if (!full) throw new Error("Canvas 2D is not available");
      drawSceneOverlay(full, sceneCapture);

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(full, 0, 0, width, height);
      // Resolves once the encoder can take more frames (backpressure).
      await source.add(seconds, 1 / fps);
      onProgress?.((i + 1) / frameCount);
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }

  const buffer = target.buffer;
  if (!buffer) throw new Error("Video encoding produced no data");
  const container = format.container;
  return {
    blob: new Blob([buffer], { type: container === "mp4" ? "video/mp4" : "video/webm" }),
    filename: `${basename}.${container}`,
    format,
    width,
    height,
    frames: frameCount,
  };
}

/**
 * Export a clip and download it: WebCodecs when available, otherwise
 * `recordFallback` (real-time MediaRecorder capture). Returns the format used.
 */
export async function exportVideo(
  options: VideoExportOptions & { recordFallback: () => Promise<void> },
): Promise<VideoFormatChoice | "recorded"> {
  const { recordFallback, ...renderOptions } = options;
  if (supportsWebCodecsEncoding()) {
    try {
      const result = await renderVideo(renderOptions);
      downloadBlob(result.blob, result.filename);
      options.onProgress?.(1);
      return result.format;
    } catch (err) {
      if (!(err instanceof NoVideoEncoderError)) throw err;
    }
  }
  await recordFallback();
  return "recorded";
}
