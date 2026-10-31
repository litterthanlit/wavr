"use client";

import { useEffect, useEffectEvent } from "react";
import { showToast } from "@/components/lazy";

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

/**
 * Hands a message to litt's Toaster (LazyToaster, mounted once in app/editor/page.tsx), which shows, times and
 * dismisses it. The caller's flag is released at once, so the same message can be shown again.
 */
export default function Toast({ message, visible, onDismiss, duration = 5000 }: ToastProps) {
  const release = useEffectEvent(onDismiss);
  useEffect(() => {
    if (!visible) return;
    showToast({ title: message, duration });
    release();
  }, [visible, message, duration]);
  return null;
}
