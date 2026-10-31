import { useId, useState, type Ref } from "react";
import { AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronUp } from "lucide-react";
import { capitalizeWords } from "./design-configurator-model";

export function ContentTextControl({ text, onChange, onTransform, onCommit, align, onAlignChange, textareaRef, onCaretChange }: {
  text: string;
  onChange: (text: string) => void;
  onTransform: (text: string) => void;
  onCommit: () => void;
  align?: "start" | "middle" | "end";
  onAlignChange?: (align: "start" | "middle" | "end") => void;
  textareaRef?: Ref<HTMLTextAreaElement>;
  onCaretChange?: (offset: number | null) => void;
}) {
  const id = useId();
  const [collapsed, setCollapsed] = useState(false);
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
      <button type="button" className="dc-content-collapse" aria-label={collapsed ? "Expand content" : "Collapse content"}
        title={collapsed ? "Expand content" : "Collapse content"} aria-expanded={!collapsed} aria-controls={id}
        onClick={() => setCollapsed(value => !value)}>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      </div>
    </div>
    <textarea ref={textareaRef} id={id} maxLength={3000} rows={collapsed ? 1 : 4} data-collapsed={collapsed} value={text}
      onFocus={event => { setCollapsed(false); onCaretChange?.(event.currentTarget.selectionEnd); }}
      onSelect={event => onCaretChange?.(event.currentTarget.selectionEnd)}
      onChange={event => { onChange(event.target.value); onCaretChange?.(event.currentTarget.selectionEnd); }}
      onBlur={() => { onCommit(); onCaretChange?.(null); }} />
  </div>;
}
