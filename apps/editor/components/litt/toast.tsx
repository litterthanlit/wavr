"use client";
// @litt/toast 2026.10.24. What changed: https://littmd.vercel.app/changelog.md

/**
 * Toast: custom, no Radix. The other half of the expressive moment.
 *
 * - <Toaster> is a provider plus a portal. Mount it once around the part of the
 *   app that fires toasts; children call useToast(). A bare toast() also works
 *   and routes to the Toaster mounted last.
 * - Look: litt-glass (float shadow), rounded-litt-surface, 360px, fixed height (72px)
 *   so the stack math is plain arithmetic. No status dot: an error's title is
 *   --litt-danger, the rest are --litt-fg, and the words say the rest. A small ghost action and
 *   a round close button.
 * - Stack: the newest is in front. Older toasts sit behind, 8px and 16px up,
 *   scaled 0.96 and 0.92, fading. Beyond three they wait out of sight and move
 *   up as space frees. Hover or keyboard focus expands the stack into a list.
 *   Only transform and opacity move, never height or top.
 * - Motion: entering is expressive (from below by useTravel(), scale 0.98 to 1).
 *   Restacking is responsive. Exiting is useExit("expressive"): x by travel
 *   toward the right edge, fading, never bouncing.
 * - Behavior: auto-dismiss after 5s (the spec), errors stay. Paused while hovered,
 *   focused, held by a finger or when the tab is hidden. Escape dismisses the
 *   focused toast. F8 moves focus to the newest toast. Each toast is its own live
 *   region: polite, or assertive for errors.
 * - Touch: there is no hover, so tapping the stack pins it open; tap outside to
 *   close it again.
 *
 * On phones and touch (foundations.md section 6; both signals come from useDevice,
 * so <DeviceProvider mode="phone"> previews them on a desktop):
 * - compact (narrower than 640): the stack spans the page gutters and sits
 *   --litt-space-4 above the bottom edge or the safe-area inset. A toast that leaves
 *   by itself (timeout, close, Esc) drops by --litt-travel instead of going sideways.
 * - compact, while a bottom sheet is open (useSheetOpen): the stack docks at the top
 *   edge instead, --litt-space-2 below the safe-area inset where the command menu sits,
 *   so it never covers the sheet's buttons. It arrives from above, older toasts peek
 *   below the newest, and a timeout lifts it by --litt-travel. The stack picks its edge
 *   when its first toast arrives and keeps it until it empties, so a toast never
 *   jumps between edges when the sheet closes.
 * - coarse (a finger): the front toast follows a sideways drag one to one, through
 *   useDismissDrag. Past --litt-dismiss-distance of its width, or faster than
 *   --litt-dismiss-velocity, it carries on the way it was going on the exit token;
 *   otherwise it springs back. The dismiss button stays and is 44px, so a swipe is
 *   never the only way. Fine pointers get no drag.
 *
 * Fun mode (motion/fun.tsx, a trial, off unless a <FunMode> is on): a mouse can throw the front toast away too, and
 * a thrown toast leaves with the speed it was let go at, on fun mode's throw spring, as it fades. One let go short
 * springs back with a little life. The close button is still there. Reduced motion turns it off.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { useDevice, useFun, useSheetOpen, useTransition, useTravel } from "../../lib/litt/motion";
import { useDismissDrag, type DismissInfo } from "../../lib/litt/motion/drag";
import { Button } from "./button";
import { XIcon } from "./icons";

export type ToastTone = "neutral" | "success" | "error";

export type ToastOptions = {
  /** The message. Keep it to a few words: it is one line, or two when there is no description. */
  title: ReactNode;
  /** A second line in a quieter color, cut to one line. */
  description?: ReactNode;
  /** "neutral" (the default), "success" or "error". An error's title is the danger color; errors are announced at once and stay until dismissed. */
  tone?: ToastTone;
  /** A small button on the right, such as Undo or View. Pressing it runs onClick and then dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /** Milliseconds before it dismisses itself. The default is 5000, and errors stay unless you set it. 0 or Infinity stays until dismissed. */
  duration?: number;
};

type ToastItem = ToastOptions & { id: string };

type ToastApi = {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

/* Stack geometry. Fixed height keeps every position a sum of constants. */
const MAX_VISIBLE = 3;
const HEIGHT = 72;
const GAP = 8;
const PEEK = 8;
const SCALES = [1, 0.96, 0.92];
const FADES = [1, 0.8, 0.55];
const AUTO_DISMISS_MS = 5000;

/* Where a toast sits in the stack. Docked at the bottom, older toasts go up; docked at the top, they go down. */
function slotFor(depth: number, expanded: boolean, top: boolean) {
  const d = Math.min(depth, MAX_VISIBLE - 1);
  const away = depth >= MAX_VISIBLE;
  const way = top ? 1 : -1;
  return expanded
    ? { y: way * d * (HEIGHT + GAP), scale: 1, opacity: away ? 0 : 1 }
    : { y: way * d * PEEK, scale: SCALES[d], opacity: away ? 0 : FADES[d] };
}

const ToastContext = createContext<ToastApi | null>(null);

/** Toasters that are mounted, newest last. toast() talks to the last one. */
const sinks: Array<(options: ToastOptions) => string> = [];

/**
 * Fire a toast from anywhere, without a hook. It goes to the Toaster mounted last, and does nothing
 * (it returns an empty string) when no Toaster is mounted.
 *
 * @param options What to show. Only the title is required.
 * @returns An id you can pass to dismiss().
 */
export function toast(options: ToastOptions): string {
  return sinks[sinks.length - 1]?.(options) ?? "";
}

/**
 * The Toaster's controls: toast(options) shows a toast and returns its id, dismiss(id) removes one, and
 * dismissAll() clears the stack. Use it inside a Toaster, or it throws.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <Toaster>");
  return api;
}

/* False while a server renders and while the client hydrates, true after, so the portal never causes a hydration mismatch. */
const subscribeNever = () => () => {};

/**
 * Holds the toasts and draws them in a corner of the screen, above everything else. Mount it once, around
 * the part of the app that fires toasts. A Toaster inside another one adds nothing: its toasts go to the outer one,
 * so a page that nests them (a section that brings its own) still has one stack and one Notifications region.
 */
export function Toaster({
  children,
}: {
  /** The part of the app that fires toasts. It renders as it is; the toasts themselves are drawn in a portal on the page body. */
  children?: ReactNode;
}) {
  const outer = useContext(ToastContext);
  return outer ? <>{children}</> : <ToasterRoot>{children}</ToasterRoot>;
}

function ToasterRoot({ children }: { children?: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false);
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((options: ToastOptions) => {
    const id = `toast-${++counter.current}`;
    setItems((list) => [...list, { ...options, id }]);
    return id;
  }, []);
  const dismiss = useCallback((id: string) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const dismissAll = useCallback(() => setItems([]), []);

  useEffect(() => {
    sinks.push(push);
    return () => {
      const at = sinks.indexOf(push);
      if (at >= 0) sinks.splice(at, 1);
    };
  }, [push]);

  const api = useMemo<ToastApi>(() => ({ toast: push, dismiss, dismissAll }), [push, dismiss, dismissAll]);

  return (
    <ToastContext value={api}>
      {children}
      {mounted && createPortal(<ToastRegion items={items} dismiss={dismiss} />, document.body)}
    </ToastContext>
  );
}

function ToastRegion({ items, dismiss }: { items: ToastItem[]; dismiss: (id: string) => void }) {
  const { compact, coarse } = useDevice();
  /* The edge is chosen while the stack is empty and kept until it empties again, so a toast never jumps. */
  const sheetOpen = useSheetOpen();
  const overSheet = compact && sheetOpen;
  const [docked, setDocked] = useState(overSheet);
  if (items.length === 0 && docked !== overSheet) setDocked(overSheet);
  const top = compact && docked;
  const regionRef = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [hover, setHover] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const [kbd, setKbd] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tabHidden, setTabHidden] = useState(() => document.visibilityState === "hidden");

  const expanded = hover || kbd || pinned;
  const paused = hover || focusIn || pinned || tabHidden;
  const count = Math.min(items.length, MAX_VISIBLE);
  const height = count === 0 ? 0 : expanded ? count * HEIGHT + (count - 1) * GAP : HEIGHT + (count - 1) * PEEK;

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* A removed element fires no blur and no pointerleave, so re-read the truth. */
  const syncFocus = useCallback(() => {
    const region = regionRef.current;
    const active = document.activeElement;
    const inside = !!region && !!active && region.contains(active);
    setFocusIn(inside);
    setKbd(inside && !!active && active.matches(":focus-visible"));
  }, []);

  useEffect(() => {
    syncFocus();
    if (items.length === 0) {
      setHover(false);
      setPinned(false);
    }
  }, [items.length, syncFocus]);

  /* F8 jumps to the newest toast, the way Radix does. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F8" || items.length === 0) return;
      e.preventDefault();
      const newest = items[items.length - 1];
      regionRef.current?.querySelector<HTMLElement>(`[data-toast-id="${newest.id}"] button`)?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items]);

  /* On touch the stack opens by tap and closes by tapping elsewhere. */
  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!regionRef.current?.contains(e.target as Node)) setPinned(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pinned]);

  return (
    <section
      ref={regionRef}
      aria-label="Notifications"
      className={
        "fixed z-60 " +
        (top
          ? "inset-x-litt-gutter top-[calc(var(--litt-space-2)+env(safe-area-inset-top,0px))] mx-auto max-w-[40rem] "
          : compact
            ? "inset-x-litt-gutter bottom-[calc(var(--litt-space-4)+env(safe-area-inset-bottom,0px))] mx-auto max-w-[40rem] "
            : "right-6 bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] w-90 ") +
        (count === 0 ? "pointer-events-none" : "")
      }
      style={{ height }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
      onFocus={(e) => {
        const from = e.relatedTarget as HTMLElement | null;
        if (from && !e.currentTarget.contains(from)) returnFocus.current = from;
        setFocusIn(true);
        setKbd(e.target.matches(":focus-visible"));
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocusIn(false);
          setKbd(false);
        }
      }}
      onClick={(e) => {
        if (coarse && items.length > 1 && !(e.target as HTMLElement).closest("button")) setPinned((p) => !p);
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        const id = (e.target as HTMLElement).closest<HTMLElement>("[data-toast-id]")?.dataset.toastId;
        if (!id) return;
        const rest = items.filter((t) => t.id !== id);
        dismiss(id);
        const next = rest[rest.length - 1];
        requestAnimationFrame(() => {
          const target = next && regionRef.current?.querySelector<HTMLElement>(`[data-toast-id="${next.id}"] button`);
          (target || returnFocus.current)?.focus();
        });
      }}
    >
      <AnimatePresence onExitComplete={syncFocus}>
        {items.map((item, i) => (
          <ToastView
            key={item.id}
            item={item}
            depth={items.length - 1 - i}
            expanded={expanded}
            paused={paused}
            top={top}
            onDismiss={dismiss}
          />
        ))}
      </AnimatePresence>
    </section>
  );
}

function ToastView({
  item,
  depth,
  expanded,
  paused,
  top,
  onDismiss,
}: {
  item: ToastItem;
  depth: number;
  expanded: boolean;
  paused: boolean;
  top: boolean;
  onDismiss: (id: string) => void;
}) {
  const { compact, coarse } = useDevice();
  const enter = useTransition("expressive");
  const move = useTransition("responsive");
  const travel = useTravel();
  const settled = useRef(false);
  const node = useRef<HTMLDivElement>(null);
  /* The way a swipe sent this toast. A timeout, the close button and Esc leave it null: they drop on compact
     screens and go right elsewhere. */
  const swiped = useRef<"left" | "right" | null>(null);
  /* Fun mode: how fast the swipe was going when it let go, in px/ms, so the toast leaves at that speed. */
  const thrown = useRef(0);
  const fun = useFun();
  const [held, setHeld] = useState(false);

  const tone = item.tone ?? "neutral";
  const away = depth >= MAX_VISIBLE;
  const slot = slotFor(depth, expanded, top);
  /* Arrivals and timeouts come from, and go back to, the edge the stack is docked at. */
  const edge = top ? -travel : travel;
  const showContent = depth === 0 || expanded;

  /* A finger swipes a toast sideways, one to one. It is off for a mouse, which has the close button, except in fun
     mode, where a mouse can throw it too. */
  const drag = useDismissDrag({
    direction: "sideways",
    tier: "expressive",
    enabled: coarse || !!fun,
    onDismiss: (info: DismissInfo) => {
      swiped.current = info.direction === "down" ? null : info.direction;
      thrown.current = info.velocity;
      onDismiss(item.id);
    },
  });

  /* A finger resting on a toast holds its clock, so it never leaves under the thumb. */
  useEffect(() => {
    if (!held) return;
    const release = () => setHeld(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, [held]);

  const wanted = item.duration ?? (tone === "error" ? Infinity : AUTO_DISMISS_MS);
  const persistent = !Number.isFinite(wanted) || wanted <= 0;
  const remaining = useRef(persistent ? 0 : wanted);
  const idle = persistent || paused || away || held;

  /* The clock only runs while the toast is visible and nobody is reading it. */
  useEffect(() => {
    if (idle) return;
    const started = performance.now();
    const timer = window.setTimeout(() => onDismiss(item.id), Math.max(remaining.current, 0));
    return () => {
      window.clearTimeout(timer);
      remaining.current -= performance.now() - started;
    };
  }, [idle, item.id, onDismiss]);

  return (
    <motion.div
      ref={node}
      {...drag.panel}
      data-toast-id={item.id}
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      inert={away}
      className={"litt-glass absolute inset-x-0 h-18 rounded-litt-surface " + (top ? "top-0 origin-bottom" : "bottom-0 origin-top")}
      onPointerDown={(e) => {
        /* Only a toast that shows its content can be swiped; the ones peeking from behind wait their turn. */
        if (!showContent) return;
        drag.onPointerDown(e);
        if (coarse) setHeld(true);
      }}
      initial={{ opacity: 0, y: slot.y + edge, scale: 0.98 }}
      animate={{ opacity: slot.opacity, y: slot.y, scale: slot.scale, transition: settled.current ? move : enter }}
      variants={{
        /* Read when the exit starts: a swipe carries on one more toast width from where the finger let go, a
           timeout drops (or, docked at the top, lifts) by the travel token on compact screens, and everywhere else
           the toast goes right. */
        leave: () => {
          if (swiped.current) {
            const now = drag.offset.get() as unknown;
            const from = typeof now === "number" ? now : 0;
            const by = node.current?.offsetWidth ?? 0;
            const to = from + (swiped.current === "left" ? -by : by);
            if (fun) {
              /* Fun mode: it carries the speed it was thrown at, the way it was going, and fades on the exit token. */
              const velocity = (swiped.current === "left" ? -1 : 1) * thrown.current * 1000;
              return { opacity: 0, x: to, transition: { x: { ...fun.throw, velocity }, opacity: drag.exit } };
            }
            return { opacity: 0, x: to, transition: drag.exit };
          }
          return compact
            ? { opacity: 0, y: slot.y + edge, transition: drag.exit }
            : { opacity: 0, x: travel, transition: drag.exit };
        },
      }}
      exit="leave"
      onAnimationComplete={() => {
        settled.current = true;
      }}
    >
      <motion.div
        className="flex h-full items-center gap-3 px-4"
        initial={false}
        animate={{ opacity: showContent ? 1 : 0, transition: move }}
      >
        <div className="min-w-0 flex-1">
          <p className={"text-litt-small font-litt-title " + (tone === "error" ? "text-litt-danger " : "text-litt-fg ") + (item.description ? "truncate" : "line-clamp-2")}>{item.title}</p>
          {item.description && <p className="truncate text-litt-caption font-normal text-litt-fg-subtle">{item.description}</p>}
        </div>
        {item.action && (
          <Button
            size="sm"
            variant="ghost"
            className="pointer-coarse:h-litt-control-md"
            onClick={() => {
              item.action?.onClick();
              onDismiss(item.id);
            }}
          >
            {item.action.label}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          aria-label="Dismiss notification"
          className="pointer-coarse:-mr-1.5 pointer-coarse:h-litt-control-md pointer-coarse:w-litt-control-md"
          onClick={() => onDismiss(item.id)}
        >
          <XIcon />
        </Button>
      </motion.div>
    </motion.div>
  );
}
