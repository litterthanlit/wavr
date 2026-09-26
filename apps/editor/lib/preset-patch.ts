import { CONFIG_FIELD_STATE_KEYS, resolveConfig, type GradientConfig } from "@wavr/core";
import type { GradientState } from "./store";

export type PresetData = Partial<
  Omit<GradientState, "set" | "setColor" | "addColor" | "removeColor" | "loadPreset" | "randomize">
>;

/**
 * The flat patch `loadPreset` applies for a preset config: the first layer's
 * look (applied to the active layer), brightness and saturation, plus every
 * global effect the config states. Effects the config doesn't mention are
 * left as the user has them, so a preset that should switch an effect off
 * says so explicitly (e.g. `grain: 0`).
 */
export function presetToStorePatch(config: GradientConfig): PresetData {
  const resolved = resolveConfig(config);
  const layer = resolved.layers[0];
  const data: Record<string, unknown> = {
    gradientType: layer.gradientType,
    speed: layer.speed,
    complexity: layer.complexity,
    scale: layer.scale,
    distortion: layer.distortion,
    colors: layer.colors.map((c) => [...c]),
    brightness: resolved.brightness,
    saturation: resolved.saturation,
  };
  if (config.layers[0]?.softness !== undefined) data.softness = layer.softness;

  for (const [field, keys] of Object.entries(CONFIG_FIELD_STATE_KEYS)) {
    if (config[field as keyof GradientConfig] === undefined) continue;
    for (const key of keys) data[key] = resolved[key];
  }
  return data as PresetData;
}
