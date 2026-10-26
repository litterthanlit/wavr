/** The sidebar's tabs, in order: number keys 1 to 5 open them. */
export const SIDEBAR_TABS = [
  { id: "gradient", label: "Gradient" },
  { id: "effects", label: "Effects" },
  { id: "presets", label: "Presets" },
  { id: "scene", label: "3D" },
  { id: "code", label: "Shader" },
] as const;

export type SidebarTab = (typeof SIDEBAR_TABS)[number]["id"];
