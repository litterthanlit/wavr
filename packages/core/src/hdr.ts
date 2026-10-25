import type { ColorProfile } from "./layers";

/** The most headroom a scene may ask for, in stops: eight times white. */
export const MAX_HDR_HEADROOM = 3;

/**
 * Where the engine presents live frames that may be brighter than white
 * (GradientEngine.setHdrOutput; WebGPUHdrOutput is the one there is). A WebGL
 * canvas can't show such a frame yet (drawingBufferToneMapping is still a
 * proposal) and hands on only 8 bits a channel, so the engine packs each frame
 * into two opaque 8-bit frames (hdr-pack.glsl) and gives them over in turn.
 */
export interface HdrOutput {
  /** Takes the source canvas's drawing buffer, as it is now, as packed tile 0 or 1. */
  copyTile(source: HTMLCanvasElement, tile: 0 | 1): void;
  /**
   * Decodes the two tiles last taken and presents them: display values from 0
   * to `range` (1 is white; above it, brighter), read in `profile`.
   */
  present(range: number, profile: ColorProfile): void;
}

/** The peak `headroom` stops above white allow, in units of white (linear light). */
export function hdrPeak(headroom: number): number {
  return Math.pow(2, Math.min(Math.max(headroom, 0), MAX_HDR_HEADROOM));
}

/** The display value of linear light `peak` on the sRGB curve, extended past 1 (displayPeak() in common.glsl). */
export function displayPeak(peak: number): number {
  return peak > 1 ? 1.055 * Math.pow(peak, 1 / 2.4) - 0.055 : 1;
}

/** Matches while the page is on a screen that can show HDR: (dynamic-range: high). */
export function hdrDisplayQuery(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(dynamic-range: high)")
    : null;
}
