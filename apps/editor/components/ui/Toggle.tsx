"use client";

import { Switch } from "@/components/litt/switch";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** litt's Switch in a settings row: label first, the switch at the row's end, neutral (R6). */
export default function Toggle({ label, checked, onChange }: ToggleProps) {
  return <Switch label={label} checked={checked} onCheckedChange={onChange} tone="neutral" align="end" />;
}
