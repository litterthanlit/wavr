import { describe, it, expect } from "vitest";
import {
  getCommands,
  COMMAND_GROUP_ORDER,
  type CommandGroup,
  type UiActions,
} from "./commands";
import { PRESETS } from "./presets";
import { useGradientStore } from "./store";
import { EFFECT_SWITCHES } from "./effect-switches";

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

  it("switches the three sidebar tabs with keys 1 to 3: Gradient, Effects, Presets", () => {
    const tabs = getCommands(noopUi()).filter((c) => c.id.startsWith("view.tab."));
    expect(tabs.map((c) => [c.shortcut, c.label])).toEqual([
      ["1", "Switch to Gradient tab"],
      ["2", "Switch to Effects tab"],
      ["3", "Switch to Presets tab"],
    ]);
  });

  it("opens 3D and Shader as tool tabs, with no shortcut", () => {
    const opened: string[] = [];
    const commands = getCommands({ ...noopUi(), setTab: (tab) => opened.push(tab) });
    const tools = commands.filter((c) => c.id.startsWith("view.open."));
    expect(tools.map((c) => [c.id, c.label, c.shortcut])).toEqual([
      ["view.open.scene", "3D tab", undefined],
      ["view.open.code", "Shader tab", undefined],
    ]);
    for (const tool of tools) tool.run();
    expect(opened).toEqual(["scene", "code"]);
  });

  it("switches only the effects the panels offer", () => {
    const effects = getCommands(noopUi()).filter((c) => c.group === "Effects").map((c) => c.id);
    expect(effects).toEqual([
      "effect.realBloomEnabled",
      "effect.scene3DEnabled",
      "effect.grain",
      "effect.mouseReact",
    ]);
  });

  it("switches grain and pointer between off and their starting amounts", () => {
    const run = (id: string) => getCommands(noopUi()).find((c) => c.id === id)?.run();
    const before = useGradientStore.getState();
    useGradientStore.setState({ grain: 0.4, mouseReact: 0 });
    try {
      run("effect.grain");
      expect(useGradientStore.getState().grain).toBe(0);
      run("effect.grain");
      expect(useGradientStore.getState().grain).toBe(EFFECT_SWITCHES.grain.onValue);
      run("effect.mouseReact");
      expect(useGradientStore.getState().mouseReact).toBe(EFFECT_SWITCHES.mouseReact.onValue);
      expect(getCommands(noopUi()).find((c) => c.id === "effect.mouseReact")?.label).toBe("Toggle pointer (on)");
    } finally {
      useGradientStore.setState({ grain: before.grain, mouseReact: before.mouseReact });
    }
  });

  it("offers the three performance modes and sets the one chosen", () => {
    const before = useGradientStore.getState().performanceMode;
    const ids = getCommands(noopUi()).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["view.performance.auto", "view.performance.quality", "view.performance.battery"]));
    getCommands(noopUi()).find((c) => c.id === "view.performance.battery")?.run();
    expect(useGradientStore.getState().performanceMode).toBe("battery");
    const battery = getCommands(noopUi()).find((c) => c.id === "view.performance.battery");
    expect(battery?.disabled?.()).toBe(true);
    useGradientStore.setState({ performanceMode: before });
  });

  it("names each look as the Look grid does", () => {
    const label = (id: string) => getCommands(noopUi()).find((c) => c.id === id)?.label;
    expect(label("gradient.lightWall")).toBe("Set gradient: Light wall");
    expect(label("gradient.iridescentFoil")).toBe("Set gradient: Iridescent foil");
  });

  it("no gradient command for the image type", () => {
    const commands = getCommands(noopUi());
    const imageCmd = commands.find((c) => c.id === "gradient.image");
    expect(imageCmd).toBeUndefined();
  });
});
