import type { GradientConfig, AnimateOptions } from "@wavr/core";

export type { AnimateOptions } from "@wavr/core";
export type { EasingFunction } from "@wavr/core";

export interface HoverTrigger {
  enter: Partial<GradientConfig>;
  leave: Partial<GradientConfig>;
  duration: number;
  easing: AnimateOptions["easing"];
}

export interface ScrollTrigger {
  mode: "scrub" | "trigger";
  start: number;  // scroll % to start (0-1)
  end: number;    // scroll % to end (0-1)
}

export interface ClickTrigger {
  effect: "ripple" | "flash" | "custom";
  config?: Partial<GradientConfig>;
  duration?: number;
  easing?: AnimateOptions["easing"];
}

export interface InViewTrigger {
  threshold: number;  // 0-1
  animation: "play" | "scrub";
}

export interface EventTriggers {
  onHover?: HoverTrigger;
  onScroll?: ScrollTrigger;
  onClick?: ClickTrigger;
  onInView?: InViewTrigger;
}
