import { describe, it, expect, vi, afterEach } from "vitest";
import { onIdle, runOnePerIdle } from "./idle";

// A requestIdleCallback stand-in the test steps by hand.
function stubIdleCallbacks() {
  const pending = new Map<number, () => void>();
  let nextId = 1;
  vi.stubGlobal("window", {
    requestIdleCallback: (cb: () => void) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    },
    cancelIdleCallback: (id: number) => {
      pending.delete(id);
    },
  });
  return {
    pending,
    /** Fire the oldest pending idle callback; false if there was none. */
    runNext() {
      const first = pending.entries().next();
      if (first.done) return false;
      const [id, cb] = first.value;
      pending.delete(id);
      cb();
      return true;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("onIdle", () => {
  it("uses requestIdleCallback when available and can be cancelled", () => {
    const idle = stubIdleCallbacks();
    const callback = vi.fn();

    const cancel = onIdle(callback);
    expect(idle.pending.size).toBe(1);
    cancel();
    expect(idle.pending.size).toBe(0);

    onIdle(callback);
    idle.runNext();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("falls back to a timer where requestIdleCallback is missing", () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
      clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    });
    const callback = vi.fn();

    onIdle(callback);
    expect(callback).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);

    const cancelled = vi.fn();
    onIdle(cancelled)();
    vi.advanceTimersByTime(1000);
    expect(cancelled).not.toHaveBeenCalled();
  });
});

describe("runOnePerIdle", () => {
  it("runs the tasks in order, one per idle slot", () => {
    const idle = stubIdleCallbacks();
    const order: string[] = [];

    runOnePerIdle([() => order.push("a"), () => order.push("b"), () => order.push("c")]);
    expect(order).toEqual([]);

    idle.runNext();
    expect(order).toEqual(["a"]);
    idle.runNext();
    expect(order).toEqual(["a", "b"]);
    idle.runNext();
    expect(order).toEqual(["a", "b", "c"]);
    // Nothing is left to schedule once the queue is empty.
    idle.runNext();
    expect(idle.pending.size).toBe(0);
  });

  it("stops scheduling after cancel", () => {
    const idle = stubIdleCallbacks();
    const order: string[] = [];

    const cancel = runOnePerIdle([() => order.push("a"), () => order.push("b")]);
    idle.runNext();
    cancel();

    expect(idle.runNext()).toBe(false);
    expect(order).toEqual(["a"]);
  });
});
