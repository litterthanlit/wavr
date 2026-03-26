# Wavr Core Polish — Design Spec

**Goal:** Make Wavr production-ready with undo/redo, keyboard shortcuts, error recovery, responsive layout, accessibility, and performance guards.

**Context:** Wavr is a working animated gradient editor with WebGL 2 rendering, 5 gradient modes, effects stack, 8 presets, export (PNG/CSS/WebM), and LiftKit theming. This spec covers the foundational polish needed before adding advanced creative features or public-facing infrastructure.

---

## 1. Undo/Redo System

Snapshot-based undo stack implemented as Zustand middleware.

**Behavior:**
- Every meaningful state change pushes a snapshot onto the undo stack
- "Meaningful" = color edit, slider release (mouseup/pointerup), preset load, randomize, toggle change
- High-frequency mid-drag slider values are NOT captured — only the final value on release
- The `playing` toggle, mouse position, and FPS are excluded from history tracking
- Stack depth: 50 states max (ring buffer — oldest dropped when full)

**Interface:**
- `Cmd+Z` / `Ctrl+Z` — undo
- `Cmd+Shift+Z` / `Ctrl+Shift+Z` — redo
- Undo/Redo arrow buttons in TopBar (next to logo), visually disabled when stack is empty

**Implementation:**
- Zustand middleware that intercepts `set()` calls
- A `skipHistory` option on `set()` for changes that shouldn't be tracked
- Separate `past` and `future` arrays stored outside the main state (not serialized into undo themselves)
- `undo()` and `redo()` actions added to the store

---

## 2. Keyboard Shortcuts

Global keyboard shortcuts registered via a `useEffect` on the root page component.

| Key | Action |
|-----|--------|
| `Space` | Play/Pause toggle |
| `R` | Randomize |
| `E` | Open export modal |
| `Escape` | Close any open modal |
| `1` / `2` / `3` | Switch sidebar tab (Gradient / Effects / Presets) |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |

**Shortcuts overlay:**
- Small `?` button in TopBar (right side, before theme toggle)
- Clicking opens a modal listing all shortcuts in a clean two-column layout
- `?` key also toggles the overlay

**Guard:** Shortcuts are suppressed when an input/select/textarea is focused (to avoid interfering with text entry like hex color inputs).

---

## 3. Error Recovery & Robustness

### WebGL Context Loss
- Listen for `webglcontextlost` and `webglcontextrestored` events on the canvas
- On loss: show an overlay message ("Recovering..."), prevent default
- On restore: re-initialize the engine (recompile shaders, re-cache uniforms, resume render loop)

### WebGL 2 Not Supported
- If `canvas.getContext("webgl2")` returns null, show a full-page fallback message:
  "Wavr requires WebGL 2. Please use a modern browser (Chrome, Firefox, Edge, Safari 15+)."
- No crash, no blank screen

### Shader Errors
- Already logging to console — add a dismissible toast notification in the UI
- Toast appears bottom-center, auto-dismisses after 5 seconds
- Only shown in development (check `process.env.NODE_ENV`)

---

## 4. Responsive Layout

### Breakpoints
- `>= 768px` — current layout (canvas left, sidebar right 320px)
- `< 768px` — sidebar becomes a bottom drawer
- `< 480px` — simplified: hide FPS counter, reduce sidebar control density

### Bottom Drawer (mobile)
- Slides up from bottom, covers ~60% of screen height
- Drag handle at top for swipe-up/swipe-down
- Toggle button (hamburger or settings icon) fixed in bottom-right of canvas area
- Canvas fills full screen behind the drawer
- Drawer has same tab structure (Gradient/Effects/Presets)

### Canvas Sizing
- Already fills available space and handles resize — no changes needed
- Ensure the resize handler accounts for drawer open/closed states on mobile

---

## 5. Accessibility

### Reduced Motion
- Detect `prefers-reduced-motion: reduce` via `window.matchMedia`
- On match: set `playing: false` by default, show a static gradient frame
- User can still manually press Play to override

### Keyboard Navigation
- All controls already use native `<input>`, `<button>`, `<select>` — inherently keyboard accessible
- Add visible focus rings: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1`
- Ensure tab order is logical: TopBar → Canvas (skip) → Sidebar tabs → Active panel controls

### ARIA
- TopBar buttons: `aria-label` on icon-only buttons (undo, redo, theme toggle)
- Toggle switches: already have `role="switch"` and `aria-checked` — good
- Export modal: `role="dialog"`, `aria-modal="true"`, focus trap
- Shortcuts modal: same dialog treatment

---

## 6. Performance Guards

### Adaptive Quality
- Track FPS via the existing FPS counter mechanism
- If FPS stays below 30 for 2+ consecutive seconds:
  1. Reduce `complexity` (fBm octaves) by 1, minimum 1
  2. If particles enabled and count > 50, halve particle count
  3. Show a subtle toast: "Reduced quality for performance"
- Store original values so user can manually restore
- Only trigger once per session (don't keep degrading)

### Redundant Uniform Skip
- The engine already sets all uniforms every frame — this is fine for the uniform count we have
- No change needed (premature optimization)

---

## Files Affected

| Area | Files |
|------|-------|
| Undo/Redo | `lib/store.ts` (middleware + actions), `components/TopBar.tsx` (buttons) |
| Keyboard Shortcuts | `app/page.tsx` (global listener), new `components/ShortcutsModal.tsx` |
| Error Recovery | `components/Canvas.tsx` (context loss), new `components/ui/Toast.tsx` |
| Responsive | `components/Sidebar.tsx` → refactor to support drawer mode, `app/globals.css` |
| Accessibility | `components/Canvas.tsx`, `components/TopBar.tsx`, `components/ExportModal.tsx`, `app/globals.css` |
| Performance | `components/Canvas.tsx` (FPS tracking + degradation logic) |

---

## Out of Scope (deferred to later sub-projects)

- Layer system / blending modes
- Animation timeline / keyframes
- New gradient types or effects
- Cloud save / user accounts
- Landing page / SEO
- Embed widget / SDK
