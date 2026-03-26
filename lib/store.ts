import { create } from "zustand";

export interface GradientState {
  // Gradient
  gradientType: "mesh" | "radial" | "linear" | "conic" | "plasma";
  speed: number;
  complexity: number;
  scale: number;
  distortion: number;
  brightness: number;
  saturation: number;
  colors: [number, number, number][];

  // Noise
  noiseEnabled: boolean;
  noiseIntensity: number;
  noiseScale: number;
  grain: number;

  // Particles
  particlesEnabled: boolean;
  particleCount: number;
  particleSize: number;
  mouseReact: number;

  // Bloom
  bloomEnabled: boolean;
  bloomIntensity: number;
  vignette: number;

  // Blur
  blurEnabled: boolean;
  blurAmount: number;

  // Playback
  playing: boolean;

  // Actions
  /** Live update — does NOT push undo history. Use for continuous changes (sliders). */
  set: (partial: Partial<GradientState>) => void;
  /** Discrete update — pushes undo history before applying. Use for one-shot changes (toggles, select). */
  setDiscrete: (partial: Partial<GradientState>) => void;
  /** Commit the pending snapshot from a continuous interaction (call on pointerUp / drag end). */
  commitSet: () => void;
  setColor: (index: number, color: [number, number, number]) => void;
  addColor: () => void;
  removeColor: (index: number) => void;
  loadPreset: (preset: Partial<GradientState>) => void;
  randomize: () => void;
  undo: () => void;
  redo: () => void;
}

// Keys excluded from undo snapshots
const HISTORY_EXCLUDE_KEYS: (keyof GradientState)[] = [
  "playing", "set", "setDiscrete", "commitSet", "setColor", "addColor", "removeColor",
  "loadPreset", "randomize", "undo", "redo",
];

type Snapshot = Omit<GradientState, "set" | "setDiscrete" | "commitSet" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize" | "undo" | "redo" | "playing">;

function takeSnapshot(state: GradientState): Snapshot {
  const snap: Record<string, unknown> = {};
  for (const key of Object.keys(state) as (keyof GradientState)[]) {
    if (!HISTORY_EXCLUDE_KEYS.includes(key) && typeof state[key] !== "function") {
      const val = state[key];
      // Deep-copy arrays (colors) to prevent snapshot corruption from later mutations
      if (Array.isArray(val)) {
        snap[key] = val.map((item: unknown) =>
          Array.isArray(item) ? [...item] : item
        );
      } else {
        snap[key] = val;
      }
    }
  }
  return snap as Snapshot;
}

function randomHue(): [number, number, number] {
  const h = Math.random() * 360;
  const s = 0.6 + Math.random() * 0.4;
  const l = 0.4 + Math.random() * 0.3;
  return hslToRgb(h, s, l);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [r + m, g + m, b + m];
}

const DEFAULTS: Omit<
  GradientState,
  "set" | "setDiscrete" | "commitSet" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize" | "undo" | "redo"
> = {
  gradientType: "mesh",
  speed: 0.4,
  complexity: 3,
  scale: 1.0,
  distortion: 0.3,
  brightness: 1.0,
  saturation: 1.0,
  colors: [
    [0.388, 0.357, 1.0],
    [1.0, 0.42, 0.42],
    [0.251, 0.878, 0.816],
    [0.98, 0.82, 0.2],
  ],
  noiseEnabled: false,
  noiseIntensity: 0.3,
  noiseScale: 1.0,
  grain: 0.0,
  particlesEnabled: false,
  particleCount: 50,
  particleSize: 2.0,
  mouseReact: 0.5,
  bloomEnabled: false,
  bloomIntensity: 0.3,
  vignette: 0.0,
  blurEnabled: false,
  blurAmount: 0,
  playing: true,
};

const MAX_HISTORY = 50;
const past: Snapshot[] = [];
let future: Snapshot[] = [];

/** Snapshot captured before a continuous interaction (slider drag) began. */
let pendingSnapshot: Snapshot | null = null;

function pushHistory(snapshot: Snapshot) {
  past.push(snapshot);
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
}

/** Flush any pending snapshot into history (e.g., before a discrete action). */
function flushPending() {
  if (pendingSnapshot !== null) {
    pushHistory(pendingSnapshot);
    pendingSnapshot = null;
  }
}

export const useGradientStore = create<GradientState>((rawSet) => {
  return {
    ...DEFAULTS,

    // Live update for continuous interactions (sliders).
    // Captures a pending snapshot on the first call, then just updates state.
    set: (partial) => {
      if (pendingSnapshot === null) {
        pendingSnapshot = takeSnapshot(useGradientStore.getState());
      }
      rawSet(partial);
    },

    // Commit the pending snapshot from a continuous interaction.
    // Call this on pointerUp / drag end.
    commitSet: () => {
      flushPending();
    },

    // Discrete update for one-shot changes (toggles, selects, type changes).
    // Pushes history immediately before applying.
    setDiscrete: (partial) => {
      flushPending();
      const current = useGradientStore.getState();
      pushHistory(takeSnapshot(current));
      rawSet(partial);
    },

    setColor: (index, color) => {
      if (pendingSnapshot === null) {
        pendingSnapshot = takeSnapshot(useGradientStore.getState());
      }
      const current = useGradientStore.getState();
      const colors = current.colors.map((c, i) =>
        i === index ? color : ([...c] as [number, number, number])
      );
      rawSet({ colors });
    },

    addColor: () => {
      const current = useGradientStore.getState();
      if (current.colors.length >= 8) return;
      flushPending();
      pushHistory(takeSnapshot(current));
      rawSet({ colors: [...current.colors.map(c => [...c] as [number, number, number]), randomHue()] });
    },

    removeColor: (index) => {
      const current = useGradientStore.getState();
      if (current.colors.length <= 2) return;
      flushPending();
      pushHistory(takeSnapshot(current));
      rawSet({ colors: current.colors.filter((_, i) => i !== index) });
    },

    loadPreset: (preset) => {
      flushPending();
      const current = useGradientStore.getState();
      pushHistory(takeSnapshot(current));
      rawSet(preset);
    },

    randomize: () => {
      const count = 3 + Math.floor(Math.random() * 3);
      const baseHue = Math.random() * 360;
      const colors: [number, number, number][] = [];
      for (let i = 0; i < count; i++) {
        const hue =
          (baseHue + i * (360 / count) + (Math.random() - 0.5) * 30) % 360;
        colors.push(
          hslToRgb(hue, 0.6 + Math.random() * 0.4, 0.4 + Math.random() * 0.3)
        );
      }
      const types: GradientState["gradientType"][] = [
        "mesh", "radial", "linear", "conic", "plasma",
      ];
      // Randomize is a discrete action
      flushPending();
      const current = useGradientStore.getState();
      pushHistory(takeSnapshot(current));
      rawSet({
        colors,
        gradientType: types[Math.floor(Math.random() * types.length)],
        speed: 0.2 + Math.random() * 0.8,
        complexity: 2 + Math.floor(Math.random() * 4),
        scale: 0.5 + Math.random() * 2,
        distortion: Math.random() * 0.6,
      });
    },

    undo: () => {
      flushPending();
      if (past.length === 0) return;
      const current = useGradientStore.getState();
      future.push(takeSnapshot(current));
      const prev = past.pop()!;
      rawSet(prev);
    },

    redo: () => {
      flushPending();
      if (future.length === 0) return;
      const current = useGradientStore.getState();
      past.push(takeSnapshot(current));
      const next = future.pop()!;
      rawSet(next);
    },
  };
});

export function canUndo() { return past.length > 0 || pendingSnapshot !== null; }
export function canRedo() { return future.length > 0; }
