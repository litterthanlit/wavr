import * as lightFields from "./light-fields";
import * as light from "./light";
import * as print from "./print";
import { GradientConfig } from "../types";

export const presets: Record<string, GradientConfig> = {
  ...lightFields,
  ...light,
  ...print,
};
