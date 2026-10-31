export const SIDEBAR_TABS = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
] as const;

/** Tabs opened from the command palette; shown as a closable fourth tab. */
export const TOOL_TABS = [
  { id: "scene", label: "3D" },
  { id: "code", label: "Shader" },
] as const;

export type SidebarTab = (typeof SIDEBAR_TABS | typeof TOOL_TABS)[number]["id"];

export function isToolTab(tab: SidebarTab): boolean {
  return TOOL_TABS.some((t) => t.id === tab);
}
