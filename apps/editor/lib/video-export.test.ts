import { afterEach, describe, expect, it, vi } from "vitest";
import type { EngineState } from "@wavr/core";
import {
  VIDEO_FORMAT_PREFERENCE,
  exportVideo,
  pickVideoFormat,
  videoSize,
  type VideoCodecName,
} from "./video-export";

describe("videoSize", () => {
  it("keeps size under the cap and rounds down to even dimensions", () => {
    expect(videoSize(1283, 721, 1920)).toEqual({ width: 1282, height: 720 });
    expect(videoSize(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
  });

  it("scales down to maxWidth, keeping aspect", () => {
    expect(videoSize(2880, 1800, 1920)).toEqual({ width: 1920, height: 1200 });
    expect(videoSize(3000, 1001, 1500)).toEqual({ width: 1500, height: 500 });
  });

  it("never goes below 2px", () => {
    expect(videoSize(1, 1, 1920)).toEqual({ width: 2, height: 2 });
  });
});

describe("pickVideoFormat", () => {
  it("prefers MP4/H.264, then WebM VP9, then VP8", async () => {
    expect(VIDEO_FORMAT_PREFERENCE.map((f) => `${f.container}/${f.codec}`)).toEqual(["mp4/avc", "webm/vp9", "webm/vp8"]);
    const only = (codecs: VideoCodecName[]) => async (codec: VideoCodecName) => codecs.includes(codec);
    expect(await pickVideoFormat(640, 360, only(["avc", "vp9"]))).toEqual({ container: "mp4", codec: "avc" });
    expect(await pickVideoFormat(640, 360, only(["vp9", "vp8"]))).toEqual({ container: "webm", codec: "vp9" });
    expect(await pickVideoFormat(640, 360, only(["vp8"]))).toEqual({ container: "webm", codec: "vp8" });
    expect(await pickVideoFormat(640, 360, only([]))).toBeNull();
  });

  it("checks encodability at the export size", async () => {
    const canEncode = vi.fn(async () => false);
    await pickVideoFormat(1282, 720, canEncode);
    expect(canEncode).toHaveBeenCalledWith("avc", { width: 1282, height: 720 });
  });
});

describe("exportVideo", () => {
  afterEach(() => vi.unstubAllGlobals());

  const frameSource = {
    captureImageData: () => null,
    getElapsedTime: () => 0,
    getMaxCaptureSize: () => 4096,
  };

  it("falls back to real-time recording without WebCodecs", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    const recordFallback = vi.fn(async () => {});
    const result = await exportVideo({ frameSource, stateAt: () => ({}) as EngineState, recordFallback });
    expect(result).toBe("recorded");
    expect(recordFallback).toHaveBeenCalledOnce();
  });

  it("surfaces real failures instead of silently recording", async () => {
    vi.stubGlobal("VideoEncoder", class {});
    vi.stubGlobal("VideoFrame", class {});
    const recordFallback = vi.fn(async () => {});
    await expect(
      exportVideo({ frameSource, stateAt: () => ({}) as EngineState, recordFallback }),
    ).rejects.toThrow(/Could not capture a frame/);
    expect(recordFallback).not.toHaveBeenCalled();
  });
});
