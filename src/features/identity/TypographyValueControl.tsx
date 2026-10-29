import { useId, useState } from "react";

export function TypographyValueControl({
  label,
  unit,
  value,
  min,
  max,
  sliderMax = max,
  expandSlider = false,
  step,
  onChange,
  onCommit,
}: {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  sliderMax?: number;
  expandSlider?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const [sliderExpanded, setSliderExpanded] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [inputDraft, setInputDraft] = useState("");
  const effectiveSliderMax = sliderMax * (sliderExpanded ? 3 : 1);
  const change = (raw: string) => {
    if (!raw.trim()) return;
    const number = Number(raw);
    if (Number.isFinite(number)) onChange(Math.min(max, Math.max(min, number)));
  };
  return (
    <div className="dc-field dc-typography-value">
      <span>
        <label htmlFor={id}>{label}</label>
        {expandSlider && (
          <button
            type="button"
            className="dc-typography-expand"
            aria-label={
              sliderExpanded
                ? `Use standard ${label.toLowerCase()} slider range`
                : `Expand ${label.toLowerCase()} slider range 3x`
            }
            aria-pressed={sliderExpanded}
            title={sliderExpanded ? "Use standard range" : "Expand range 3x"}
            onClick={() => setSliderExpanded((expanded) => !expanded)}
          >
            x3
          </button>
        )}
        {unit && <small>{unit}</small>}
      </span>
      <input
        id={id}
        type={"number"}
        inputMode={"decimal"}
        min={min}
        max={max}
        step={step}
        value={inputFocused ? inputDraft : value}
        onFocus={() => {
          setInputDraft(String(value));
          setInputFocused(true);
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setInputDraft(raw);
          change(raw);
        }}
        onBlur={() => {
          setInputFocused(false);
          onCommit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
      <input
        type="range"
        aria-label={`${label} slider`}
        min={min}
        max={effectiveSliderMax}
        step={step}
        value={Math.min(value, effectiveSliderMax)}
        onChange={(event) => change(event.target.value)}
        onPointerUp={onCommit}
        onPointerCancel={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </div>
  );
}
