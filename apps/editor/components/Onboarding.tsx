"use client";

import { useState, useEffect } from "react";
import { ONBOARDING_STORAGE_KEY } from "@/lib/onboarding";
import { Button } from "@/components/litt/button";

const STEPS = [
  {
    title: "Welcome to Wavr",
    desc: "Create animated gradients with real-time controls. Move your mouse over the canvas to interact with the gradient.",
  },
  {
    title: "Gradient controls",
    desc: "Pick a look in the Gradient tab, then shape its colours and motion. Each look brings its own palette, and Reset brings it back.",
  },
  {
    title: "Effects",
    desc: "Effects: bloom, grain and the pointer.",
  },
  {
    title: "Layers",
    desc: "Add up to 4 layers at the top of the sidebar. Each layer has its own look, colours and blend mode.",
  },
  {
    title: "Export and share",
    desc: "Click Export to download as PNG, CSS, video, or embed code. Click Share to copy a shareable link.",
  },
  {
    title: "Keyboard shortcuts",
    desc: "Press ? to see all shortcuts. Space to play/pause, R to randomize, Cmd+Z to undo.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!seen) {
      requestAnimationFrame(() => setVisible(true));
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];

  // A floating glass card, not a dialog: the editor stays usable behind it, so it is part of the page's view,
  // whose one accent fill is Export. Next is secondary.
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-litt-gutter">
      <section
        aria-label="Welcome tour"
        className="litt-glass pointer-events-auto grid w-84 max-w-full gap-4 rounded-litt-surface p-6"
      >
        <div className="grid gap-1">
          <h3 className="text-litt-h4 text-litt-fg">{current.title}</h3>
          <p className="text-litt-small text-litt-fg-muted">{current.desc}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="mr-auto text-litt-caption font-normal text-litt-fg-subtle tabular-nums">
            {step + 1} of {STEPS.length}
          </span>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          <Button size="sm" onClick={next}>
            {step === STEPS.length - 1 ? "Get started" : "Next"}
          </Button>
        </div>
      </section>
    </div>
  );
}
