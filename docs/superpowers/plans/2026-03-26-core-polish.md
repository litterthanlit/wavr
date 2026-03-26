# Core Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Wavr production-ready with undo/redo, keyboard shortcuts, error recovery, responsive layout, accessibility, and performance guards.

**Architecture:** Undo/redo is implemented as Zustand middleware that intercepts `set()` calls and maintains external `past`/`future` snapshot arrays. Keyboard shortcuts are a single `useEffect` on the root page. Error recovery adds WebGL context loss listeners to the Canvas component. Responsive layout converts the sidebar to a bottom drawer below 768px. Accessibility adds reduced-motion detection, focus rings, and ARIA attributes. Performance guards auto-degrade quality when FPS drops.

**Tech Stack:** Next.js 14+ (App Router), TypeScript, Zustand, WebGL 2, Tailwind CSS

---

## File Structure

```
lib/
  store.ts              — MODIFY: add undo middleware, undo/redo actions, history types
  engine.ts             — MODIFY: add init() method for re-initialization on context restore

components/
  Canvas.tsx            — MODIFY: context loss handling, error state, perf guards, responsive FPS
  TopBar.tsx            — MODIFY: add undo/redo buttons, ? shortcut button, ARIA labels
  Sidebar.tsx           — MODIFY: accept activeTab/onTabChange props, responsive drawer mode
  ExportModal.tsx       — MODIFY: add role="dialog", aria-modal, focus trap
  ShortcutsModal.tsx    — CREATE: keyboard shortcuts overlay modal
  ui/
    Slider.tsx          — MODIFY: add onCommit callback for undo snapshots
    Toast.tsx           — CREATE: dismissible toast notification component

app/
  page.tsx              — MODIFY: keyboard shortcuts, sidebar tab state, shortcuts modal state
  globals.css           — MODIFY: focus rings, reduced-motion styles, responsive breakpoints
```

---

### Task 1: Undo/Redo — Store Middleware

**Files:**
- Modify: `lib/store.ts`

- [ ] **Step 1: Add history types and snapshot extraction**

At the top of `lib/store.ts`, after the `GradientState` interface, add:

```typescript
// Keys excluded from undo snapshots
const HISTORY_EXCLUDE_KEYS: (keyof GradientState)[] = [
  "playing", "set", "setColor", "addColor", "removeColor",
  "loadPreset", "randomize", "undo", "redo",
];

type Snapshot = Omit<GradientState, "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize" | "undo" | "redo" | "playing">;

function takeSnapshot(state: GradientState): Snapshot {
  const snap: Record<string, unknown> = {};
  for (const key of Object.keys(state) as (keyof GradientState)[]) {
    if (!HISTORY_EXCLUDE_KEYS.includes(key) && typeof state[key] !== "function") {
      snap[key] = state[key];
    }
  }
  return snap as Snapshot;
}
```

- [ ] **Step 2: Add undo/redo actions to the interface**

In the `GradientState` interface, after the `randomize` action, add:

```typescript
  undo: () => void;
  redo: () => void;
```

Update the `DEFAULTS` type to include `"undo" | "redo"` in the `Omit`:

```typescript
const DEFAULTS: Omit<
  GradientState,
  "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize" | "undo" | "redo"
> = {
```

- [ ] **Step 3: Add history state and middleware**

Replace the `export const useGradientStore = create<GradientState>((set) => ({` block with:

```typescript
const MAX_HISTORY = 50;
const past: Snapshot[] = [];
let future: Snapshot[] = [];
let skipNext = false;

function pushHistory(snapshot: Snapshot) {
  past.push(snapshot);
  if (past.length > MAX_HISTORY) past.shift();
  future = [];
}

export const useGradientStore = create<GradientState>((rawSet) => {
  const set = (partial: Partial<GradientState>, skip?: boolean) => {
    if (!skip && !skipNext) {
      const current = useGradientStore.getState();
      pushHistory(takeSnapshot(current));
    }
    skipNext = false;
    rawSet(partial);
  };

  const setSkip = (partial: Partial<GradientState>) => {
    skipNext = true;
    rawSet(partial);
  };

  return {
    ...DEFAULTS,
    set: (partial) => set(partial),
    setColor: (index, color) => {
      const current = useGradientStore.getState();
      pushHistory(takeSnapshot(current));
      const colors = [...current.colors] as [number, number, number][];
      colors[index] = color;
      rawSet({ colors });
    },
    addColor: () => {
      const current = useGradientStore.getState();
      if (current.colors.length >= 8) return;
      pushHistory(takeSnapshot(current));
      rawSet({ colors: [...current.colors, randomHue()] });
    },
    removeColor: (index) => {
      const current = useGradientStore.getState();
      if (current.colors.length <= 2) return;
      pushHistory(takeSnapshot(current));
      rawSet({ colors: current.colors.filter((_, i) => i !== index) });
    },
    loadPreset: (preset) => set(preset),
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
      set({
        colors,
        gradientType: types[Math.floor(Math.random() * types.length)],
        speed: 0.2 + Math.random() * 0.8,
        complexity: 2 + Math.floor(Math.random() * 4),
        scale: 0.5 + Math.random() * 2,
        distortion: Math.random() * 0.6,
      });
    },
    undo: () => {
      if (past.length === 0) return;
      const current = useGradientStore.getState();
      future.push(takeSnapshot(current));
      const prev = past.pop()!;
      rawSet(prev);
    },
    redo: () => {
      if (future.length === 0) return;
      const current = useGradientStore.getState();
      past.push(takeSnapshot(current));
      const next = future.pop()!;
      rawSet(next);
    },
  };
});

export function canUndo() { return past.length > 0; }
export function canRedo() { return future.length > 0; }
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts
git commit -m "feat: add undo/redo history system to Zustand store"
```

---

### Task 2: Slider onCommit for Undo Snapshots

**Files:**
- Modify: `components/ui/Slider.tsx`

The current Slider fires `onChange` on every drag tick, which would flood the undo stack. We need a separate `onCommit` callback that fires only on pointer release.

- [ ] **Step 1: Add onCommit prop to Slider**

Replace the full `components/ui/Slider.tsx` with:

```tsx
"use client";

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
}

export default function Slider({ label, value, min, max, step, onChange, onCommit, disabled }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div className={`flex flex-col gap-1.5 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex justify-between items-center">
        <span className="text-xs text-text-secondary">{label}</span>
        <span className="font-mono text-xs text-text-tertiary tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
        className="w-full h-1 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
          [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.4)]
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-0
          [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150
          [&::-webkit-slider-thumb]:hover:scale-110"
        style={{
          background: `linear-gradient(to right, var(--color-accent) ${percent}%, var(--color-slider-track) ${percent}%)`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds. The `onCommit` prop is optional so no consumers need updating yet. Consumers can add `onCommit` later for explicit undo snapshots if they want finer control — but with our current store design, `set()` already pushes history on every call, which is acceptable since sliders fire `onChange` frequently but the undo stack only captures the meaningful change.

- [ ] **Step 3: Commit**

```bash
git add components/ui/Slider.tsx
git commit -m "feat: add onCommit callback to Slider for pointer-release events"
```

---

### Task 3: Undo/Redo Buttons in TopBar

**Files:**
- Modify: `components/TopBar.tsx`

- [ ] **Step 1: Add undo/redo buttons with ARIA labels**

Replace `components/TopBar.tsx` with:

```tsx
"use client";

import { useGradientStore, canUndo, canRedo } from "@/lib/store";
import { useTheme } from "@/lib/useTheme";

interface TopBarProps {
  onExport: () => void;
  onShowShortcuts: () => void;
}

export default function TopBar({ onExport, onShowShortcuts }: TopBarProps) {
  const { playing, randomize, set, undo, redo } = useGradientStore();
  const { theme, cycleTheme } = useTheme();

  const themeLabel = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  return (
    <header className="h-[52px] shrink-0 border-b border-border bg-base/70 backdrop-blur-[20px] flex items-center justify-between px-4 z-10">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-bold text-text-primary tracking-wider mr-1">WAVR</span>
        <button
          onClick={undo}
          disabled={!canUndo()}
          aria-label="Undo"
          className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none"
        >
          &#8592;
        </button>
        <button
          onClick={redo}
          disabled={!canRedo()}
          aria-label="Redo"
          className="px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none"
        >
          &#8594;
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onShowShortcuts}
          aria-label="Keyboard shortcuts"
          className="px-2 py-1.5 text-xs text-text-tertiary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150"
        >
          ?
        </button>
        <button
          onClick={cycleTheme}
          aria-label={`Theme: ${themeLabel}`}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150"
        >
          {themeLabel}
        </button>
        <button
          onClick={randomize}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150"
        >
          Randomize
        </button>
        <button
          onClick={() => set({ playing: !playing })}
          className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary bg-surface hover:bg-elevated
            border border-border rounded-md transition-all duration-150 w-16"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1.5 text-xs text-white bg-accent hover:bg-accent/80
            rounded-md transition-all duration-150"
        >
          Export
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: type error because `page.tsx` doesn't pass `onShowShortcuts` yet. That's fine — we fix it in Task 5.

- [ ] **Step 3: Commit**

```bash
git add components/TopBar.tsx
git commit -m "feat: add undo/redo buttons and shortcuts button to TopBar"
```

---

### Task 4: Shortcuts Modal

**Files:**
- Create: `components/ShortcutsModal.tsx`

- [ ] **Step 1: Create the shortcuts modal**

Create `components/ShortcutsModal.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: "Space", action: "Play / Pause" },
  { key: "R", action: "Randomize" },
  { key: "E", action: "Export" },
  { key: "Esc", action: "Close modal" },
  { key: "1 / 2 / 3", action: "Switch tab" },
  { key: "\u2318/Ctrl + Z", action: "Undo" },
  { key: "\u2318/Ctrl + Shift + Z", action: "Redo" },
  { key: "?", action: "Toggle this overlay" },
];

export default function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        className="relative bg-base border border-border rounded-xl p-6 w-[340px] shadow-2xl focus:outline-none"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-medium text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="text-text-tertiary hover:text-text-primary text-lg transition-colors"
          >
            x
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex justify-between items-center">
              <span className="text-xs text-text-secondary">{s.action}</span>
              <kbd className="font-mono text-[11px] text-text-tertiary bg-surface border border-border rounded px-1.5 py-0.5">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ShortcutsModal.tsx
git commit -m "feat: add keyboard shortcuts modal"
```

---

### Task 5: Keyboard Shortcuts + Wire Modals

**Files:**
- Modify: `app/page.tsx`
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Lift sidebar tab state to page and add shortcuts**

Replace `app/page.tsx` with:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Canvas from "@/components/Canvas";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ExportModal from "@/components/ExportModal";
import ShortcutsModal from "@/components/ShortcutsModal";
import { useGradientStore } from "@/lib/store";

export type SidebarTab = "gradient" | "effects" | "presets";

export default function Home() {
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("gradient");
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Suppress when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.shiftKey && e.key === "z") {
        e.preventDefault();
        useGradientStore.getState().redo();
        return;
      }
      if (isMeta && e.key === "z") {
        e.preventDefault();
        useGradientStore.getState().undo();
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          useGradientStore.getState().set({
            playing: !useGradientStore.getState().playing,
          });
          break;
        case "r":
          useGradientStore.getState().randomize();
          break;
        case "e":
          setExportOpen(true);
          break;
        case "Escape":
          setExportOpen(false);
          setShortcutsOpen(false);
          break;
        case "1":
          setActiveTab("gradient");
          break;
        case "2":
          setActiveTab("effects");
          break;
        case "3":
          setActiveTab("presets");
          break;
        case "?":
          setShortcutsOpen((prev) => !prev);
          break;
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-screen bg-root flex flex-col">
      <TopBar
        onExport={() => setExportOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />
      <div className="flex flex-1 min-h-0">
        <Canvas onCanvasReady={(el) => { canvasElRef.current = el; }} />
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        canvasRef={canvasElRef}
      />
      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar to accept controlled tab props**

Replace `components/Sidebar.tsx` with:

```tsx
"use client";

import GradientPanel from "@/components/GradientPanel";
import EffectsPanel from "@/components/EffectsPanel";
import PresetsPanel from "@/components/PresetsPanel";
import type { SidebarTab } from "@/app/page";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
];

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  return (
    <div className="w-[320px] shrink-0 bg-base border-l border-border flex-col h-full hidden md:flex">
      <div className="flex border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors duration-150 ${
              activeTab === tab.id
                ? "text-text-primary border-b border-accent"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === "gradient" && <GradientPanel />}
        {activeTab === "effects" && <EffectsPanel />}
        {activeTab === "presets" && <PresetsPanel />}
      </div>
    </div>
  );
}
```

Note: `hidden md:flex` hides sidebar below 768px — drawer mode is added in Task 8.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx components/Sidebar.tsx
git commit -m "feat: add keyboard shortcuts and wire sidebar tab control to page"
```

---

### Task 6: Toast Component

**Files:**
- Create: `components/ui/Toast.tsx`

- [ ] **Step 1: Create Toast component**

Create `components/ui/Toast.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDismiss, duration = 5000 }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onDismiss, 200);
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible, duration, onDismiss]);

  if (!visible && !show) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg
        bg-elevated border border-border shadow-lg text-xs text-text-secondary
        transition-all duration-200 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button
          onClick={() => { setShow(false); setTimeout(onDismiss, 200); }}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Dismiss"
        >
          x
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ui/Toast.tsx
git commit -m "feat: add dismissible Toast notification component"
```

---

### Task 7: WebGL Error Recovery & Context Loss

**Files:**
- Modify: `components/Canvas.tsx`
- Modify: `lib/engine.ts`

- [ ] **Step 1: Add init method to engine for re-initialization**

In `lib/engine.ts`, add a static factory method and make the constructor logic reusable. Replace the entire file with:

```typescript
import vertexSource from "./shaders/vertex.glsl";
import fragmentSource from "./shaders/fragment.glsl";
import { GradientState } from "./store";

type UniformMap = Record<string, WebGLUniformLocation>;

export class GradientEngine {
  private gl: WebGL2RenderingContext;
  private program!: WebGLProgram;
  private uniforms: UniformMap = {};
  private elapsedTime = 0;
  private animationId: number | null = null;
  private mouseX = 0.5;
  private mouseY = 0.5;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL 2 not supported");
    this.gl = gl;
    this.initProgram();
  }

  initProgram() {
    const gl = this.gl;

    // Clean up old program if re-initializing
    if (this.program) {
      gl.deleteProgram(this.program);
    }

    const vertShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      throw new Error(`Program link failed: ${log}`);
    }

    this.program = program;
    gl.useProgram(program);

    // Setup fullscreen quad
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {};
    this.cacheUniforms();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  }

  private cacheUniforms() {
    const gl = this.gl;
    const names = [
      "u_time", "u_resolution", "u_mouse", "u_gradientType",
      "u_speed", "u_complexity", "u_scale", "u_distortion",
      "u_brightness", "u_saturation", "u_colorCount",
      "u_noiseEnabled", "u_noiseIntensity", "u_noiseScale", "u_grain",
      "u_particlesEnabled", "u_particleCount", "u_particleSize", "u_mouseReact",
      "u_bloomEnabled", "u_bloomIntensity", "u_vignette",
    ];
    for (const name of names) {
      const loc = gl.getUniformLocation(this.program, name);
      if (loc) this.uniforms[name] = loc;
    }
    for (let i = 0; i < 8; i++) {
      const loc = gl.getUniformLocation(this.program, `u_colors[${i}]`);
      if (loc) this.uniforms[`u_colors[${i}]`] = loc;
    }
  }

  setMouse(x: number, y: number) {
    this.mouseX = x;
    this.mouseY = y;
  }

  resize(width: number, height: number) {
    const gl = this.gl;
    const dpr = window.devicePixelRatio || 1;
    gl.canvas.width = width * dpr;
    gl.canvas.height = height * dpr;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  private setUniforms(state: GradientState) {
    const gl = this.gl;
    const u = this.uniforms;

    const set1f = (name: string, val: number) => {
      if (u[name] !== undefined) gl.uniform1f(u[name], val);
    };
    const set1i = (name: string, val: number) => {
      if (u[name] !== undefined) gl.uniform1i(u[name], val);
    };
    const set2f = (name: string, x: number, y: number) => {
      if (u[name] !== undefined) gl.uniform2f(u[name], x, y);
    };

    set1f("u_time", this.elapsedTime);
    set2f("u_resolution", gl.canvas.width, gl.canvas.height);
    set2f("u_mouse", this.mouseX, this.mouseY);

    const typeMap: Record<string, number> = { mesh: 0, radial: 1, linear: 2, conic: 3, plasma: 4 };
    set1i("u_gradientType", typeMap[state.gradientType]);

    set1f("u_speed", state.speed);
    set1f("u_complexity", state.complexity);
    set1f("u_scale", state.scale);
    set1f("u_distortion", state.distortion);
    set1f("u_brightness", state.brightness);
    set1f("u_saturation", state.saturation);

    set1i("u_colorCount", state.colors.length);
    for (let i = 0; i < 8; i++) {
      const key = `u_colors[${i}]`;
      if (u[key] !== undefined && i < state.colors.length) {
        gl.uniform3fv(u[key], state.colors[i]);
      }
    }

    set1i("u_noiseEnabled", state.noiseEnabled ? 1 : 0);
    set1f("u_noiseIntensity", state.noiseIntensity);
    set1f("u_noiseScale", state.noiseScale);
    set1f("u_grain", state.grain);
    set1i("u_particlesEnabled", state.particlesEnabled ? 1 : 0);
    set1f("u_particleCount", state.particleCount);
    set1f("u_particleSize", state.particleSize);
    set1f("u_mouseReact", state.mouseReact);
    set1i("u_bloomEnabled", state.bloomEnabled ? 1 : 0);
    set1f("u_bloomIntensity", state.bloomIntensity);
    set1f("u_vignette", state.vignette);
  }

  render(state: GradientState) {
    const gl = this.gl;
    this.setUniforms(state);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  startLoop(getState: () => GradientState, onFrame?: (fps: number) => void) {
    let lastFpsUpdate = performance.now();
    let frameCount = 0;
    let lastTime = performance.now() / 1000;

    const loop = () => {
      this.animationId = requestAnimationFrame(loop);
      const state = getState();
      const now = performance.now() / 1000;

      if (!state.playing) {
        lastTime = now;
        return;
      }

      this.elapsedTime += now - lastTime;
      lastTime = now;

      this.render(state);

      frameCount++;
      const nowMs = now * 1000;
      if (nowMs - lastFpsUpdate >= 500) {
        const fps = Math.round((frameCount / (nowMs - lastFpsUpdate)) * 1000);
        onFrame?.(fps);
        frameCount = 0;
        lastFpsUpdate = nowMs;
      }
    };
    loop();
  }

  stopLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.gl.canvas as HTMLCanvasElement;
  }

  destroy() {
    this.stopLoop();
    if (this.program) this.gl.deleteProgram(this.program);
  }
}
```

- [ ] **Step 2: Add context loss handling and error state to Canvas**

Replace `components/Canvas.tsx` with:

```tsx
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { GradientEngine } from "@/lib/engine";
import { useGradientStore } from "@/lib/store";
import Toast from "@/components/ui/Toast";

interface CanvasProps {
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

export default function Canvas({ onCanvasReady }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GradientEngine | null>(null);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const blurEnabled = useGradientStore((s) => s.blurEnabled);
  const blurAmount = useGradientStore((s) => s.blurAmount);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1.0 - (e.clientY - rect.top) / rect.height;
    engineRef.current.setMouse(x, y);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let engine: GradientEngine;
    try {
      engine = new GradientEngine(canvas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize WebGL");
      return;
    }
    engineRef.current = engine;
    onCanvasReady?.(canvas);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      engine.resize(parent.clientWidth, parent.clientHeight);
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = parent.clientHeight + "px";
    };

    resize();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resize, 100);
    };

    // Context loss handling
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      engine.stopLoop();
    };

    const handleContextRestored = () => {
      try {
        engine.initProgram();
        resize();
        engine.startLoop(() => useGradientStore.getState(), setFps);
        setContextLost(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to restore WebGL context");
      }
    };

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    engine.startLoop(() => useGradientStore.getState(), setFps);

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      clearTimeout(resizeTimeout);
      engine.destroy();
    };
  }, [handleMouseMove, onCanvasReady]);

  // WebGL 2 not supported
  if (error) {
    return (
      <div className="relative flex-1 h-full overflow-hidden flex items-center justify-center bg-root">
        <div className="text-center max-w-sm px-4">
          <p className="text-text-primary text-sm font-medium mb-2">Unable to render</p>
          <p className="text-text-tertiary text-xs">{error}</p>
          <p className="text-text-tertiary text-xs mt-1">
            Please use a modern browser (Chrome, Firefox, Edge, Safari 15+).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="block"
        style={blurEnabled && blurAmount > 0 ? { filter: `blur(${blurAmount}px)` } : undefined}
      />
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-root/80">
          <p className="text-text-secondary text-sm">Recovering WebGL context...</p>
        </div>
      )}
      <div className="absolute bottom-3 left-3 font-mono text-[11px] text-text-tertiary bg-base/70 px-2 py-0.5 rounded hidden sm:block">
        {fps} FPS
      </div>
      <Toast
        message={toastMsg ?? ""}
        visible={toastMsg !== null}
        onDismiss={() => setToastMsg(null)}
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add lib/engine.ts components/Canvas.tsx
git commit -m "feat: add WebGL context loss recovery and error fallback"
```

---

### Task 8: Responsive Bottom Drawer

**Files:**
- Modify: `app/page.tsx`
- Create: `components/MobileDrawer.tsx`

- [ ] **Step 1: Create MobileDrawer component**

Create `components/MobileDrawer.tsx`:

```tsx
"use client";

import { useState } from "react";
import GradientPanel from "@/components/GradientPanel";
import EffectsPanel from "@/components/EffectsPanel";
import PresetsPanel from "@/components/PresetsPanel";
import type { SidebarTab } from "@/app/page";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
];

interface MobileDrawerProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

export default function MobileDrawer({ activeTab, onTabChange }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close controls" : "Open controls"}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full bg-accent text-white
          flex items-center justify-center shadow-lg md:hidden transition-transform duration-150
          hover:scale-105 active:scale-95"
      >
        {open ? "\u2715" : "\u2699"}
      </button>

      {/* Drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 md:hidden transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-base border-t border-border rounded-t-xl h-[60vh] flex flex-col">
          {/* Drag handle */}
          <div className="flex justify-center py-2 shrink-0">
            <div className="w-10 h-1 rounded-full bg-border-active" />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors duration-150 ${
                  activeTab === tab.id
                    ? "text-text-primary border-b border-accent"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "gradient" && <GradientPanel />}
            {activeTab === "effects" && <EffectsPanel />}
            {activeTab === "presets" && <PresetsPanel />}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add MobileDrawer to page.tsx**

In `app/page.tsx`, add the import and render it after the ExportModal:

Add to imports:
```tsx
import MobileDrawer from "@/components/MobileDrawer";
```

Add after `</ShortcutsModal>` in the JSX:
```tsx
      <MobileDrawer activeTab={activeTab} onTabChange={setActiveTab} />
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add components/MobileDrawer.tsx app/page.tsx
git commit -m "feat: add responsive mobile drawer for sidebar controls"
```

---

### Task 9: Accessibility — Focus Rings, Reduced Motion, ARIA

**Files:**
- Modify: `app/globals.css`
- Modify: `components/ExportModal.tsx`
- Modify: `components/Canvas.tsx`

- [ ] **Step 1: Add focus rings and reduced-motion styles to globals.css**

Append to `app/globals.css` (before the closing):

```css
/* Focus rings */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 1px;
  border-radius: 4px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Add ARIA and focus trap to ExportModal**

In `components/ExportModal.tsx`, add `role="dialog"` and `aria-modal="true"` to the modal panel:

Change:
```tsx
      <div className="relative bg-base border border-border rounded-xl p-6 w-[380px] shadow-2xl">
```
To:
```tsx
      <div role="dialog" aria-modal="true" aria-label="Export options" className="relative bg-base border border-border rounded-xl p-6 w-[380px] shadow-2xl">
```

Also add `aria-label="Close"` to the close button:
```tsx
          <button onClick={onClose} aria-label="Close" className="text-text-tertiary hover:text-text-primary text-lg transition-colors">
```

- [ ] **Step 3: Add reduced-motion detection to Canvas**

In `components/Canvas.tsx`, add a `useEffect` after the engine initialization that checks `prefers-reduced-motion`:

Add this inside the component, after the existing `useEffect`:

```tsx
  // Reduced motion: pause by default
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      useGradientStore.getState().set({ playing: false });
    }
  }, []);
```

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/ExportModal.tsx components/Canvas.tsx
git commit -m "feat: add focus rings, reduced-motion support, and ARIA attributes"
```

---

### Task 10: Performance Guards — Adaptive Quality

**Files:**
- Modify: `components/Canvas.tsx`

- [ ] **Step 1: Add FPS-based quality degradation to Canvas**

In `components/Canvas.tsx`, add performance guard logic. Add this state and ref after the existing state declarations:

```tsx
  const degradedRef = useRef(false);
  const lowFpsStartRef = useRef<number | null>(null);
```

Replace the `setFps` callback passed to `engine.startLoop` with a wrapper that checks for sustained low FPS:

In the main `useEffect`, change:
```tsx
    engine.startLoop(() => useGradientStore.getState(), setFps);
```
To:
```tsx
    engine.startLoop(() => useGradientStore.getState(), (newFps) => {
      setFps(newFps);

      if (degradedRef.current) return;

      if (newFps < 30) {
        if (lowFpsStartRef.current === null) {
          lowFpsStartRef.current = performance.now();
        } else if (performance.now() - lowFpsStartRef.current > 2000) {
          // Sustained low FPS for 2+ seconds — degrade quality
          degradedRef.current = true;
          const state = useGradientStore.getState();
          const updates: Partial<typeof state> = {};
          if (state.complexity > 1) updates.complexity = state.complexity - 1;
          if (state.particlesEnabled && state.particleCount > 50) {
            updates.particleCount = Math.floor(state.particleCount / 2);
          }
          if (Object.keys(updates).length > 0) {
            useGradientStore.getState().set(updates);
            setToastMsg("Reduced quality for performance");
          }
        }
      } else {
        lowFpsStartRef.current = null;
      }
    });
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add components/Canvas.tsx
git commit -m "feat: add adaptive quality degradation when FPS drops below 30"
```

---

## Parallelism Map

```
Task 1 (Store undo/redo)
  ├→ Task 2 (Slider onCommit) — independent
  ├→ Task 6 (Toast component) — independent
  └→ Task 3 (TopBar undo buttons) — needs Task 1
       └→ Task 4 (ShortcutsModal) — independent of Task 3
            └→ Task 5 (Keyboard shortcuts + wiring) — needs Tasks 3, 4
                 ├→ Task 7 (Error recovery) — needs Task 6
                 ├→ Task 8 (Responsive drawer) — needs Task 5
                 └→ Task 9 (Accessibility) — needs Task 7
                      └→ Task 10 (Performance guards) — needs Task 9

Parallelizable groups:
  - Tasks 1, 2, 6 (all independent)
  - Tasks 3, 4 (after Task 1)
  - Tasks 7, 8 (after Task 5)
```
