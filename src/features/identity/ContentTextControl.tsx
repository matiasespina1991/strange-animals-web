import { useId } from "react";
import { capitalizeWords } from "./design-configurator-model";

export function ContentTextControl({ text, onChange, onTransform, onCommit }: {
  text: string;
  onChange: (text: string) => void;
  onTransform: (text: string) => void;
  onCommit: () => void;
}) {
  const id = useId();
  return <div className="dc-field dc-text-field">
    <div className="dc-content-heading">
      <label htmlFor={id}>Content</label>
      <span>{text.length} characters</span>
      <div className="dc-content-casing" role="group" aria-label="Text case">
        {[
          { label: "aa", title: "All lowercase", transform: (value: string) => value.toLowerCase() },
          { label: "Aa", title: "Capitalize each word", transform: capitalizeWords },
          { label: "AA", title: "All uppercase", transform: (value: string) => value.toUpperCase() },
        ].map(({ label, title, transform }) => <button key={label} type="button" className="dc-capitalize" title={title} aria-label={title}
          disabled={!text.trim()} onClick={() => onTransform(transform(text).slice(0, 3000))}>{label}</button>)}
      </div>
    </div>
    <textarea id={id} maxLength={3000} rows={4} value={text} onChange={event => onChange(event.target.value)} onBlur={onCommit} />
  </div>;
}
