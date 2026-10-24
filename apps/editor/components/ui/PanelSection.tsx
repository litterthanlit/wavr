"use client";

import { useId, type ReactNode } from "react";

interface PanelSectionProps {
  title: string;
  children: ReactNode;
}

/**
 * One group of controls in a panel: a 12px label at the label weight in the
 * quiet ink (sentence case), then its controls 16px apart. Sections are
 * divided by a hairline.
 */
export default function PanelSection({ title, children }: PanelSectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-litt-line py-6 first:border-t-0 first:pt-2">
      <h3 id={id} className="text-litt-caption font-litt-label text-litt-fg-subtle">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A titled group inside a section, such as "Mask 1": the title weight in the foreground ink. */
export function PanelSubsection({ title, children }: PanelSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-litt-small font-litt-title text-litt-fg">{title}</h4>
      {children}
    </div>
  );
}
