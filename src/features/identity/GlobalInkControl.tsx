import { useEffect, useState } from "react";
import { ColorSwatches } from "./ColorSwatches";
import { DESIGN_COLOR_PRESETS } from "./design-configurator-colors";
import { TextColorConfirmation } from "./TextColorConfirmation";
import { ArrowLeftRight } from "lucide-react";

type Props = {
  colors: string[];
  hasCustomColors: boolean;
  onApply: (color: string) => void;
  labelColor?: string;
  onSwap?: () => void;
};

export function GlobalInkControl({ colors, hasCustomColors, onApply, labelColor, onSwap }: Props) {
  const current = colors[0] ?? "#20211e";
  const mixed = colors.some(
    (color) => color.toLowerCase() !== current.toLowerCase(),
  );
  const [draft, setDraft] = useState(current);
  const [pendingColor, setPendingColor] = useState<{ color: string; swap: boolean } | null>(null);
  useEffect(() => setDraft(current), [current]);
  const complete = (color: string, swap: boolean) => {
    setDraft(color);
    if (swap && onSwap) onSwap(); else onApply(color);
  };
  const apply = (color: string, swap = false) => {
    if (!colors.some((value) => value.toLowerCase() !== color.toLowerCase()))
      return;
    if (hasCustomColors) {
      setPendingColor({ color, swap });
      return;
    }
    complete(color, swap);
  };
  return (
    <div className="dc-preview-stock" aria-label="Global text color">
      <span>Text color</span>
      <label className="dc-custom-paper">
        <span className="sr-only">
          Custom color for all text on sides A and B
        </span>
        <input
          type="color"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => apply(draft)}
        />
      </label>
      <ColorSwatches
        colors={DESIGN_COLOR_PRESETS}
        value={mixed ? undefined : current}
        label="Text color"
        onChoose={apply}
      >
        {pendingColor && (
          <TextColorConfirmation
            color={pendingColor.color}
            onCancel={() => {
              setPendingColor(null);
              setDraft(current);
            }}
            onConfirm={() => {
              complete(pendingColor.color, pendingColor.swap);
              setPendingColor(null);
            }}
          />
        )}
      </ColorSwatches>
      {onSwap && labelColor && colors.length > 0 && !mixed && labelColor.toLowerCase() !== current.toLowerCase() && (
        <button className="dc-swap-colors" aria-label="Swap text and label colors" title="Swap text and label colors"
          onClick={() => apply(labelColor, true)}><ArrowLeftRight size={15} /></button>
      )}
    </div>
  );
}
