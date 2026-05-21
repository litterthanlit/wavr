import { describe, expect, it } from "vitest";
import { normalizeTimelineTime } from "./timeline";

describe("timeline helpers", () => {
  it("normalizes loop playback time into the visible duration", () => {
    expect(normalizeTimelineTime(12.25, 10, "loop")).toBe(2.25);
  });

  it("normalizes bounce playback time on the return leg", () => {
    expect(normalizeTimelineTime(12, 10, "bounce")).toBe(8);
  });

  it("clamps once playback time at the duration", () => {
    expect(normalizeTimelineTime(12, 10, "once")).toBe(10);
  });
});
