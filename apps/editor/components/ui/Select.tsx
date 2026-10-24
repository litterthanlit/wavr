"use client";

import { SelectField } from "@/components/litt/select";
import { Combobox } from "@/components/litt/combobox";

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; group?: string }[];
  onChange: (value: string) => void;
}

/**
 * One value from a list. A flat list is litt's Select; a grouped one (gradient
 * types, blend modes) is long enough to search, so it is litt's Combobox.
 */
export default function Select({ label, value, options, onChange }: SelectProps) {
  if (options.some((option) => option.group)) {
    return (
      <Combobox
        label={label}
        size="sm"
        options={options}
        value={value}
        // A field left empty clears the pick; the panels always need a value.
        onValueChange={(next) => {
          if (next) onChange(next);
        }}
      />
    );
  }
  return <SelectField label={label} size="sm" options={options} value={value} onValueChange={onChange} />;
}
