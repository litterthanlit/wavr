import type { ReactNode } from "react";

/**
 * A titled group of controls in a sidebar panel, always open. Panels stack
 * them in a `divide-y divide-border` column, which rules them apart. `aside`
 * sits at the right of the title.
 */
export default function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="section-title">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
