"use client";

import { Switch } from "@/components/litt/switch";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** A line of detail under the label. */
  description?: string;
}

/** An on/off setting: litt's Switch, label first and the switch at the row's end. */
export default function Toggle({ label, checked, onChange, disabled, description }: ToggleProps) {
  return (
    <Switch
      label={label}
      description={description}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      align="end"
    />
  );
}
