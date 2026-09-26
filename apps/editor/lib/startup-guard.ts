/**
 * Startup crash guard for the editor.
 *
 * A GPU hang in the first frames can freeze the whole machine, so nothing in
 * the page gets a chance to react. Instead, each start is recorded durably
 * *before* the WebGL engine is created and marked healthy once the render
 * loop has run for a while. If the next load finds a start that never became
 * healthy, the editor shows a recovery screen instead of starting WebGL.
 *
 * `StartupWatch` covers the softer case where the page keeps running but
 * frames crawl: it reports a stall so the editor can stop the loop itself.
 */

export type StartupMode = "normal" | "safe";

export interface StartupRecord {
  id: string;
  mode: StartupMode;
  status: "starting" | "healthy" | "stalled";
  startedAt: number;
  /** Consecutive starts before this one that never became healthy. */
  failures: number;
}

export type RecoveryReason = "unclean-start" | "stalled" | "forced";

export interface StartupDecision {
  /** Why to show the recovery screen, or null to start normally. */
  recovery: RecoveryReason | null;
  /** Consecutive failed starts, including the one just detected. */
  failures: number;
  lastMode: StartupMode | null;
}

/** `?safe` in the editor URL always opens the recovery screen. */
export const FORCE_RECOVERY_PARAM = "safe";

/**
 * Decides how to start from the last recorded start. `cleanExitId` is the id
 * the page wrote on `pagehide`: a start that was closed or reloaded before it
 * became healthy is not a crash.
 */
export function decideStartup(
  record: StartupRecord | null,
  cleanExitId: string | null,
  forced: boolean,
): StartupDecision {
  const lastMode = record?.mode ?? null;
  const forcedDecision = (failures: number): StartupDecision => ({
    recovery: forced ? "forced" : null,
    failures,
    lastMode,
  });

  if (!record || record.status === "healthy") return forcedDecision(0);
  if (record.status === "stalled") {
    return { recovery: "stalled", failures: record.failures + 1, lastMode };
  }
  if (record.id === cleanExitId) return forcedDecision(record.failures);
  return { recovery: "unclean-start", failures: record.failures + 1, lastMode };
}

export function startingRecord(
  decision: StartupDecision,
  mode: StartupMode,
  id: string,
  now: number,
): StartupRecord {
  return { id, mode, status: "starting", startedAt: now, failures: decision.failures };
}

export function healthyRecord(record: StartupRecord): StartupRecord {
  return { ...record, status: "healthy", failures: 0 };
}

export function stalledRecord(record: StartupRecord): StartupRecord {
  return { ...record, status: "stalled" };
}

export interface StartupWatchOptions {
  /** Time the loop must run before the start counts as healthy. */
  probationMs: number;
  /** Frames the loop must render before the start counts as healthy. */
  healthyFrames: number;
  /** Frames at the start that may be slow (lazy driver shader compiles). */
  warmupFrames: number;
  /** A single gap this long during warm-up is a stall. */
  warmupStallMs: number;
  /** A single gap this long after warm-up is a stall. */
  stallMs: number;
  /** Gaps at least this long count as slow... */
  slowMs: number;
  /** ...and this many slow gaps after warm-up are a stall. */
  maxSlowFrames: number;
}

export const DEFAULT_WATCH_OPTIONS: StartupWatchOptions = {
  probationMs: 5000,
  healthyFrames: 30,
  warmupFrames: 3,
  warmupStallMs: 15000,
  stallMs: 3000,
  slowMs: 750,
  maxSlowFrames: 4,
};

export type WatchVerdict = "pending" | "healthy" | "stalled";

/**
 * Watches frame gaps during the first seconds of the render loop. Feed it
 * one `frame()` per requestAnimationFrame tick; call `pause()` while the tab
 * is hidden so the hidden time isn't read as a stall.
 */
export class StartupWatch {
  private readonly options: StartupWatchOptions;
  private startMs: number | null = null;
  private lastMs: number | null = null;
  private frames = 0;
  private slowFrames = 0;
  private verdict: WatchVerdict = "pending";

  constructor(options: Partial<StartupWatchOptions> = {}) {
    this.options = { ...DEFAULT_WATCH_OPTIONS, ...options };
  }

  frame(nowMs: number): WatchVerdict {
    if (this.verdict !== "pending") return this.verdict;
    const o = this.options;
    this.startMs ??= nowMs;

    if (this.lastMs !== null) {
      const gap = nowMs - this.lastMs;
      if (this.frames < o.warmupFrames) {
        if (gap >= o.warmupStallMs) this.verdict = "stalled";
      } else if (gap >= o.stallMs) {
        this.verdict = "stalled";
      } else if (gap >= o.slowMs && ++this.slowFrames >= o.maxSlowFrames) {
        this.verdict = "stalled";
      }
    }
    this.lastMs = nowMs;
    this.frames++;

    if (
      this.verdict === "pending" &&
      this.frames >= o.healthyFrames &&
      nowMs - this.startMs >= o.probationMs
    ) {
      this.verdict = "healthy";
    }
    return this.verdict;
  }

  pause() {
    this.lastMs = null;
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export interface StartupGuardStorage {
  read(): Promise<StartupRecord | null>;
  /** Resolves once the record is on disk, as far as the browser allows. */
  write(record: StartupRecord): Promise<void>;
  readCleanExit(): string | null;
  /** Synchronous: runs inside `pagehide`. */
  writeCleanExit(id: string): void;
}

export class MemoryStartupGuardStorage implements StartupGuardStorage {
  record: StartupRecord | null = null;
  cleanExit: string | null = null;
  async read() {
    return this.record;
  }
  async write(record: StartupRecord) {
    this.record = record;
  }
  readCleanExit() {
    return this.cleanExit;
  }
  writeCleanExit(id: string) {
    this.cleanExit = id;
  }
}

const RECORD_KEY = "wavr-startup-guard";
const CLEAN_EXIT_KEY = "wavr-startup-clean-exit";
const DB_NAME = "wavr-startup-guard";
const STORE = "records";

export function isStartupRecord(value: unknown): value is StartupRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.mode === "normal" || r.mode === "safe") &&
    (r.status === "starting" || r.status === "healthy" || r.status === "stalled") &&
    typeof r.startedAt === "number" &&
    typeof r.failures === "number"
  );
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or blocked: the guard degrades to "always start normally".
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked"));
  });
}

/**
 * The record goes to IndexedDB with `durability: "strict"`, whose commit
 * resolves only after the data is flushed to disk. localStorage writes are
 * flushed lazily and can be lost when the machine freezes and is power
 * cycled, which is exactly the case this guards against. localStorage keeps
 * a copy for browsers without IndexedDB.
 */
export class BrowserStartupGuardStorage implements StartupGuardStorage {
  async read(): Promise<StartupRecord | null> {
    let fromDb: StartupRecord | null = null;
    try {
      const db = await openDb();
      fromDb = await new Promise<StartupRecord | null>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).get(RECORD_KEY);
        req.onsuccess = () => resolve(isStartupRecord(req.result) ? req.result : null);
        req.onerror = () => reject(req.error);
      });
      db.close();
    } catch {
      // Fall through to localStorage.
    }

    let fromLocal: StartupRecord | null = null;
    try {
      const raw = readLocal(RECORD_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      fromLocal = isStartupRecord(parsed) ? parsed : null;
    } catch {
      fromLocal = null;
    }

    if (fromDb && fromLocal && fromLocal.id !== fromDb.id) {
      return fromLocal.startedAt > fromDb.startedAt ? fromLocal : fromDb;
    }
    // Same start in both: IndexedDB is the durable copy, but a later status
    // change may only have reached localStorage.
    if (fromDb && fromLocal) return fromLocal.status !== "starting" ? fromLocal : fromDb;
    return fromDb ?? fromLocal;
  }

  async write(record: StartupRecord): Promise<void> {
    writeLocal(RECORD_KEY, JSON.stringify(record));
    try {
      const db = await openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite", { durability: "strict" });
        tx.objectStore(STORE).put(record, RECORD_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    } catch {
      // localStorage copy only.
    }
  }

  readCleanExit() {
    return readLocal(CLEAN_EXIT_KEY);
  }

  writeCleanExit(id: string) {
    writeLocal(CLEAN_EXIT_KEY, id);
  }
}

/** Resolves with `promise`, or after `ms` so a stuck store never blocks startup. */
export function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
