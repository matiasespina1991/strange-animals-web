import { useEffect, useState } from "react";
import { ColorSwatches } from "./ColorSwatches";
import { DESIGN_COLOR_PRESETS } from "./design-configurator-colors";
import { TextColorConfirmation } from "./TextColorConfirmation";

type Props = { colors: string[]; hasCustomColors: boolean; onApply: (color: string) => void };

export function GlobalInkControl({ colors, hasCustomColors, onApply }: Props) {
  const current = colors[0] ?? "#20211e";
  const mixed = colors.some((color) => color.toLowerCase() !== current.toLowerCase());
  const [draft, setDraft] = useState(current);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  useEffect(() => setDraft(current), [current]);
  const apply = (color: string) => {
    if (!colors.some((value) => value.toLowerCase() !== color.toLowerCase())) return;
    if (hasCustomColors) {
      setPendingColor(color);
      return;
    }
    setDraft(color);
    onApply(color);
  };
  return (
    <div className="dc-preview-stock" aria-label="Global text color">
      <span>Text color{mixed ? " · Mixed" : ""}</span>
      <label className="dc-custom-paper">
        <span className="sr-only">Custom color for all text on sides A and B</span>
        <input type="color" value={draft} onChange={(event) => setDraft(event.target.value)}
          onBlur={() => apply(draft)} />
      </label>
      <ColorSwatches colors={DESIGN_COLOR_PRESETS}
        value={mixed ? undefined : current} label="Text color" onChoose={apply}>
        {pendingColor && <TextColorConfirmation color={pendingColor}
          onCancel={() => { setPendingColor(null); setDraft(current); }}
          onConfirm={() => {
            setDraft(pendingColor);
            onApply(pendingColor);
            setPendingColor(null);
          }} />}
      </ColorSwatches>
    </div>
  );
}
