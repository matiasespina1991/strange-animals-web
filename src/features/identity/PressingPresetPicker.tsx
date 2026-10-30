import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PRESSING_PRESETS, type PressingPreset } from "./pressing-rings";
import type { LabelDesign } from "./design-configurator-model";

export function PressingPresetPicker({ value, onChange, disabled = false, marksEnabled = true, onMarksChange, sleeveMaterial = "printed-board", onSleeveMaterialChange }: {
  value: PressingPreset; onChange: (value: PressingPreset) => void; disabled?: boolean;
  marksEnabled?: boolean; onMarksChange?: (enabled: boolean) => void;
  sleeveMaterial?: NonNullable<LabelDesign["sleeveMaterial"]>; onSleeveMaterialChange?: (value: NonNullable<LabelDesign["sleeveMaterial"]>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = PRESSING_PRESETS.find(preset => preset.id === value)!;
  const show = () => {
    setActive(PRESSING_PRESETS.findIndex(preset => preset.id === value));
    setOpen(true);
  };
  const choose = (index: number) => {
    onChange(PRESSING_PRESETS[index].id);
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open || disabled) return;
    list.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, disabled]);
  return <div className="dc-pressing-picker" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <span id={`${id}-label`} className="dc-pressing-label">Pressing rings</span>
    <div className="dc-pressing-select">
    <button ref={trigger} type="button" className="dc-pressing-trigger" disabled={disabled}
      aria-haspopup="listbox" aria-expanded={open && !disabled} aria-controls={`${id}-list`}
      aria-label={`Pressing rings: ${selected.label}`} title="Preview only; included in shared 3D model"
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); }
      }}>
      <span>{selected.label}</span><ChevronDown size={12} aria-hidden="true" />
    </button>
    {open && !disabled && <div ref={list} id={`${id}-list`} className="dc-pressing-menu" role="listbox" tabIndex={-1}
      aria-labelledby={`${id}-label`} aria-activedescendant={`${id}-option-${active}`}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
        else if (event.key === "Tab") { setOpen(false); trigger.current?.focus(); }
        else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(active); }
        else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          setActive(current => event.key === "Home" ? 0 : event.key === "End" ? PRESSING_PRESETS.length - 1 :
            (current + (event.key === "ArrowDown" ? 1 : -1) + PRESSING_PRESETS.length) % PRESSING_PRESETS.length);
        }
      }}>
      {PRESSING_PRESETS.map((preset, index) => <div key={preset.id} id={`${id}-option-${index}`} role="option"
        aria-selected={preset.id === value} data-active={index === active}
        onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>
        <span>{preset.label}</span>{preset.id === value && <Check size={13} aria-hidden="true" />}
      </div>)}
    </div>}
    </div>
    <label className="dc-pressing-marks">
      <input type="checkbox" checked={marksEnabled} disabled={disabled}
        onChange={event => onMarksChange?.(event.target.checked)} />
      Pressing marks
    </label>
    <label className="dc-paper-texture">
      Sleeve material
      <select value={sleeveMaterial} disabled={disabled}
        onChange={event => onSleeveMaterialChange?.(event.target.value as NonNullable<LabelDesign["sleeveMaterial"]>)}>
        <option value="printed-board">Printed Cardboard</option>
        <option value="printed-board-glossy">Printed Cardboard — Glossy</option>
        <option value="matte">Matte</option>
      </select>
    </label>
  </div>;
}
