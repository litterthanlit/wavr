"use client";

import { useState, useEffect } from "react";

const STEPS = [
  {
    title: "Welcome to Wavr",
    desc: "Create animated gradients with real-time controls. Move your mouse over the canvas to interact.",
  },
  {
    title: "Gradient Controls",
    desc: "Use the sidebar on the right to change gradient type, colors, speed, and other parameters.",
  },
  {
    title: "Effects",
    desc: "Switch to the Effects tab to add noise, particles, bloom, blur, ASCII art, dithering, and more.",
  },
  {
    title: "Layers",
    desc: "Add up to 4 layers at the top of the sidebar. Each layer has its own gradient type and blend mode.",
  },
  {
    title: "Export & Share",
    desc: "Click Export to download as PNG, CSS, video, or embed code. Click Share to copy a link.",
  },
  {
    title: "Keyboard Shortcuts",
    desc: "Press ? to see all shortcuts. Space to play/pause, R to randomize, Cmd+Z to undo.",
  },
];

const STORAGE_KEY = "wavr-onboarding-seen";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, "true");
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto bg-base border border-border rounded-xl p-5 w-[340px] shadow-2xl">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-sm font-medium text-text-primary">{current.title}</h3>
          <button
            onClick={dismiss}
            className="text-text-tertiary hover:text-text-primary text-xs transition-colors"
          >
            Skip
          </button>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed mb-4">{current.desc}</p>
        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? "bg-accent" : "bg-elevated"
                }`}
              />
            ))}
          </div>
          <button
            onClick={next}
            className="px-4 py-1.5 text-xs text-white bg-accent hover:bg-accent/80
              rounded-md transition-all duration-150"
          >
            {step === STEPS.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
