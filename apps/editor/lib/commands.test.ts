import { describe, it, expect } from "vitest";
import {
  getCommands,
  COMMAND_GROUP_ORDER,
  type CommandGroup,
  type UiActions,
} from "./commands";
import { PRESETS } from "./presets";

function noopUi(): UiActions {
  return {
    openExport: () => {},
    openProjects: () => {},
    openShortcuts: () => {},
    setTab: () => {},
  };
}

describe("command registry", () => {
  it("every command has non-empty id, label, group, and callable run", () => {
    const commands = getCommands(noopUi());
    expect(commands.length).toBeGreaterThan(0);
    for (const cmd of commands) {
      expect(cmd.id, `missing id on ${JSON.stringify(cmd)}`).toBeTruthy();
      expect(cmd.label, `missing label on ${cmd.id}`).toBeTruthy();
      expect(cmd.group, `missing group on ${cmd.id}`).toBeTruthy();
      expect(typeof cmd.run).toBe("function");
    }
  });

  it("command ids are unique", () => {
    const commands = getCommands(noopUi());
    const ids = commands.map((c) => c.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes, `duplicate ids: ${dupes.join(", ")}`).toEqual([]);
  });

  it("at least one command exists in every CommandGroup", () => {
    const commands = getCommands(noopUi());
    const groups = new Set(commands.map((c) => c.group));
    for (const g of COMMAND_GROUP_ORDER) {
      expect(groups.has(g as CommandGroup), `no commands in group ${g}`).toBe(true);
    }
  });

  it("preset command count equals PRESETS.length", () => {
    const commands = getCommands(noopUi());
    const presetCommands = commands.filter((c) => c.group === "Presets");
    expect(presetCommands.length).toBe(PRESETS.length);
  });

  it("opens the tabs with keys 1 to 5: Gradient, Effects, Presets, 3D, Shader", () => {
    const tabs = getCommands(noopUi()).filter((c) => c.id.startsWith("view.tab."));
    expect(tabs.map((c) => [c.shortcut, c.label])).toEqual([
      ["1", "Switch to Gradient tab"],
      ["2", "Switch to Effects tab"],
      ["3", "Switch to Presets tab"],
      ["4", "Switch to 3D tab"],
      ["5", "Switch to Shader tab"],
    ]);
  });

  it("switches only the effects the panels offer", () => {
    const effects = getCommands(noopUi()).filter((c) => c.group === "Effects").map((c) => c.id);
    expect(effects).toEqual([
      "effect.realBloomEnabled",
      "effect.blurEnabled",
      "effect.rippleEnabled",
      "effect.trailEnabled",
      "effect.debandEnabled",
      "effect.scene3DEnabled",
    ]);
  });

  it("names each look as the Look grid does", () => {
    const label = (id: string) => getCommands(noopUi()).find((c) => c.id === id)?.label;
    expect(label("gradient.lightWall")).toBe("Set gradient: Light Wall");
    expect(label("gradient.iridescentFoil")).toBe("Set gradient: Iridescent Foil");
  });

  it("no gradient command for the image type", () => {
    const commands = getCommands(noopUi());
    const imageCmd = commands.find((c) => c.id === "gradient.image");
    expect(imageCmd).toBeUndefined();
  });
});
