import type { ButtonSize, ButtonVariant } from "@/components/litt/button";

/* litt's Button classes (components/litt/button.tsx), for a link that looks like one. Litt's Button always renders a
 * <button>, and a link to another page is an <a> (build.md), so the landing's links take these and wrap their label in
 * .litt-trim. They are copied because the vendored file stays as the registry ships it; litt-button-classes.test.ts
 * fails when a litt update changes them there. */

const base =
  "relative inline-flex shrink-0 items-center justify-center gap-litt-control whitespace-nowrap select-none font-litt-title " +
  "cursor-pointer transition-[background-color,color,translate] duration-(--litt-dur-instant) ease-litt " +
  "[-webkit-tap-highlight-color:transparent] " +
  "active:translate-y-(--litt-press-depth) disabled:cursor-not-allowed disabled:active:translate-y-0 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus";

const sizes: Record<ButtonSize, string> = {
  sm: "h-litt-control-sm px-litt-control-pad-sm text-litt-small",
  md: "h-litt-control-md px-litt-control-pad-md text-litt-body",
  lg: "h-litt-control-lg px-litt-button-pad-lg text-(length:--litt-control-text-lg)",
};

/* A link is never disabled and never sits in a dialog's footer, so danger's dialog-confirm rules are left out. */
const variants: Record<Exclude<ButtonVariant, "danger">, string> = {
  primary:
    "bg-litt-accent text-litt-accent-fg hover:bg-litt-accent-hover enabled:pointer-coarse:active:bg-litt-accent-hover shadow-litt-glow " +
    "inset-shadow-[0_1px_0_color-mix(in_oklab,white_22%,transparent)]",
  secondary:
    "bg-litt-block text-litt-fg shadow-(--litt-block-lift) enabled:active:shadow-(--litt-block-press) forced-colors:border " +
    "hover:bg-[color-mix(in_oklab,var(--litt-block),var(--litt-fg)_4%)] enabled:pointer-coarse:active:bg-[color-mix(in_oklab,var(--litt-block),var(--litt-fg)_4%)]",
  ghost:
    "bg-transparent text-litt-fg-muted hover:text-litt-fg hover:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)] " +
    "enabled:pointer-coarse:active:text-litt-fg enabled:pointer-coarse:active:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)]",
};

export const LITT_BUTTON_CLASSES = { base, sizes, variants };

export function buttonClassName({
  variant = "secondary",
  size = "md",
}: { variant?: Exclude<ButtonVariant, "danger">; size?: ButtonSize } = {}) {
  return [base, sizes[size], variants[variant], "rounded-litt-control"].join(" ");
}
