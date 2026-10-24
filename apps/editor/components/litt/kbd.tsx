"use client";
// @litt/kbd 2026.10.15. What changed: https://littmd.vercel.app/changelog.md

/**
 * Kbd: the key cap for a real shortcut (⌘K, ↵, esc). Never decoration.
 *
 * - One chip everywhere, from components.md and the specimen: a 20px box at
 *   rounded-litt-control, a surface-2 fill, an inset line hairline, Geist Mono at
 *   weight 400 in fg-subtle. The tooltip, the command menu footer, the button
 *   hint and the tabs legend all render this component and nothing else.
 * - The size is the caption step (12px), on the type scale like every other label.
 * - shrink-0 so it never squashes in a flex row; min-w-5 keeps a lone glyph square.
 * - Static: no motion and no states. It is a real <kbd>, so whether a hint is
 *   hidden from screen readers is the caller's call.
 */
import type { ReactNode } from "react";

const chip =
  "inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-litt-control bg-litt-surface-2 px-1 " +
  "font-litt-mono font-normal text-litt-caption text-litt-fg-subtle shadow-[inset_0_0_0_1px_var(--litt-line)]";

/** One key cap, or one chord written in glyphs, such as ⇧⌘C. Keys pressed one after another each get their own Kbd, 4px apart. */
export function Kbd({
  children,
}: {
  /** The key as people read it: a glyph (⌘, ↵, ⌫, ←), a chord of glyphs (⇧⌘C) or a short word (esc, tab). */
  children: ReactNode;
}) {
  return <kbd className={chip}>{children}</kbd>;
}
