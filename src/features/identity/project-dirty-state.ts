import { initialDesign, parseDesign, type LabelDesign } from "./design-configurator-model";

/** Compare canonical documents, so legacy defaults do not look like user edits. */
export function hasUnsavedProject(design: LabelDesign, saved?: string): boolean {
  let baseline = initialDesign;
  try { if (saved) baseline = parseDesign(JSON.parse(saved)); } catch { /* Invalid saved data is not a usable baseline. */ }
  return JSON.stringify(parseDesign(design)) !== JSON.stringify(parseDesign(baseline));
}
