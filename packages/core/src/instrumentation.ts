export type GpuResourceSample =
  | { kind: "framebuffer"; count?: number }
  | { kind: "texture"; width: number; height: number; count?: number; bytesPerPixel?: number };

export interface GpuResourceSummary {
  framebufferCount: number;
  textureCount: number;
  estimatedBytes: number;
}

export interface EngineMetrics extends GpuResourceSummary {
  canvasWidth: number;
  canvasHeight: number;
  maxPixelRatio: number;
  frameRateCap: number;
  lastCpuFrameMs: number;
  avgCpuFrameMs: number;
  lastShaderCompileMs: number;
  totalShaderCompileMs: number;
}

export function estimateTextureBytes(
  width: number,
  height: number,
  count = 1,
  bytesPerPixel = 4,
): number {
  const safeWidth = Math.max(0, Math.floor(width));
  const safeHeight = Math.max(0, Math.floor(height));
  const safeCount = Math.max(0, Math.floor(count));
  return safeWidth * safeHeight * safeCount * bytesPerPixel;
}

export function summarizeGpuResources(samples: GpuResourceSample[]): GpuResourceSummary {
  return samples.reduce<GpuResourceSummary>(
    (summary, sample) => {
      const count = Math.max(0, Math.floor(sample.count ?? 1));
      if (sample.kind === "framebuffer") {
        summary.framebufferCount += count;
        return summary;
      }

      summary.textureCount += count;
      summary.estimatedBytes += estimateTextureBytes(
        sample.width,
        sample.height,
        count,
        sample.bytesPerPixel,
      );
      return summary;
    },
    { framebufferCount: 0, textureCount: 0, estimatedBytes: 0 },
  );
}

export function createEmptyEngineMetrics(): EngineMetrics {
  return {
    canvasWidth: 0,
    canvasHeight: 0,
    maxPixelRatio: 1.5,
    frameRateCap: 60,
    lastCpuFrameMs: 0,
    avgCpuFrameMs: 0,
    lastShaderCompileMs: 0,
    totalShaderCompileMs: 0,
    framebufferCount: 0,
    textureCount: 0,
    estimatedBytes: 0,
  };
}
