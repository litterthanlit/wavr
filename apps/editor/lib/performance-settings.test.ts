import { describe, expect, it, vi } from "vitest";
import { applyEnginePerformanceSettings } from "./frame-state";
import { getEditorPerformanceSettings, type PerformanceMode } from "./store";

const MODES: PerformanceMode[] = ["auto", "quality", "battery"];

describe("getEditorPerformanceSettings render scale", () => {
  it("quality draws the layers at full resolution, always", () => {
    expect(getEditorPerformanceSettings("quality").renderScale).toEqual({ mode: "fixed", scale: 1 });
  });

  it("auto adapts between full resolution and 0.6 to the frame rate it caps at", () => {
    const settings = getEditorPerformanceSettings("auto");
    expect(settings.renderScale).toEqual({ mode: "adaptive", minScale: 0.6, targetFps: settings.maxFrameRate });
  });

  it("battery draws the layers at a lower fixed scale, no lower than the adaptive floor", () => {
    const { renderScale } = getEditorPerformanceSettings("battery");
    expect(renderScale.mode).toBe("fixed");
    if (renderScale.mode === "fixed") {
      expect(renderScale.scale).toBeLessThan(1);
      expect(renderScale.scale).toBeGreaterThanOrEqual(0.6);
    }
  });

  it("never asks for a scale the engine would clamp", () => {
    for (const mode of MODES) {
      const { renderScale } = getEditorPerformanceSettings(mode);
      const lowest = renderScale.mode === "fixed" ? renderScale.scale : renderScale.minScale;
      expect(lowest).toBeGreaterThanOrEqual(0.25);
      expect(lowest).toBeLessThanOrEqual(1);
    }
  });
});

describe("applyEnginePerformanceSettings", () => {
  const engineMock = () => ({
    setMaxPixelRatio: vi.fn(),
    setMaxFrameRate: vi.fn(),
    setRenderScale: vi.fn(),
    setAdaptiveRenderScale: vi.fn(),
  });

  it("auto: pixel ratio, frame cap and an adaptive scale, not a fixed one", () => {
    const engine = engineMock();
    applyEnginePerformanceSettings(engine, getEditorPerformanceSettings("auto"));
    expect(engine.setMaxPixelRatio).toHaveBeenCalledWith(1.5);
    expect(engine.setMaxFrameRate).toHaveBeenCalledWith(45);
    expect(engine.setAdaptiveRenderScale).toHaveBeenCalledWith({ minScale: 0.6, targetFps: 45 });
    expect(engine.setRenderScale).not.toHaveBeenCalled();
  });

  it("quality and battery: a fixed scale, which also ends any adaptive one", () => {
    const quality = engineMock();
    applyEnginePerformanceSettings(quality, getEditorPerformanceSettings("quality"));
    expect(quality.setRenderScale).toHaveBeenCalledWith(1);
    expect(quality.setAdaptiveRenderScale).not.toHaveBeenCalled();

    const battery = engineMock();
    applyEnginePerformanceSettings(battery, getEditorPerformanceSettings("battery"));
    expect(battery.setRenderScale).toHaveBeenCalledWith(0.75);
    expect(battery.setAdaptiveRenderScale).not.toHaveBeenCalled();
  });
});
