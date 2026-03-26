"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDismiss, duration = 5000 }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setTimeout(onDismiss, 200);
      }, duration);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible, duration, onDismiss]);

  if (!visible && !show) return null;

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg
        bg-elevated border border-border shadow-lg text-xs text-text-secondary
        transition-all duration-200 ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
    >
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button
          onClick={() => { setShow(false); setTimeout(onDismiss, 200); }}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Dismiss"
        >
          x
        </button>
      </div>
    </div>
  );
}
