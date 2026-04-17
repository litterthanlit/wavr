/**
 * Pure helpers for the layer drag-reorder UI in LayerPanel.
 *
 * Kept in lib/ (a) to be Node-testable without jsdom, and (b) because the
 * vitest include pattern only picks up `lib/**\/*.test.ts`.
 *
 * The UI generates ids as `layer-${index}` at render time. Using the index as
 * id is safe here because MAX_LAYERS = 4 and `moveLayer` reconciles
 * activeLayerIndex itself — see store.ts `moveLayer`.
 */

export const LAYER_ID_PREFIX = "layer-" as const;

export function layerIdFor(index: number): string {
  return `${LAYER_ID_PREFIX}${index}`;
}

export function parseLayerId(id: string | number): number | null {
  const s = typeof id === "number" ? `${LAYER_ID_PREFIX}${id}` : id;
  if (!s.startsWith(LAYER_ID_PREFIX)) return null;
  const tail = s.slice(LAYER_ID_PREFIX.length);
  if (tail.length === 0 || !/^\d+$/.test(tail)) return null;
  const n = Number(tail);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

export interface DragEndLike {
  active: { id: string | number };
  over: { id: string | number } | null;
}

/**
 * Given a drag-end event, return the `[from, to]` pair to pass to
 * `store.moveLayer`, or `null` if the drag is a no-op (no drop target, same
 * target, or an id we don't recognize).
 *
 * `layerCount` bounds-checks against the current store state; out-of-range
 * indices yield null so stale events (e.g., a layer was removed mid-drag)
 * don't corrupt state.
 */
export function computeMoveFromDragEnd(
  event: DragEndLike,
  layerCount: number,
): [number, number] | null {
  if (!event.over) return null;
  const from = parseLayerId(event.active.id);
  const to = parseLayerId(event.over.id);
  if (from === null || to === null) return null;
  if (from === to) return null;
  if (from >= layerCount || to >= layerCount) return null;
  return [from, to];
}
