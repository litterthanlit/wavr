"use client";

import { LazySelectField } from "@/components/lazy";

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

/** litt's SelectField at the tool size, loaded on first use (components/lazy.tsx). litt's Select has no option groups, so neither does this. */
export default function Select({ label, value, options, onChange }: SelectProps) {
  return <LazySelectField label={label} value={value} options={options} onValueChange={onChange} size="sm" />;
}
