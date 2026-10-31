/**
 * One undo step per held key. litt's Slider commits right after every key
 * move, so a key held for two seconds would close dozens of undo steps. The
 * gate swallows those commits while a key is down and commits once, with the
 * last value, when it comes up. A pointer release, or a commit with no key
 * held, goes straight through.
 */
export interface CommitGate {
  keyDown(): void;
  keyUp(v: number): void;
  valueCommit(v: number): void;
  pointerUp(v: number): void;
}

export function createCommitGate(commit: (v: number) => void): CommitGate {
  let held = false;
  // A commit was swallowed while the key was down, so keyUp owes one.
  let owed = false;
  return {
    keyDown() {
      held = true;
    },
    keyUp(v) {
      if (!held) return;
      held = false;
      if (!owed) return;
      owed = false;
      commit(v);
    },
    valueCommit(v) {
      if (held) {
        owed = true;
        return;
      }
      commit(v);
    },
    pointerUp(v) {
      held = false;
      owed = false;
      commit(v);
    },
  };
}

/**
 * The slider's side of the gate: the latest value and onCommit, which key and
 * focus events read after the render that set them. A key's commit can come
 * before its change (Radix's arrows, Home and End) or after it (litt's Page
 * Up/Down); either way release() commits the value the key left.
 */
export function createSliderCommits() {
  const latest: { value: number; onCommit?: (value: number) => void } = { value: 0 };
  const gate = createCommitGate((v) => latest.onCommit?.(v));
  return {
    sync(value: number, onCommit?: (value: number) => void) {
      latest.value = value;
      latest.onCommit = onCommit;
    },
    moved(value: number) {
      latest.value = value;
    },
    keyDown: gate.keyDown,
    release: () => gate.keyUp(latest.value),
    valueCommit: gate.valueCommit,
  };
}
