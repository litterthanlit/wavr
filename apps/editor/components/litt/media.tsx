"use client";
// @litt/media 2026.10.22. What changed: https://littmd.vercel.app/changelog.md

/**
 * Media: one picture in a frame, such as a screenshot, a photograph or a poster, that keeps its shape while it loads
 * and says so when it fails (components.md, "Media"). The frame every image in litt sits in: a card cover, a carousel
 * slide, a lightbox.
 *
 * - Frame: a fixed shape (16/9, 8/5, 4/3, 1/1, 4/5, or a number such as 1.5 for an image's own), so the page never
 *   jumps when the image arrives. `auto` lets the image set the height: pass its width and height then, so the space
 *   is kept. The surface radius by default, the control radius inside a padded card, or none. An inset --litt-line
 *   hairline lies over the image, so a white image keeps its edge, as an avatar's photo does.
 * - Loading: the frame is surface-2 and still, the skeleton's look. No pulse, no shimmer, no blur-up. When the image
 *   has loaded it fades in on the instant tier (opacity only). Under reduced motion it is simply there.
 * - Failed: the frame stays its size and says "Image didn't load" beside an image mark, in --litt-fg-subtle; in a frame too
 *   narrow for the words only the mark shows. The alt text still names it.
 * - Lazy by default: `loading="lazy"` and `decoding="async"`. `priority` loads at once, with high fetch priority, for
 *   the one image the page opens on (a hero).
 * - Open: with `onOpen` the frame is a button that opens a larger view (a Lightbox), named by the alt text and marked
 *   aria-haspopup="dialog". Hover strengthens the hairline to --litt-line-strong on the instant tier and the pointer is a
 *   zoom; nothing lifts or scales, and hover reveals nothing, so touch loses nothing. Focus draws the 2px ring at a
 *   2px offset around the frame.
 * - Caption: a line under the frame, at the small size in --litt-fg-subtle, 8px below it, in a figure.
 * - Children replace the image: a <video controls>, or drawn art. They fill the frame; Media keeps the shape, the
 *   radius and the hairline, and reads them as loaded. A video never autoplays (foundations.md, Motion).
 */
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ImageIcon } from "./icons";

export type MediaRatio = "16/9" | "8/5" | "4/3" | "1/1" | "4/5" | "auto";

/* Literal classes, because Tailwind only generates what it can read. */
const RATIO: Record<Exclude<MediaRatio, "auto">, string> = {
  "16/9": "aspect-video",
  "8/5": "aspect-[8/5]",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-square",
  "4/5": "aspect-[4/5]",
};
const RADIUS = { surface: "rounded-litt-surface", control: "rounded-litt-control", none: "" } as const;

type Status = "loading" | "loaded" | "failed";

export type MediaProps = {
  /** The image's address. Leave it out when you pass children instead. */
  src?: string;
  /** What the image shows, in a sentence: "The Halo home page on a phone". Pass "" for an image that only decorates; it is then hidden from screen readers. */
  alt: string;
  /** Other sizes of the same image, for the browser to pick from. Pair it with sizes. */
  srcSet?: string;
  /** How wide the image is drawn, for srcSet: "(min-width: 64rem) 50vw, 100vw". */
  sizes?: string;
  /** The image's own width and height in pixels. With ratio="auto" they keep its space before it loads. */
  width?: number;
  height?: number;
  /** The frame's shape: 16/9, 8/5 (the default, a card cover's), 4/3, 1/1, 4/5, a number such as 1.5 (width over height), or auto to let the image set the height. */
  ratio?: MediaRatio | number;
  /** cover fills the frame and crops the edges; contain shows the whole image on surface-2. */
  fit?: "cover" | "contain";
  /** surface (8px) on its own in the page, control (4px) inside a card that pads it by 4px, none at the edge of a full-bleed area. */
  radius?: "surface" | "control" | "none";
  /** Load at once with high priority. Only for the image the page opens on, such as a hero; every other image waits until it is near the screen. */
  priority?: boolean;
  /** A line under the image. It wraps the frame in a figure. */
  caption?: ReactNode;
  /** Makes the image a button that opens a larger view, such as a Lightbox. The alt text names the button, so it must not be empty. */
  onOpen?: () => void;
  /** Called with the image element once it has loaded, for its natural size. */
  onLoad?: (image: HTMLImageElement) => void;
  /** Replaces the image: a <video controls> or drawn art, sized to fill (size-full). */
  children?: ReactNode;
  /** Extra classes for the outermost element (the figure, the button or the frame), such as a width. */
  className?: string;
  /** Inline style for the outermost element, such as a computed width. */
  style?: CSSProperties;
};

/** One picture in a frame that keeps its shape while it loads, says so when it fails, and can open a larger view. */
export function Media({
  src,
  alt,
  srcSet,
  sizes,
  width,
  height,
  ratio = "8/5",
  fit = "cover",
  radius = "surface",
  priority = false,
  caption,
  onOpen,
  onLoad,
  children,
  className = "",
  style,
}: MediaProps) {
  const img = useRef<HTMLImageElement>(null);
  /* The status belongs to one address: a new src starts loading again. */
  const [state, setState] = useState<{ src?: string; status: Status }>({ src, status: "loading" });
  const status: Status = children !== undefined ? "loaded" : state.src === src ? state.status : "loading";
  const loaded = (el: HTMLImageElement) => {
    setState({ src, status: "loaded" });
    onLoad?.(el);
  };
  const failed = () => setState({ src, status: "failed" });

  /* An image the browser already had (a cached one, or one that loaded before hydration) fires no load event.
     decode() settles either way, and rejects for an image that is broken. */
  useLayoutEffect(() => {
    const el = img.current;
    if (!el || !el.complete) return;
    let live = true;
    el.decode().then(
      () => live && loaded(el),
      () => live && failed(),
    );
    return () => {
      live = false;
    };
  }, [src]); // once per address

  const auto = ratio === "auto";
  const shape = typeof ratio === "number" ? "" : auto ? "" : RATIO[ratio];
  const corners = RADIUS[radius];
  const interactive = onOpen !== undefined;

  const frame = (
    <span
      className={[
        "@container relative block overflow-hidden bg-litt-surface-2",
        corners,
        shape,
        auto && status === "failed" ? "min-h-32" : "",
        caption || interactive ? "" : className,
      ].join(" ")}
      style={{ ...(typeof ratio === "number" ? { aspectRatio: ratio } : {}), ...(caption || interactive ? {} : style) }}
    >
      {children !== undefined ? (
        <span className={auto ? "block" : "absolute inset-0 block *:size-full"}>{children}</span>
      ) : (
        src !== undefined && (
          <img
            ref={img}
            src={src}
            srcSet={srcSet}
            sizes={sizes}
            width={width}
            height={height}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            draggable={false}
            onLoad={(e) => loaded(e.currentTarget)}
            onError={failed}
            className={[
              auto ? "block h-auto w-full" : "absolute inset-0 size-full",
              fit === "contain" ? "object-contain" : "object-cover",
              "transition-opacity duration-(--litt-dur-instant) ease-litt",
              status === "loaded" ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        )
      )}
      {status === "failed" && (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-2 p-4 text-litt-fg-subtle">
          <ImageIcon className="shrink-0" />
          <span className="truncate text-litt-small @max-[10rem]:hidden">Image didn&apos;t load</span>
        </span>
      )}
      {/* The hairline lies over the image, so a white image keeps its edge. An open button strengthens it on hover. */}
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_var(--litt-line)]",
          corners,
          interactive
            ? "transition-[box-shadow] duration-(--litt-dur-instant) ease-litt group-hover/media:shadow-[inset_0_0_0_1px_var(--litt-line-strong)] group-active/media:shadow-[inset_0_0_0_1px_var(--litt-line-strong)]"
            : "",
        ].join(" ")}
      />
    </span>
  );

  const body = interactive ? (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={onOpen}
      className={[
        "group/media relative block w-full cursor-zoom-in text-left [-webkit-tap-highlight-color:transparent]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus",
        corners,
        caption ? "" : className,
      ].join(" ")}
      style={caption ? undefined : style}
    >
      {frame}
    </button>
  ) : (
    frame
  );

  if (!caption) return body;
  return (
    <figure className={"grid min-w-0 content-start gap-2 " + className} style={style}>
      {body}
      <figcaption className="text-litt-small text-litt-fg-subtle">{caption}</figcaption>
    </figure>
  );
}
