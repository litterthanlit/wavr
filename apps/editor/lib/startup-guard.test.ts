import { describe, expect, it } from "vitest";
import {
  MemoryStartupGuardStorage,
  StartupWatch,
  decideStartup,
  healthyRecord,
  isStartupRecord,
  stalledRecord,
  startingRecord,
  withTimeout,
  type StartupRecord,
} from "./startup-guard";

const starting = (overrides: Partial<StartupRecord> = {}): StartupRecord => ({
  id: "a",
  mode: "normal",
  status: "starting",
  startedAt: 1,
  failures: 0,
  ...overrides,
});

describe("decideStartup", () => {
  it("starts normally on first run", () => {
    expect(decideStartup(null, null, false)).toEqual({ recovery: null, failures: 0, lastMode: null });
  });

  it("starts normally after a healthy start", () => {
    const d = decideStartup(healthyRecord(starting({ failures: 2 })), null, false);
    expect(d).toEqual({ recovery: null, failures: 0, lastMode: "normal" });
  });

  it("recovers when the last start never became healthy", () => {
    expect(decideStartup(starting(), null, false)).toEqual({
      recovery: "unclean-start",
      failures: 1,
      lastMode: "normal",
    });
  });

  it("counts consecutive failed starts", () => {
    const d = decideStartup(starting({ failures: 2, mode: "safe" }), null, false);
    expect(d).toMatchObject({ recovery: "unclean-start", failures: 3, lastMode: "safe" });
  });

  it("treats a start closed before it became healthy as clean", () => {
    expect(decideStartup(starting({ id: "x", failures: 1 }), "x", false)).toEqual({
      recovery: null,
      failures: 1,
      lastMode: "normal",
    });
  });

  it("ignores a clean-exit marker from an older start", () => {
    expect(decideStartup(starting({ id: "new" }), "old", false).recovery).toBe("unclean-start");
  });

  it("recovers after an in-session stall even if the tab then closed cleanly", () => {
    const d = decideStartup(stalledRecord(starting({ id: "x" })), "x", false);
    expect(d).toMatchObject({ recovery: "stalled", failures: 1 });
  });

  it("?safe forces the recovery screen", () => {
    expect(decideStartup(null, null, true).recovery).toBe("forced");
    expect(decideStartup(healthyRecord(starting()), null, true).recovery).toBe("forced");
    // A real failure reason wins over "forced".
    expect(decideStartup(starting(), null, true).recovery).toBe("unclean-start");
  });
});

describe("records", () => {
  it("carries the failure count into the next start and clears it once healthy", () => {
    const decision = decideStartup(starting({ failures: 1 }), null, false);
    const next = startingRecord(decision, "safe", "b", 5);
    expect(next).toEqual({ id: "b", mode: "safe", status: "starting", startedAt: 5, failures: 2 });
    expect(healthyRecord(next)).toMatchObject({ status: "healthy", failures: 0 });
  });

  it("validates stored records", () => {
    expect(isStartupRecord(starting())).toBe(true);
    expect(isStartupRecord({ ...starting(), status: "weird" })).toBe(false);
    expect(isStartupRecord(null)).toBe(false);
    expect(isStartupRecord("starting")).toBe(false);
  });

  it("round-trips through memory storage", async () => {
    const storage = new MemoryStartupGuardStorage();
    await storage.write(starting());
    storage.writeCleanExit("a");
    expect(decideStartup(await storage.read(), storage.readCleanExit(), false).recovery).toBeNull();
  });
});

describe("StartupWatch", () => {
  const opts = {
    probationMs: 1000,
    healthyFrames: 10,
    warmupFrames: 2,
    warmupStallMs: 5000,
    stallMs: 2000,
    slowMs: 500,
    maxSlowFrames: 3,
  };

  function run(watch: StartupWatch, times: number[]) {
    return times.map((t) => watch.frame(t));
  }

  it("becomes healthy after enough frames and time", () => {
    const watch = new StartupWatch(opts);
    const verdicts = run(watch, Array.from({ length: 70 }, (_, i) => i * 16));
    expect(verdicts.at(-1)).toBe("healthy");
    expect(verdicts.indexOf("healthy")).toBe(Math.ceil(1000 / 16));
  });

  it("needs the probation time, not just the frame count", () => {
    const watch = new StartupWatch(opts);
    expect(run(watch, Array.from({ length: 20 }, (_, i) => i * 16)).at(-1)).toBe("pending");
  });

  it("tolerates a slow first frame (lazy shader compile)", () => {
    const watch = new StartupWatch(opts);
    expect(run(watch, [0, 4000, 4016]).at(-1)).toBe("pending");
  });

  it("stalls on a very long warm-up gap", () => {
    const watch = new StartupWatch(opts);
    expect(run(watch, [0, 6000])).toEqual(["pending", "stalled"]);
  });

  it("stalls on one long gap after warm-up", () => {
    const watch = new StartupWatch(opts);
    expect(run(watch, [0, 16, 32, 2100]).at(-1)).toBe("stalled");
  });

  it("stalls on repeated slow frames", () => {
    const watch = new StartupWatch(opts);
    expect(run(watch, [0, 16, 32, 600, 1200, 1700]).at(-1)).toBe("stalled");
  });

  it("stays stalled once stalled", () => {
    const watch = new StartupWatch(opts);
    run(watch, [0, 6000]);
    expect(watch.frame(6016)).toBe("stalled");
  });

  it("doesn't count time spent paused (hidden tab) as a gap", () => {
    const watch = new StartupWatch(opts);
    run(watch, [0, 16, 32]);
    watch.pause();
    expect(run(watch, [60_000, 60_016])).toEqual(["pending", "pending"]);
  });
});

describe("withTimeout", () => {
  it("falls back when the promise never settles", async () => {
    await expect(withTimeout(new Promise<number>(() => {}), 5, -1)).resolves.toBe(-1);
  });

  it("falls back when the promise rejects", async () => {
    await expect(withTimeout(Promise.reject(new Error("x")), 1000, -1)).resolves.toBe(-1);
  });

  it("resolves with the value when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve(3), 1000, -1)).resolves.toBe(3);
  });
});
