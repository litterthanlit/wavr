"use client";
// @litt/select 2026.10.19. What changed: https://littmd.vercel.app/changelog.md

/**
 * Select: one value from a short list (components.md, "Select"), on @radix-ui/react-select
 * with position="popper". Radix supplies the roles, typeahead, keyboard, focus return and the
 * hidden native <select> a form reads. Everything visual is written here.
 *
 * - Two parts, like Input. Select is the bare trigger and list, for a toolbar or inline use, and it
 *   needs an aria-label or aria-labelledby. SelectField adds the label above and the help or error
 *   below, all wired up, in the same layout as TextField.
 * - Trigger: the Input's field look and sizes (sm 32, md 44, lg 56, 16px text on coarse pointers),
 *   the value in --litt-fg, the placeholder in --litt-fg-subtle, and a 16px chevron that never turns. The
 *   edge fades on the instant tier, the box never moves. There is no hover fill. A long value
 *   truncates with an ellipsis.
 * - List: the Menu's panel. Glass at the surface radius with a 4px inset, 44px rows at the control
 *   radius with 12px side padding, one gliding highlight (glide.tsx), and a 16px check in a fixed
 *   cell at the end of the current option. It is at least as wide as the trigger and never taller
 *   than the room on screen, and it scrolls inside. Opened inside glass (a dialog, a sheet, the
 *   header, a popover) it is solid (bg-litt-surface-2 + shadow-litt-float), found from the DOM when it opens.
 * - Motion, responsive tier, as the Menu. The list grows from the trigger
 *   (--radix-select-content-transform-origin) and travels a quarter of the travel token from the side
 *   it really opens on, after collision flipping. Radix Select unmounts its content on close and keeps
 *   the options in a detached fragment, so the exit is held with Content's forceMount: the select
 *   marks itself "leaving" in the same render that closes it, plays the exit on useExit, and then lets
 *   Radix unmount. Radix Select overrides onPlaced, so "placed" is read from the content's inline
 *   `animation: none`, which Radix's popper removes once it has measured and positioned the list.
 * - The highlight follows Radix's focus: Radix focuses the highlighted option, so each row reports
 *   onFocus to the glide, as Menu rows do. Opened with the pointer, nothing is lit until the pointer
 *   moves or a key is pressed. Opened with Space, Enter or an arrow, the current option is lit with
 *   the keyboard ring. A finger's press shows on the row itself (pointer-coarse:active:), and a tap
 *   never takes focus, so nothing stays lit after it.
 * - On compact screens the list stays anchored, like a dropdown menu. It is not a sheet.
 * - Closing returns focus to the trigger at once, not when the exit has finished.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
  type Ref,
} from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { animate, motion, useMotionValue, type AnimationPlaybackControls, type HTMLMotionProps } from "motion/react";
import { useExit, useTransition, useTravel } from "../../lib/litt/motion";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { GLIDE_ROW, useGlide, type Glide } from "../../lib/litt/glide";

/* Radix's asChild, spread in: shadcn's CLI rewrites a written asChild to Base UI's render prop in base-* hosts. */
const asChildProps = { asChild: true } as const;

export type SelectSize = "sm" | "md" | "lg";

export type SelectOption = {
  /** What the form sends and onValueChange receives. Keep it unique, and not an empty string. */
  value: string;
  /** What people read, in the list and in the trigger. It truncates with an ellipsis instead of wrapping. */
  label: ReactNode;
  /** Dims the option and skips it for the pointer, the arrow keys and typeahead. */
  disabled?: boolean;
  /** Plain text for typeahead, and for the hidden native field, when label is not a string. */
  textValue?: string;
};

export type SelectProps = {
  /** The choices, in the order they show. */
  options: SelectOption[];
  /** The picked value. Pair it with onValueChange. Leave it out and the select keeps its own. */
  value?: string;
  /** The value to start with when you do not control it. Leave it out to start on the placeholder. */
  defaultValue?: string;
  /** Called with the value of the option that was picked. */
  onValueChange?: (value: string) => void;
  /** Shown while nothing is picked, in the subtle color. It is not a label. */
  placeholder?: ReactNode;
  /** Height on the shared control scale: sm is 32, md is 44, lg is 56. Use lg next to an lg button, and sm in a toolbar. */
  size?: SelectSize;
  /** Draws the error edge and sets aria-invalid. The bare Select shows no message, so link yours with aria-describedby. */
  invalid?: boolean;
  /** Dims the trigger and keeps the list closed. */
  disabled?: boolean;
  /** Marks the field as required for assistive tech and for the hidden native field. */
  required?: boolean;
  /** The field name a form sends the value under. The value travels in a hidden native select inside the form. */
  name?: string;
  /** The id of the trigger. SelectField sets one for you. */
  id?: string;
  /** Extra classes for the trigger. It fills its container, so set a width on a wrapper. */
  className?: string;
  /** The select's accessible name, when no visible label names it. The bare Select needs this or aria-labelledby. */
  "aria-label"?: string;
  /** The id of the element that names the select, such as a visible label. */
  "aria-labelledby"?: string;
  /** The id of the help or error text under the select. */
  "aria-describedby"?: string;
  /** Whether the list is open. Pair it with onOpenChange. Leave it out and the select keeps its own state. */
  open?: boolean;
  /** Start open when you do not control it. */
  defaultOpen?: boolean;
  /** Called with the next state when the trigger, a pick, Esc or a click outside asks to change it. */
  onOpenChange?: (open: boolean) => void;
};

type Side = "top" | "right" | "bottom" | "left";

/** What the list must not be glass over: any glass surface, and any popover. */
const FLOATING = ".litt-glass, [data-popover-surface]";

/* ---------------------------------------------------------------- trigger */

/* The look every field shares (the same as Input): fill, edge, focus, error, disabled. */
const field =
  "group/trigger flex w-full min-w-0 cursor-pointer items-center gap-litt-control rounded-litt-control bg-litt-surface-1 text-left font-normal text-litt-fg " +
  "data-placeholder:text-litt-fg-subtle " +
  "pointer-coarse:text-(length:--litt-control-text-lg) " +
  "[-webkit-tap-highlight-color:transparent] " +
  "shadow-[inset_0_0_0_1px_var(--litt-line-control)] " +
  "transition-[box-shadow] duration-(--litt-dur-instant) ease-litt " +
  "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--litt-focus),var(--litt-focus-ring)] " +
  "aria-invalid:shadow-[inset_0_0_0_1px_var(--litt-danger)] " +
  "aria-invalid:focus-visible:shadow-[inset_0_0_0_1px_var(--litt-danger),var(--litt-focus-ring)] " +
  "disabled:cursor-not-allowed disabled:bg-litt-surface-2 disabled:text-litt-fg-disabled disabled:data-placeholder:text-litt-fg-disabled " +
  "disabled:shadow-[inset_0_0_0_1px_var(--litt-line)] " +
  /* Forced colors (Windows high contrast) drops box-shadow, so the edge becomes a real border and focus gets an outline. */
  "forced-colors:border forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:outline-offset-2";

const sizes: Record<SelectSize, string> = {
  sm: "h-litt-control-sm px-litt-control-pad-sm text-litt-small pointer-coarse:h-litt-control-md",
  md: "h-litt-control-md px-litt-control-pad-md text-litt-body",
  lg: "h-litt-control-lg px-litt-control-pad-lg text-(length:--litt-control-text-lg)",
};

/* --------------------------------------------------------------- the list */

/** Shared by the rows of one open list. */
type ListContext = {
  glide: Glide;
  /** True while a pointer opened the list and nothing has moved or been pressed yet: no row is lit. */
  quiet: MutableRefObject<boolean>;
  /** True when the last press was a finger's. */
  touch: MutableRefObject<boolean>;
};
const ListCtx = createContext<ListContext | null>(null);

const row =
  "relative flex h-litt-control-md w-full scroll-my-1 cursor-pointer select-none items-center gap-3 rounded-litt-control px-3 text-litt-small outline-none " +
  "[-webkit-tap-highlight-color:transparent] " +
  "transition-colors duration-(--litt-dur-instant) ease-litt " +
  "text-litt-fg-muted data-[state=checked]:text-litt-fg group-data-[quiet=false]/list:data-[highlighted]:text-litt-fg " +
  "data-[disabled]:pointer-events-none data-[disabled]:text-litt-fg-disabled " +
  "pointer-coarse:active:bg-[color-mix(in_oklab,var(--litt-fg)_7%,transparent)] pointer-coarse:active:text-litt-fg";

function Row({ option }: { option: SelectOption }) {
  const ctx = useContext(ListCtx);
  if (!ctx) return null;
  const { glide, quiet, touch } = ctx;
  return (
    <SelectPrimitive.Item
      {...GLIDE_ROW}
      value={option.value}
      disabled={option.disabled}
      textValue={option.textValue}
      /* A tap would focus the row it lands on, and a focused row looks keyboard-lit. */
      onMouseDown={(e) => {
        if (touch.current) e.preventDefault();
      }}
      onFocus={(e) => {
        if (!quiet.current) glide.focusRow(e.currentTarget);
      }}
      className={row}
    >
      <span className="min-w-0 flex-1 truncate">
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
      </span>
      <span className="grid size-4 shrink-0 place-items-center">
        <SelectPrimitive.ItemIndicator className="grid place-items-center text-litt-fg">
          <CheckIcon />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

const compose =
  <A extends unknown[]>(a: ((...args: A) => void) | undefined, b: (...args: A) => void) =>
  (...args: A) => {
    a?.(...args);
    b(...args);
  };

type SurfaceProps = Omit<HTMLMotionProps<"div">, "ref" | "children"> & {
  /** Radix hands the content its ref through Slot. */
  ref?: Ref<HTMLDivElement>;
  options: SelectOption[];
  open: boolean;
  leaving: boolean;
  flat: boolean;
  input: MutableRefObject<"key" | "pointer">;
  onExited: () => void;
};

/**
 * The animated surface. It is the direct child of SelectPrimitive.Content (asChild), so it receives the props
 * Radix puts on the content (role, id, data-state, the keyboard handlers, the focus trap) and puts them on the
 * element. It mounts when the list opens, and stays mounted through the exit.
 */
function Surface({ ref, options, open, leaving, flat, input, onExited, style, ...rest }: SurfaceProps) {
  const enter = useTransition("responsive");
  const exit = useExit("responsive");
  const travel = useTravel();
  const latest = useRef({ enter, exit, travel, onExited });
  latest.current = { enter, exit, travel, onExited };

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(0.98);
  const opacity = useMotionValue(0);
  const node = useRef<HTMLDivElement | null>(null);
  const side = useRef<Side>("bottom");
  const entered = useRef(false);

  const setNode = useCallback(
    (el: HTMLDivElement | null) => {
      node.current = el;
      if (typeof ref === "function") return ref(el);
      if (ref) ref.current = el;
    },
    [ref],
  );

  /* A quarter of the travel, starting nearer the trigger than the resting place. */
  const offset = (s: Side) => {
    const d = latest.current.travel / 4;
    return { x: s === "left" ? d : s === "right" ? -d : 0, y: s === "top" ? d : s === "bottom" ? -d : 0 };
  };

  /* Enter. Radix removes the inline `animation: none` once it has measured and placed the list, and until
     then the list sits off the page, so wait for that, then read the side it really opened on. */
  useEffect(() => {
    const el = node.current;
    if (!open || !el || !el.isConnected) return;
    let alive = true;
    let frame = 0;
    let runs: AnimationPlaybackControls[] = [];
    const start = () => {
      if (!alive) return;
      if (el.style.animationName === "none") {
        frame = requestAnimationFrame(start);
        return;
      }
      side.current = (el.dataset.side as Side | undefined) ?? "bottom";
      const { enter } = latest.current;
      /* Opened again while it was still leaving: carry on from where it is. */
      if (!entered.current) {
        const o = offset(side.current);
        x.jump(o.x);
        y.jump(o.y);
        scale.jump(0.98);
        opacity.jump(0);
      }
      entered.current = true;
      runs = [animate(x, 0, enter), animate(y, 0, enter), animate(scale, 1, enter), animate(opacity, 1, enter)];
    };
    start();
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      runs.forEach((r) => r.stop());
    };
  }, [open, x, y, scale, opacity]);

  /* Exit. The select holds this mounted (forceMount) until it is told the exit is done. */
  useEffect(() => {
    if (open || !leaving) return;
    let alive = true;
    const { exit } = latest.current;
    const o = offset(side.current);
    const runs = [
      animate(x, o.x, exit),
      animate(y, o.y, exit),
      animate(scale, 0.98, exit),
      animate(opacity, 0, {
        ...exit,
        onComplete: () => {
          if (alive) latest.current.onExited();
        },
      }),
    ];
    return () => {
      alive = false;
      runs.forEach((r) => r.stop());
    };
  }, [open, leaving, x, y, scale, opacity]);

  const glide = useGlide({ focusRows: true });
  const gp = glide.props;
  /* Opened by a pointer, no row is lit until the pointer moves or a key is pressed. */
  const quietRef = useRef(input.current === "pointer");
  const [quiet, setQuiet] = useState(quietRef.current);
  const touch = useRef(false);
  const wake = () => {
    if (!quietRef.current) return;
    quietRef.current = false;
    setQuiet(false);
  };
  const ctx: ListContext = { glide, quiet: quietRef, touch };

  return (
    <motion.div
      {...rest}
      ref={setNode}
      data-quiet={quiet}
      className={
        "group/list relative z-50 max-h-(--radix-select-content-available-height) max-w-(--radix-select-content-available-width) " +
        "min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) rounded-litt-surface outline-none " +
        (flat ? "bg-litt-surface-2 shadow-litt-float" : "litt-glass")
      }
      style={{ ...style, x, y, scale, opacity, ...(open ? null : { pointerEvents: "none" as const }) }}
      onPointerEnter={compose(rest.onPointerEnter, gp.onPointerEnter)}
      onPointerLeave={compose(rest.onPointerLeave, gp.onPointerLeave)}
      onPointerMoveCapture={compose(rest.onPointerMoveCapture, (e) => {
        if (e.pointerType !== "touch") wake();
        gp.onPointerMoveCapture(e);
      })}
      onPointerDownCapture={compose(rest.onPointerDownCapture, (e) => {
        touch.current = e.pointerType === "touch";
        /* A finger's press shows on the row itself (its own fill), so the glide does not light it as well. */
        if (!touch.current) gp.onPointerDownCapture(e);
      })}
      onKeyDownCapture={compose(rest.onKeyDownCapture, (e) => {
        wake();
        gp.onKeyDownCapture(e);
      })}
    >
      <ListCtx.Provider value={ctx}>
        {/* The glass cannot clip, its shadow lives on ::before, so the viewport clips and scrolls the rows. Radix
            hides the scrollbar by default; a long list gets a thin one back, so it reads as scrollable. */}
        <SelectPrimitive.Viewport
          ref={glide.ref}
          className="rounded-litt-surface p-1 overscroll-contain [scrollbar-color:var(--litt-line-strong)_transparent]! [scrollbar-width:thin]!"
        >
          {glide.highlight}
          {options.map((o) => (
            <Row key={o.value} option={o} />
          ))}
        </SelectPrimitive.Viewport>
      </ListCtx.Provider>
    </motion.div>
  );
}

/* ----------------------------------------------------------------- select */

/**
 * The bare select: a trigger and its list, with no label. Use it in a toolbar or inline, and give it an aria-label
 * or aria-labelledby, because a placeholder is not a label. For a form field use SelectField.
 */
export function Select({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder,
  size = "md",
  invalid = false,
  disabled,
  required,
  name,
  id,
  className = "",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
}: SelectProps) {
  const [innerValue, setInnerValue] = useState(defaultValue ?? "");
  const value = valueProp ?? innerValue;
  const pick = (next: string) => {
    setInnerValue(next);
    onValueChange?.(next);
  };

  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = openProp ?? innerOpen;
  const change = (next: boolean) => {
    setInnerOpen(next);
    onOpenChange?.(next);
  };

  /* Closing marks the list as leaving in the same render, so Radix never sees it unmounted before the exit has played. */
  const [prevOpen, setPrevOpen] = useState(open);
  const [leaving, setLeaving] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setLeaving(!open);
  }

  const trigger = useRef<HTMLButtonElement | null>(null);
  const input = useRef<"key" | "pointer">("key");

  /* Focus goes back to the trigger as the list starts to leave, so the next key is meant for the trigger. */
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  /* Glass never sits on glass: is the trigger inside another floating surface? Found before the first paint. */
  const [flat, setFlat] = useState(false);
  useLayoutEffect(() => {
    if (open) setFlat(trigger.current?.closest(FLOATING) != null);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const done = useCallback(() => setLeaving(false), []);

  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={pick}
      open={open}
      onOpenChange={change}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectPrimitive.Trigger
        ref={trigger}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        onPointerDown={() => {
          input.current = "pointer";
        }}
        onKeyDown={() => {
          input.current = "key";
        }}
        className={[field, sizes[size], className].join(" ")}
      >
        {/* Radix drops a className on Value, so this span carries the truncation and pushes the chevron to the end. */}
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder}>{selected?.label}</SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon {...asChildProps}>
          <ChevronDownIcon className="shrink-0 text-litt-fg-subtle group-disabled/trigger:text-litt-fg-disabled" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          {...asChildProps}
          position="popper"
          forceMount={leaving ? true : undefined}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={8}
        >
          <Surface
            options={options}
            open={open}
            leaving={leaving}
            flat={flat}
            input={input}
            onExited={done}
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
          />
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* ------------------------------------------------------------ select field */

export type SelectFieldProps = Omit<SelectProps, "invalid"> & {
  /** The label above the trigger. Required, because a placeholder is not a label. Clicking it focuses the trigger. */
  label: ReactNode;
  /** A hint under the field. An error replaces it. */
  help?: ReactNode;
  /** Shown in danger color and linked to the trigger with aria-describedby. Also sets aria-invalid. Say how to fix it. */
  error?: ReactNode;
};

/**
 * A labelled select. The label, the hint and the error are wired to the trigger for you, in the same layout as
 * TextField: label above, hint or error below. Pass name and it works in a form.
 */
export function SelectField({
  label,
  help,
  error,
  id: idProp,
  "aria-describedby": describedByProp,
  "aria-labelledby": labelledByProp,
  ...rest
}: SelectFieldProps) {
  const auto = useId();
  const id = idProp ?? auto;
  const labelId = `${id}-label`;
  const noteId = `${id}-note`;
  const note = error ?? help;
  const describedBy = [describedByProp, note ? noteId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-2">
      {/* The label points at the trigger, but a click only moves focus: a label click would otherwise open the list. */}
      <label
        id={labelId}
        htmlFor={id}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(id)?.focus();
        }}
        className={"text-litt-small font-litt-title " + (rest.disabled ? "text-litt-fg-disabled" : "text-litt-fg")}
      >
        {label}
      </label>
      <Select
        {...rest}
        id={id}
        invalid={!!error}
        aria-labelledby={[labelId, labelledByProp].filter(Boolean).join(" ")}
        aria-describedby={describedBy}
      />
      {note && (
        <p id={noteId} className={"text-litt-small " + (error ? "text-litt-danger" : "text-litt-fg-subtle")}>
          {note}
        </p>
      )}
    </div>
  );
}
