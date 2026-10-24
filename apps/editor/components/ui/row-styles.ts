/*
 * A selectable row in a panel list (layers, scene objects): 32px at the control radius. The selected row wears litt's
 * raised segment (P12): a fill one step up from the panel, the hairline and the top highlight, kept on hover. The
 * others take the fg 6% hover fill. Color fades on the instant tier.
 */
export const ROW =
  "group flex h-litt-control-sm items-center gap-1 rounded-litt-control transition-colors duration-(--litt-dur-instant) ease-litt";
export const ROW_SELECTED = "bg-litt-surface-2 shadow-[inset_0_0_0_1px_var(--litt-line),var(--litt-highlight)]";
export const ROW_IDLE = "hover:bg-[color-mix(in_oklab,var(--litt-fg)_6%,transparent)]";
/** The row's main button: fills the row, label at the start, the focus ring inside the row. */
export const ROW_BUTTON =
  "flex h-full min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-litt-control px-3 text-left text-litt-small " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-litt-focus";
