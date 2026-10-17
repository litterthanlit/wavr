/** What attachPointer drives: a GradientEngine or a GradientHandle. */
export interface PointerTarget {
  /** The pointer is at (x, y): 0..1 across the element, y up. Implies it is present. */
  setMouse(x: number, y: number): void;
  setPointerActive(active: boolean): void;
  triggerRipple?(x: number, y: number): void;
}

export interface AttachPointerOptions {
  /** Click or tap fires `target.triggerRipple` at the pointer. Default false. */
  ripple?: boolean;
}

const PASSIVE = { passive: true } as const;

/**
 * Feeds `element`'s pointer to `target`, the one way every Wavr surface does it.
 * Pointer Events, so mouse, pen and touch all work. Coordinates are relative to
 * the element (y up), the pointer counts as absent once it leaves the element
 * or the gesture is cancelled, and the pointer only reacts while over the
 * element, not anywhere on the page. Returns a function that removes the
 * listeners.
 */
export function attachPointer(
  element: HTMLElement,
  target: PointerTarget,
  options: AttachPointerOptions = {},
): () => void {
  const locate = (event: { clientX: number; clientY: number }): [number, number] | null => {
    const rect = element.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;
    return [(event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height];
  };

  const onMove = (event: PointerEvent) => {
    const at = locate(event);
    if (at) target.setMouse(at[0], at[1]);
  };
  const onLeave = () => target.setPointerActive(false);
  const onClick = (event: MouseEvent) => {
    const at = locate(event);
    if (at) target.triggerRipple?.(at[0], at[1]);
  };

  element.addEventListener("pointerenter", onMove, PASSIVE);
  element.addEventListener("pointermove", onMove, PASSIVE);
  element.addEventListener("pointerdown", onMove, PASSIVE);
  element.addEventListener("pointerleave", onLeave, PASSIVE);
  element.addEventListener("pointercancel", onLeave, PASSIVE);
  if (options.ripple) element.addEventListener("click", onClick, PASSIVE);
  // Focus moving away (another window, devtools) never sends pointerleave.
  const view = element.ownerDocument?.defaultView;
  view?.addEventListener("blur", onLeave);

  return () => {
    element.removeEventListener("pointerenter", onMove);
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerdown", onMove);
    element.removeEventListener("pointerleave", onLeave);
    element.removeEventListener("pointercancel", onLeave);
    element.removeEventListener("click", onClick);
    view?.removeEventListener("blur", onLeave);
  };
}
