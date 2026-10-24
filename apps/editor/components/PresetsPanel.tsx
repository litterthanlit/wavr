"use client";

import { useGradientStore } from "@/lib/store";
import { PRESETS, CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/presets";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/litt/accordion";

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export default function PresetsPanel() {
  const loadPreset = useGradientStore((s) => s.loadPreset);
  const categories = CATEGORY_ORDER.filter((cat) => PRESETS.some((p) => p.category === cat));

  return (
    <Accordion type="multiple" defaultValue={categories} className="mx-4 mt-2 mb-6">
      {categories.map((cat) => {
        const catPresets = PRESETS.filter((p) => p.category === cat);
        return (
          <AccordionItem key={cat} value={cat}>
            <AccordionTrigger>
              <span className="flex items-baseline justify-between gap-3 pr-2">
                {CATEGORY_LABELS[cat]}
                <span className="font-litt-mono text-litt-caption font-normal text-litt-fg-subtle">{catPresets.length}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2">
                {catPresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => loadPreset(preset.data)}
                    className="group flex cursor-pointer flex-col gap-2 rounded-litt-surface border border-litt-line bg-litt-surface-1 p-1 pb-2 text-left transition-colors duration-(--litt-dur-instant) ease-litt hover:border-litt-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-litt-focus"
                  >
                    <span
                      aria-hidden="true"
                      className="h-16 w-full rounded-litt-control"
                      // The thumbnail is the preset's own palette: user data, not chrome.
                      style={{
                        background: `linear-gradient(135deg, ${preset.data.colors!
                          .map((c) => rgbToHex(...c))
                          .join(", ")})`,
                      }}
                    />
                    <span className="truncate px-2 text-litt-small text-litt-fg-muted transition-colors duration-(--litt-dur-instant) ease-litt group-hover:text-litt-fg">
                      {preset.name}
                    </span>
                  </button>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
