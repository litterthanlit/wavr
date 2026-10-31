"use client";

import Link from "next/link";
import { useId } from "react";
import { buttonClassName } from "@/lib/litt-button-classes";
import { Media } from "@/components/litt/media";
import { LandingHero } from "@/components/LandingHero";
import type { PresetId } from "@/lib/preset-entry";
import { presetThumbnail } from "@/lib/preset-thumbnail";
import { useTheme } from "@/lib/useTheme";

// The landing, in litt's terms: a glass header, a hero with the copy in
// columns 1–5 and the product running live in 7–12, one row of looks that
// open in the editor, and a footer under a hairline. One idea per section,
// left-aligned, nothing above 18px. The hero's Open editor is the view's one
// accent fill.

const REPO = "https://github.com/litterthanlit/wavr";

/** Four looks, strongest first. Names in sentence case; each opens /editor?preset=<id>. */
const LOOKS: { id: PresetId; name: string }[] = [
  { id: "aperture", name: "Aperture" },
  { id: "lightLeak", name: "Light leak" },
  { id: "plasmaOrb", name: "Orb" },
  { id: "lightWall", name: "Light wall" },
];

const linkText =
  "rounded-litt-control text-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt hover:text-litt-fg " +
  "pointer-coarse:inline-flex pointer-coarse:h-litt-control-md pointer-coarse:items-center";

export default function LandingPage() {
  // Applies a theme chosen in the editor; without one the page follows the system.
  useTheme();
  const looksId = useId();

  return (
    <div className="flex min-h-dvh flex-col bg-litt-canvas text-litt-fg">
      {/* litt's Glass header (components.md) without a nav: the registry's Header brings its Menu, and with it Radix
          and motion, for a nav this page doesn't have. The same classes, wordmark at left and actions at right. */}
      <header className="litt-glass sticky top-[env(safe-area-inset-top,0px)] z-30 rounded-none">
        <div className="mx-auto flex h-(--litt-header-h) max-w-litt-wide items-center gap-4 px-litt-gutter sm:gap-6">
          <Link
            href="/"
            className="rounded-litt-control text-litt-body font-litt-title text-litt-fg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-litt-focus pointer-coarse:inline-flex pointer-coarse:h-litt-control-md pointer-coarse:items-center"
          >
            Wavr
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <a href={REPO} className={buttonClassName({ variant: "ghost", size: "sm" }) + " pointer-coarse:h-litt-control-md"}>
              <span className="litt-trim">GitHub</span>
            </a>
            <Link href="/editor" className={buttonClassName({ variant: "secondary", size: "sm" }) + " pointer-coarse:h-litt-control-md"}>
              <span className="litt-trim">Open editor</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="pt-litt-section">
          <div className="mx-auto grid max-w-litt-wide grid-cols-1 gap-x-(--litt-grid-gap) gap-y-12 px-litt-gutter lg:grid-cols-12">
            <div className="grid content-center justify-items-start gap-8 lg:col-span-5">
              <div className="grid gap-1">
                <h1 className="text-litt-display text-balance">Light that moves, made in your browser.</h1>
                <p className="max-w-[65ch] text-litt-reading text-litt-fg-muted">
                  Shape a gradient of light, set how it moves and how it answers the pointer, then take it with you as
                  a video, an image or code.
                </p>
              </div>
              <Link href="/editor" className={buttonClassName({ variant: "primary", size: "lg" })}>
                <span className="litt-trim">Open editor</span>
              </Link>
            </div>
            <div className="min-w-0 lg:col-span-6 lg:col-start-7">
              <LandingHero
                preset="aperture"
                alt="Aperture: a tall opening of light in a dark wall, pale at its edges and cornflower blue at its core"
                caption="Aperture, the look the editor opens on."
              />
            </div>
          </div>
        </section>

        <section aria-labelledby={looksId} className="pt-litt-section pb-litt-section">
          <div className="mx-auto grid max-w-litt-wide grid-cols-1 gap-x-(--litt-grid-gap) gap-y-6 px-litt-gutter lg:grid-cols-12">
            <div className="grid content-start gap-1 lg:col-span-3">
              <h2 id={looksId} className="text-litt-h2">
                Looks
              </h2>
              <p className="text-litt-small text-litt-fg-muted">Each one opens in the editor, ready to change.</p>
            </div>
            <ul className="grid grid-cols-2 gap-x-(--litt-grid-gap) gap-y-6 sm:grid-cols-4 lg:col-span-9">
              {LOOKS.map((look) => (
                <li key={look.id}>
                  <Link
                    href={`/editor?preset=${look.id}`}
                    className="group grid gap-2 rounded-litt-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus"
                  >
                    <Media src={presetThumbnail(look.id) ?? undefined} alt="" ratio="4/3" />
                    <span className="text-litt-small font-litt-title text-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt group-hover:text-litt-fg">
                      {look.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-litt-line">
        <div className="mx-auto flex max-w-litt-wide flex-wrap items-center justify-between gap-x-6 gap-y-2 px-litt-gutter py-8 text-litt-small">
          <p className="text-litt-fg-subtle">Wavr runs in your browser. Nothing you make leaves it.</p>
          <a href={REPO} className={linkText}>
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
