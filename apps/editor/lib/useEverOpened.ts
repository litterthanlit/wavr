import { useState } from "react";

/**
 * Latches to `true` the first time `open` is true and stays true afterwards.
 * Used to mount a lazily loaded modal on first open and keep it mounted, so its
 * state survives closing.
 */
export function useEverOpened(open: boolean): boolean {
  const [everOpened, setEverOpened] = useState(open);
  // Derived-state update during render: React re-renders immediately, before
  // committing, so the modal mounts in the same pass that opens it.
  if (open && !everOpened) setEverOpened(true);
  return everOpened;
}
