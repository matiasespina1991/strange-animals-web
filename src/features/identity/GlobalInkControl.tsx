import { useEffect, useState } from "react";
import { ColorSwatches } from "./ColorSwatches";
import { GLOBAL_COLOR_PRESETS } from "./design-configurator-colors";
import { TextColorConfirmation } from "./TextColorConfirmation";

type Props = {
  side: "A" | "B" | "both";
  colors: string[];
  hasCustomColors: boolean;
  onApply: (color: string) => void;
  onPreview?: (color: string | null) => void;
  visibleCount?: number;
};

export function GlobalInkControl({ side, colors, hasCustomColors, onApply, onPreview, visibleCount = 3 }: Props) {
  const current = colors[0] ?? "#20211e";
  const mixed = colors.some(
    (color) => color.toLowerCase() !== current.toLowerCase(),
  );
  const [draft, setDraft] = useState(current);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  useEffect(() => setDraft(current), [current]);
  const complete = (color: string) => {
    setDraft(color);
    onApply(color);
  };
  const apply = (color: string) => {
    if (!colors.some((value) => value.toLowerCase() !== color.toLowerCase()))
      return;
    if (hasCustomColors) {
      setPendingColor(color);
      return;
    }
    complete(color);
  };
  return (
    <div className="dc-preview-stock" aria-label="Global text color">
      <span>Text color</span>
      <label className="dc-custom-paper">
        <span className="sr-only">
          {side === "both" ? "Custom color for all text on sides A and B" : `Custom color for all text on side ${side}`}
        </span>
        <input
          type="color"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => apply(draft)}
        />
      </label>
      <ColorSwatches
        colors={GLOBAL_COLOR_PRESETS}
        value={mixed ? undefined : current}
        label="Text color"
        visibleCount={visibleCount}
        onChoose={apply}
        onPreview={onPreview}
      >
        {pendingColor && (
          <TextColorConfirmation
            side={side}
            onCancel={() => {
              setPendingColor(null);
              setDraft(current);
            }}
            onConfirm={() => {
              complete(pendingColor);
              setPendingColor(null);
            }}
          />
        )}
      </ColorSwatches>
    </div>
  );
}
