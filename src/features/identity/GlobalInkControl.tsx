import { useEffect, useState } from "react";
import { ColorSwatches } from "./ColorSwatches";

type Props = { colors: string[]; onApply: (color: string) => void };

export function GlobalInkControl({ colors, onApply }: Props) {
  const current = colors[0] ?? "#20211e";
  const mixed = colors.some((color) => color.toLowerCase() !== current.toLowerCase());
  const [draft, setDraft] = useState(current);
  useEffect(() => setDraft(current), [current]);
  const apply = (color: string) => {
    if (!colors.some((value) => value.toLowerCase() !== color.toLowerCase())) return;
    if (colors.some((value) => value.toLowerCase() !== "#20211e") &&
      !window.confirm("Esto reemplazará los colores personalizados de todas las capas de texto de los lados A y B por un único color. ¿Continuar?")) {
      setDraft(current);
      return;
    }
    setDraft(color);
    onApply(color);
  };
  return (
    <div className="dc-preview-stock" aria-label="Global font color">
      <span>Font color{mixed ? " · Mixed" : ""}</span>
      <ColorSwatches colors={["#ffffff", "#000000", "#FA8AA6"]}
        value={mixed ? undefined : current} label="Font color" onChoose={apply} />
      <label className="dc-custom-paper">
        <span className="sr-only">Custom color for all text on sides A and B</span>
        <input type="color" value={draft} onChange={(event) => setDraft(event.target.value)}
          onBlur={() => apply(draft)} />
      </label>
    </div>
  );
}
