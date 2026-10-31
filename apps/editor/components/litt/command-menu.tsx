"use client";
// @litt/command-menu 2026.10.25. What changed: https://littmd.vercel.app/changelog.md

/**
 * Command menu: ⌘K search over pages, projects and actions.
 *
 * - Overlay, focus trap and Esc come from @radix-ui/react-dialog. The panel is
 *   floating glass with the modal shadow, rounded-litt-surface, max width 560, 15dvh
 *   from the top. Rows and their highlight are rounded-litt-control inside a 4px
 *   list inset, so the corners stay concentric.
 * - The list is the combobox + listbox pattern: DOM focus stays in the input
 *   and aria-activedescendant names the highlighted option. Rows never take
 *   focus (mousedown is prevented), so the caret never leaves the field.
 * - The first enabled row is always highlighted. Arrows move and wrap, skipping
 *   disabled rows. Enter fires only on the highlighted row. Escape clears a
 *   non-empty query first and closes when it is empty. Every handler returns
 *   early while an IME is composing. Pointer leave keeps the highlight.
 * - Filtering keeps the original order and shows a designed empty state.
 * - Motion, responsive tier: the panel fades, drops half the travel and scales
 *   0.98 to 1; the overlay fades on opacity only; exits use useExit. Typing
 *   changes the list instantly and the panel's height is never animated: the
 *   list has a max height and scrolls inside. The gliding highlight is glide.tsx.
 * - The panel body (CommandPanel) renders without the dialog too, for a static preview.
 * - Compact screens (useDevice().compact, foundations.md section 6): the panel moves
 *   to the top edge, --litt-space-2 below the safe-area inset and --litt-space-2 from each side,
 *   not 15dvh down. The wrapper takes the position and height of window.visualViewport
 *   (resize and scroll events), so the list is the visible screen less the keyboard and
 *   no row hides behind it. Before the first read, and without a visual viewport, 100dvh
 *   stands in. The motion is the same responsive drop. It is not draggable, because the
 *   list scrolls. Nothing else moves; the panel's height is still never animated.
 * - Coarse pointers (useDevice().coarse): the placeholder is shorter beside Cancel (a focused field
 *   clips instead of ellipsizing), the footer hints (arrows, enter, esc) and the
 *   row shortcuts are gone, and a Cancel button (--litt-control-md tall) sits beside the field
 *   when onCancel is given; CommandMenu always gives it. The field keeps the focus, as it
 *   is the first thing in the dialog that takes it, because typing is the point. Both
 *   signals come from useDevice, so <DeviceProvider mode="phone"> previews them.
 */
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { useDevice, useExit, useTransition, useTravel, useVisibleScreen } from "../../lib/litt/motion";
import { Button } from "./button";
import { SearchIcon } from "./icons";
import { Kbd } from "./kbd";
import { GLIDE_ROW, useGlide, type GlideSource } from "../../lib/litt/glide";

/* Radix's asChild, spread in: shadcn's CLI rewrites a written asChild to Base UI's render prop in base-* hosts. */
const asChildProps = { asChild: true } as const;

/** One row. The search matches its label. */
export type CommandItem = {
  /** Unique across every group, because it names the row for assistive tech. */
  id: string;
  /** The row text, and what the search matches. */
  label: string;
  /** 16px icon in a fixed cell before the label. */
  icon?: ReactNode;
  /** Mono hint on the right, for example ⌘N. It is a hint only: it does not bind the key. */
  shortcut?: string;
  /** Dims the row. It is never lit and Enter and clicks skip it. */
  disabled?: boolean;
};
/** A heading and its rows. A group with no match for the query is hidden. */
export type CommandGroup = {
  /** Unique among the groups. */
  id: string;
  /** The group label above its rows. */
  heading: string;
  items: CommandItem[];
};

type Section = { id: string; heading: string; rows: (CommandItem & { index: number })[] };

/** Keeps the original order. Matches the label, ignoring case. */
function filter(groups: CommandGroup[], query: string) {
  const q = query.trim().toLowerCase();
  const flat: CommandItem[] = [];
  const sections: Section[] = [];
  for (const g of groups) {
    const rows: Section["rows"] = [];
    for (const item of g.items) {
      if (q && !item.label.toLowerCase().includes(q)) continue;
      rows.push({ ...item, index: flat.length });
      flat.push(item);
    }
    if (rows.length) sections.push({ id: g.id, heading: g.heading, rows });
  }
  return { sections, flat };
}

const firstEnabled = (items: CommandItem[]) => items.findIndex((i) => !i.disabled);

function Hint({ keys, children }: { keys: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Kbd>{keys}</Kbd>
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ----------------------------------------------------------------- panel */

export type CommandPanelProps = {
  /** What to search, in order. A group is { id, heading, items } and an item is { id, label, icon?, shortcut?, disabled? }. */
  groups: CommandGroup[];
  /** The text in the search field. You own it, so you can preset or clear it. */
  query: string;
  /** Called with the new text on each keystroke, and with "" when Esc clears the field. */
  onQueryChange: (query: string) => void;
  /** Called with the item when a row is chosen with Enter or a click. */
  onSelect: (item: CommandItem) => void;
  /** How the panel came up. A keyboard open shows the ring on the first row at once. */
  initialSource?: GlideSource;
  /** Focuses the search field when the panel mounts. CommandMenu does not need it, because the dialog focuses the field itself. */
  autoFocus?: boolean;
  /** Called by the Cancel button beside the field, which shows on touch screens only. CommandMenu closes with it. Leave it out and no button shows. */
  onCancel?: () => void;
};

/** Input, list and footer. The caller supplies the surface around it; CommandMenu wraps it in a dialog. */
export function CommandPanel({ groups, query, onQueryChange, onSelect, initialSource = "keyboard", autoFocus, onCancel }: CommandPanelProps) {
  const { coarse } = useDevice();
  const uid = useId();
  const listId = `${uid}-list`;
  const { sections, flat } = useMemo(() => filter(groups, query), [groups, query]);

  /* The highlighted row. Null means "the first enabled row", which is where every
     new query starts (adjusted during render, so there is no stale frame). */
  const [pick, setPick] = useState<number | null>(null);
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setPick(null);
  }
  const [source, setSource] = useState<GlideSource>(initialSource);
  const picked = pick !== null && flat[pick] && !flat[pick].disabled ? pick : -1;
  const current = picked >= 0 ? picked : firstEnabled(flat);
  const active = current >= 0 ? flat[current] : undefined;

  const glide = useGlide({
    scroll: true,
    keepOnLeave: true,
    onPointerRow: (index, _row, type) => {
      setPick(index);
      setSource(type === "touch" ? "touch" : "pointer");
    },
  });

  /* The glide follows the state. A list change snaps; a move glides. */
  const { setActive } = glide;
  const prevFlat = useRef(flat);
  useLayoutEffect(() => {
    const changed = prevFlat.current !== flat;
    prevFlat.current = flat;
    setActive(current >= 0 ? current : null, source, { jump: changed });
  }, [current, source, flat, setActive]);

  const move = (dir: 1 | -1) => {
    const enabled = flat.flatMap((it, i) => (it.disabled ? [] : [i]));
    if (!enabled.length) return;
    const at = enabled.indexOf(current);
    const next = at < 0 ? enabled[dir === 1 ? 0 : enabled.length - 1] : enabled[(at + dir + enabled.length) % enabled.length];
    setPick(next);
    setSource("keyboard");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active && !active.disabled) onSelect(active);
    } else if (e.key === "Escape" && query) {
      e.preventDefault();
      e.stopPropagation();
      onQueryChange("");
    }
  };

  const optionId = (item: CommandItem) => `${uid}-opt-${item.id}`;

  return (
    <>
      <div
        className={
          "flex h-13 shrink-0 items-center gap-3 border-b border-[var(--litt-glass-border)] " + (coarse && onCancel ? "pl-4 pr-1" : "px-4")
        }
      >
        <SearchIcon className="shrink-0 text-litt-fg-subtle" />
        <input
          role="combobox"
          aria-label="Search pages, projects and actions"
          aria-expanded={flat.length > 0}
          aria-controls={flat.length > 0 ? listId : undefined}
          aria-activedescendant={active ? optionId(active) : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          value={query}
          placeholder={coarse && onCancel ? "Search pages and actions" : "Search pages, projects and actions"}
          onChange={(e) => {
            onQueryChange(e.target.value);
            setSource("keyboard");
          }}
          onKeyDown={onKeyDown}
          className="h-full min-w-0 flex-1 truncate bg-transparent text-litt-body text-litt-fg outline-none placeholder:text-litt-fg-subtle pointer-coarse:text-(length:--litt-control-text-lg)"
        />
        {coarse && onCancel && (
          <Button variant="ghost" size="md" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {flat.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Results"
          ref={glide.ref}
          {...glide.props}
          onMouseDown={(e) => e.preventDefault()}
          className="relative max-h-[var(--cmd-list-max,min(55dvh,22rem))] min-h-0 overflow-y-auto overscroll-contain p-1"
        >
          {glide.highlight}
          {sections.map((s) => (
            <div key={s.id} role="group" aria-labelledby={`${uid}-g-${s.id}`}>
              <div id={`${uid}-g-${s.id}`} className="flex h-litt-control-sm items-center px-3 text-litt-caption text-litt-fg-subtle">
                {s.heading}
              </div>
              {s.rows.map((r) => (
                <div
                  key={r.id}
                  id={optionId(r)}
                  role="option"
                  aria-selected={r.index === current}
                  aria-disabled={r.disabled || undefined}
                  data-active={r.index === current || undefined}
                  {...GLIDE_ROW}
                  onClick={() => !r.disabled && onSelect(r)}
                  className="relative flex h-litt-control-md scroll-mt-8 scroll-mb-1 cursor-pointer items-center gap-3 rounded-litt-control px-3 text-litt-small text-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt data-[active]:text-litt-fg aria-disabled:cursor-not-allowed aria-disabled:text-litt-fg-disabled"
                >
                  {r.icon !== undefined && <span className="grid size-4 shrink-0 place-items-center">{r.icon}</span>}
                  <span className="min-w-0 truncate">{r.label}</span>
                  {r.shortcut && !coarse && <span className="ml-auto shrink-0 pl-4 text-litt-caption font-normal text-litt-fg-subtle">{r.shortcut}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div role="status" className="grid justify-items-center gap-2 px-6 py-12 text-center">
          <SearchIcon className="text-litt-fg-subtle" />
          <p className="max-w-full break-words text-litt-small font-litt-title text-litt-fg">No results for “{query.trim()}”</p>
          <p className="text-litt-caption font-normal text-litt-fg-subtle">Check the spelling, or try a project name.</p>
        </div>
      )}

      {/* A container query, not a viewport one: the same panel is 358 wide in the dialog and 295 in a card.
          Under 24rem the arrow hint goes first, since the Enter hint says what will happen.
          On a touch screen every hint here is a keyboard one, so the whole footer goes. */}
      {!coarse && (
        <div className="@container shrink-0 border-t border-[var(--litt-glass-border)]">
          <div className="flex h-10 items-center gap-4 px-4 text-litt-caption text-litt-fg-subtle">
            <span className="flex @max-sm:hidden">
              <Hint keys="↑↓">to move</Hint>
            </span>
            {active && <Hint keys="↵">to open {active.label}</Hint>}
            <span className="ml-auto flex shrink-0">
              <Hint keys="esc">to close</Hint>
            </span>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- dialog */

export type CommandMenuProps = {
  /** Whether the menu is showing. You own it, so a trigger button and useCommandShortcut can both set it. */
  open: boolean;
  /** Called with false when the menu asks to close: Esc on an empty field, a click on the backdrop, or a chosen row. It never asks to open, so your trigger and useCommandShortcut set that. */
  onOpenChange: (open: boolean) => void;
  /** What to search, in order. A group is { id, heading, items } and an item is { id, label, icon?, shortcut?, disabled? }. */
  groups: CommandGroup[];
  /** Called with the chosen item, and then the menu closes itself. */
  onSelect: (item: CommandItem) => void;
  /** Keyboard (the shortcut, Enter on the trigger) or pointer. Decides whether the first row shows the ring at once. */
  openedBy?: "keyboard" | "pointer";
};

/** The dialog form. Overlay, focus trap and Esc come from Radix Dialog, and the query starts empty on every open. */
export function CommandMenu({ open, onOpenChange, groups, onSelect, openedBy = "keyboard" }: CommandMenuProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && <Body key="body" groups={groups} onSelect={onSelect} onClose={() => onOpenChange(false)} openedBy={openedBy} />}
      </AnimatePresence>
    </Dialog.Root>
  );
}

/* Mounted once per open, so the query starts empty and survives the exit animation. */
function Body({
  groups,
  onSelect,
  onClose,
  openedBy,
}: {
  groups: CommandGroup[];
  onSelect: (item: CommandItem) => void;
  onClose: () => void;
  openedBy: "keyboard" | "pointer";
}) {
  const enter = useTransition("responsive");
  const exit = useExit("responsive");
  const travel = useTravel();
  const { compact } = useDevice();
  const visible = useVisibleScreen(compact);
  const [query, setQuery] = useState("");
  /* There is no Dialog.Trigger (the page owns the button and the shortcut), so give focus back ourselves. */
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  return (
    <Dialog.Portal forceMount>
      <Dialog.Overlay {...asChildProps}>
        <motion.div
          className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--litt-canvas)_55%,transparent)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: enter }}
          exit={{ opacity: 0, transition: exit }}
        />
      </Dialog.Overlay>
      {/* Desktop: 15dvh down, --litt-space-4 from each side. Compact: the top edge of the visible screen, --litt-space-2 below
          the safe-area inset and from each side. The wrapper IS the visible screen (visualViewport), so the panel's
          max-h-full is the visible screen less the keyboard and the gaps. */}
      <div
        className={
          compact
            ? "pointer-events-none fixed inset-x-0 top-0 z-50 flex h-dvh items-start justify-center px-(--litt-space-2) pt-[calc(env(safe-area-inset-top)+var(--litt-space-2))] pb-(--litt-space-2)"
            : "pointer-events-none fixed inset-x-0 top-[15dvh] z-50 flex justify-center px-4"
        }
        style={compact && visible ? { top: visible.top, height: visible.height } : undefined}
      >
        <Dialog.Content
          {...asChildProps}
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener?.focus?.({ preventScroll: true });
          }}
          onEscapeKeyDown={(e) => {
            /* Composing an IME word: Esc cancels the composition, not the menu. */
            if (e.isComposing) return e.preventDefault();
            /* A non-empty query clears first; the menu closes on the next Esc. */
            if (query) {
              e.preventDefault();
              setQuery("");
            }
          }}
        >
          <motion.div
            className={
              "litt-glass pointer-events-auto w-full max-w-140 origin-top rounded-litt-surface outline-none [--litt-glass-shadow:var(--litt-shadow-modal)]" +
              (compact ? " flex max-h-full flex-col [--cmd-list-max:none]" : "")
            }
            initial={{ opacity: 0, y: -travel / 2, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: enter }}
            exit={{ opacity: 0, scale: 0.98, transition: exit }}
          >
            <Dialog.Title className="sr-only">Command menu</Dialog.Title>
            <CommandPanel
              groups={groups}
              query={query}
              onQueryChange={setQuery}
              initialSource={openedBy}
              onCancel={onClose}
              onSelect={(item) => {
                onSelect(item);
                onClose();
              }}
            />
          </motion.div>
        </Dialog.Content>
      </div>
    </Dialog.Portal>
  );
}

/**
 * ⌘K or Ctrl+K. Call it from the page that owns the menu: the listener lives only while that page is mounted.
 *
 * @param toggle - Runs when the shortcut is pressed. Flip your open state here. It always sees the latest render, so it needs no memo.
 */
export function useCommandShortcut(toggle: () => void) {
  const latest = useRef(toggle);
  latest.current = toggle;
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.isComposing) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
