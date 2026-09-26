import { GRADIENT_TYPES as ALL_GRADIENT_TYPES } from "@wavr/schema/enums";
import type { GradientConfig, GradientType, LayerConfig, RGBColor } from "@wavr/core";

// Every type except "image", which needs an uploaded image.
export const GRADIENT_TYPES: GradientType[] = ALL_GRADIENT_TYPES.filter((type) => type !== "image");

export function cloneConfig(config: GradientConfig): GradientConfig {
  return structuredClone(config);
}

export function activeLayer(config: GradientConfig): LayerConfig {
  const layer = config.layers[0];
  if (layer) return layer;
  return {
    type: "mesh",
    colors: [
      [0.1, 0.1, 0.2],
      [0.4, 0.2, 0.8],
      [0.9, 0.4, 0.5],
      [0.2, 0.8, 0.9],
    ],
    speed: 0.4,
    complexity: 3,
    scale: 1,
    distortion: 0.3,
  };
}

export function padColors(colors: RGBColor[] | undefined): RGBColor[] {
  const next = colors && colors.length > 0 ? colors.map((c) => [...c] as RGBColor) : [];
  const fallback: RGBColor = next[next.length - 1] ?? [0, 0, 0];
  while (next.length < 4) next.push([...fallback] as RGBColor);
  return next.slice(0, 4);
}

export function patchActiveLayer(
  config: GradientConfig,
  patch: Partial<LayerConfig>,
): GradientConfig {
  const next = cloneConfig(config);
  const layer = activeLayer(next);
  next.layers = [{ ...layer, ...patch }, ...next.layers.slice(1)];
  return next;
}

export function patchConfig(
  config: GradientConfig,
  patch: Partial<GradientConfig>,
): GradientConfig {
  const next = cloneConfig(config);
  return { ...next, ...patch, layers: patch.layers ?? next.layers };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function rgbToHex(rgb: RGBColor): string {
  const hex = (n: number) =>
    Math.round(clamp(n, 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(rgb[0])}${hex(rgb[1])}${hex(rgb[2])}`;
}

export function hexToRgb(hex: string): RGBColor {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => `${c}${c}`)
          .join("")
      : raw.padEnd(6, "0").slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function formatReactSnippet(config: GradientConfig): string {
  return `import { WavrGradient } from "@wavr/gradient";

export function Hero() {
  return (
    <WavrGradient
      config={${JSON.stringify(config, null, 6).replace(/\n/g, "\n      ")}}
      className="absolute inset-0"
    />
  );
}
`;
}

export function shouldShowEditor(explicit?: boolean): boolean {
  if (typeof window !== "undefined") {
    const query = new URLSearchParams(window.location.search).get("editor");
    if (query === "1" || query === "true") return true;
    if (query === "0" || query === "false") return false;
  }
  if (explicit === false) return false;
  if (explicit === true) return true;
  return true;
}
