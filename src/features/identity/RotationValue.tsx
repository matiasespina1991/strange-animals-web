import { useState } from "react";

export function RotationValue({ value, min, max, onChange }: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const finish = () => {
    const number = Number(draft);
    if (draft.trim() && Number.isFinite(number))
      onChange(Math.min(max, Math.max(min, number)));
    setEditing(false);
  };
  return editing ? (
    <input
      className="dc-rotation-input"
      aria-label="Rotation in degrees"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step="any"
      value={draft}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={finish}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setEditing(false);
        }
        event.stopPropagation();
      }}
    />
  ) : (
    <output
      tabIndex={0}
      title="Double-click to edit rotation"
      aria-label={`Rotation ${value} degrees. Double-click or press Enter to edit.`}
      onDoubleClick={() => { setDraft(String(value)); setEditing(true); }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          setDraft(String(value));
          setEditing(true);
        }
      }}
    >
      {value} <small>°</small>
    </output>
  );
}
