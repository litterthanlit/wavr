import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserStartupGuardStorage,
  FORCE_RECOVERY_PARAM,
  decideStartup,
  healthyRecord,
  stalledRecord,
  startingRecord,
  withTimeout,
  type RecoveryReason,
  type StartupDecision,
  type StartupGuardStorage,
  type StartupMode,
  type StartupRecord,
} from "./startup-guard";

export type StartupPhase =
  | { kind: "checking" }
  | { kind: "recovery"; reason: RecoveryReason | "context-lost"; failures: number; lastMode: StartupMode | null }
  | { kind: "running"; mode: StartupMode };

/** Never hold the editor back longer than this waiting on storage. */
const STORAGE_TIMEOUT_MS = 1500;

function newStartId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Gates WebGL startup on the last start having finished cleanly. See
 * `lib/startup-guard.ts`. The editor mounts the canvas only in the "running"
 * phase, and reports back through `reportHealthy` / `reportStall`.
 */
export function useStartupGuard(storage?: StartupGuardStorage) {
  const storageRef = useRef<StartupGuardStorage | null>(storage ?? null);
  const decisionRef = useRef<StartupDecision | null>(null);
  const recordRef = useRef<StartupRecord | null>(null);
  const removePagehideRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<StartupPhase>({ kind: "checking" });

  const getStorage = () => (storageRef.current ??= new BrowserStartupGuardStorage());

  const start = useCallback(async (mode: StartupMode) => {
    const store = getStorage();
    const decision = decisionRef.current ?? { recovery: null, failures: 0, lastMode: null };
    const record = startingRecord(decision, mode, newStartId(), Date.now());
    recordRef.current = record;

    // Closing or reloading the tab before the start is healthy isn't a crash.
    removePagehideRef.current?.();
    const onPagehide = () => store.writeCleanExit(record.id);
    window.addEventListener("pagehide", onPagehide);
    removePagehideRef.current = () => window.removeEventListener("pagehide", onPagehide);

    // The record must be on disk before any GPU work: after a hard freeze
    // nothing written later survives.
    await withTimeout(store.write(record), STORAGE_TIMEOUT_MS, undefined);
    setPhase({ kind: "running", mode });
  }, []);

  const reportHealthy = useCallback(() => {
    const record = recordRef.current;
    if (!record || record.status !== "starting") return;
    recordRef.current = healthyRecord(record);
    void getStorage().write(recordRef.current);
    removePagehideRef.current?.();
    removePagehideRef.current = null;
  }, []);

  const reportStall = useCallback((reason: "stalled" | "context-lost") => {
    const record = recordRef.current;
    if (!record) return;
    recordRef.current = stalledRecord(record);
    void getStorage().write(recordRef.current);
    removePagehideRef.current?.();
    removePagehideRef.current = null;
    const failures = record.status === "healthy" ? 1 : record.failures + 1;
    decisionRef.current = { recovery: "stalled", failures, lastMode: record.mode };
    setPhase({ kind: "recovery", reason, failures, lastMode: record.mode });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const store = getStorage();
    const forced = new URLSearchParams(window.location.search).has(FORCE_RECOVERY_PARAM);

    void (async () => {
      const record = await withTimeout(store.read(), STORAGE_TIMEOUT_MS, null);
      if (cancelled) return;
      const decision = decideStartup(record, store.readCleanExit(), forced);
      decisionRef.current = decision;
      if (decision.recovery) {
        setPhase({
          kind: "recovery",
          reason: decision.recovery,
          failures: decision.failures,
          lastMode: decision.lastMode,
        });
      } else {
        await start("normal");
      }
    })();

    return () => {
      cancelled = true;
      removePagehideRef.current?.();
      removePagehideRef.current = null;
    };
  }, [start]);

  return { phase, start, reportHealthy, reportStall };
}
