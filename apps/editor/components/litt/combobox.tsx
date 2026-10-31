"use client";
// @litt/combobox 2026.10.27. What changed: https://littmd.vercel.app/changelog.md

/**
 * Combobox: type to find one value, or several, in a long list (components.md, "Combobox"): a client, a
 * framework, a teammate. Select is for a short fixed list, and Command menu is for actions.
 *
 * - Field: the Input's cut (R3: the --litt-cut floor, the control line and the top wall's shade) and sizes (sm 32, md 44,
 *   lg 56; 16px text on coarse pointers, where sm grows to 44), with the same focus line and ring, error line and
 *   flat disabled look. The text is the query. A 16px chevron button in
 *   --litt-fg-subtle sits at the end, --litt-control-gap from the text, and opens and closes the list; it never turns.
 *   The label sits above and the hint or error under it, wired as TextField's are.
 * - List: anchored under the field and flipped above it when there is no room, as wide as the field. It is the
 *   Menu's panel: glass at the surface radius with the 4px inset, 44px rows at the control radius, one gliding
 *   highlight (glide.tsx), and the picked option's 16px check in a fixed cell at the row's start, so labels never
 *   shift. Group labels are the Menu's. At most eight rows show, then it scrolls inside. With no match a quiet row
 *   says so and nothing is lit. Opened inside glass (a dialog, a sheet, the header, a popover) it is solid
 *   (bg-litt-surface-2 + shadow-litt-float), found from the DOM when it opens.
 * - Behavior: the combobox and listbox pattern. Focus stays in the field and aria-activedescendant names the lit
 *   option; rows never take focus (the panel prevents mousedown). Typing opens the list and filters it in the
 *   original order, ignoring case and accents, and lights the first match. With an empty query the picked option
 *   is lit. ArrowDown opens or moves, ArrowUp moves, both wrap and skip disabled options, and Enter picks the lit
 *   option. Esc closes the list first (the list is a Radix layer, so inside a dialog it closes only the list), then
 *   puts back the picked option's label. Leaving the field closes the list and puts the label back, so the field
 *   never holds text that is not a value; a field left empty clears the pick. Every key handler returns early
 *   while an IME is composing.
 * - multiple: the picks sit inside the field before the query as Token input's tokens (raised Tags, R3: blocks you can
 *   lift out of the cut, flat while the field is disabled; a 24px remove button that grows to 44px on coarse
 *   pointers). A pick clears the query and keeps the list open, and
 *   picking a picked option again removes it. Backspace in an empty query removes the last token. ArrowLeft at the
 *   start of the query walks into the remove buttons, which are not Tab stops, so the field stays one Tab stop.
 * - Positioning is Radix Popover with the field as its anchor (role, focus and the trigger are ours): it places
 *   and flips the list, gives its transform origin and the room on screen, closes it on Esc and outside presses,
 *   and stacks it above a dialog's own layer. After the first placement the side is pinned, so the list never
 *   jumps from one side to the other while typing changes its height.
 * - Motion, responsive tier, as the Menu: the list grows from the field (--radix-popover-content-transform-origin),
 *   travels a quarter of the travel token from the side it really opens on, and leaves on useExit with its rows
 *   frozen, so a pick never flashes the full list on the way out. Typing changes the list at once and its height
 *   is never animated. Tokens fade in with a 0.98 scale, their neighbors slide by transform (layout="position"),
 *   and a removed one fades out on the exit token. The edge and the ring fade on the instant tier.
 * - Compact screens (useDevice().compact): the list stays anchored, never a sheet, because a sheet would cover the
 *   field. Once placed, its height is the visible screen on its side of the field less --litt-space-2, read from the
 *   visual viewport (useVisibleScreen), so no option hides behind the keyboard.
 * - Coarse pointers: a tap on the chevron opens the list without focusing the field, so the keyboard stays shut
 *   while a person browses.
 * - hideLabel keeps the label for screen readers only, where the row around the field already says what it holds (the
 *   value of a rule in a Rule builder).
 * - Accessibility: a real label; aria-expanded, aria-controls and aria-autocomplete="list" on the field; a polite
 *   live region says how many options match a moment after typing stops, and with multiple what was added or
 *   removed. A form gets one hidden field per value under `name`.
 */
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue } from "motion/react";
import { useDevice, useExit, useTransition, useTravel, useVisibleScreen } from "../../lib/litt/motion";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { Tag } from "./tag";
import { GLIDE_ROW, useGlide, type GlideSource } from "../../lib/litt/glide";

/* Radix's asChild, spread in: shadcn's CLI rewrites a written asChild to Base UI's render prop in base-* hosts. */
const asChildProps = { asChild: true } as const;

export type ComboboxSize = "sm" | "md" | "lg";

export type ComboboxOption = {
  /** What the form sends and onValueChange receives. Keep it unique, and not an empty string. */
  value: string;
  /** What people read in the list, and what the field shows once it is picked. The search matches it, ignoring case and accents. */
  label: string;
  /** Dims the option. The arrow keys skip it, and a click does nothing. */
  disabled?: boolean;
  /** Files the option under a group label, such as "Past clients". Options of one group show together, in the order the groups first appear. */
  group?: string;
};

export type ComboboxGroup = {
  /** The group label above its options, at the caption size. */
  label: string;
  /** The options in the group, in order. */
  options: ComboboxOption[];
};

/** One value is a string ("" while nothing is picked); with multiple it is an array of strings. */
export type ComboboxValue<Multiple extends boolean> = Multiple extends true ? string[] : string;

export type ComboboxProps<Multiple extends boolean = false> = {
  /** The label above the field. Required, because a placeholder is not a label. Clicking it focuses the field. */
  label: ReactNode;
  /** Hides the label from sight and keeps it for screen readers, where the row already says what the field holds, such as the value of a rule. */
  hideLabel?: boolean;
  /** A hint under the field. An error replaces it. */
  hint?: ReactNode;
  /** Shown in danger color under the field and linked with aria-describedby. Also draws the danger edge and sets aria-invalid. Say how to fix it. */
  error?: ReactNode;
  /** The choices: a flat list of { value, label, disabled?, group? }, or groups of { label, options }. */
  options: ComboboxOption[] | ComboboxGroup[];
  /** Pick several values. They sit in the field as removable tokens, and the list stays open after each pick. */
  multiple?: Multiple;
  /** The picked value, when you control it: a string, or an array with multiple. Pair it with onValueChange. */
  value?: ComboboxValue<Multiple>;
  /** The value to start with when you do not control it. */
  defaultValue?: ComboboxValue<Multiple>;
  /** Called with the new value after a pick, a removal, or a field left empty: a string ("" for none), or an array with multiple. */
  onValueChange?: (value: ComboboxValue<Multiple>) => void;
  /** Hint text inside the empty field, in the subtle color. It is never a label. With multiple it shows only while nothing is picked. */
  placeholder?: string;
  /** Height on the shared control scale: sm is 32, md is 44, lg is 56. With multiple it is the minimum, and the field grows as tokens wrap. */
  size?: ComboboxSize;
  /** The field name a form sends the value under, through one hidden input per value. */
  name?: string;
  /** What the quiet row says when nothing matches. It gets the query. The default reads No matches for “marl”. */
  emptyText?: (query: string) => ReactNode;
  /** Makes the field unavailable: muted, skipped by Tab, and left out of a form, like a native field. */
  disabled?: boolean;
  /** The id of the text field, for a label or an error summary link of your own. */
  id?: string;
  /** Extra classes for the whole component: the label, the field and the note under it. */
  className?: string;
};

type Side = "top" | "right" | "bottom" | "left";

/** An option with its place in the whole list and its label folded for matching. */
type Entry = ComboboxOption & { index: number; folded: string };
type Section = { key: string; label: string | null; options: Entry[] };

/** What the list must not be glass over: any glass surface, and any popover. */
const FLOATING = ".litt-glass, [data-popover-surface]";
/** The gap between the field and the list, in px. */
const GAP = 8;
/** Eight 44px rows and the 4px inset above and below them. */
const EIGHT_ROWS = "calc(8 * var(--litt-control-md) + var(--litt-space-2))";
/** How long typing must pause before the live region says how many options match, in ms. */
const SETTLE = 500;

/** Lowercase, with accents taken off, so "zurich" finds "Zürich". */
const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Groups or a flat list, as sections in order. Flat options with a group gather under it where the group first appears. */
function sectionsOf(options: ComboboxOption[] | ComboboxGroup[]): Section[] {
  const out: Section[] = [];
  let index = 0;
  const entry = (o: ComboboxOption): Entry => ({ ...o, index: index++, folded: fold(o.label) });
  for (const item of options) {
    if ("options" in item) {
      out.push({ key: `g${out.length}`, label: item.label, options: item.options.map(entry) });
      continue;
    }
    const label = item.group ?? null;
    let section = out.find((s) => s.label === label);
    if (!section) out.push((section = { key: `g${out.length}`, label, options: [] }));
    section.options.push(entry(item));
  }
  return out;
}

const toList = (value: string | string[] | undefined): string[] | undefined =>
  value === undefined ? undefined : Array.isArray(value) ? value : value === "" ? [] : [value];

/* ---------------------------------------------------------------- the field */

/* The Input's cut (floor, line, shade) and its focus, error and disabled looks, on a wrapper that holds the text
   field (and the tokens). The ring follows the text field only: the remove buttons draw their own. */
const FIELD =
  "relative flex w-full min-w-0 cursor-text rounded-litt-control bg-litt-cut font-normal text-litt-fg " +
  "shadow-[inset_0_0_0_1px_var(--litt-line-control),var(--litt-cut-shade)] " +
  "transition-[box-shadow] duration-(--litt-dur-instant) ease-litt " +
  "has-[input:focus-visible]:shadow-[inset_0_0_0_1px_var(--litt-focus),var(--litt-cut-shade),var(--litt-focus-ring)] " +
  "data-[invalid]:shadow-[inset_0_0_0_1px_var(--litt-danger),var(--litt-cut-shade)] " +
  "data-[invalid]:has-[input:focus-visible]:shadow-[inset_0_0_0_1px_var(--litt-danger),var(--litt-cut-shade),var(--litt-focus-ring)] " +
  "data-[disabled]:cursor-not-allowed data-[disabled]:bg-litt-surface-2 data-[disabled]:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  "pointer-coarse:text-(length:--litt-control-text-lg) " +
  /* Forced colors drops box-shadow, so the edge becomes a real border and focus gets an outline. */
  "forced-colors:border forced-colors:has-[input:focus-visible]:outline-2 forced-colors:has-[input:focus-visible]:outline-solid forced-colors:has-[input:focus-visible]:outline-offset-2";

const TEXT_SIZE: Record<ComboboxSize, string> = {
  sm: "text-litt-small",
  md: "text-litt-body",
  lg: "text-(length:--litt-control-text-lg)",
};

/* One value: a fixed height, and the text field fills it, so a click anywhere places the caret. */
const ONE_FIELD: Record<ComboboxSize, string> = {
  sm: "h-litt-control-sm pointer-coarse:h-litt-control-md",
  md: "h-litt-control-md",
  lg: "h-litt-control-lg",
};
const ONE_INPUT: Record<ComboboxSize, string> = {
  sm: "pl-litt-control-pad-sm",
  md: "pl-litt-control-pad-md",
  lg: "pl-litt-control-pad-lg",
};
const ONE_CHEVRON: Record<ComboboxSize, string> = {
  sm: "pl-litt-control pr-litt-control-pad-sm",
  md: "pl-litt-control pr-litt-control-pad-md",
  lg: "pl-litt-control pr-litt-control-pad-lg",
};

/* Several values: Token input's padding on the 4px grid, so the field grows by whole 24px token rows. The chevron
   cancels the padding to fill the field's height and keeps the control padding from the right edge. */
const MANY_FIELD: Record<ComboboxSize, string> = {
  sm: "min-h-litt-control-sm px-1 py-1 pointer-coarse:min-h-litt-control-md",
  md: "min-h-litt-control-md px-2 py-2",
  lg: "min-h-litt-control-lg px-4 py-4",
};
const MANY_CHEVRON: Record<ComboboxSize, string> = {
  sm: "-my-1 -mr-1 pl-litt-control pr-litt-control-pad-sm",
  md: "-my-2 -mr-2 pl-litt-control pr-litt-control-pad-md",
  lg: "-my-4 -mr-4 pl-litt-control pr-litt-control-pad-lg",
};

const CHEVRON =
  "grid shrink-0 cursor-pointer place-items-center self-stretch text-litt-fg-subtle outline-none " +
  "[-webkit-tap-highlight-color:transparent] transition-[color] duration-(--litt-dur-instant) ease-litt hover:text-litt-fg " +
  "disabled:cursor-not-allowed disabled:text-litt-fg-disabled disabled:hover:text-litt-fg-disabled";

const REMOVE =
  "relative grid size-6 shrink-0 place-items-center rounded-litt-control text-litt-fg-subtle " +
  "transition-[color] duration-(--litt-dur-instant) ease-litt hover:text-litt-fg " +
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-litt-focus " +
  "disabled:cursor-not-allowed disabled:text-litt-fg-disabled disabled:hover:text-litt-fg-disabled " +
  /* An invisible 44px target around the 24px button on a finger. */
  "pointer-coarse:before:absolute pointer-coarse:before:-inset-2.5";

/** A 16px cross, drawn smaller than the 24px button so it sits with the caption-size label (Token input's). */
function RemoveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true" focusable="false">
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ combobox */

/**
 * A labelled field that filters a long list as you type and picks one value, or several with multiple. Give it a
 * label and options, and hold the value in state with value and onValueChange, or pass a defaultValue and a name to
 * post it with a form. The label, the hint and the error are wired up for you.
 */
export function Combobox<Multiple extends boolean = false>({
  label,
  hideLabel = false,
  hint,
  error,
  options,
  multiple,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder,
  size = "md",
  name,
  emptyText,
  disabled = false,
  id: idProp,
  className = "",
}: ComboboxProps<Multiple>) {
  const many = multiple === true;
  const uid = useId();
  const inputId = idProp ?? `${uid}-input`;
  const labelId = `${uid}-label`;
  const noteId = `${uid}-note`;
  const listId = `${uid}-list`;
  const optionId = (o: Entry) => `${uid}-option-${o.index}`;

  const { coarse } = useDevice();
  const enter = useTransition("responsive");
  const exit = useExit("responsive");

  const sections = useMemo(() => sectionsOf(options), [options]);
  const all = useMemo(() => sections.flatMap((s) => s.options), [sections]);
  const labelOf = (v: string) => all.find((o) => o.value === v)?.label ?? v;

  const [inner, setInner] = useState<string[]>(() => toList(defaultValue) ?? []);
  const picked = toList(valueProp) ?? inner;

  /* The typed text. Null while nothing is typed: the field then shows the picked label (one value) or nothing. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  /* The lit option, when a key or the pointer chose it. Null means the rule: the first match, else the pick. */
  const [active, setActive] = useState<string | null>(null);
  const [source, setSource] = useState<GlideSource>("keyboard");
  const [said, setSaid] = useState("");

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const after = useRef<{ token: string } | "input" | null>(null);
  /* The Esc that closed the list. Radix hears it first, on the document, and React may re-render before the field's
     own handler runs, so the field checks the event itself rather than `open`. */
  const spentEscape = useRef<Event | null>(null);

  const text = query ?? (many || picked[0] === undefined ? "" : labelOf(picked[0]));
  const filter = (query ?? "").trim();

  const { shown, visible } = useMemo(() => {
    const q = fold(filter);
    const kept = sections
      .map((s) => ({ ...s, options: q ? s.options.filter((o) => o.folded.includes(q)) : s.options }))
      .filter((s) => s.options.length > 0);
    return { shown: kept, visible: kept.flatMap((s) => s.options) };
  }, [sections, filter]);

  const enabled = visible.filter((o) => !o.disabled);
  const lightable = (v: string | undefined) => v !== undefined && enabled.some((o) => o.value === v);
  const fallback = filter ? (enabled[0]?.value ?? null) : !many && lightable(picked[0]) ? picked[0] : null;
  const current = active !== null && lightable(active) ? active : fallback;
  const currentIndex = current === null ? -1 : visible.findIndex((o) => o.value === current);
  const currentEntry = currentIndex >= 0 ? visible[currentIndex] : undefined;

  const note = error ?? hint;

  function setValue(next: string[]) {
    if (valueProp === undefined) setInner(next);
    onValueChange?.((many ? next : (next[0] ?? "")) as ComboboxValue<Multiple>);
  }

  function openList(how: "down" | "up" | "type" | "chevron") {
    if (disabled) return;
    setOpen(true);
    setSource(how === "chevron" ? (coarse ? "touch" : "pointer") : "keyboard");
    if ((how === "down" || how === "up") && fallback === null && enabled.length) {
      setActive(enabled[how === "down" ? 0 : enabled.length - 1].value);
    } else if (how !== "type") {
      setActive(null);
    }
  }

  function closeList() {
    setOpen(false);
    setActive(null);
  }

  /** Focus left the field: close, and put the label back. A one-value field left empty clears its pick. */
  function leave() {
    closeList();
    if (!many && query !== null && query.trim() === "" && picked.length) setValue([]);
    setQuery(null);
  }

  function pick(o: Entry) {
    if (o.disabled) return;
    if (!many) {
      if (picked[0] !== o.value) setValue([o.value]);
      setQuery(null);
      closeList();
      return;
    }
    const had = picked.includes(o.value);
    setValue(had ? picked.filter((v) => v !== o.value) : [...picked, o.value]);
    setQuery(null);
    setActive(o.value);
    setSaid(`${had ? "Removed" : "Added"} ${o.label}`);
  }

  /** Removes a token. A key moves focus to the next token or the field; a press leaves it where it was. */
  function remove(v: string, focus: "stay" | "key") {
    const at = picked.indexOf(v);
    if (at < 0 || disabled) return;
    const next = picked.filter((p) => p !== v);
    setValue(next);
    setSaid(`Removed ${labelOf(v)}`);
    if (focus === "key") after.current = next[at] !== undefined ? { token: next[at] } : "input";
  }

  /* Focus lands where the removed token was, once the tokens have re-rendered. */
  useEffect(() => {
    const target = after.current;
    if (!target) return;
    after.current = null;
    if (target !== "input") {
      const next = buttons.current.get(target.token);
      if (next) return next.focus();
    }
    inputRef.current?.focus();
  });

  /* A moment after typing stops, say how many options match. */
  const count = visible.length;
  useEffect(() => {
    if (!open || query === null) return;
    const timer = window.setTimeout(() => setSaid(count === 0 ? "No matches" : count === 1 ? "1 option" : `${count} options`), SETTLE);
    return () => window.clearTimeout(timer);
  }, [open, query, count]);

  function move(dir: 1 | -1) {
    if (!enabled.length) return;
    const at = enabled.findIndex((o) => o.value === current);
    const next = at < 0 ? enabled[dir === 1 ? 0 : enabled.length - 1] : enabled[(at + dir + enabled.length) % enabled.length];
    setActive(next.value);
    setSource("keyboard");
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setActive(null);
    setSource("keyboard");
    if (!open) openList("type");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (e.altKey && e.key === "ArrowUp") {
          if (open) {
            e.preventDefault();
            closeList();
          }
          return;
        }
        e.preventDefault();
        if (!open) openList(e.key === "ArrowDown" ? "down" : "up");
        else move(e.key === "ArrowDown" ? 1 : -1);
        return;
      }
      case "Enter": {
        if (!open) return; // a closed list lets Enter submit the form
        e.preventDefault();
        if (currentEntry) pick(currentEntry);
        return;
      }
      case "Escape": {
        /* An open list is a Radix layer: its document listener has already closed it with this Esc. */
        if (open || spentEscape.current === e.nativeEvent) return;
        if (query !== null) {
          e.preventDefault();
          setQuery(null);
        }
        return;
      }
      case "Backspace": {
        if (many && el.value === "" && picked.length > 0) {
          e.preventDefault();
          remove(picked[picked.length - 1], "stay");
        }
        return;
      }
      case "ArrowLeft": {
        if (many && picked.length > 0 && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && el.selectionStart === 0 && el.selectionEnd === 0) {
          e.preventDefault();
          buttons.current.get(picked[picked.length - 1])?.focus();
        }
        return;
      }
    }
  }

  function onRemoveKeyDown(e: KeyboardEvent<HTMLButtonElement>, v: string, at: number) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      buttons.current.get(picked[Math.max(0, at - 1)])?.focus();
    } else if (e.key === "ArrowRight" || e.key === "Escape") {
      e.preventDefault();
      if (e.key === "ArrowRight" && at < picked.length - 1) buttons.current.get(picked[at + 1])?.focus();
      else inputRef.current?.focus();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      remove(v, "key");
    }
  }

  /* A press on the chevron or a remove button keeps focus in the field when it is already there, so the caret and an
     open keyboard stay put. From elsewhere the button takes focus, which lets the other field go (and its keyboard). */
  const holdFocus = (e: MouseEvent) => {
    if (fieldRef.current?.contains(document.activeElement)) e.preventDefault();
  };

  const input = (
    <input
      ref={inputRef}
      id={inputId}
      type="text"
      role="combobox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={open && currentEntry ? optionId(currentEntry) : undefined}
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? noteId : undefined}
      value={text}
      placeholder={many && picked.length > 0 ? undefined : placeholder}
      disabled={disabled}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="none"
      spellCheck={false}
      onChange={onChange}
      onKeyDown={onKeyDown}
      className={
        "min-w-0 flex-1 truncate bg-transparent text-litt-fg outline-none placeholder:text-litt-fg-subtle " +
        "disabled:cursor-not-allowed disabled:text-litt-fg-disabled disabled:placeholder:text-litt-fg-disabled " +
        (many ? "box-content h-6 pl-2" : "h-full " + ONE_INPUT[size])
      }
    />
  );

  return (
    <div className={"grid gap-2 " + className}>
      <label id={labelId} htmlFor={inputId} className={"text-litt-small font-litt-title " + (disabled ? "text-litt-fg-disabled" : "text-litt-fg") + (hideLabel ? " sr-only" : "")}>
        {label}
      </label>

      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (!next) closeList();
        }}
      >
        <PopoverPrimitive.Anchor {...asChildProps}>
          <div
            ref={fieldRef}
            data-invalid={error ? "" : undefined}
            data-disabled={disabled ? "" : undefined}
            className={[FIELD, many ? MANY_FIELD[size] : ONE_FIELD[size], TEXT_SIZE[size]].join(" ")}
            onMouseDown={(e) => {
              /* A press on the field's own air focuses the text field and keeps focus from falling off it. */
              if (disabled || (e.target as HTMLElement).closest("button, input")) return;
              e.preventDefault();
              inputRef.current?.focus();
            }}
            onBlur={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node | null)) return; // moving inside the field
              if (document.activeElement === e.target) return; // the window lost focus, not the field
              leave();
            }}
          >
            {many ? (
              <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1">
                <ul role="list" aria-labelledby={labelId} className="contents">
                  <AnimatePresence initial={false} mode="popLayout">
                    {picked.map((v, at) => (
                      <motion.li
                        key={v}
                        layout="position"
                        className="flex max-w-full min-w-0 cursor-default"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, transition: exit }}
                        transition={enter}
                      >
                        <Tag raised={!disabled} className="max-w-full min-w-0 pr-0">
                          <span className={"min-w-0 truncate " + (disabled ? "text-litt-fg-subtle" : "")}>{labelOf(v)}</span>
                          <button
                            type="button"
                            ref={(el) => {
                              if (el) buttons.current.set(v, el);
                              else buttons.current.delete(v);
                            }}
                            aria-label={`Remove ${labelOf(v)}`}
                            tabIndex={-1}
                            disabled={disabled}
                            className={REMOVE}
                            onMouseDown={holdFocus}
                            onKeyDown={(e) => onRemoveKeyDown(e, v, at)}
                            onClick={(e) => remove(v, e.detail === 0 ? "key" : "stay")}
                          >
                            <RemoveIcon />
                          </button>
                        </Tag>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
                {/* A disabled field takes no text, so its query does not claim a line of its own after the tokens. */}
                <motion.div layout="position" transition={enter} className={"flex flex-1 " + (disabled && picked.length ? "min-w-1" : "min-w-[8ch]")}>
                  {input}
                </motion.div>
              </div>
            ) : (
              input
            )}

            <button
              type="button"
              tabIndex={-1}
              aria-label="Show options"
              aria-expanded={open}
              aria-controls={open ? listId : undefined}
              disabled={disabled}
              className={CHEVRON + " " + (many ? MANY_CHEVRON[size] : ONE_CHEVRON[size])}
              onMouseDown={holdFocus}
              onClick={() => {
                if (open) return closeList();
                openList("chevron");
                /* A finger browses without the keyboard; a mouse keeps typing in the field. */
                if (!coarse) inputRef.current?.focus();
              }}
            >
              <ChevronDownIcon />
            </button>

            {name && (many ? picked : [picked[0] ?? ""]).map((v) => <input key={v} type="hidden" name={name} value={v} disabled={disabled} />)}
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal forceMount>
          <AnimatePresence>
            {open && (
              <Panel
                key="list"
                field={fieldRef}
                input={inputRef}
                listId={listId}
                labelId={labelId}
                many={many}
                shown={shown}
                visible={visible}
                current={currentIndex}
                source={source}
                picked={picked}
                empty={emptyText ? emptyText(filter) : filter ? `No matches for “${filter}”` : "No options"}
                optionId={optionId}
                onPointerRow={(index, type) => {
                  const o = visible[index];
                  if (!o) return;
                  setActive(o.value);
                  setSource(type === "touch" ? "touch" : "pointer");
                }}
                onPick={pick}
                onEscape={(e) => {
                  spentEscape.current = e;
                }}
              />
            )}
          </AnimatePresence>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      {note && (
        <p id={noteId} className={"text-litt-small " + (error ? "text-litt-danger" : "text-litt-fg-subtle")}>
          {note}
        </p>
      )}

      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {said}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- the list */

type PanelProps = {
  field: RefObject<HTMLDivElement | null>;
  input: RefObject<HTMLInputElement | null>;
  listId: string;
  labelId: string;
  many: boolean;
  shown: Section[];
  visible: Entry[];
  /** The lit option's index in `visible`, or -1. */
  current: number;
  source: GlideSource;
  picked: string[];
  empty: ReactNode;
  optionId: (o: Entry) => string;
  onPointerRow: (index: number, type: "mouse" | "touch") => void;
  onPick: (o: Entry) => void;
  /** Hears the Esc that closes the list, so the field does not act on it as well. */
  onEscape: (e: Event) => void;
};

const ROW =
  "relative flex h-litt-control-md w-full cursor-pointer select-none items-center gap-3 rounded-litt-control px-3 text-litt-small outline-none " +
  "[-webkit-tap-highlight-color:transparent] transition-colors duration-(--litt-dur-instant) ease-litt " +
  "text-litt-fg-muted aria-selected:text-litt-fg data-[active]:text-litt-fg aria-disabled:cursor-not-allowed aria-disabled:text-litt-fg-disabled";
/** The group label row: the Menu's. */
const LABEL_ROW = "flex h-litt-control-sm items-center px-3 text-litt-caption text-litt-fg-subtle";

/**
 * The anchored list. It mounts on open and stays through its exit, so the glide starts fresh each time. While it
 * leaves it keeps the rows it had (only the checks follow the value), so a pick never flashes the full list.
 */
function Panel(props: PanelProps) {
  const present = useIsPresent();
  const frozen = useRef(props);
  if (present) frozen.current = props;
  const { field, input, listId, labelId, many, shown, visible, current, source, empty, optionId, onPointerRow, onPick, onEscape } =
    frozen.current;
  const { picked } = props;

  const enter = useTransition("responsive");
  const exit = useExit("responsive");
  const travel = useTravel();
  const latest = useRef(enter);
  latest.current = enter;
  const { compact } = useDevice();
  const screen = useVisibleScreen(compact);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const el = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  /* Null until Radix has placed the list; then the side it really opened on, pinned from there. */
  const [placed, setPlaced] = useState<Side | null>(null);
  const placedRef = useRef<Side | null>(null);
  /* Glass never sits on glass: is the field inside another floating surface? Read once, as the list opens. */
  const [flat] = useState(() => Boolean(field.current?.closest(FLOATING)));
  /* Compact: the room on screen beside the field on the list's side, from the visual viewport. */
  const [room, setRoom] = useState<number | null>(null);

  /* A quarter of the travel, starting nearer the field than the resting place. */
  const offset = (s: Side) => {
    const d = travel / 4;
    return { x: s === "left" ? d : s === "right" ? -d : 0, y: s === "top" ? d : s === "bottom" ? -d : 0 };
  };

  const onPlaced = () => {
    if (placedRef.current) return;
    const s = (el.current?.dataset.side as Side | undefined) ?? "bottom";
    placedRef.current = s;
    const o = offset(s);
    x.jump(o.x);
    y.jump(o.y);
    setPlaced(s);
  };

  useEffect(() => {
    if (!placed) return;
    const runs = [animate(x, 0, latest.current), animate(y, 0, latest.current)];
    return () => runs.forEach((r) => r.stop());
  }, [placed, x, y]);

  useLayoutEffect(() => {
    if (!compact || !placed) return;
    const read = () => {
      const r = field.current?.getBoundingClientRect();
      if (!r) return;
      const top = screen ? screen.top : 0;
      const bottom = screen ? screen.top + screen.height : window.innerHeight;
      setRoom(Math.max(0, Math.floor(placed === "top" ? r.top - top - GAP : bottom - r.bottom - GAP)));
    };
    read();
    window.addEventListener("scroll", read, { capture: true, passive: true });
    window.addEventListener("resize", read);
    return () => {
      window.removeEventListener("scroll", read, { capture: true });
      window.removeEventListener("resize", read);
    };
  }, [compact, placed, screen, field]);

  /** Scrolls the list (never the page) so a row, and its group label above it, are in view. */
  const reveal = (index: number, center = false) => {
    const box = scroller.current;
    const row = box?.querySelectorAll<HTMLElement>("[data-glide-row]")[index];
    if (!box || !row) return;
    if (center) {
      box.scrollTop = row.offsetTop - (box.clientHeight - row.offsetHeight) / 2;
      return;
    }
    const head = row.previousElementSibling as HTMLElement | null;
    const top = (head?.hasAttribute("data-group-label") ? head.offsetTop : row.offsetTop) - 4;
    const bottom = row.offsetTop + row.offsetHeight + 4;
    if (index === 0 || top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  };

  const glide = useGlide({
    keepOnLeave: true,
    onPointerRow: (index, _row, type) => onPointerRow(index, type),
  });

  /* The glide follows the lit option. A new list snaps it; a move glides. The list scrolls to it on a key, when the
     rows change, and once when the list has been placed (its height is known only then). */
  const { setActive } = glide;
  const rowsKey = visible.map((o) => o.index).join(",");
  const prev = useRef<{ rows: string | null; placed: Side | null }>({ rows: null, placed: null });
  useLayoutEffect(() => {
    const changed = prev.current.rows !== rowsKey;
    const justPlaced = placed !== null && prev.current.placed === null;
    prev.current = { rows: rowsKey, placed };
    setActive(current >= 0 ? current : null, source, { jump: changed });
    if (current < 0) {
      if (changed && scroller.current) scroller.current.scrollTop = 0;
      return;
    }
    if (justPlaced) reveal(current, true);
    else if (changed || source === "keyboard") reveal(current);
  }, [current, source, rowsKey, placed, setActive]);

  const out = offset(placed ?? "bottom");
  const grouped = shown.some((s) => s.label !== null);

  /* Radix forwards onPlaced to its popper, but the popover types omit it. */
  const placedProp = { onPlaced } as Record<string, unknown>;

  const maxHeight = compact
    ? room !== null
      ? `min(${EIGHT_ROWS}, calc(${room}px - var(--litt-space-2)))`
      : EIGHT_ROWS
    : `min(${EIGHT_ROWS}, var(--radix-popover-content-available-height, ${EIGHT_ROWS}))`;

  let at = -1;
  const row = (o: Entry) => {
    at += 1;
    const isPicked = picked.includes(o.value);
    return (
      <div
        key={o.index}
        id={optionId(o)}
        role="option"
        aria-selected={isPicked}
        aria-disabled={o.disabled || undefined}
        data-active={at === current || undefined}
        {...GLIDE_ROW}
        onClick={() => onPick(o)}
        className={ROW + (grouped ? " scroll-mt-9" : "")}
      >
        <span className="grid size-4 shrink-0 place-items-center text-litt-fg">{isPicked && <CheckIcon />}</span>
        <span className="min-w-0 truncate">{o.label}</span>
      </div>
    );
  };

  return (
    <PopoverPrimitive.Content
      forceMount
      {...asChildProps}
      role="presentation"
      side={placed ?? "bottom"}
      align="start"
      sideOffset={GAP}
      collisionPadding={GAP}
      avoidCollisions={placed === null}
      hideWhenDetached
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      onEscapeKeyDown={(e) => {
        /* Composing an IME word: Esc cancels the composition, not the list. */
        if (e.isComposing) e.preventDefault();
        else onEscape(e);
      }}
      onPointerDownOutside={(e) => {
        /* The field is outside the list, but a press on it (the text, the chevron, a token) is not a dismissal. */
        if (field.current?.contains(e.target as Node)) e.preventDefault();
      }}
      onFocusOutside={(e) => {
        if (e.target === input.current) e.preventDefault();
      }}
      {...placedProp}
    >
      <motion.div
        ref={el}
        className={
          "relative z-50 w-(--radix-popover-trigger-width) origin-(--radix-popover-content-transform-origin) rounded-litt-surface outline-none " +
          "data-[state=closed]:pointer-events-none " +
          (flat ? "bg-litt-surface-2 shadow-litt-float" : "litt-glass")
        }
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: placed ? 1 : 0, scale: placed ? 1 : 0.98, transition: enter }}
        exit={{ opacity: 0, scale: 0.98, x: out.x, y: out.y, transition: exit }}
        style={{ x, y }}
        /* Rows never take focus: the caret stays in the field. */
        onMouseDown={(e) => e.preventDefault()}
      >
        {/* The glass cannot clip, its shadow lives on ::before, so this box clips and scrolls the rows. */}
        <div
          ref={(node) => {
            scroller.current = node;
            glide.ref(node);
          }}
          {...glide.props}
          className="relative overflow-y-auto overscroll-contain rounded-litt-surface p-1 [scrollbar-color:var(--litt-line-strong)_transparent] [scrollbar-width:thin]"
          style={{ maxHeight }}
        >
          {glide.highlight}
          <div id={listId} role="listbox" aria-labelledby={labelId} aria-multiselectable={many || undefined}>
            {shown.map((s) =>
              s.label === null ? (
                <Fragment key={s.key}>{s.options.map(row)}</Fragment>
              ) : (
                <div key={s.key} role="group" aria-labelledby={`${listId}-${s.key}`}>
                  <div id={`${listId}-${s.key}`} data-group-label="" className={LABEL_ROW}>
                    {s.label}
                  </div>
                  {s.options.map(row)}
                </div>
              ),
            )}
          </div>
          {visible.length === 0 && (
            <div className="flex h-litt-control-md min-w-0 items-center px-3 text-litt-small text-litt-fg-subtle">
              <span className="min-w-0 truncate">{empty}</span>
            </div>
          )}
        </div>
      </motion.div>
    </PopoverPrimitive.Content>
  );
}
