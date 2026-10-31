import { describe, expect, it, vi } from "vitest";
import { createCommitGate } from "./commit-gate";

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
