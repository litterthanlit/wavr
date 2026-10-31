"use client";

import { LazySegmented } from "@/components/lazy";

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** litt's Segmented at the tool size, filling the panel's width, loaded on first use (components/lazy.tsx). The label names the group for screen readers. */
export default function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  // The lazy component loses the generic, so the picked value is read back from the typed options.
  const pick = (v: string) => {
    const option = options.find((o) => o.value === v);
    if (option) onChange(option.value);
  };
  return <LazySegmented legend={label} value={value} options={[...options]} onValueChange={pick} size="sm" block />;
}
