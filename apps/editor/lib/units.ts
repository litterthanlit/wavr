// How sliders show their values. A slider without a format of its own shows an
// amount between 0 and 1 as a percentage, an integer step as an integer and
// anything else as the number at its step's precision, never a percentage of
// a range that isn't one.

export type ValueFormat = (value: number) => string;

/** Decimals a step needs: 1 → 0, 0.1 → 1, 0.25 → 1, 0.01 → 2, 0.005 → 3. */
export function stepDecimals(step: number): number {
  if (step >= 1) return 0;
  return Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
}

export const percent: ValueFormat = (value) => `${Math.round(value * 100)}%`;

export function defaultFormat(min: number, max: number, step: number): ValueFormat {
  if (min >= 0 && max <= 1) return percent;
  const decimals = stepDecimals(step);
  return (value) => value.toFixed(decimals);
}

/** A plain number at `decimals`, for a small quantity in 0–1 that isn't a share (a size in scene units). */
export const fixed = (decimals: number): ValueFormat => (value) => value.toFixed(decimals);

/** A multiplier: scale, speed, zoom. */
export const times: ValueFormat = (value) => `${value.toFixed(2)}×`;

/** An angle stored in degrees. */
export const degrees: ValueFormat = (value) => `${Math.round(value)}°`;

/** An angle stored in radians, shown in degrees. */
export const radiansAsDegrees: ValueFormat = (value) => `${Math.round((value * 180) / Math.PI)}°`;

export const px: ValueFormat = (value) => `${Number.isInteger(value) ? value : value.toFixed(1)} px`;

export const em: ValueFormat = (value) => `${+value.toFixed(3)} em`;

export const fps: ValueFormat = (value) => `${Math.round(value)} fps`;

/** How much brighter than white `headroom` stops let light shine: "2×", "2.8×"; "Off" at 0. */
export function hdrPeakLabel(headroom: number): string {
  if (headroom <= 0) return "Off";
  const peak = Math.pow(2, headroom);
  return `${Number.isInteger(peak) ? peak : peak.toFixed(1)}×`;
}
