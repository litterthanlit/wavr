import { createGradient } from "@wavr/core";
import type { CreateGradientOptions, GradientConfig, GradientHandle } from "@wavr/core";
import { cloneConfig, shouldShowEditor } from "./config";
import { mountWavrEditor, type WavrEditorHandle } from "./editor";

export interface WavrPreviewOptions {
  config: GradientConfig;
  editor?: boolean;
  interactive?: boolean;
  onChange?: (config: GradientConfig) => void;
  onApply?: (config: GradientConfig) => void | Promise<void>;
  onError?: CreateGradientOptions["onError"];
}

export interface WavrPreviewHandle {
  getConfig(): GradientConfig;
  gradient: GradientHandle | null;
  editor: WavrEditorHandle | null;
  destroy(): void;
}

export function mountWavrPreview(
  host: HTMLElement,
  options: WavrPreviewOptions,
): WavrPreviewHandle {
  const computed = window.getComputedStyle(host);
  if (computed.position === "static") host.style.position = "relative";

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;";
  host.appendChild(canvas);

  let current = cloneConfig(options.config);
  const bounds = host.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.max(1, Math.floor(Math.max(1, bounds.width) * dpr));
  canvas.height = Math.max(1, Math.floor(Math.max(1, bounds.height) * dpr));

  let gradient: GradientHandle | null = null;
  try {
    gradient = createGradient(canvas, current, { onError: options.onError });
    if (bounds.width > 0 && bounds.height > 0) {
      gradient.resize(Math.max(1, bounds.width), Math.max(1, bounds.height));
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    options.onError?.(err);
    console.warn("[wavr] failed to create gradient", err);
  }

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry || !gradient) return;
    gradient.resize(entry.contentRect.width, entry.contentRect.height);
  });
  observer.observe(host);

  if (options.interactive !== false) {
    const onMove = (event: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      gradient?.setMouse((event.clientX - rect.left) / rect.width, 1 - (event.clientY - rect.top) / rect.height);
    };
    host.addEventListener("mousemove", onMove);
    host.addEventListener(
      "touchmove",
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        const rect = host.getBoundingClientRect();
        gradient?.setMouse((touch.clientX - rect.left) / rect.width, 1 - (touch.clientY - rect.top) / rect.height);
      },
      { passive: true },
    );
  }

  const showEditor = shouldShowEditor(options.editor);
  const editor = showEditor
    ? mountWavrEditor(host, {
        config: current,
        onChange(next) {
          current = next;
          gradient?.update(next);
          options.onChange?.(next);
        },
        onApply: options.onApply,
        visible: true,
      })
    : null;

  return {
    getConfig: () => cloneConfig(current),
    gradient,
    editor,
    destroy() {
      observer.disconnect();
      editor?.destroy();
      gradient?.destroy();
      canvas.remove();
    },
  };
}
