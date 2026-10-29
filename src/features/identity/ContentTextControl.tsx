import { useId, type Ref } from "react";
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { capitalizeWords } from "./design-configurator-model";

export function ContentTextControl({ text, onChange, onTransform, onCommit, align, onAlignChange, textareaRef }: {
  text: string;
  onChange: (text: string) => void;
  onTransform: (text: string) => void;
  onCommit: () => void;
  align?: "start" | "middle" | "end";
  onAlignChange?: (align: "start" | "middle" | "end") => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  // These buttons transform the actual content, so derive their state from it.
  // Manual edits, undo and switching layers cannot leave a stale active button.
  const hasCase = text.toLowerCase() !== text.toUpperCase();
  const activeCase = !hasCase ? undefined : text === text.toLowerCase() ? "aa"
    : text === text.toUpperCase() ? "AA" : text === capitalizeWords(text) ? "Aa" : undefined;
  return <div className="dc-field dc-text-field">
    <div className="dc-content-heading">
      <label htmlFor={id}>Content</label>
      <div className="dc-content-actions">
      {onAlignChange && <div className="dc-content-casing" role="group" aria-label="Text anchor">
        {(["start", "middle", "end"] as const).map((value, index) => {
          const Icon = [AlignLeft, AlignCenter, AlignRight][index];
          const title = ["Start anchor", "Center anchor", "End anchor"][index];
          return <button key={value} type="button" className="dc-capitalize" title={title} aria-label={title}
            aria-pressed={align === value} onClick={() => onAlignChange(value)}><Icon size={13} /></button>;
        })}
      </div>}
      <div className="dc-content-casing" role="group" aria-label="Text case">
        {[
          { label: "aa", title: "All lowercase", transform: (value: string) => value.toLowerCase() },
          { label: "Aa", title: "Capitalize each word", transform: capitalizeWords },
          { label: "AA", title: "All uppercase", transform: (value: string) => value.toUpperCase() },
        ].map(({ label, title, transform }) => <button key={label} type="button" className="dc-capitalize" title={title} aria-label={title}
          aria-pressed={activeCase === label}
          disabled={!text.trim()} onClick={() => onTransform(transform(text).slice(0, 3000))}>{label}</button>)}
      </div>
      </div>
    </div>
    <textarea ref={textareaRef} id={id} maxLength={3000} rows={4} value={text} onChange={event => onChange(event.target.value)} onBlur={onCommit} />
  </div>;
}
