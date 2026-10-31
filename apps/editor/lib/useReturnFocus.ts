import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Gives focus back to whatever had it when a dialog opened, once it closes. litt's Dialog leaves that to Radix,
 * which returns focus only to a DialogTrigger; the editor's dialogs open from the top bar, the keyboard and the
 * command menu instead, so there is none.
 *
 * The opener is read in a layout effect, before the dialog's own (passive) focus effect moves focus inside it.
 * Focus goes back in a passive effect, after the dialog's focus trap (a child, so its effects run first) has let go.
 */
export function useReturnFocus(open: boolean): void {
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);
  useEffect(() => {
    if (open) return;
    const el = opener.current;
    opener.current = null;
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, [open]);
}
