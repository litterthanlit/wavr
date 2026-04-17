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

  it("no gradient command for the image type", () => {
    const commands = getCommands(noopUi());
    const imageCmd = commands.find((c) => c.id === "gradient.image");
    expect(imageCmd).toBeUndefined();
  });
});
