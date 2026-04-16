"use client";

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export default function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <div className="select-wrapper">
      <span className="select-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-input"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
