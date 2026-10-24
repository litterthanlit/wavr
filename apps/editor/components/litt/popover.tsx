"use client";
// @litt/popover 2026.10.15. What changed: https://littmd.vercel.app/changelog.md

/**
 * Popover: a floating panel for content that needs more than a row. A small
 * form, a share link, a filter set, a detail card. Rows that run a command
 * belong to Menu.
 *
 * - Radix Popover is the accessibility layer (role="dialog", focus into the
 *   panel and back to the trigger, Esc, outside click, aria-expanded on the
 *   trigger). Everything visual is written here.
 * - Surface: floating glass (litt-glass, default float shadow), rounded-litt-surface,
 *   p-1 (4px) like Menu. The content sits in a 12px pad inside that inset, so a
 *   form field starts 16px from the edge, like a Menu row's label. Turn the pad
 *   off (padded={false}) for rows that bring their own 44px height and 12px side
 *   padding: they then sit concentric in the 4px inset, exactly as Menu rows do.
 * - Glass never sits on glass. When the trigger sits inside a glass surface (a
 *   dialog, the header, a toast) or inside another popover, the panel is solid
 *   (bg-litt-surface-2 + shadow-litt-float), as Menu's submenus are. Found from the DOM
 *   when the panel opens, so nothing has to be wired by hand. `solid` forces it.
 * - Motion, responsive tier. The panel grows from the trigger: Radix gives
 *   --radix-popover-content-transform-origin, and it travels a quarter of the
 *   travel token from the side it actually opens on (after collision flipping).
 *   We wait for Radix to place it, then read data-side. Exit uses useExit.
 *   AnimatePresence + forceMount + controlled open lets the exit play.
 * - Focus: Radix moves it into the panel on open. It lands on the control marked
 *   data-autofocus, else the first focusable control, else the panel itself.
 *   Closing returns it to the trigger. Opened with the pointer, a button gets no
 *   ring (:focus-visible), a text field always does.
 * - Sizes sit on the 8px grid: 256, 320, 384. The panel never grows past the room
 *   on screen, and scrolls inside when it is taller than the room.
 *
 * On a phone (foundations.md section 6; useDevice().compact, so a desktop can preview it with
 * <DeviceProvider mode="phone">) the popover is a bottom sheet, because it holds fields and
 * pickers that need the width and a place above the keyboard:
 * - It is DialogSheet from dialog.tsx, the same sheet the Dialog uses, so a phone has one: it
 *   rises by its own height, follows a finger down to close, and leaves on the exit token. It is
 *   a modal there (focus trapped and returned to the trigger, Esc, a tap on the scrim, a 44px
 *   close button on touch), whatever `modal` says.
 * - The same children render in both. Only the shell changes, so a caller keeps one copy of the
 *   content. `label` is the sheet's heading (the Radix Dialog title), so it is what names the sheet.
 *   `side`, `align`, `sideOffset`, `size` and `collisionBoundary` describe an anchored panel and
 *   are ignored. `padded` and `solid` still apply.
 * - Radix Popover cannot be a sheet, so the root holds a Radix Dialog root beside the Popover one,
 *   both driven by the same open state, and PopoverTrigger is the Dialog's trigger on a phone: that
 *   is what returns focus to it and points its aria-controls at the sheet. PopoverClose works in both.
 * - Glass never sits on glass: a sheet opened from a trigger inside a dialog, another sheet or the
 *   header is solid, found from the trigger when it opens.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import * as RadixPopover from "@radix-ui/react-popover";
import { AnimatePresence, animate, motion, useMotionValue } from "motion/react";
import { useDevice, useExit, useTransition, useTravel } from "../../lib/litt/motion";
import { Button } from "./button";
import { DialogSheet } from "./dialog";
import { XIcon } from "./icons";

/* Radix's asChild, spread in: shadcn's CLI rewrites a written asChild to Base UI's render prop in base-* hosts. */
const asChildProps = { asChild: true } as const;

type Side = "top" | "right" | "bottom" | "left";

/* The open state, and the way to change it (a drag, the close button and Esc on a phone ask through this). */
const PopoverState = createContext<{ open: boolean; change: (open: boolean) => void }>({ open: false, change: () => {} });

export type PopoverProps = {
  /** Whether the popover is open. Pair it with onOpenChange. Leave it out and the popover keeps its own state. */
  open?: boolean;
  /** Start open when you do not control it. */
  defaultOpen?: boolean;
  /** Called with the next state when Esc, a click outside, PopoverClose or PopoverTrigger asks to change it. Ignore a false to keep the popover open, for example while a save runs. */
  onOpenChange?: (open: boolean) => void;
  /** Make the rest of the page inert while it is open: focus is trapped, outside clicks only close it, and screen readers skip the page. */
  modal?: boolean;
  /** The trigger and the content: a PopoverTrigger and a PopoverContent. */
  children: ReactNode;
};

/** The root. It holds the open state and shares it with PopoverTrigger and PopoverContent, which go inside it. */
export function Popover({ open: openProp, defaultOpen = false, onOpenChange, modal = false, children }: PopoverProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const change = useCallback(
    (next: boolean) => {
      setInner(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );
  /* Both Radix roots are only context, so they cost nothing. The Popover one serves the anchored panel and
     PopoverClose; the Dialog one serves the sheet a phone gets. Both follow the same open state. */
  return (
    <PopoverState value={{ open, change }}>
      <RadixPopover.Root open={open} onOpenChange={change} modal={modal}>
        <RadixDialog.Root open={open} onOpenChange={change}>
          {children}
        </RadixDialog.Root>
      </RadixPopover.Root>
    </PopoverState>
  );
}

/** Opens and closes the popover. Wrap your own Button with asChild, so it keeps its look and gets aria-expanded and the toggle. */
export function PopoverTrigger(props: ComponentProps<typeof RadixPopover.Trigger>) {
  /* On a phone the panel is a Radix Dialog, so its trigger is the Dialog's: that is what gives the sheet its
     aria-controls and brings focus back to this button when the sheet closes. */
  const { compact } = useDevice();
  const Trigger = (compact ? RadixDialog.Trigger : RadixPopover.Trigger) as typeof RadixPopover.Trigger;
  return <Trigger {...props} />;
}
/** Closes the popover. Wrap a Cancel or Done button with asChild. */
export const PopoverClose = RadixPopover.Close;

export type PopoverContentProps = {
  /** The popover's accessible name. It is a dialog, and a dialog needs a name, so this is required. On a phone it is also the sheet's heading, so write it as a short title and do not repeat it at the top of your content. */
  label: string;
  /** The side of the trigger it opens on first. With no room there it flips to the opposite side, and the entrance follows. On a phone it is a sheet and this is ignored. */
  side?: Side;
  /** Which edge of the trigger it lines up with. On a phone this is ignored. */
  align?: "start" | "center" | "end";
  /** Gap between the trigger and the popover, in px. On a phone this is ignored. */
  sideOffset?: number;
  /** Width on the 8px grid: sm is 256px, md is 320px, lg is 384px. It never grows past the room on screen. On a phone the sheet spans the screen and this is ignored. */
  size?: "sm" | "md" | "lg";
  /** Pad the content 12px inside the 4px inset, so it sits 16px from the edge. Turn it off for rows that bring their own 44px height and 12px side padding. On a phone the same two choices line up with the sheet's heading. */
  padded?: boolean;
  /** Draw a solid surface instead of glass. Left out, it is solid only when the trigger sits inside a glass surface or another popover. */
  solid?: boolean;
  /** Flip against this element instead of the viewport (a stage, a card). On a phone this is ignored. */
  collisionBoundary?: Element | null;
  /** The content: a form, a link and a button, a detail card, a set of options. The same content shows in the anchored panel and in the phone sheet. */
  children: ReactNode;
};

const WIDTH = { sm: "w-64", md: "w-80", lg: "w-96" } as const;
/** What a popover must not be glass over: any glass surface, and any popover. */
const FLOATING = ".litt-glass, [data-popover-surface]";

/**
 * The panel. Render it inside a Popover, next to the PopoverTrigger.
 * Focus lands on the control marked data-autofocus, else the first focusable control, else the panel itself.
 * On a phone (narrower than 640px) it is a bottom sheet with `label` as its heading, and the same children.
 */
export function PopoverContent({
  label,
  side = "bottom",
  align = "start",
  sideOffset = 8,
  size = "md",
  padded = true,
  solid,
  collisionBoundary,
  children,
}: PopoverContentProps) {
  const { open } = useContext(PopoverState);
  const { compact } = useDevice();
  if (compact) {
    return (
      <Sheet open={open} label={label} padded={padded} solid={solid}>
        {children}
      </Sheet>
    );
  }
  return (
    <RadixPopover.Portal forceMount>
      <AnimatePresence>
        {open && (
          <Surface
            key="popover"
            label={label}
            side={side}
            align={align}
            sideOffset={sideOffset}
            size={size}
            padded={padded}
            solid={solid}
            collisionBoundary={collisionBoundary}
          >
            {children}
          </Surface>
        )}
      </AnimatePresence>
    </RadixPopover.Portal>
  );
}

/* ------------------------------------------------------------ the phone sheet */

/**
 * The popover on a phone: DialogSheet with a heading, the body and a close button. Same grid areas as the Dialog,
 * so the heading and the close button sit exactly where a Dialog's do.
 */
function Sheet({
  open,
  label,
  padded,
  solid,
  children,
}: Pick<PopoverContentProps, "label" | "padded" | "solid" | "children"> & { open: boolean }) {
  const { change } = useContext(PopoverState);
  const panel = useRef<HTMLDivElement | null>(null);
  const [overFloating, setOverFloating] = useState(false);
  const flat = solid ?? overFloating;
  return (
    <DialogSheet
      open={open}
      onDismiss={() => change(false)}
      onOpenAutoFocus={(e) => {
        /* Fine pointers: the marked control, else Radix's first focusable. A coarse pointer is handled by the sheet. */
        const target = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
        if (!target) return;
        e.preventDefault();
        target.focus({ preventScroll: true });
      }}
      described={false}
      contentRef={panel}
      className={flat ? "[--litt-glass-bg:var(--litt-surface-2)] [--litt-glass-shadow:var(--litt-shadow-float)]" : ""}
    >
      <SheetParts label={label} padded={padded ?? true} onFloating={setOverFloating}>
        {children}
      </SheetParts>
    </DialogSheet>
  );
}

function SheetParts({
  label,
  padded,
  onFloating,
  children,
}: {
  label: string;
  padded: boolean;
  onFloating: (floating: boolean) => void;
  children: ReactNode;
}) {
  const marker = useRef<HTMLSpanElement | null>(null);
  /* Is the trigger inside another floating surface? The Dialog's trigger has aria-controls = this sheet's id, so find
     it from the panel this renders in, before the first paint. */
  useLayoutEffect(() => {
    const id = marker.current?.closest<HTMLElement>('[role="dialog"]')?.id;
    const trigger = id ? document.querySelector(`[aria-controls="${CSS.escape(id)}"]`) : null;
    onFloating(Boolean(trigger?.closest(FLOATING)));
  }, [onFloating]);

  return (
    <>
      <span ref={marker} hidden />
      <div className="grid content-start pt-6 pr-4 pl-6" style={{ gridArea: "head" }}>
        <RadixDialog.Title className="text-litt-h4 text-litt-fg text-balance">{label}</RadixDialog.Title>
      </div>

      <div
        className={"min-h-0 overflow-y-auto overscroll-contain pt-6 pb-(--sheet-foot) " + (padded ? "px-6" : "px-3")}
        style={{ gridArea: "body" }}
      >
        {children}
      </div>

      <div className="self-start pt-6 pr-4" style={{ gridArea: "close" }}>
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
    </>
  );
}

/** The animated surface. */
function Surface({
  label,
  side,
  align,
  sideOffset,
  size,
  padded,
  solid,
  collisionBoundary,
  children,
}: Required<Pick<PopoverContentProps, "label" | "side" | "align" | "sideOffset" | "size" | "padded">> &
  Pick<PopoverContentProps, "solid" | "collisionBoundary" | "children">) {
  const enter = useTransition("responsive");
  const exit = useExit("responsive");
  const travel = useTravel();
  const latest = useRef(enter);
  latest.current = enter;

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const el = useRef<HTMLDivElement | null>(null);
  /* null until Radix has placed the panel; then the side it really opened on. */
  const [placed, setPlaced] = useState<Side | null>(null);
  /* Is the trigger inside another floating surface? Radix gives the trigger aria-controls = this
     panel's id while it is open, so find it from there, before the first paint. */
  const [overFloating, setOverFloating] = useState(false);

  useLayoutEffect(() => {
    const id = el.current?.id;
    const trigger = id ? document.querySelector(`[aria-controls="${CSS.escape(id)}"]`) : null;
    setOverFloating(Boolean(trigger?.closest(FLOATING)));
  }, []);

  /* A quarter of the travel, starting nearer the trigger than the resting place. */
  const offset = (s: Side) => {
    const d = travel / 4;
    return { x: s === "left" ? d : s === "right" ? -d : 0, y: s === "top" ? d : s === "bottom" ? -d : 0 };
  };

  const onPlaced = () => {
    const s = (el.current?.dataset.side as Side | undefined) ?? "bottom";
    const o = offset(s);
    x.jump(o.x);
    y.jump(o.y);
    setPlaced(s);
  };

  useEffect(() => {
    if (!placed) return;
    animate(x, 0, latest.current);
    animate(y, 0, latest.current);
  }, [placed, x, y]);

  const out = offset(placed ?? side);

  /* Radix forwards onPlaced to its popper, but the popover types omit it. */
  const placedProp = { onPlaced } as Record<string, unknown>;

  const flat = solid ?? overFloating;
  const surface =
    "relative z-50 max-w-(--radix-popover-content-available-width) rounded-litt-surface p-1 outline-none " +
    "origin-(--radix-popover-content-transform-origin) data-[state=closed]:pointer-events-none " +
    WIDTH[size] +
    (flat ? " bg-litt-surface-2 shadow-litt-float" : " litt-glass");

  return (
    <RadixPopover.Content
      forceMount
      {...asChildProps}
      aria-label={label}
      side={side}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={8}
      collisionBoundary={collisionBoundary ?? undefined}
      onOpenAutoFocus={(e) => {
        const target = el.current?.querySelector<HTMLElement>("[data-autofocus]");
        if (!target) return;
        e.preventDefault();
        target.focus({ preventScroll: true });
      }}
      {...placedProp}
    >
      <motion.div
        ref={el}
        data-popover-surface=""
        className={surface}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: placed ? 1 : 0, scale: placed ? 1 : 0.98, transition: enter }}
        exit={{ opacity: 0, scale: 0.98, x: out.x, y: out.y, transition: exit }}
        style={{ x, y }}
      >
        <div
          className={
            "max-h-[calc(var(--radix-popover-content-available-height)-0.5rem)] overflow-y-auto overscroll-contain rounded-litt-control" +
            (padded ? " p-3" : "")
          }
        >
          {children}
        </div>
      </motion.div>
    </RadixPopover.Content>
  );
}
