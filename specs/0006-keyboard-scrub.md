# Spec 0006 — Keyboard-scrub numeric sliders

> **Status:** Draft
> **Blocks:** Step 1 completion in HANDOFF.md
> **Depends on:** `apps/editor/components/ui/Slider.tsx` (the hand-rolled slider used throughout the editor)
> **Related:** spec 0003 (URL-state) — no changes needed; keyboard edits flow through `onChange`/`onCommit` which the subscriber already handles.

---

## 1. What this delivers

HANDOFF.md Step 1: *"Keyboard-scrub numeric inputs on every slider: ↑↓ = ±step, ⇧↑↓ = ±10×step, ⌥↑↓ = ±0.1×step. Figma convention."*

Concrete UX promise: click any slider to focus it, then:
- **↑ / ↓** — increment/decrement by the slider's `step` value.
- **Shift + ↑ / ↓** — increment/decrement by 10× `step`.
- **Alt + ↑ / ↓** — increment/decrement by 0.1× `step`.
- **Home / End** — jump to min / max. Industry standard, nearly free to add.
- **Enter / Space** on a focused slider does nothing (don't trigger blur or committed drag; the keyboard is the drag).

Every press commits immediately (no drag-and-commit distinction on discrete keys). Values clamp at min/max. URL-sync + undo work automatically through the existing `onChange`/`onCommit` pipeline.

---

## 2. Architecture

### 2.1 Where the change lives

One file: `apps/editor/components/ui/Slider.tsx`. The slider is used in every effect row, every gradient param, and every global control — editing it once fixes all callers. Zero consumer changes.

### 2.2 Focus surface

The slider currently has no focusable element. Add `tabIndex={0}` and a keyboard handler to the root `slider-track` div. That div already owns the pointer events, so keyboard joins the same container naturally.

Add `role="slider"` with the standard ARIA attributes (`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`) so screen readers announce the component correctly.

Focused state needs visible affordance. Reuse the existing `slider-track-hover` / `slider-thumb-visible` classes when focused — same visual as hover, so a focused slider looks "live" without new CSS.

### 2.3 Keyboard handler

```ts
const onKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (disabled) return;

  // Determine step multiplier from modifiers. Alt = 0.1×, Shift = 10×, none = 1×.
  // Alt wins over Shift if both pressed (Figma behavior).
  const multiplier = e.altKey ? 0.1 : e.shiftKey ? 10 : 1;
  const delta = step * multiplier;

  let next = value;
  switch (e.key) {
    case "ArrowUp":
    case "ArrowRight":
      next = value + delta;
      break;
    case "ArrowDown":
    case "ArrowLeft":
      next = value - delta;
      break;
    case "Home":
      next = min;
      break;
    case "End":
      next = max;
      break;
    default:
      return;  // not our key, let default handling proceed
  }

  e.preventDefault();
  const clamped = clampToStep(next);
  if (clamped !== value) {
    onChange(clamped);
    onCommit?.(clamped);  // keyboard edits commit immediately
  }
}, [disabled, step, value, min, max, onChange, onCommit, clampToStep]);
```

Key notes:
- **Left/Right = Down/Up** — ARIA convention for horizontal sliders. Users reach for either axis.
- **Alt over Shift** — Figma's precedence. Alt is "fine scrub"; Shift is "coarse scrub".
- **`onChange` fires per keypress; `onCommit` fires on a 300 ms trailing debounce.** Every key press is a continuous edit (like a drag mid-gesture). The debounced `onCommit` flushes a single undo + URL-history entry per batch of rapid keypresses. Matches Figma/Sketch/Linear convention: rapid keyboard scrubbing produces one undo, slow-paced presses produce one each. Implemented with a single `setTimeout` in a `useRef` that restarts on each keydown and fires `onCommit(currentValue)` when it elapses.

### 2.4 Sub-step precision

0.1× step is the Alt modifier. For a slider with `step: 0.01`, Alt gives `step: 0.001`. The existing `clampToStep` rounds to the nearest step value — if 0.1× produces a non-step-aligned result, it rounds. This means Alt may produce "no change" on very coarse sliders (e.g. `step: 1` → Alt = 0.1 → rounds back to integer steps).

**Decision:** accept the round-to-step behavior. Consumers who want finer keyboard control raise their `step` resolution. Pragma: for Wavr's sliders, most use `step: 0.01` (continuous params) or `step: 1` (counts). Alt on integer sliders still works for "no-op held down" — slightly surprising but self-explanatory once the user sees it.

Alternative considered: bypass `clampToStep` on Alt. Rejected — inconsistent with the slider's own value discretization. Visual value would show the full float, URL would carry it, but re-loading would snap to step. Worse.

### 2.5 Active state during keyboard edits

The slider's `active` state is currently true only during pointer-drag. Add brief keyboard-active: set `active=true` on key-down, reset after ~300ms of no further key activity. Gives the same thumb/bulge visual feedback as dragging.

Implement as a single `setTimeout` in a `useRef` that restarts on each key press. Clear on blur.

---

## 3. Accessibility

- `role="slider"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label={label}`, `aria-orientation="horizontal"`.
- `aria-valuetext` optional — if the slider has a formatter (e.g. "50%"), use it; else omit.
- `aria-disabled={disabled}` when disabled.
- `tabIndex={0}` when enabled, `-1` when disabled (so Tab skips disabled sliders).

Screen readers will announce: "Speed, slider, 0.5 of 0 to 2."

---

## 4. What stays the same

- Pointer drag flow: unchanged.
- `onChange` / `onCommit` signatures: unchanged.
- Every existing consumer: unchanged. The slider drops in the new behavior and everyone benefits.
- URL-sync subscriber: unchanged. Keyboard commits flow through the same `onCommit` path that drag end uses.

---

## 5. Acceptance criteria

- [ ] Click on the brightness slider track. Press ↑. Value increments by `step`. URL hash updates within 300ms.
- [ ] Hold Shift + ↑. Value increments by 10 × `step`. Hold repeat: continuous increase.
- [ ] Hold Alt + ↑. Value increments by 0.1 × `step` (rounded to nearest `step` multiple if step is coarse).
- [ ] Home → jumps to `min`. End → jumps to `max`.
- [ ] Tab through the sidebar: every enabled slider is a tab stop. Shift+Tab walks backward.
- [ ] Disabled sliders (e.g. when an effect toggle is off and children are greyed) are NOT tab stops and do not respond to arrow keys.
- [ ] Focus a slider. Press ↑ three times rapidly (within ~300 ms). Press ⌘Z once: value returns to pre-keyboard state. (Debounced commit groups rapid presses.)
- [ ] Focus a slider. Press ↑, wait 500 ms, press ↑, wait 500 ms, press ↑. Press ⌘Z three times: each undo walks back one press.
- [ ] Focus a slider, press ↑ five times rapidly. `window.history.length` increases by at most 1 (single `pushState` at the trailing-edge commit).
- [ ] Screen reader (VoiceOver on macOS): focus a slider, hear "[Label], slider, [current] of [min] to [max]".
- [ ] `pnpm --filter editor lint` no new errors.
- [ ] `pnpm --filter editor build` clean.
- [ ] `pnpm --filter editor test` still green.

---

## 6. Out of scope

- Typing a number directly into the slider (requires a text-input overlay — different UX pattern, future spec).
- Slider dragging with right-click (Figma-style). Not needed; keyboard + pointer cover the surface.
- Per-slider custom step overrides from keyboard modifiers beyond the ±10× / ±0.1× pair.
- Reorder-by-keyboard for draggable lists (spec 0007 territory if it lands).

---

## 7. Implementation order

1. `apps/editor/components/ui/Slider.tsx` — add `tabIndex`, `role="slider"`, ARIA attrs, `onKeyDown` handler, keyboard-active state with timeout.
2. Visual polish: focus ring via CSS (`:focus-visible` style matching the existing hover state). Minimal — maybe 3 lines added to `globals.css` or similar if there's a slider stylesheet.
3. Quick smoke: open editor, tab through sidebar, confirm each slider responds to arrow keys.
4. Verify: lint + build + tests.

---

## 8. Open questions

- **Should arrow keys without focus ever scrub the last-focused slider?** No — would be surprising and conflict with other key handlers. Users must focus first.
- **Page Up / Page Down for 10× step?** Industry-split. Shift + arrow is already that; adding PgUp/PgDn is redundant. Skip unless someone complains.
- **Mouse wheel on a focused slider?** Separate concern, not scoped here. Would be a natural follow-up.
