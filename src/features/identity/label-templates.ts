import { initialDesign, type LabelDesign, type LabelLayer } from "./design-configurator-model";

type Template = { id: string; name: string; description: string; design: LabelDesign };
function template(id: string, name: string, description: string, paper: string, ink: string,
  patches: Record<string, Partial<LabelLayer>>, frame = false): Template {
  const design = structuredClone(initialDesign);
  design.title = "Untitled project";
  design.paper = paper;
  design.frame = frame;
  design.mark = false;
  for (const side of ["A", "B"] as const) {
    design[side] = design[side].map((layer) => ({ ...layer, color: ink, ...patches[layer.id] }));
  }
  return { id, name, description, design };
}

// Original layouts based on familiar record-label conventions, not label reproductions.
export const LABEL_TEMPLATES: Template[] = [
  template("classic", "Default001", "Centered title · perimeter legal text", "#ffffff", "#20211e", {}),
  template("white-label", "Default002", "Minimal metadata · open space", "#f7f6f0", "#20211e", {
    artist: { x: 110, y: 195, align: "start", size: 14, spacing: 1 },
    title: { x: 110, y: 229, align: "start", size: 25, spacing: -0.4 },
    tracks: { x: 110, y: 390, align: "start", size: 11, spacing: 0 },
    side: { x: 470, y: 405, size: 62 }, edition: { visible: false },
    imprint: { visible: false }, legal: { size: 7, radius: 262, spacing: 0.3 },
    catalog: { x: 110, y: 155, size: 11 }, rpm: { x: 480, y: 155, size: 10 },
  }),
  template("club", "Default003", "Large type · high contrast", "#000000", "#ffffff", {
    title: { size: 58, y: 180, spacing: -2 }, artist: { y: 100, size: 12 },
    tracks: { y: 395, size: 12 }, side: { y: 472, size: 50 },
    edition: { visible: false }, imprint: { y: 505, spacing: 1.2 },
    legal: { radius: 272, size: 8 },
  }),
  template("swiss", "Default004", "Left-aligned hierarchy · compact tracklist", "#e0e7ec", "#172938", {
    title: { x: 105, y: 180, size: 39, align: "start", spacing: -1 },
    artist: { x: 105, y: 135, size: 13, align: "start", spacing: 1 },
    tracks: { x: 105, y: 375, size: 12, align: "start", spacing: 0 },
    catalog: { x: 105, y: 430, size: 11 }, rpm: { x: 105, y: 450, align: "start", size: 10 },
    side: { x: 465, y: 420, size: 74 }, edition: { visible: false },
    imprint: { y: 490, spacing: 1 }, legal: { size: 8, radius: 270 },
  }),
  template("catalog", "Default005", "Technical metadata · restrained typography", "#f1eadc", "#3b3026", {
    title: { text: "OTHER FREQUENCIES", size: 24, y: 180, spacing: -0.5 },
    artist: { y: 145, size: 12, spacing: 2 }, edition: { y: 110, size: 8, spacing: 1 },
    catalog: { x: 300, y: 220, align: "middle", size: 16 },
    tracks: { y: 375, size: 11, spacing: 0 }, side: { y: 445, size: 32 },
    rpm: { x: 300, y: 475, align: "middle", size: 10 },
    imprint: { y: 502, size: 8, spacing: 1 }, legal: { radius: 265, size: 7 },
  }),
  template("pink", "Default006", "Pink stock · oversized side marker", "#FA8AA6", "#252020", {
    title: { y: 179, size: 42, spacing: -1 }, artist: { y: 122, size: 13, spacing: 2 },
    tracks: { x: 112, y: 365, align: "start", size: 10, spacing: 0 },
    side: { x: 455, y: 395, size: 96 }, edition: { visible: false },
    catalog: { x: 112, y: 415, size: 11 }, rpm: { x: 112, y: 435, align: "start", size: 10 },
    imprint: { y: 490, size: 9 }, legal: { radius: 272, size: 8 },
  }),
];
