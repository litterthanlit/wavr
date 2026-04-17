import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createKeyCommitTimer } from "./keyCommitTimer";

/**
 * Covers the three scenarios from the scrub PR review:
 *   1. 3 rapid presses → 1 commit.
 *   2. 3 paced presses → 3 commits.
 *   3. Boundary (no-op) press with a pending commit → real commit still fires.
 *
 * Plus edge cases that catch regressions in the timer state machine.
 */

describe("keyCommitTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeDeps() {
    const onCommit = vi.fn();
    const onActiveChange = vi.fn<[boolean], void>();
    const timer = createKeyCommitTimer({ onCommit, onActiveChange, delayMs: 300 });
    return { timer, onCommit, onActiveChange };
  }

  it("3 rapid presses → 1 commit (debounced)", () => {
    const { timer, onCommit } = makeDeps();

    timer.scheduleReal();
    vi.advanceTimersByTime(100);
    timer.scheduleReal();
    vi.advanceTimersByTime(100);
    timer.scheduleReal();

    // Still within the last press's 300ms window.
    vi.advanceTimersByTime(299);
    expect(onCommit).not.toHaveBeenCalled();

    // Fire the trailing commit.
    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("3 paced presses (>delay apart) → 3 commits", () => {
    const { timer, onCommit } = makeDeps();

    timer.scheduleReal();
    vi.advanceTimersByTime(300);
    expect(onCommit).toHaveBeenCalledTimes(1);

    timer.scheduleReal();
    vi.advanceTimersByTime(300);
    expect(onCommit).toHaveBeenCalledTimes(2);

    timer.scheduleReal();
    vi.advanceTimersByTime(300);
    expect(onCommit).toHaveBeenCalledTimes(3);
  });

  it("boundary no-op press with a pending commit → real commit still fires", () => {
    const { timer, onCommit } = makeDeps();

    // Real press at t=0 (commit would fire at t=300)
    timer.scheduleReal();
    vi.advanceTimersByTime(100);
    expect(timer.isPending()).toBe(true);

    // Boundary/no-op press at t=100. MUST NOT disturb the pending commit.
    timer.scheduleVisualOnlyIfIdle();
    expect(timer.isPending()).toBe(true); // still the real one

    // Real commit should still fire at t=300.
    vi.advanceTimersByTime(199);
    expect(onCommit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("visual-only press when idle schedules a visual reset", () => {
    const { timer, onCommit, onActiveChange } = makeDeps();

    timer.scheduleVisualOnlyIfIdle();
    expect(timer.isPending()).toBe(true);

    vi.advanceTimersByTime(300);
    expect(timer.isPending()).toBe(false);
    expect(onCommit).not.toHaveBeenCalled();
    // Visual path always resets the active state.
    expect(onActiveChange).toHaveBeenLastCalledWith(false);
  });

  it("real press overrides a pending visual-only timer", () => {
    const { timer, onCommit } = makeDeps();

    timer.scheduleVisualOnlyIfIdle();
    vi.advanceTimersByTime(100);

    // Real press at t=100. clears the visual-only, installs a real one.
    timer.scheduleReal();
    vi.advanceTimersByTime(299);
    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("flush() fires any pending commit synchronously", () => {
    const { timer, onCommit } = makeDeps();

    timer.scheduleReal();
    timer.flush();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(timer.isPending()).toBe(false);

    // Subsequent advance does nothing — the timer was cleared.
    vi.advanceTimersByTime(1000);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("flush() when no timer pending is a no-op", () => {
    const { timer, onCommit } = makeDeps();

    timer.flush();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("clear() cancels without firing", () => {
    const { timer, onCommit, onActiveChange } = makeDeps();

    timer.scheduleReal();
    timer.clear();

    vi.advanceTimersByTime(1000);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onActiveChange).not.toHaveBeenCalled();
    expect(timer.isPending()).toBe(false);
  });

  it("scheduleReal fires onActiveChange(false) and onCommit on elapse", () => {
    const { timer, onCommit, onActiveChange } = makeDeps();

    timer.scheduleReal();
    vi.advanceTimersByTime(300);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onActiveChange).toHaveBeenCalledWith(false);
  });

  it("rapid presses interleaved with no-ops still collapse into 1 commit", () => {
    const { timer, onCommit } = makeDeps();

    timer.scheduleReal();
    vi.advanceTimersByTime(100);
    timer.scheduleVisualOnlyIfIdle(); // no-op — pending commit preserved
    vi.advanceTimersByTime(100);
    timer.scheduleReal(); // real resets the timer
    vi.advanceTimersByTime(100);
    timer.scheduleVisualOnlyIfIdle(); // no-op again
    vi.advanceTimersByTime(199);

    expect(onCommit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
