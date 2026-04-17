/**
 * keyCommitTimer — debounced trailing-edge commit for keyboard scrubbing.
 *
 * Pure module (no React imports) so timer semantics can be unit-tested with
 * vi.useFakeTimers(). Slider.tsx wires callbacks through refs so this module
 * stays React-agnostic.
 *
 * Three entry points:
 *   - scheduleReal(): fire onCommit after delayMs of quiet. Restarts the
 *     timer on each call — rapid keypresses collapse into a single commit.
 *   - scheduleVisualOnlyIfIdle(): same delay, only fires onActiveChange(false).
 *     Used for no-op keypresses (at boundary, or Alt on a coarse step). Does
 *     NOT disturb a pending real commit — critical so a boundary press after
 *     rapid scrubbing doesn't drop the in-flight commit.
 *   - flush(): synchronously fire any pending commit now (used on blur so
 *     focus loss never drops an edit).
 *   - clear(): cancel any pending timer without firing (used on unmount).
 */

export interface KeyCommitTimerDeps {
  /** Fire the real commit. Reads latest value from a closure/ref. */
  onCommit: () => void;
  /** Toggle the keyboard-active visual state. */
  onActiveChange: (active: boolean) => void;
  /** Debounce window, in ms. 300ms in production. */
  delayMs: number;
  /**
   * Optional setTimeout/clearTimeout injection for tests. Defaults to the
   * global timers. Vitest's fake-timer install replaces the globals, so in
   * production tests don't need to pass these.
   */
  setTimeout?: (fn: () => void, ms: number) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout?: (handle: ReturnType<typeof globalThis.setTimeout>) => void;
}

export interface KeyCommitTimer {
  /** Is a timer currently pending? Useful for tests + the visual-only guard. */
  isPending(): boolean;
  /** Schedule a real commit in delayMs. Replaces any existing pending timer. */
  scheduleReal(): void;
  /**
   * Schedule a visual-only reset in delayMs. No-op if a timer is already
   * pending — protects in-flight real commits from being overwritten.
   */
  scheduleVisualOnlyIfIdle(): void;
  /** Fire any pending commit synchronously and clear the timer. */
  flush(): void;
  /** Cancel any pending timer without firing. */
  clear(): void;
}

export function createKeyCommitTimer(deps: KeyCommitTimerDeps): KeyCommitTimer {
  const setT = deps.setTimeout ?? globalThis.setTimeout;
  const clearT = deps.clearTimeout ?? globalThis.clearTimeout;

  let handle: ReturnType<typeof globalThis.setTimeout> | null = null;

  function isPending(): boolean {
    return handle !== null;
  }

  function clear(): void {
    if (handle !== null) {
      clearT(handle);
      handle = null;
    }
  }

  function flush(): void {
    if (handle !== null) {
      clearT(handle);
      handle = null;
      deps.onCommit();
    }
  }

  function scheduleReal(): void {
    clear();
    handle = setT(() => {
      handle = null;
      deps.onActiveChange(false);
      deps.onCommit();
    }, deps.delayMs);
  }

  function scheduleVisualOnlyIfIdle(): void {
    if (handle !== null) return; // don't disturb a pending real commit
    handle = setT(() => {
      handle = null;
      deps.onActiveChange(false);
    }, deps.delayMs);
  }

  return { isPending, scheduleReal, scheduleVisualOnlyIfIdle, flush, clear };
}
