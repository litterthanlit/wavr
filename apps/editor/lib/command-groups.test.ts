import { describe, it, expect } from "vitest";
import { getCommands, type UiActions } from "./commands";
import { toMenuGroups } from "./command-groups";
import { filter } from "@/components/litt/command-menu";

const ui: UiActions = { openExport: () => {}, openProjects: () => {}, openShortcuts: () => {}, setTab: () => {} };

/** The labels litt's command menu shows for a query, over the live registry. */
function search(query: string): string[] {
  return filter(toMenuGroups(getCommands(ui)), query).flat.map((item) => item.label);
}

describe("command menu search", () => {
  it("finds a command by a keyword that isn't in its label", () => {
    expect(search("gif")).toContain("Export…");
    expect(search("png")).toContain("Export…");
    expect(search("fps")).toEqual(expect.arrayContaining([expect.stringMatching(/render stats$/)]));
    expect(search("code")).toContain("Shader tab");
  });

  it("finds a window by what it opens, though its label drops the verb", () => {
    expect(search("open export")).toEqual(["Export…"]);
    expect(search("open projects")).toEqual(["Projects…"]);
    expect(search("open shader")).toEqual(["Shader tab"]);
  });

  it("still matches labels, ignoring case", () => {
    expect(search("SHADER TAB")).toEqual(["Shader tab"]);
  });

  it("leaves out commands that match neither", () => {
    expect(search("zzzz")).toEqual([]);
  });
});
