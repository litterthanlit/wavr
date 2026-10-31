import type { CommandGroup as MenuGroup } from "@/components/litt/command-menu";
import { COMMAND_GROUP_ORDER, type Command, type CommandGroup } from "@/lib/commands";

/** The registry as litt's command-menu groups, in COMMAND_GROUP_ORDER, with each command's keywords for the search. */
export function toMenuGroups(commands: Command[]): MenuGroup[] {
  const byGroup = new Map<CommandGroup, Command[]>();
  for (const cmd of commands) {
    const list = byGroup.get(cmd.group);
    if (list) list.push(cmd);
    else byGroup.set(cmd.group, [cmd]);
  }
  return COMMAND_GROUP_ORDER.flatMap((group) => {
    const items = byGroup.get(group);
    if (!items) return [];
    return [{
      id: group,
      heading: group,
      items: items.map((cmd) => ({
        id: cmd.id,
        label: cmd.label,
        shortcut: cmd.shortcut,
        disabled: cmd.disabled?.() ?? false,
        keywords: cmd.keywords,
      })),
    }];
  });
}
