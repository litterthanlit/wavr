import { afterEach, describe, expect, it, vi } from "vitest";
import { openPresetFromSearch, presetFromSearch } from "./preset-entry";
import { useGradientStore } from "./store";

describe("presetFromSearch", () => {
  it("names a catalogue preset from ?preset= when there is no hash", () => {
    expect(presetFromSearch("?preset=lightLeak", "")).toBe("lightLeak");
    expect(presetFromSearch("?preset=plasmaOrb", "#")).toBe("plasmaOrb");
  });

  it("ignores a name the catalogue doesn't have", () => {
    expect(presetFromSearch("?preset=nope", "")).toBeNull();
    expect(presetFromSearch("?preset=", "")).toBeNull();
    expect(presetFromSearch("?preset=constructor", "")).toBeNull();
    expect(presetFromSearch("", "")).toBeNull();
  });

  it("lets a shared scene in the hash win", () => {
    expect(presetFromSearch("?preset=lightLeak", "#s2.abc")).toBeNull();
  });
});

describe("openPresetFromSearch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLocation(search: string, hash = "") {
    const replaceState = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/editor", search, hash },
      history: { state: null, replaceState },
    });
    return replaceState;
  }

  it("loads the preset and drops the query", () => {
    const replaceState = stubLocation("?preset=plasmaOrb");
    openPresetFromSearch();
    expect(useGradientStore.getState().gradientType).toBe("plasmaOrb");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/editor");
  });

  it("leaves the scene alone for an unknown name, and still drops the query", () => {
    const before = useGradientStore.getState().layers;
    const replaceState = stubLocation("?preset=nope");
    expect(() => openPresetFromSearch()).not.toThrow();
    expect(useGradientStore.getState().layers).toBe(before);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/editor");
  });

  it("keeps a shared scene's hash", () => {
    const before = useGradientStore.getState().layers;
    const replaceState = stubLocation("?preset=lightLeak", "#s2.abc");
    openPresetFromSearch();
    expect(useGradientStore.getState().layers).toBe(before);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/editor#s2.abc");
  });
});
