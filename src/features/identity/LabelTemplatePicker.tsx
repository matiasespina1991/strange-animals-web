import { LabelArtwork } from "./LabelArtwork";
import { defaultLabelFont } from "./design-configurator-export";
import { LABEL_TEMPLATES } from "./label-templates";
import type { LabelDesign } from "./design-configurator-model";

export function LabelTemplatePicker({ onChoose }: { onChoose: (design: LabelDesign) => void }) {
  return <div className="dc-dialog-scroll dc-template-grid">
    {LABEL_TEMPLATES.map((template) => (
      <button key={template.id} className="dc-template-card" onClick={() => onChoose(structuredClone(template.design))}>
        <div className="dc-template-preview" aria-hidden="true">
          <LabelArtwork design={template.design} side="A" prefix={`template-${template.id}`} fontFamily={defaultLabelFont} />
        </div>
        <strong>{template.name}</strong>
        <span>{template.description}</span>
      </button>
    ))}
  </div>;
}
