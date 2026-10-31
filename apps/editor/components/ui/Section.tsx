import type { ReactNode } from "react";

/** A panel section, always open: litt's 12px label in sentence case over its controls. Panels draw the hairline between sections. */
export default function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 py-6 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-litt-caption font-litt-label text-litt-fg-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
