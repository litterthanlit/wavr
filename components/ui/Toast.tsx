"use client";

import { useEffect, useCallback } from "react";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onDismiss, duration = 5000 }: ToastProps) {
  const dismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(dismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, dismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg
        bg-elevated border border-border shadow-lg text-xs text-text-secondary animate-[fadeIn_0.2s_ease-out]"
    >
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <button
          onClick={dismiss}
          className="text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Dismiss"
        >
          x
        </button>
      </div>
    </div>
  );
}
