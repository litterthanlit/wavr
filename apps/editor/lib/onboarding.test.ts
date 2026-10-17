import { describe, it, expect, vi, afterEach } from "vitest";
import { hasSeenOnboarding, ONBOARDING_STORAGE_KEY } from "./onboarding";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hasSeenOnboarding", () => {
  it("is false for a first-time visitor", () => {
    const getItem = vi.fn(() => null);
    vi.stubGlobal("localStorage", { getItem });

    expect(hasSeenOnboarding()).toBe(false);
    expect(getItem).toHaveBeenCalledWith(ONBOARDING_STORAGE_KEY);
  });

  it("is true once the walkthrough was dismissed", () => {
    vi.stubGlobal("localStorage", { getItem: () => "true" });

    expect(hasSeenOnboarding()).toBe(true);
  });

  it("counts unreadable storage as seen, so the walkthrough code never loads", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });

    expect(hasSeenOnboarding()).toBe(true);
  });
});
