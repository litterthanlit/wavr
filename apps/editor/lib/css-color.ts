import type { ColorProfile } from "@wavr/core";

const toHex = (n: number) => Math.round(Math.min(Math.max(n, 0), 1) * 255).toString(16).padStart(2, "0");
const toFixed = (n: number) => String(+Math.min(Math.max(n, 0), 1).toFixed(4));

/**
 * A CSS colour for r g b in 0..1 as a scene reads them: hex for sRGB, and
 * color(display-p3 r g b) for a Display P3 scene, so a swatch shows the colour
 * the canvas shows (browsers without P3 fall back to sRGB the same way).
 */
export function cssColor([r, g, b]: readonly [number, number, number], profile: ColorProfile = "srgb"): string {
  if (profile === "display-p3") return `color(display-p3 ${toFixed(r)} ${toFixed(g)} ${toFixed(b)})`;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
