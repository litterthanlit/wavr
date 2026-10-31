import type { GradientState } from "./store";

export type EffectSwitchKey = "grain" | "mouseReact";

// Grain and Pointer are amounts; their switch writes the amount a fresh scene starts with.
export const EFFECT_SWITCHES: Record<EffectSwitchKey, { label: string; onValue: number }> = {
  grain: { label: "Grain", onValue: 0.03 },
  mouseReact: { label: "Pointer", onValue: 0.5 },
};

export const isSwitchOn = (value: number): boolean => value > 0;

export function switchPatch(key: EffectSwitchKey, on: boolean): Partial<GradientState> {
  return { [key]: on ? EFFECT_SWITCHES[key].onValue : 0 };
}
