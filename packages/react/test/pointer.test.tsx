import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GradientConfig } from "../src/types";

// createGradient needs WebGL; replace it with a handle whose calls we can see.
// attachPointer is the real one.
const handle = {
  update: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  setMouse: vi.fn(),
  setPointerActive: vi.fn(),
  triggerRipple: vi.fn(),
  setTime: vi.fn(),
  setSpeed: vi.fn(),
  setTimelineProgress: vi.fn(),
  animateTo: vi.fn(),
  resize: vi.fn(),
  captureFrame: vi.fn(() => new Uint8Array(0)),
  destroy: vi.fn(),
};

vi.mock("@wavr/core", async (importActual) => ({
  ...(await importActual<typeof import("@wavr/core")>()),
  createGradient: vi.fn(() => handle),
}));

import { WavrGradient, type WavrGradientProps } from "../src/WavrGradient";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const config: GradientConfig = { layers: [{ type: "mesh", colors: [[1, 0, 0], [0, 0, 1]] }] };

let host: HTMLDivElement;
let root: Root;

/** Mounts the component and gives its container a 200 x 100 box at (10, 20). */
async function mount(props: Partial<WavrGradientProps> = {}): Promise<HTMLElement> {
  await act(async () => {
    root.render(createElement(WavrGradient, { config, ...props }));
  });
  const container = host.firstElementChild as HTMLElement;
  container.getBoundingClientRect = () =>
    ({ left: 10, top: 20, width: 200, height: 100, right: 210, bottom: 120, x: 10, y: 20, toJSON() {} }) as DOMRect;
  return container;
}

const fire = (element: Element, type: string, clientX: number, clientY: number) =>
  act(async () => {
    element.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true }));
  });

describe("WavrGradient pointer", () => {
  beforeEach(() => {
    for (const fn of Object.values(handle)) fn.mockClear();
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it("the click trigger's ripple starts the engine's ripple at the click", async () => {
    const container = await mount({ events: { onClick: { effect: "ripple" } } });

    await fire(container, "click", 110, 45);

    // Centre of the box, a quarter of the way down from the top: (0.5, 0.75) with y up.
    expect(handle.triggerRipple).toHaveBeenCalledWith(0.5, 0.75);
    // And it switches the ripple effect on, or the engine would not draw it.
    expect(handle.update).toHaveBeenCalledWith({ ripple: { enabled: true, intensity: 0.8 } });
  });

  it("does not ripple on a click when there is no click trigger and the component is not interactive", async () => {
    const container = await mount({ interactive: false });
    await fire(container, "click", 110, 45);
    expect(handle.triggerRipple).not.toHaveBeenCalled();
  });

  it("an interactive component follows the pointer relative to itself, y up", async () => {
    const container = await mount();

    await fire(container, "pointermove", 110, 45);
    expect(handle.setMouse).toHaveBeenLastCalledWith(0.5, 0.75);
    await fire(container, "pointermove", 10, 120);
    expect(handle.setMouse).toHaveBeenLastCalledWith(0, 0);
  });

  it("tells the engine when the pointer leaves", async () => {
    const container = await mount();
    await fire(container, "pointermove", 60, 70);
    await fire(container, "pointerleave", 0, 0);
    expect(handle.setPointerActive).toHaveBeenLastCalledWith(false);
    await fire(container, "pointercancel", 0, 0);
    expect(handle.setPointerActive).toHaveBeenCalledTimes(2);
  });

  it("a click on an interactive component ripples when the config has a ripple on", async () => {
    const container = await mount();
    await fire(container, "click", 60, 70);
    expect(handle.triggerRipple).toHaveBeenCalledWith(0.25, 0.5);
  });

  it("ignores the pointer when not interactive", async () => {
    const container = await mount({ interactive: false });
    await fire(container, "pointermove", 110, 45);
    await fire(container, "pointerleave", 0, 0);
    expect(handle.setMouse).not.toHaveBeenCalled();
    expect(handle.setPointerActive).not.toHaveBeenCalled();
  });

  it("stops listening when unmounted", async () => {
    const container = await mount();
    await act(async () => root.unmount());
    await fire(container, "pointermove", 110, 45);
    expect(handle.setMouse).not.toHaveBeenCalled();
    root = createRoot(host);
  });
});
