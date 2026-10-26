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
    // On a phone the bottom of the screen holds the controls, so the toast
    // sits under the top bar instead.
    <div
      role="status"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg
        max-[900px]:bottom-auto max-[900px]:top-14 max-[900px]:w-max max-[900px]:max-w-[calc(100vw-32px)]
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
