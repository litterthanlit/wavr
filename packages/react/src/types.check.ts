// Compile-time guard, checked by `pnpm lint` (not a build entry, so it never
// ships). The published types in ./types.ts are standalone so the .d.ts files
// don't depend on @wavr/core; this fails typechecking if they drift from the
// canonical lists in @wavr/schema/enums.
import type * as Core from "@wavr/core";
import type * as Published from "./types";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

export const publishedTypesMatchCore: [
  Equal<Published.GradientType, Core.GradientType>,
  Equal<Published.BlendMode, Core.BlendMode>,
  Equal<Published.ImageBlendMode, Core.ImageBlendMode>,
  Equal<Published.MaskShape, Core.MaskShape>,
  Equal<Published.MaskBlendMode, Core.MaskBlendMode>,
  Equal<Published.TextMaskAlign, Core.TextMaskAlign>,
  Equal<Published.ColorProfile, Core.ColorProfile>,
] = [true, true, true, true, true, true, true];

// The pointer methods of the handle, which WavrGradient calls on what createGradient returns.
type PointerMethods = "setMouse" | "setPointerActive" | "triggerRipple";
export const publishedHandleMatchesCore: [
  Equal<Pick<Published.GradientHandle, PointerMethods>, Pick<Core.GradientHandle, PointerMethods>>,
] = [true];
