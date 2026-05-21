export type PropertyValueType =
  | "number"
  | "boolean"
  | "color"
  | "select"
  | "vec2"
  | "asset"
  | "text";

export type PropertyCostHint = "low" | "medium" | "high";

export interface PropertySchema {
  path: string;
  label: string;
  type: PropertyValueType;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: readonly string[];
  animatable: boolean;
  exposedInExport: boolean;
  affectsCompile: boolean;
  affectsLayout: boolean;
  costHint?: PropertyCostHint;
}
