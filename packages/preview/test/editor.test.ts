import { afterEach, describe, expect, it, vi } from "vitest";
import { aurora, ocean } from "@wavr/core/presets";
import { mountWavrEditor } from "../src/editor";

describe("mountWavrEditor", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/");
  });

  it("mounts, applies a preset, and returns the matching config", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const onChange = vi.fn();
    const handle = mountWavrEditor(host, { config: aurora, onChange, visible: true });

    const root = document.body.querySelector("[data-wavr-editor='root']");
    expect(root?.parentElement).toBe(document.body);
    expect(root?.shadowRoot).toBeTruthy();
    const panel = root?.shadowRoot?.querySelector("[data-wavr-editor='panel']");
    expect(panel).toBeTruthy();
    expect((panel as HTMLElement).hidden).toBe(false);

    const oceanBtn = root?.shadowRoot?.querySelector("[data-preset='ocean']") as HTMLButtonElement;
    oceanBtn.click();

    expect(handle.getConfig().layers[0]?.type).toBe("linear");
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last.layers[0].type).toBe(ocean.layers[0]?.type);
    handle.destroy();
    expect(document.body.querySelector("[data-wavr-editor='root']")).toBeNull();
  });

  it("toggles the panel with the E key and the chip", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const handle = mountWavrEditor(host, { config: aurora, visible: true });
    const root = document.body.querySelector("[data-wavr-editor='root']");
    const panel = root?.shadowRoot?.querySelector("[data-wavr-editor='panel']") as HTMLElement;
    const chip = root?.shadowRoot?.querySelector("[data-wavr-editor='chip']") as HTMLButtonElement;

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "e", bubbles: true }));
    expect(panel.hidden).toBe(true);
    chip.click();
    expect(panel.hidden).toBe(false);
    handle.destroy();
  });

  it("updates from outside without emitting", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const onChange = vi.fn();
    const handle = mountWavrEditor(host, { config: aurora, onChange, visible: true });
    handle.update(ocean);
    expect(handle.getConfig().layers[0]?.type).toBe("linear");
    expect(onChange).not.toHaveBeenCalled();
    handle.destroy();
  });
});
