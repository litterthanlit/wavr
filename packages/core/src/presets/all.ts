import * as classic from "./classic";
import * as dither from "./dither";
import * as scanline from "./scanline";
import * as glitch from "./glitch";
import * as cinematic from "./cinematic";
import * as nature from "./nature";
import * as abstract from "./abstract";
import { GradientConfig } from "../types";

export const presets: Record<string, GradientConfig> = {
  ...classic,
  ...dither,
  ...scanline,
  ...glitch,
  ...cinematic,
  ...nature,
  ...abstract,
};
