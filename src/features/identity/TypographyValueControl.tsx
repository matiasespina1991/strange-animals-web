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
  zeroLabel,
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
  zeroLabel?: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const [sliderExpanded, setSliderExpanded] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [inputDraft, setInputDraft] = useState("");
  const effectiveSliderMax = sliderMax * (sliderExpanded ? 3 : 1);
  const change = (raw: string) => {
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
                ? "Use standard size slider range"
                : "Expand size slider range 3x"
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
        type={zeroLabel ? "text" : "number"}
        inputMode={zeroLabel ? "decimal" : undefined}
        min={zeroLabel ? undefined : min}
        max={zeroLabel ? undefined : max}
        step={zeroLabel ? undefined : step}
        value={inputFocused ? inputDraft : zeroLabel && value === 0 ? zeroLabel : value}
        onFocus={() => {
          setInputDraft(String(value));
          setInputFocused(true);
        }}
        onChange={(event) => {
          if (!zeroLabel) {
            change(event.target.value);
            return;
          }
          const raw = event.target.value;
          setInputDraft(raw);
          if (!raw.trim()) return;
          const number = Number(raw);
          if (Number.isFinite(number))
            onChange(Math.min(max, Math.max(min, number)));
        }}
        onBlur={() => {
          if (zeroLabel && inputFocused) {
            const number = Number(inputDraft);
            if (inputDraft.trim() && Number.isFinite(number))
              onChange(Math.min(max, Math.max(min, number)));
            setInputFocused(false);
          }
          onCommit();
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
