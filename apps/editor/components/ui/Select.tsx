"use client";

interface SelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; group?: string }[];
  onChange: (value: string) => void;
}

export default function Select({ label, value, options, onChange }: SelectProps) {
  const groups = options.reduce<Record<string, typeof options>>((acc, option) => {
    const group = option.group ?? "";
    acc[group] = [...(acc[group] ?? []), option];
    return acc;
  }, {});
  const groupNames = Object.keys(groups);

  return (
    <div className="select-wrapper">
      <span className="select-label">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select-input"
      >
        {groupNames.length === 1 && groupNames[0] === ""
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : groupNames.map((group) =>
              group ? (
                <optgroup key={group} label={group}>
                  {groups[group].map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ) : (
                groups[group].map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              )
            )}
      </select>
    </div>
  );
}
