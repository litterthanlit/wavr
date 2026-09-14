import type { GradientConfig, GradientType } from "@wavr/core";
import {
  GRADIENT_TYPES,
  activeLayer,
  cloneConfig,
  formatReactSnippet,
  hexToRgb,
  padColors,
  patchActiveLayer,
  patchConfig,
  rgbToHex,
  shouldShowEditor,
} from "./config";
import { PRESET_OPTIONS, getPreset } from "./presets";
import { EDITOR_CSS } from "./styles";

export interface WavrEditorOptions {
  config: GradientConfig;
  onChange?: (config: GradientConfig) => void;
  onApply?: (config: GradientConfig) => void;
  visible?: boolean;
}

export interface WavrEditorHandle {
  update(config: GradientConfig): void;
  destroy(): void;
  getConfig(): GradientConfig;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = el("textarea");
      area.value = text;
      area.setAttribute("readonly", "true");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function mountWavrEditor(
  host: HTMLElement,
  options: WavrEditorOptions,
): WavrEditorHandle {
  const visible = shouldShowEditor(options.visible);
  let current = cloneConfig(options.config);
  let panelOpen = visible;
  let destroyed = false;

  const root = el("div", { class: "wavr-editor-root", "data-wavr-editor": "root" });
  root.style.cssText = "position:absolute;inset:0;pointer-events:none;z-index:2147483000;";
  const shadow = root.attachShadow({ mode: "open" });
  const style = el("style");
  style.textContent = EDITOR_CSS;
  const shell = el("div", { class: "wavr-ed" });
  const chip = el("button", { class: "wavr-ed-chip", type: "button", "data-wavr-editor": "chip" });
  chip.append(el("span", { class: "wavr-ed-dot" }), document.createTextNode("Wavr"));
  const panel = el("aside", { class: "wavr-ed-panel", "data-wavr-editor": "panel" });
  const status = el("div", { class: "wavr-ed-status", "data-wavr-editor": "status" });

  const typeSelect = el("select", { class: "wavr-ed-select", "data-wavr-editor": "type" });
  for (const type of GRADIENT_TYPES) {
    typeSelect.append(el("option", { value: type }, type));
  }

  const presetWrap = el("div", { class: "wavr-ed-presets" });
  const presetButtons = new Map<string, HTMLButtonElement>();
  for (const preset of PRESET_OPTIONS) {
    const button = el("button", {
      class: "wavr-ed-preset",
      type: "button",
      "data-preset": preset.id,
    }, preset.label);
    button.addEventListener("click", () => {
      const next = getPreset(preset.id);
      if (!next) return;
      applyConfig(cloneConfig(next), true);
    });
    presetButtons.set(preset.id, button);
    presetWrap.append(button);
  }

  const colorWrap = el("div", { class: "wavr-ed-colors" });
  const colorInputs = [0, 1, 2, 3].map((index) => {
    const input = el("input", {
      type: "color",
      "data-wavr-editor": `color-${index}`,
    });
    input.addEventListener("input", () => {
      const colors = padColors(activeLayer(current).colors);
      colors[index] = hexToRgb(input.value);
      applyConfig(patchActiveLayer(current, { colors }), true);
    });
    colorWrap.append(input);
    return input;
  });

  function slider(
    key: "speed" | "complexity" | "scale" | "distortion",
    min: string,
    max: string,
    step: string,
  ): HTMLInputElement {
    const input = el("input", {
      class: "wavr-ed-range",
      type: "range",
      min,
      max,
      step,
      "data-wavr-editor": key,
    });
    input.addEventListener("input", () => {
      applyConfig(patchActiveLayer(current, { [key]: Number(input.value) }), true);
    });
    return input;
  }

  const speed = slider("speed", "0", "2", "0.01");
  const complexity = slider("complexity", "1", "8", "1");
  const scale = slider("scale", "0.2", "3", "0.01");
  const distortion = slider("distortion", "0", "1", "0.01");
  const vignette = el("input", {
    class: "wavr-ed-range",
    type: "range",
    min: "0",
    max: "1",
    step: "0.01",
    "data-wavr-editor": "vignette",
  });
  const grain = el("input", {
    class: "wavr-ed-range",
    type: "range",
    min: "0",
    max: "1",
    step: "0.01",
    "data-wavr-editor": "grain",
  });
  const bloomEnabled = el("input", { type: "checkbox", "data-wavr-editor": "bloom-enabled" });
  const bloomIntensity = el("input", {
    class: "wavr-ed-range",
    type: "range",
    min: "0",
    max: "1",
    step: "0.01",
    "data-wavr-editor": "bloom-intensity",
  });

  typeSelect.addEventListener("change", () => {
    applyConfig(patchActiveLayer(current, { type: typeSelect.value as GradientType }), true);
  });
  vignette.addEventListener("input", () => {
    applyConfig(patchConfig(current, { vignette: Number(vignette.value) }), true);
  });
  grain.addEventListener("input", () => {
    applyConfig(patchConfig(current, { grain: Number(grain.value) }), true);
  });
  bloomEnabled.addEventListener("change", () => {
    applyConfig(
      patchConfig(current, {
        bloom: { enabled: bloomEnabled.checked, intensity: Number(bloomIntensity.value) },
      }),
      true,
    );
  });
  bloomIntensity.addEventListener("input", () => {
    applyConfig(
      patchConfig(current, {
        bloom: { enabled: bloomEnabled.checked, intensity: Number(bloomIntensity.value) },
      }),
      true,
    );
  });

  const copyJson = el("button", { type: "button", "data-wavr-editor": "copy-json" }, "Copy JSON");
  const copyReact = el("button", { type: "button", "data-wavr-editor": "copy-react" }, "Copy React");
  const applyBtn = el("button", {
    class: "wavr-ed-apply",
    type: "button",
    "data-wavr-editor": "apply",
  }, options.onApply ? "Apply to project" : "Download config");

  copyJson.addEventListener("click", async () => {
    const ok = await writeClipboard(JSON.stringify(current, null, 2));
    status.textContent = ok ? "Copied JSON" : "Copy failed";
  });
  copyReact.addEventListener("click", async () => {
    const ok = await writeClipboard(formatReactSnippet(current));
    status.textContent = ok ? "Copied React snippet" : "Copy failed";
  });
  applyBtn.addEventListener("click", async () => {
    if (options.onApply) {
      try {
        await options.onApply(cloneConfig(current));
        status.textContent = "Applied to project";
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Apply failed";
      }
      return;
    }
    const blob = new Blob([JSON.stringify(current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: "wavr.config.json" });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    status.textContent = "Downloaded wavr.config.json";
  });

  const actions = el("div", { class: "wavr-ed-actions" });
  actions.append(copyJson, copyReact, applyBtn);

  const head = el("div", { class: "wavr-ed-head" });
  head.append(el("p", { class: "wavr-ed-title" }, "Editor"), el("p", { class: "wavr-ed-sub" }, "E to toggle"));

  const bloomRow = el("label", { class: "wavr-ed-check" });
  bloomRow.append(bloomEnabled, document.createTextNode("Bloom"));

  panel.append(
    head,
    el("span", { class: "wavr-ed-label" }, "Presets"),
    presetWrap,
    el("span", { class: "wavr-ed-label" }, "Type"),
    typeSelect,
    el("span", { class: "wavr-ed-label" }, "Colors"),
    colorWrap,
    el("span", { class: "wavr-ed-label" }, "Speed"),
    speed,
    el("span", { class: "wavr-ed-label" }, "Complexity"),
    complexity,
    el("span", { class: "wavr-ed-label" }, "Scale"),
    scale,
    el("span", { class: "wavr-ed-label" }, "Distortion"),
    distortion,
    el("span", { class: "wavr-ed-label" }, "Bloom"),
    bloomRow,
    bloomIntensity,
    el("span", { class: "wavr-ed-label" }, "Vignette"),
    vignette,
    el("span", { class: "wavr-ed-label" }, "Grain"),
    grain,
    actions,
    status,
  );

  shell.append(panel, chip);
  shadow.append(style, shell);
  host.appendChild(root);

  function syncFields(): void {
    const layer = activeLayer(current);
    typeSelect.value = GRADIENT_TYPES.includes(layer.type) ? layer.type : "mesh";
    const colors = padColors(layer.colors);
    colorInputs.forEach((input, index) => {
      const color = colors[index] ?? [0, 0, 0];
      input.value = rgbToHex(color);
    });
    speed.value = String(layer.speed ?? 0.4);
    complexity.value = String(layer.complexity ?? 3);
    scale.value = String(layer.scale ?? 1);
    distortion.value = String(layer.distortion ?? 0.3);
    vignette.value = String(current.vignette ?? 0);
    grain.value = String(current.grain ?? 0);
    bloomEnabled.checked = Boolean(current.bloom?.enabled);
    bloomIntensity.value = String(current.bloom?.intensity ?? 0.3);
    for (const [id, button] of presetButtons) {
      const preset = getPreset(id);
      button.dataset.active = preset && JSON.stringify(preset) === JSON.stringify(current) ? "true" : "false";
    }
  }

  function setPanelOpen(open: boolean): void {
    panelOpen = open;
    panel.hidden = !open;
    chip.setAttribute("aria-expanded", String(open));
  }

  function applyConfig(next: GradientConfig, emit: boolean): void {
    current = cloneConfig(next);
    syncFields();
    if (emit) options.onChange?.(cloneConfig(current));
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "e" && event.key !== "E") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    event.preventDefault();
    setPanelOpen(!panelOpen);
  };

  chip.addEventListener("click", () => setPanelOpen(!panelOpen));
  window.addEventListener("keydown", onKey);

  syncFields();
  setPanelOpen(visible);
  if (!visible) root.style.display = "none";

  return {
    update(config: GradientConfig) {
      if (destroyed) return;
      applyConfig(config, false);
    },
    getConfig() {
      return cloneConfig(current);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("keydown", onKey);
      root.remove();
    },
  };
}
