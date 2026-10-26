import { MAX_PALETTE_COLORS, PALETTE_SIZE, bakePalette, effectiveBlend, paletteReach, type ColorProfile } from "@wavr/core";

// The gradient bar's model. A layer's colours are evenly spaced stops (the
// palette has no stop positions), so stop i of n sits at i / (n - 1): the bar
// shows them where getGradientColor reads them, and moving one is a reorder.

export type Rgb = [number, number, number];

export const MIN_STOPS = 2;
export const MAX_STOPS = MAX_PALETTE_COLORS;

/** Where stop `index` of `count` sits along the bar, 0–1. */
export function stopPosition(index: number, count: number): number {
  return count <= 1 ? 0.5 : index / (count - 1);
}

/** The slot nearest `x` (0–1) for a stop dragged among `count` stops. */
export function nearestSlot(x: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.round(x * (count - 1))));
}

/** The index a stop inserted at `x` takes: after every stop left of it. */
export function insertionIndex(x: number, count: number): number {
  return Math.min(count, Math.max(1, Math.ceil(x * (count - 1) - 1e-9)));
}

export function moveStop(colors: readonly Rgb[], from: number, to: number): Rgb[] {
  const next = colors.map((c) => [...c] as Rgb);
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function insertStop(colors: readonly Rgb[], index: number, color: Rgb): Rgb[] {
  const next = colors.map((c) => [...c] as Rgb);
  next.splice(index, 0, [...color] as Rgb);
  return next;
}

export function reverseStops(colors: readonly Rgb[]): Rgb[] {
  return colors.map((c) => [...c] as Rgb).reverse();
}

export function sameStops(a: readonly Rgb[], b: readonly Rgb[]): boolean {
  return a.length === b.length && a.every((c, i) => c.every((v, j) => v === b[i][j]));
}

export interface BarPalette {
  /** The colour at `t` (0–1) along the bar, as the engine's baked palette has it. */
  sample: (t: number) => Rgb;
}

export function barPalette(
  colors: readonly Rgb[],
  options: { oklab: boolean; softness: number; colorProfile: ColorProfile },
): BarPalette {
  const blend = effectiveBlend(options.softness);
  const table = bakePalette(colors, options.oklab, blend, undefined, options.colorProfile === "display-p3");
  const reach = paletteReach(blend);
  const span = 1 + 2 * reach;
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  return {
    sample: (t) => {
      const i = Math.round(((clamp01(t) + reach) / span) * (PALETTE_SIZE - 1)) * 4;
      return [clamp01(table[i]), clamp01(table[i + 1]), clamp01(table[i + 2])];
    },
  };
}
