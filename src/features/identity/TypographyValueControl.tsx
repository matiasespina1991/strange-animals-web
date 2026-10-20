import { useId } from "react";

export function TypographyValueControl({ label, unit, value, min, max, sliderMax = max, step, onChange, onCommit }: {
  label: string; unit?: string; value: number; min: number; max: number; step: number;
  sliderMax?: number;
  onChange: (value: number) => void; onCommit: () => void;
}) {
  const id = useId();
  const change = (raw: string) => {
    const number = Number(raw);
    if (Number.isFinite(number)) onChange(Math.min(max, Math.max(min, number)));
  };
  return <div className="dc-field dc-typography-value">
    <span><label htmlFor={id}>{label}</label>{unit && <small>{unit}</small>}</span>
    <input id={id} type="number" min={min} max={max} step={step} value={value}
      onChange={(event) => change(event.target.value)} onBlur={onCommit} />
    <input type="range" aria-label={`${label} slider`} min={min} max={sliderMax} step={step} value={Math.min(value, sliderMax)}
      onChange={(event) => change(event.target.value)}
      onPointerUp={onCommit} onPointerCancel={onCommit} onKeyUp={onCommit} onBlur={onCommit} />
  </div>;
}
