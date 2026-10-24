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
    desc: "Use the Gradient tab in the sidebar to change type, colors, speed, and distortion. Try Domain Warp in mesh mode for deeper organic patterns.",
  },
  {
    title: "Effects",
    desc: "Switch to the Effects tab for noise, bloom, blur, curl noise, kaleidoscope, dithering, ASCII art, and more. Sections collapse to keep things tidy.",
  },
  {
    title: "Layers",
    desc: "Add up to 4 layers at the top of the sidebar. Each layer has its own gradient type, colors, and blend mode.",
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

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* It floats over the canvas, so it is glass; Next stays secondary so Export keeps the view's one accent fill. */}
      <section
        aria-labelledby="onboarding-title"
        className="litt-glass pointer-events-auto flex w-[22rem] max-w-full flex-col gap-4 rounded-litt-surface p-6"
      >
        <div className="flex flex-col gap-1">
          <p className="font-litt-mono text-litt-caption font-normal text-litt-fg-subtle">
            {step + 1} of {STEPS.length}
          </p>
          <h3 id="onboarding-title" className="text-litt-body font-litt-title text-litt-fg">{current.title}</h3>
          <p className="text-litt-small text-litt-fg-muted">{current.desc}</p>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={dismiss}>
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
