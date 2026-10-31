"use client";
// @litt/dialog 2026.10.26. What changed: https://littmd.vercel.app/changelog.md

/**
 * Dialog: the expressive moment. "Placed, not thrown."
 *
 * - Radix Dialog is the accessibility layer (focus trap, Esc, focus return,
 *   aria). Everything visual is ours.
 * - Controlled open state plus AnimatePresence plus forceMount, so exits
 *   animate before Radix unmounts anything.
 * - Panel enter (expressive tier): opacity 0 to 1, y from useTravel() to 0,
 *   scale 0.98 to 1. It may bounce slightly, as the tokens allow. The side sheet
 *   travels the same small distance on x, never its own width. When the view has
 *   already spent its expressive moment, tier="responsive" moves it on that tier.
 * - Exit: useExit(tier), quicker and never bouncing.
 * - Overlay: a canvas tint that only fades (instant tier). No blur.
 * - Corners: the panel is rounded-litt-surface; the sheet hugs the right edge, so
 *   only its left corners are rounded. .litt-glass carries the surface radius,
 *   so the right corners are reset to square.
 * - Slots: title, description, body (children), footer. Footer buttons are
 *   right-aligned, 12px apart, primary last. The footer is marked
 *   data-dialog-footer in all three forms (the panel, the side sheet and the
 *   phone sheet share one footer): focus looks for it, and Button's danger
 *   variant reads it, so a destructive dialog's confirm is the one red fill
 *   (R7). Keep the attribute on any footer you write by hand.
 *
 * On compact screens (useDevice().compact, narrower than 640) the dialog is a
 * bottom sheet, and side="right" is the same sheet (foundations.md section 6):
 * - It rises from the bottom edge by its own height, always on the expressive
 *   spring whatever tier says (a sheet does not use up the view's moment), and
 *   leaves the same way on the exit token. Transform only, its height never
 *   animates, and it has one height: its content, up to the visible screen less
 *   --litt-space-6. --litt-space-6 of the sheet hides below the screen edge, so an
 *   overshoot or a pull never shows a gap.
 * - It sits above the keyboard: the layer is the visible screen
 *   (useVisibleScreen), so when the keyboard opens the sheet's bottom rises with
 *   it and the body scrolls inside, never under the keys.
 * - While it is open it counts itself (useSheetPresence), so a toast fired over
 *   it docks at the top edge instead of covering its buttons.
 * - Glass, rounded on the top corners only, a 32 by 4 grabber at the top (hidden
 *   from assistive tech), the body scrolls inside with overscroll-behavior:
 *   contain, and the footer is padded by the safe-area inset.
 * - It follows a finger through useDismissDrag (@/motion): drag down from
 *   anywhere the guards allow. The scrim lightens with it. The close button is
 *   44px on coarse pointers, and Cancel, Esc and a tap on the scrim still close.
 * - On coarse pointers focus lands on the panel, unless a field carries
 *   data-autofocus, so the keyboard does not open under a sheet that is moving.
 *   Fine pointers keep the focus rule above.
 *
 * DialogSheet is that sheet shell, exported so another overlay can reuse it (the
 * Popover on compact screens). It renders the portal, the scrim and the panel
 * inside a Radix Dialog root, and the panel is a grid with the areas "head close
 * / body body / foot foot". Put each child in an area with style={{ gridArea }}.
 * Inside it, var(--sheet-foot) is the bottom padding a last row needs: --litt-space-6
 * or the safe-area inset, whichever is larger.
 */
import { createContext, useCallback, useContext, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useTransform } from "motion/react";
import { useDevice, useExit, useMotionDial, useSheetPresence, useTransition, useTravel, useVisibleScreen } from "../../lib/litt/motion";
import { useDismissDrag } from "../../lib/litt/motion/drag";
import { Button } from "./button";
import { XIcon } from "./icons";

/* Radix's asChild, spread in: shadcn's CLI rewrites a written asChild to Base UI's render prop in base-* hosts. */
const asChildProps = { asChild: true } as const;

/* The open state, and the way to change it (a drag that leaves asks through this). */
const DialogState = createContext<{ open: boolean; change: (open: boolean) => void }>({ open: false, change: () => {} });

export type DialogProps = {
  /** Whether the dialog is open. Pair it with onOpenChange. Leave it out and the dialog keeps its own state. */
  open?: boolean;
  /** Start open when you do not control it. */
  defaultOpen?: boolean;
  /** Called with the next state when Esc, a click outside, Close, DialogClose or DialogTrigger asks to change it. Ignore a false to keep the dialog open, for example while a save runs. */
  onOpenChange?: (open: boolean) => void;
  /** The trigger and the content: a DialogTrigger and a DialogContent. */
  children: ReactNode;
};

/** The root. It holds the open state and shares it with DialogTrigger and DialogContent, which go inside it. */
export function Dialog({ open: openProp, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const change = useCallback(
    (next: boolean) => {
      setInner(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  return (
    <DialogState value={{ open, change }}>
      <RadixDialog.Root open={open} onOpenChange={change}>
        {children}
      </RadixDialog.Root>
    </DialogState>
  );
}

/** Opens the dialog. Wrap your own Button with asChild, so it keeps its look and gets the open behavior. */
export const DialogTrigger = RadixDialog.Trigger;
/** Closes the dialog. Wrap a Cancel button with asChild. */
export const DialogClose = RadixDialog.Close;

export type DialogContentProps = {
  /** The heading. It also names the dialog for screen readers, so it is required. */
  title: ReactNode;
  /** One line under the title, also read as the dialog's description. Leave it out when the title says enough. */
  description?: ReactNode;
  /** Buttons, right-aligned and 12px apart. Primary goes last. */
  footer?: ReactNode;
  /** "center" is a modal; "right" is a settings sheet. On a phone (compact screens) both are the bottom sheet. */
  side?: "center" | "right";
  /** The view's one expressive moment by default. Pass "responsive" when the view has already spent it (a list entrance, say). A phone sheet always rises on the expressive spring. */
  tier?: "expressive" | "responsive";
  /** Hide the round close button in the corner. */
  hideClose?: boolean;
  /** Extra classes for the panel. */
  className?: string;
  /** The body. It scrolls when it is taller than the panel, and the title and footer stay put. Leave it out for a title and buttons only. */
  children?: ReactNode;
};

const FOCUSABLE = ":is(input,textarea,select,button,[href]):not(:disabled)";

/**
 * Where focus goes when a dialog opens. On a coarse pointer it lands on the panel, or on the field marked
 * data-autofocus, so the keyboard never opens under a panel that is still moving. Otherwise `fine` decides.
 */
function focusOnOpen(event: Event, panel: HTMLElement | null, coarse: boolean, fine?: (event: Event) => void) {
  if (!coarse) return fine?.(event);
  if (!panel) return;
  event.preventDefault();
  (panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel).focus({ preventScroll: true });
}

const SCRIM = "absolute inset-0 bg-[color-mix(in_oklab,var(--litt-canvas)_55%,transparent)]";

export type DialogSheetProps = {
  /** Whether the sheet is shown. It drives the rise and the exit, so keep rendering the sheet and flip this. */
  open: boolean;
  /** Called when a drag decides to leave. Close the surface here: the exit then plays from where the finger let go. */
  onDismiss: () => void;
  /** Where focus goes on a fine pointer when the sheet opens (Radix onOpenAutoFocus). On a coarse pointer focus lands on the panel unless a field carries data-autofocus. */
  onOpenAutoFocus?: (event: Event) => void;
  /** Set false when nothing inside names a description, so Radix does not look for one. Default true. */
  described?: boolean;
  /** The panel element. */
  contentRef?: Ref<HTMLDivElement>;
  /** Extra classes for the panel. */
  className?: string;
  /** The panel's content. Place each child in a grid area with style={{ gridArea }}: head, close, body, foot. It needs a Radix Dialog.Title. */
  children: ReactNode;
};

/**
 * The bottom sheet shell for compact screens: portal, scrim and a draggable glass panel. Render it inside a Radix
 * Dialog root. See the file header for the rules it follows. The Dialog uses it, and so can any overlay that
 * becomes a sheet on a phone.
 */
export function DialogSheet({ open, ...rest }: DialogSheetProps) {
  useSheetPresence(open);
  return (
    <RadixDialog.Portal forceMount>
      <AnimatePresence>{open && <SheetLayer key="layer" {...rest} />}</AnimatePresence>
    </RadixDialog.Portal>
  );
}

function SheetLayer({ onDismiss, onOpenAutoFocus, described = true, contentRef, className = "", children }: Omit<DialogSheetProps, "open">) {
  const { coarse } = useDevice();
  const { reduced } = useMotionDial();
  const enter = useTransition("expressive");
  const drag = useDismissDrag({ direction: "down", onDismiss });
  const panel = useRef<HTMLDivElement | null>(null);
  const height = useRef(0);
  const visible = useVisibleScreen(true);

  const setPanel = useCallback(
    (node: HTMLDivElement | null) => {
      panel.current = node;
      if (typeof contentRef === "function") contentRef(node);
      else if (contentRef) contentRef.current = node;
    },
    [contentRef],
  );

  useLayoutEffect(() => {
    const el = panel.current;
    if (!el) return;
    const read = () => {
      height.current = el.offsetHeight;
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* The scrim is a function of how far the sheet is down, so it comes in with the rise, lightens as a finger pulls
     the sheet away, and goes with the exit. While Motion runs its own enter and exit, the value can be a number or
     a length such as "100%", so both are read. */
  const scrim = useTransform(drag.offset, (y: unknown) => {
    const h = height.current;
    const down = typeof y === "string" ? (y.endsWith("%") ? (parseFloat(y) / 100) * h : parseFloat(y)) : y;
    return h > 0 && typeof down === "number" && Number.isFinite(down) ? 1 - Math.min(1, Math.max(0, down / h)) : 0;
  });

  return (
    /* The layer is the visible screen, so the keyboard lifts the sheet's bottom instead of covering it. */
    <div
      className="fixed inset-0 z-50 grid grid-rows-[minmax(0,1fr)] items-end"
      style={visible ? { top: visible.top, height: visible.height, bottom: "auto" } : undefined}
    >
      <RadixDialog.Overlay forceMount {...asChildProps}>
        <motion.div className={SCRIM} style={{ opacity: scrim }} />
      </RadixDialog.Overlay>

      <RadixDialog.Content
        forceMount
        {...asChildProps}
        ref={setPanel}
        onOpenAutoFocus={(e) => focusOnOpen(e, panel.current, coarse, onOpenAutoFocus)}
        {...(described ? {} : { "aria-describedby": undefined })}
      >
        <motion.div
          {...drag.panel}
          onPointerDown={drag.onPointerDown}
          className={
            "litt-glass relative grid max-h-full w-full max-w-[40rem] -mb-6 justify-self-center pb-6 " +
            "grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] rounded-t-litt-surface rounded-b-none " +
            "[--litt-glass-shadow:var(--litt-shadow-modal)] [--sheet-foot:max(var(--litt-space-6),env(safe-area-inset-bottom,0px))] " +
            "focus-visible:outline-none " +
            className
          }
          style={{ ...drag.panel.style, gridTemplateAreas: '"head close" "body body" "foot foot"' }}
          initial={{ y: reduced ? 0 : "100%" }}
          animate={{ y: 0, transition: enter }}
          exit={{ y: "100%", transition: drag.exit }}
        >
          <span aria-hidden className="pointer-events-none absolute top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-litt-pill bg-litt-line-strong" />
          {children}
        </motion.div>
      </RadixDialog.Content>
    </div>
  );
}

/**
 * The panel: title, description, body and footer, with a dim overlay behind it. Render it inside a Dialog.
 * Focus lands on the control marked data-autofocus, else the first control in the body, else the first one in
 * the footer, and only then on the close button. On a touch screen it lands on the panel, or on a control marked
 * data-autofocus, so the keyboard does not open during the entrance.
 */
export function DialogContent({
  title,
  description,
  footer,
  side = "center",
  tier = "expressive",
  hideClose = false,
  className = "",
  children,
}: DialogContentProps) {
  const { open, change } = useContext(DialogState);
  const { compact, coarse } = useDevice();
  const enter = useTransition(tier);
  const exit = useExit(tier);
  const fadeIn = useTransition("instant");
  const fadeOut = useExit("instant");
  const travel = useTravel();
  const ref = useRef<HTMLDivElement | null>(null);
  const sheet = side === "right";
  const hasBody = children != null && children !== false;

  /* Focus the field the person came to fill, or the marked button, else the
     first control in the footer. Never the close button. */
  const pickFocus = (e: Event) => {
    const root = ref.current;
    if (!root) return;
    const el =
      root.querySelector<HTMLElement>("[data-autofocus]") ??
      root.querySelector<HTMLElement>(`[data-dialog-body] ${FOCUSABLE}`) ??
      root.querySelector<HTMLElement>(`[data-dialog-footer] ${FOCUSABLE}`);
    if (el) {
      e.preventDefault();
      el.focus({ preventScroll: true });
    }
  };

  /* The slots are the same on every screen; compact screens only change their padding and the footer's inset. */
  const slots = (
    <>
      <div className="grid content-start gap-1 pt-6 pr-4 pl-6 sm:pt-8 sm:pl-8" style={{ gridArea: "head" }}>
        <RadixDialog.Title className="text-litt-h4 text-litt-fg text-balance">{title}</RadixDialog.Title>
        {description && (
          <RadixDialog.Description className="text-litt-small text-litt-fg-subtle">{description}</RadixDialog.Description>
        )}
      </div>

      {hasBody && (
        <div
          data-dialog-body
          className={"min-h-0 overflow-y-auto px-6 py-6 sm:px-8 " + (compact ? "overscroll-contain" : "")}
          style={{ gridArea: "body" }}
        >
          {children}
        </div>
      )}

      {footer && (
        <div
          data-dialog-footer
          className={
            "flex flex-wrap justify-end gap-3 px-6 sm:px-8 " +
            (compact
              ? "border-t border-litt-line pt-6 pb-(--sheet-foot)"
              : sheet
                ? "border-t border-litt-line pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]"
                : "pb-6 sm:pb-8 " + (hasBody ? "pt-2" : "pt-6"))
          }
          style={{ gridArea: "foot" }}
        >
          {footer}
        </div>
      )}

      {!hideClose && (
        <div className="self-start pt-6 pr-4 sm:pt-8 sm:pr-6" style={{ gridArea: "close" }}>
          <RadixDialog.Close {...asChildProps}>
            <Button
              iconOnly
              size="sm"
              variant="ghost"
              aria-label="Close"
              className="-mt-1 pointer-coarse:-mt-2.5 pointer-coarse:h-litt-control-md pointer-coarse:w-litt-control-md"
            >
              <XIcon />
            </Button>
          </RadixDialog.Close>
        </div>
      )}
    </>
  );

  if (compact) {
    return (
      <DialogSheet
        open={open}
        onDismiss={() => change(false)}
        onOpenAutoFocus={pickFocus}
        described={!!description}
        contentRef={ref}
        className={className}
      >
        {slots}
      </DialogSheet>
    );
  }

  return (
    <RadixDialog.Portal forceMount>
      <AnimatePresence>
        {open && (
          <div
            key="layer"
            className={
              "fixed inset-0 z-50 grid " +
              (sheet ? "justify-items-end" : "place-items-center p-litt-gutter")
            }
          >
            <RadixDialog.Overlay forceMount {...asChildProps}>
              <motion.div
                className={SCRIM}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: fadeIn }}
                exit={{ opacity: 0, transition: fadeOut }}
              />
            </RadixDialog.Overlay>

            <RadixDialog.Content
              forceMount
              {...asChildProps}
              ref={ref}
              onOpenAutoFocus={(e) => focusOnOpen(e, ref.current, coarse, pickFocus)}
              {...(description ? {} : { "aria-describedby": undefined })}
            >
              <motion.div
                className={
                  "litt-glass grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_minmax(0,1fr)_auto] [--litt-glass-shadow:var(--litt-shadow-modal)] " +
                  (sheet
                    ? "h-full w-[400px] max-w-[calc(100%-2rem)] rounded-l-litt-surface rounded-r-none "
                    : "max-h-full w-full max-w-[480px] rounded-litt-surface ") +
                  className
                }
                style={{ gridTemplateAreas: '"head close" "body body" "foot foot"' }}
                initial={sheet ? { opacity: 0, x: travel } : { opacity: 0, y: travel, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: enter }}
                exit={
                  sheet
                    ? { opacity: 0, x: travel / 2, transition: exit }
                    : { opacity: 0, y: travel / 2, scale: 0.98, transition: exit }
                }
              >
                {slots}
              </motion.div>
            </RadixDialog.Content>
          </div>
        )}
      </AnimatePresence>
    </RadixDialog.Portal>
  );
}
