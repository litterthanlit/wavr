"use client";

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle-row">
      <span className="toggle-label">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`toggle-switch ${checked ? "toggle-on" : "toggle-off"}`}
      >
        <span className={`toggle-knob ${checked ? "translate-x-[18px]" : "translate-x-0"}`} />
      </button>
    </label>
  );
}
