import { describe, expect, it, vi } from "vitest";
import { createCommitGate, createSliderCommits } from "./commit-gate";

describe("createCommitGate", () => {
  it("commits a held key once, with the last value, when it comes up", () => {
    const commit = vi.fn();
    const gate = createCommitGate(commit);
    gate.keyDown();
    for (let i = 0; i < 10; i++) {
      gate.keyDown(); // key repeat
      gate.valueCommit(0.1 * i);
    }
    expect(commit).not.toHaveBeenCalled();
    gate.keyUp(0.7);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(0.7);
  });

  it("commits a value commit with no key held straight away", () => {
    const commit = vi.fn();
    const gate = createCommitGate(commit);
    gate.valueCommit(0.3);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(0.3);
  });

  it("commits on pointer up straight away", () => {
    const commit = vi.fn();
    const gate = createCommitGate(commit);
    gate.pointerUp(0.4);
    expect(commit).toHaveBeenCalledWith(0.4);
  });

  it("does not commit a key that moved nothing", () => {
    const commit = vi.fn();
    const gate = createCommitGate(commit);
    gate.keyDown();
    gate.keyUp(0.5);
    expect(commit).not.toHaveBeenCalled();
  });
});

// The orders the slider's events really come in. The adapter listens in the capture phase, so its
// keyDown always runs before the thumb's own keydown handler commits.
describe("createSliderCommits", () => {
  function slider(start: number) {
    const commit = vi.fn();
    const s = createSliderCommits();
    s.sync(start, commit);
    return { s, commit };
  }

  it("commits a tapped arrow once, with the value it moved to (Radix commits before the change)", () => {
    const { s, commit } = slider(0.3);
    s.keyDown();
    s.valueCommit(0.3); // Radix's onValueCommit, still the old value
    s.moved(0.31); // then onValueChange
    s.release();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(0.31);
  });

  it("commits a held Page Up once (litt changes, then commits, on every repeat)", () => {
    const { s, commit } = slider(0.3);
    for (let i = 1; i <= 5; i++) {
      s.keyDown();
      s.moved(0.3 + i * 0.2);
      s.valueCommit(0.3 + i * 0.2);
    }
    s.release();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(1.3);
  });

  it("commits a drag on release, with no key involved", () => {
    const { s, commit } = slider(0.3);
    s.moved(0.5);
    s.moved(0.6);
    s.valueCommit(0.6);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(0.6);
  });
});
