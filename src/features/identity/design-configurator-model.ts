export type LabelSide = "A" | "B";
export type LabelLayer = {
  id: string;
  name: string;
  kind: "text" | "circular" | "image";
  text: string;
  size: number;
  spacing: number;
  radius: number;
  angle: number;
  x: number;
  y: number;
  color: string;
  align: "start" | "middle" | "end";
  visible: boolean;
  arc: "top" | "bottom";
  width: number;
  imageRatio?: number;
  opacity?: number;
  image?: string;
  fontId?: string;
  variantId?: string;
};
export type LabelDesign = {
  version: 2;
  title: string;
  A: LabelLayer[];
  B: LabelLayer[];
  paper: string;
  sleeveColor: string;
  sleeveImage?: string;
  sleeveZoom: number;
  diameterMm: number;
  holeMm: number;
  bleedMm: number;
  safeMm: number;
  frame: boolean;
  mark: boolean;
};
export const DRAFT_KEY = "sa-label-design-draft";
export const RECOVERY_KEY = "sa-label-design-recovery-v2";
export function makeLayer(
  kind: LabelLayer["kind"],
  id: string = crypto.randomUUID(),
): LabelLayer {
  return {
    id,
    kind,
    name:
      kind === "circular"
        ? "Legal text"
        : kind === "image"
          ? "Image / logo"
          : "New text",
    text:
      kind === "circular"
        ? "℗ & © 2026 STRANGE ANIMALS. ALL RIGHTS RESERVED."
        : "Your text",
    size: kind === "circular" ? 11 : 24,
    spacing: 0,
    radius: 254,
    angle: 0,
    x: 300,
    y: 190,
    color: "#20211e",
    align: "middle",
    visible: true,
    arc: "bottom",
    width: 150,
    opacity: 1,
  };
}
const initialLayers: LabelLayer[] = [
  {
    ...makeLayer("text", "artist"),
    name: "Artist",
    text: "STRANGE ANIMALS",
    size: 16,
    spacing: 3,
    y: 137,
  },
  {
    ...makeLayer("text", "title"),
    name: "Release title",
    text: "OTHER\nFREQUENCIES",
    size: 53,
    spacing: -1.6,
    y: 198,
  },
  {
    ...makeLayer("text", "tracks"),
    name: "Tracklist",
    text: "01  AFTER HOURS                 06:42\n02  NO FIXED ADDRESS          05:18",
    size: 13,
    spacing: 0.6,
    y: 390,
  },
  {
    ...makeLayer("circular", "legal"),
    text: "℗ & © 2026 STRANGE ANIMALS. ALL RIGHTS RESERVED. UNAUTHORIZED COPYING IS PROHIBITED.",
    spacing: 0.7,
  },
  {
    ...makeLayer("text", "edition"),
    name: "Edition",
    text: "INDEPENDENT SOUNDS / SINCE 2026",
    size: 10,
    spacing: 2.5,
    y: 89,
  },
  {
    ...makeLayer("text", "catalog"),
    name: "Catalog number",
    text: "SA—001",
    size: 12,
    spacing: 1.5,
    x: 85,
    y: 310,
    align: "start",
  },
  {
    ...makeLayer("text", "rpm"),
    name: "Speed",
    text: "33⅓ RPM",
    size: 12,
    spacing: 1.5,
    x: 516,
    y: 310,
    align: "end",
  },
  { ...makeLayer("text", "side"), name: "Side", text: "A", size: 36, y: 465 },
  {
    ...makeLayer("text", "imprint"),
    name: "Imprint",
    text: "STRANGE ANIMALS RECORDS",
    size: 9,
    spacing: 2,
    y: 487,
  },
];
export const initialDesign: LabelDesign = {
  version: 2,
  title: "Other frequencies",
  A: initialLayers,
  B: initialLayers.map((l) => ({
    ...l,
    text:
      l.id === "tracks"
        ? "01  SIGNAL / NOISE                 07:03\n02  THE OTHER SIDE               04:56"
        : l.id === "side"
          ? "B"
          : l.text,
  })),
  paper: "#e5e8d9",
  sleeveColor: "#000000",
  sleeveZoom: 1,
  diameterMm: 100,
  holeMm: 7.3,
  bleedMm: 3,
  safeMm: 3,
  frame: true,
  mark: true,
};
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export function circularPath(
  layer: Pick<LabelLayer, "radius" | "arc">,
) {
  // Two semicircles form a complete path; its midpoint remains the text anchor.
  const radius = layer.radius;
  const startY = 300 + (layer.arc === "top" ? radius : -radius);
  const midpointY = 600 - startY;
  const sweep = layer.arc === "top" ? 1 : 0;
  return `M 300 ${startY} A ${radius} ${radius} 0 0 ${sweep} 300 ${midpointY} A ${radius} ${radius} 0 0 ${sweep} 300 ${startY}`;
}
export type History = {
  past: LabelDesign[];
  present: LabelDesign;
  future: LabelDesign[];
  group?: string;
};
export type HistoryAction =
  | {
      type: "change";
      change: (current: LabelDesign) => LabelDesign;
      group?: string;
    }
  | { type: "undo" | "redo" | "end" };
export function designReducer(state: History, action: HistoryAction): History {
  if (action.type === "end") return { ...state, group: undefined };
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past[state.past.length - 1],
      future: [state.present, ...state.future],
    };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present].slice(-100),
      present: state.future[0],
      future: state.future.slice(1),
    };
  }
  if (action.type !== "change") return state;
  const present = action.change(state.present);
  if (JSON.stringify(present) === JSON.stringify(state.present)) return state;
  const grouped = !!action.group && state.group === action.group;
  return {
    past: grouped ? state.past : [...state.past, state.present].slice(-100),
    present,
    future: [],
    group: action.group,
  };
}
function numeric(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clamp(value, min, max)
    : fallback;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function hex(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[a-f\d]{6}$/i.test(value)
    ? value
    : fallback;
}
export function parseDesign(input: unknown): LabelDesign {
  if (!record(input) || !Array.isArray(input.A) || !Array.isArray(input.B))
    throw Error("El archivo no contiene un diseño válido.");
  if (input.version !== undefined && input.version !== 2)
    throw Error("Versión de proyecto no compatible.");
  const side = (values: unknown[]): LabelLayer[] => {
    if (!values.length || values.length > 50)
      throw Error("Cada lado debe tener entre 1 y 50 elementos.");
    const ids = new Set<string>();
    return values.map((item) => {
      if (
        !record(item) ||
        typeof item.id !== "string" ||
        !item.id ||
        ids.has(item.id)
      )
        throw Error("Elementos inválidos o duplicados.");
      ids.add(item.id);
      const kind =
        item.kind === "image"
          ? "image"
          : item.kind === "circular" || item.id === "legal"
            ? "circular"
            : "text";
      const base = makeLayer(kind, item.id);
      const image = typeof item.image === "string" ? item.image : undefined;
      if (
        image &&
        (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(image) ||
          image.length > 7_000_000)
      )
        throw Error("Imagen inválida o demasiado grande.");
      return {
        ...base,
        name:
          typeof item.name === "string" ? item.name.slice(0, 80) : base.name,
        text: typeof item.text === "string" ? item.text.slice(0, 3000) : "",
        visible: item.visible !== false,
        size: numeric(item.size, base.size, 3, 125),
        spacing: numeric(item.spacing, 0, -10, 30),
        radius: numeric(item.radius, 254, 30, 295),
        angle: numeric(item.angle, 0, -180, 180),
        x: numeric(item.x, 300, 0, 600),
        y: numeric(item.y, 190, 0, 600),
        width: numeric(item.width, 150, 10, 600),
        color: hex(item.color, base.color),
        align:
          item.align === "start" || item.align === "end"
            ? item.align
            : "middle",
        arc: item.arc === "top" ? "top" : "bottom",
        image,
        imageRatio: numeric(item.imageRatio, 1, 0.05, 20),
        opacity: numeric(item.opacity, 1, 0, 1),
        fontId: typeof item.fontId === "string" ? item.fontId : undefined,
        variantId:
          typeof item.variantId === "string" ? item.variantId : undefined,
      };
    });
  };
  const diameterMm = numeric(input.diameterMm, 100, 50, 150);
  const sleeveImage = typeof input.sleeveImage === "string" ? input.sleeveImage : undefined;
  if (sleeveImage && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(sleeveImage) || sleeveImage.length > 7_000_000))
    throw Error("Imagen de sleeve inválida o demasiado grande.");
  return {
    version: 2,
    title:
      typeof input.title === "string"
        ? input.title.slice(0, 120)
        : "Other frequencies",
    A: side(input.A),
    B: side(input.B),
    paper: hex(input.paper, "#e5e8d9"),
    sleeveColor: hex(input.sleeveColor, "#000000"),
    sleeveImage,
    sleeveZoom: numeric(input.sleeveZoom, 1, 1, 3),
    diameterMm,
    holeMm: numeric(input.holeMm, 7.3, 1, Math.min(40, diameterMm - 10)),
    bleedMm: numeric(input.bleedMm, 3, 0, 10),
    safeMm: numeric(input.safeMm, 3, 0, 10),
    frame: input.frame !== false,
    mark: input.mark !== false,
  };
}
export function safeFilename(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z\d-]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "vinyl-label"
  );
}
