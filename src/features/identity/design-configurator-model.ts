export type LabelSide = "A" | "B";
export type LabelSurface = "cookie" | "sleeve";
export const SLEEVE_SIZE_MM = 315;
export type LabelLayerGroup = LabelSide | `sleeve${LabelSide}`;
export type TextBlendMode = "normal" | "difference";
export type TextExtrusion = {
  depth: number;
  angle: number;
  steps: number;
  fade?: number;
  depthBlur?: number;
};
export type StaticTextEffect =
  | ({ type: "extrusion" } & TextExtrusion)
  | {
      type: "cylinder";
      radius: number;
      span: number;
      segments: number;
      tilt?: number;
      rotation?: number;
      closed?: boolean;
      backBlur?: number;
      backShading?: number;
      backFade?: number;
      extrusion?: TextExtrusion;
    };
export type TextEffectSettings = {
  cylinder?: Omit<Extract<StaticTextEffect, { type: "cylinder" }>, "extrusion">;
  extrusion?: TextExtrusion;
};
export function textExtrusion(
  effect?: StaticTextEffect,
): TextExtrusion | undefined {
  if (!effect) return undefined;
  if (effect.type === "cylinder") return effect.extrusion;
  const { type: _type, ...settings } = effect;
  return settings;
}
export function extrusionOpacity(step: number, steps: number, fade = 0) {
  return clamp(
    1 - (clamp(fade, 0, 300) / 100) * clamp(step / Math.max(1, steps), 0, 1),
    0,
    1,
  );
}
/** Far-to-near batches share at most six blur passes, not one per depth copy. */
export function extrusionBlurBands(steps: number, depthBlur = 0) {
  const count = Math.round(clamp(steps, 1, 200));
  const maximum = clamp(depthBlur, 0, 40);
  const bands: { blur: number; steps: number[] }[] = [];
  for (let step = count; step >= 1; step--) {
    const blur = maximum ? (maximum * Math.round((step / count) * 5)) / 5 : 0;
    const previous = bands[bands.length - 1];
    if (previous?.blur === blur) previous.steps.push(step);
    else bands.push({ blur, steps: [step] });
  }
  return bands;
}
// Every depth step repeats all cylinder segments; bound their total node count.
export function cylinderExtrusionSteps(segments: number) {
  return Math.min(
    200,
    Math.max(1, Math.floor(1536 / clamp(segments, 6, 64)) - 1),
  );
}
export type LabelLayer = {
  id: string;
  name: string;
  kind: "text" | "circular" | "image";
  text: string;
  size: number;
  spacing: number;
  lineHeight: number;
  inkBleed?: number;
  radius: number;
  angle: number;
  x: number;
  y: number;
  color: string;
  finish?: "gold" | "silver" | "copper" | "custom" | "raised-uv" | "emboss" | "deboss";
  finishDepth?: number;
  foilColor?: string;
  customTextColor?: boolean;
  align: "start" | "middle" | "end";
  visible: boolean;
  arc: "top" | "bottom";
  width: number;
  imageRatio?: number;
  borderRadius?: number;
  opacity?: number;
  blur?: number;
  image?: string;
  textTexture?: string;
  textTextureOpacity?: number;
  textTextureScale?: number;
  imageFill?: string;
  imageInverted?: boolean;
  imageBarColor?: string;
  imageBarBackground?: string;
  imageBarSource?: { bars: string; background: string };
  imageRole?: "brand-logo" | "barcode";
  imageCrop?: { top: number; right: number; bottom: number; left: number };
  fontId?: string;
  variantId?: string;
  textEffect?: StaticTextEffect;
  textEffectSettings?: TextEffectSettings;
  blendMode?: TextBlendMode;
};
export type LabelDesign = {
  version: 2;
  title: string;
  A: LabelLayer[];
  B: LabelLayer[];
  sleeveA: LabelLayer[];
  sleeveB: LabelLayer[];
  sleeveLayers: LabelLayer[];
  paper: string;
  sleeveColor: string;
  sleeveWindowA?: boolean;
  sleeveWindowB?: boolean;
  sleeveMaterial?: "matte" | "printed-board" | "printed-board-glossy";
  sleeveImage?: string;
  sleeveZoom: number;
  sleeveImageOffsetX: number;
  sleeveImageOffsetY: number;
  diameterMm: number;
  holeMm: number;
  bleedMm: number;
  safeMm: number;
  frame: boolean;
  mark: boolean;
};
export function layerGroupForSurface(
  surface: LabelSurface,
  side: LabelSide,
): LabelLayerGroup {
  return surface === "sleeve" ? `sleeve${side}` : side;
}
export function hasSleeveWindow(design: LabelDesign, side: LabelSide) {
  return (side === "A" ? design.sleeveWindowA : design.sleeveWindowB) !== false;
}
export function textFoilColor(layer: LabelLayer) {
  return layer.finish === "gold" ? "#d6ad60" : layer.finish === "silver" ? "#d6d9df" :
    layer.finish === "copper" ? "#c58160" : layer.finish === "custom" ? (layer.foilColor ?? "#d6ad60") : null;
}
export function getSurfaceLayers(
  design: LabelDesign,
  surface: LabelSurface,
  side: LabelSide,
) {
  return design[layerGroupForSurface(surface, side)];
}
export function updateSurfaceLayers(
  design: LabelDesign,
  surface: LabelSurface,
  side: LabelSide,
  update: (layers: LabelLayer[]) => LabelLayer[],
): LabelDesign {
  const key = layerGroupForSurface(surface, side);
  const current = design[key];
  const next = update(current);
  return next === current ? design : { ...design, [key]: next };
}
export function sleeveLabelGeometry(diameterMm: number) {
  const center = 300;
  const radius = (diameterMm / SLEEVE_SIZE_MM) * center;
  return { center, radius, radiusPercent: (radius / 600) * 100 };
}
export function initialImageLayerPosition(
  surface: LabelSurface,
  layer: Pick<LabelLayer, "width" | "imageRatio">,
) {
  if (surface === "cookie") return { x: 300, y: 300 };
  const imageHeight = layer.width / Math.max(layer.imageRatio ?? 1, 0.05);
  const topPadding = 24;
  const y =
    imageHeight + topPadding * 2 >= 600
      ? 300
      : Math.min(
          Math.max(imageHeight / 2 + topPadding, 100),
          600 - imageHeight / 2 - topPadding,
        );
  return {
    x: 300,
    y,
  };
}
export function imageRole(layer: Pick<LabelLayer, "name" | "imageRole">) {
  return (
    layer.imageRole ??
    (/^Barcode\b/.test(layer.name)
      ? "barcode"
      : /^Strange Animals (logo|outlined)( copy)?$/.test(layer.name)
        ? "brand-logo"
        : undefined)
  );
}
export function imageCropBounds(layer: LabelLayer) {
  const crop = layer.imageCrop ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const height = layer.width / (layer.imageRatio ?? 1);
  const width = layer.width * (1 - (crop.left + crop.right) / 100);
  const croppedHeight = height * (1 - (crop.top + crop.bottom) / 100);
  return {
    x: layer.x - layer.width / 2 + (layer.width * crop.left) / 100,
    y: layer.y - height / 2 + (height * crop.top) / 100,
    width,
    height: croppedHeight,
    rx: Math.min(layer.borderRadius ?? 0, width / 2, croppedHeight / 2),
  };
}
// Normalize the source barcode palette before applying independently editable colors.
export function barcodeSourceMatrix(
  source = { bars: "#000000", background: "#ffffff" },
) {
  const channels = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const bars = channels(source.bars),
    background = channels(source.background);
  const channel = [0, 1, 2].reduce(
    (best, i) =>
      Math.abs(background[i] - bars[i]) >
      Math.abs(background[best] - bars[best])
        ? i
        : best,
    0,
  );
  const delta = background[channel] - bars[channel];
  if (Math.abs(delta) < 1e-6) return "1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0";
  const row = [0, 0, 0, 0, -bars[channel] / delta];
  row[channel] = 1 / delta;
  return [...row, ...row, ...row, 0, 0, 0, 1, 0].join(" ");
}
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
        ? "Arc text"
        : kind === "image"
          ? "Image / logo"
          : "New text",
    text:
      kind === "circular"
        ? "℗ & © 2026 STRANGE ANIMALS. ALL RIGHTS RESERVED."
        : "Your text",
    size: kind === "circular" ? 11 : 24,
    spacing: 0,
    lineHeight: 1.1,
    borderRadius: 0,
    radius: 254,
    angle: 0,
    x: 300,
    y: 190,
    color: "#20211e",
    customTextColor: false,
    align: "middle",
    visible: true,
    arc: "bottom",
    width: 150,
    opacity: 1,
    blur: 0,
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
  sleeveA: [],
  sleeveB: [],
  sleeveWindowA: true,
  sleeveWindowB: true,
  sleeveMaterial: "printed-board",
  sleeveLayers: [],
  paper: "#e5e8d9",
  sleeveColor: "#000000",
  sleeveZoom: 1,
  sleeveImageOffsetX: 0,
  sleeveImageOffsetY: 0,
  diameterMm: 100,
  holeMm: 7.3,
  bleedMm: 3,
  safeMm: 3,
  frame: false,
  mark: true,
};
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export function capitalizeWords(text: string) {
  const lower = text.toLowerCase();
  if (typeof Intl.Segmenter === "function") {
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "word" }).segment(lower),
      (part) =>
        part.isWordLike
          ? part.segment.replace(/\p{L}/u, (letter) => letter.toUpperCase())
          : part.segment,
    ).join("");
  }
  return lower.replace(
    /(^|[^\p{L}\p{M}\p{N}])([\p{L}\p{M}]+)/gu,
    (_, separator, word) =>
      separator +
      word.replace(/\p{L}/u, (letter: string) => letter.toUpperCase()),
  );
}
export function circularPath(layer: Pick<LabelLayer, "radius" | "arc">) {
  // Two semicircles form a complete path; its midpoint remains the text anchor.
  const radius = layer.radius;
  const startY = 300 + (layer.arc === "top" ? radius : -radius);
  const midpointY = 600 - startY;
  const sweep = layer.arc === "top" ? 1 : 0;
  return `M 300 ${startY} A ${radius} ${radius} 0 0 ${sweep} 300 ${midpointY} A ${radius} ${radius} 0 0 ${sweep} 300 ${startY}`;
}
export function cylinderTextSegments(
  radius: number,
  span: number,
  count: number,
  tilt: number = 0,
  rotation: number = 0,
) {
  const safeRadius = clamp(radius, 30, 295);
  const safeSpan = clamp(span, 1, 360) * (Math.PI / 180);
  const safeCount = Math.round(clamp(count, 1, 64));
  const radians = clamp(tilt, -75, 75) * (Math.PI / 180);
  const rotationRadians = (clamp(rotation, 0, 360) % 360) * (Math.PI / 180);
  const sine = Math.sin(radians);
  const cosine = Math.cos(radians);
  const project = (angle: number) => {
    const depth = safeRadius * (1 - Math.cos(angle));
    const perspective = (safeRadius * 3) / (safeRadius * 3 + depth * cosine);
    return {
      x: safeRadius * Math.sin(angle) * perspective,
      y: depth * sine * perspective,
    };
  };
  return Array.from({ length: safeCount }, (_, index) => {
    const start = (index / safeCount - 0.5) * safeSpan + rotationRadians;
    const end = ((index + 1) / safeCount - 0.5) * safeSpan + rotationRadians;
    const middle = (start + end) / 2;
    const depth = safeRadius * (1 - Math.cos(middle));
    const perspective = (safeRadius * 3) / (safeRadius * 3 + depth * cosine);
    const left = project(start);
    const right = project(end);
    const signedWidth =
      safeRadius * (Math.sin(end) - Math.sin(start)) * perspective;
    const width = Math.max(0.001, Math.abs(signedWidth));
    return {
      x: safeRadius * Math.sin(middle) * perspective,
      y: depth * sine * perspective,
      shear: (right.y - left.y) / Math.max(0.001, width),
      verticalScale: cosine,
      width,
      horizontalScale: signedWidth < 0 ? -1 : 1,
      scale: perspective,
      angle: middle * (180 / Math.PI),
    };
  });
}
export function splitTextGraphemes(text: string) {
  if (typeof Intl.Segmenter === "function")
    return Array.from(
      new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text),
      (part) => part.segment,
    );
  return Array.from(text);
}
export function closedCylinderText(layer: LabelLayer) {
  const base = layer.text.replace(/\n/g, " ").trim();
  if (!base || layer.textEffect?.type !== "cylinder") return base;
  const unit = `${base} · `;
  const unitLength = splitTextGraphemes(unit).length;
  const span = cylinderTextSpan(
    unit,
    layer.size,
    layer.spacing,
    layer.textEffect.radius,
    360,
  );
  const repeats = Math.round(
    clamp(
      Math.max(
        Math.ceil(360 / span),
        Math.ceil(layer.textEffect.segments / unitLength),
      ),
      1,
      64,
    ),
  );
  return unit.repeat(repeats);
}
export function cylinderTextLayout(layer: LabelLayer) {
  const effect = layer.textEffect;
  if (effect?.type !== "cylinder")
    return {
      graphemes: [] as string[],
      segments: [] as ReturnType<typeof cylinderTextSegments>,
      anchorOffset: 0,
    };
  const text = effect.closed
    ? closedCylinderText(layer)
    : layer.text.replace(/\n/g, " ");
  const graphemes = splitTextGraphemes(text);
  if (!graphemes.length)
    return {
      graphemes,
      segments: [] as ReturnType<typeof cylinderTextSegments>,
      anchorOffset: 0,
    };
  const count = Math.min(effect.segments, graphemes.length);
  const span = effect.closed
    ? 360
    : cylinderTextSpan(
        text,
        layer.size,
        layer.spacing,
        effect.radius,
        effect.span,
      );
  const segments = cylinderTextSegments(
    effect.radius,
    span,
    count,
    effect.tilt ?? 0,
    effect.rotation ?? 0,
  );
  const projectedWidth = effect.closed
    ? Math.max(...segments.map((segment) => segment.x + segment.width / 2)) -
      Math.min(...segments.map((segment) => segment.x - segment.width / 2))
    : segments.reduce((total, segment) => total + segment.width, 0);
  return {
    graphemes,
    segments,
    anchorOffset: effect.closed
      ? 0
      : layer.align === "start"
        ? projectedWidth / 2
        : layer.align === "end"
          ? -projectedWidth / 2
          : 0,
  };
}
/** Six shared focus levels, painted from the farthest panels toward the front. */
export function cylinderBackBlurBands(angles: number[], backBlur = 0) {
  const maximum = clamp(backBlur, 0, 40);
  const depths = angles.map((angle) => 1 - Math.cos((angle * Math.PI) / 180));
  const maxDepth = Math.max(0.0001, ...depths);
  const indices = angles.map((_, i) => i).sort((a, b) => depths[b] - depths[a]);
  const bands: { blur: number; indices: number[] }[] = [];
  for (const index of indices) {
    const blur = maximum
      ? (maximum * Math.round((depths[index] / maxDepth) * 5)) / 5
      : 0;
    const previous = bands[bands.length - 1];
    if (previous?.blur === blur) previous.indices.push(index);
    else bands.push({ blur, indices: [index] });
  }
  return bands;
}
export function cylinderShading(angle: number, backShading = 70) {
  return clamp(
    ((clamp(backShading, 0, 250) / 100) *
      (1 - Math.cos((angle * Math.PI) / 180))) /
      2,
    0,
    1,
  );
}
export function cylinderOpacity(angle: number, backFade = 0) {
  return clamp(
    1 -
      ((clamp(backFade, 0, 400) / 100) *
        (1 - Math.cos((angle * Math.PI) / 180))) /
        2,
    0,
    1,
  );
}
/** Project complete curved text in clipped slices, preserving its textPath layout. */
export function circularCylinderSlices(layer: LabelLayer) {
  if (layer.kind !== "circular" || layer.textEffect?.type !== "cylinder")
    return [];
  const effect = layer.textEffect;
  const halfWidth = layer.radius + layer.size * 1.5;
  const count = Math.round(clamp(effect.segments, 6, 64));
  const sourceWidth = (halfWidth * 2) / count;
  return cylinderTextSegments(
    effect.radius,
    effect.closed ? 360 : effect.span,
    count,
    effect.tilt ?? 0,
    effect.rotation ?? 0,
  ).map((segment, i) => {
    const x = 300 - halfWidth + i * sourceWidth;
    const center = x + sourceWidth / 2;
    const scaleX = (segment.width * segment.horizontalScale) / sourceWidth;
    const shear = (segment.shear * segment.width) / sourceWidth;
    return {
      x,
      width: sourceWidth,
      angle: segment.angle,
      transform: `matrix(${scaleX} ${shear} 0 ${segment.verticalScale} ${300 + segment.x - scaleX * center} ${300 + segment.y - shear * center - segment.verticalScale * 300})`,
    };
  });
}
export function cylinderTextSpan(
  text: string,
  size: number,
  spacing: number,
  radius: number,
  maxSpan: number,
) {
  const graphemes = splitTextGraphemes(text.replace(/\n/g, " "));
  const estimatedWidth = graphemes.reduce((width, grapheme) => {
    const factor =
      grapheme === " "
        ? 0.32
        : /[ilI1!|.,:;'`]/.test(grapheme)
          ? 0.3
          : /[MW@%&]/.test(grapheme)
            ? 0.88
            : /[A-Z0-9]/.test(grapheme)
              ? 0.62
              : 0.54;
    return width + size * factor;
  }, 0);
  const width = Math.max(
    size * 0.5,
    estimatedWidth + Math.max(0, graphemes.length - 1) * spacing,
  );
  return clamp((width / clamp(radius, 30, 295)) * (180 / Math.PI), 1, maxSpan);
}
export type History = {
  past: LabelDesign[];
  present: LabelDesign;
  future: LabelDesign[];
  group?: string;
};
export type HistoryAction =
  | { type: "replace"; design: LabelDesign }
  | { type: "normalize"; change: (current: LabelDesign) => LabelDesign }
  | {
      type: "change";
      change: (current: LabelDesign) => LabelDesign;
      group?: string;
    }
  | { type: "undo" | "redo" | "end" };

/** Compare immutable document branches without serializing embedded assets.
 * Shared arrays/objects stop at identity; absent optional fields equal undefined,
 * matching the previous JSON comparison for valid design documents.
 */
function sameDesignValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => sameDesignValue(value, right[index]));
  }
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter(key => a[key] !== undefined);
  const otherKeys = Object.keys(b).filter(key => b[key] !== undefined);
  return keys.length === otherKeys.length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(b, key) && sameDesignValue(a[key], b[key]));
}
export function designReducer(state: History, action: HistoryAction): History {
  if (action.type === "replace")
    return { past: [], present: action.design, future: [] };
  if (action.type === "normalize")
    return {
      ...state,
      present: action.change(state.present),
      past: state.past.map(action.change),
      future: state.future.map(action.change),
    };
  if (action.type === "end") return state.group === undefined ? state : { ...state, group: undefined };
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
  if (sameDesignValue(present, state.present)) return state;
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
function isSafeEmbeddedSvg(image: string) {
  const match = image.match(/^data:image\/svg\+xml;base64,([A-Za-z\d+/=]+)$/);
  if (!match) return false;
  let svg: string;
  try {
    svg = atob(match[1]);
  } catch {
    return false;
  }
  return (
    /<svg\b/i.test(svg) &&
    !/<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(svg) &&
    !/\son[a-z]+\s*=/i.test(svg) &&
    !/(?:href|xlink:href)\s*=\s*["']\s*(?:https?:|\/\/|javascript:|data:text\/html)/i.test(
      svg,
    ) &&
    !/\b(?:xlink:)?href\s*=\s*(["'])(?!#|data:image\/(?:png|jpeg|webp);base64,)[^"']*\1/i.test(
      svg,
    ) &&
    !/@import\b|url\(\s*["']?(?!#|data:image\/(?:png|jpeg|webp);base64,)/i.test(
      svg,
    )
  );
}
function parseExtrusion(value: unknown): TextExtrusion | undefined {
  if (!record(value)) return undefined;
  return {
    depth: numeric(value.depth, 12, 1, 400),
    angle: numeric(value.angle, 45, 0, 360),
    steps: Math.round(numeric(value.steps, 12, 1, 200)),
    fade: numeric(value.fade, 0, 0, 300),
    ...(typeof value.depthBlur === "number"
      ? { depthBlur: numeric(value.depthBlur, 0, 0, 40) }
      : {}),
  };
}
function parseTextEffect(value: unknown): StaticTextEffect | undefined {
  if (!record(value)) return undefined;
  if (value.type === "extrusion")
    return {
      type: "extrusion",
      ...parseExtrusion(value)!,
    };
  if (value.type === "cylinder")
    return {
      type: "cylinder",
      radius: numeric(value.radius, 170, 30, 295),
      span: numeric(value.span, 150, 1, 180),
      segments: Math.round(numeric(value.segments, 24, 6, 64)),
      tilt: numeric(value.tilt, 0, -75, 75),
      ...(typeof value.rotation === "number"
        ? { rotation: numeric(value.rotation, 0, 0, 360) }
        : {}),
      ...(typeof value.closed === "boolean" ? { closed: value.closed } : {}),
      ...(typeof value.backBlur === "number"
        ? { backBlur: numeric(value.backBlur, 0, 0, 40) }
        : {}),
      ...(typeof value.backShading === "number"
        ? { backShading: numeric(value.backShading, 70, 0, 250) }
        : {}),
      ...(typeof value.backFade === "number"
        ? { backFade: numeric(value.backFade, 0, 0, 400) }
        : {}),
      ...(record(value.extrusion)
        ? {
            extrusion: {
              ...parseExtrusion(value.extrusion)!,
              steps: Math.min(
                parseExtrusion(value.extrusion)!.steps,
                cylinderExtrusionSteps(numeric(value.segments, 24, 6, 64)),
              ),
            },
          }
        : {}),
    };
  return undefined;
}
function parseTextEffectSettings(
  value: unknown,
): TextEffectSettings | undefined {
  if (!record(value)) return undefined;
  const cylinder = parseTextEffect(value.cylinder);
  const extrusion = parseExtrusion(value.extrusion);
  const settings: TextEffectSettings = {};
  if (cylinder?.type === "cylinder") {
    const { extrusion: _extrusion, ...rest } = cylinder;
    settings.cylinder = rest;
  }
  if (extrusion) settings.extrusion = extrusion;
  return settings;
}
export function parseDesign(input: unknown): LabelDesign {
  if (!record(input) || !Array.isArray(input.A) || !Array.isArray(input.B))
    throw Error("El archivo no contiene un diseño válido.");
  if (input.version !== undefined && input.version !== 2)
    throw Error("Versión de proyecto no compatible.");
  const side = (values: unknown[]): LabelLayer[] => {
    if (values.length > 50) throw Error("Cada lado admite hasta 50 elementos.");
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
      const textTexture =
        kind !== "image" && typeof item.textTexture === "string"
          ? item.textTexture
          : undefined;
      if (
        image &&
        ((!/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(image) &&
          !isSafeEmbeddedSvg(image)) ||
          image.length > 7_000_000)
      )
        throw Error("Imagen inválida o demasiado grande.");
      if (
        textTexture &&
        (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(
          textTexture,
        ) ||
          textTexture.length > 7_000_000)
      )
        throw Error("Textura inválida o demasiado grande.");
      return {
        ...base,
        name:
          kind === "circular" && item.name === "Legal text"
            ? "Arc text"
            : typeof item.name === "string"
              ? item.name.slice(0, 80)
              : base.name,
        text: typeof item.text === "string" ? item.text.slice(0, 3000) : "",
        visible: item.visible !== false,
        size: numeric(item.size, base.size, 3, 3000),
        spacing: numeric(item.spacing, 0, -10, 30),
        lineHeight: numeric(item.lineHeight, 1.1, 0, 3),
        inkBleed: numeric(item.inkBleed, 0, 0, 8),
        radius: numeric(item.radius, 254, 30, 295),
        angle: numeric(item.angle, 0, -180, 180),
        x: numeric(item.x, 300, 0, 600),
        y: numeric(item.y, 190, 0, 600),
        width: numeric(item.width, 150, 10, 1500),
        color: hex(item.color, base.color),
        ...(["gold", "silver", "copper", "custom", "raised-uv", "emboss", "deboss"].includes(String(item.finish))
          ? {finish: item.finish as LabelLayer["finish"], foilColor: hex(item.foilColor, "#d6ad60"),
            finishDepth: clamp(Number.isFinite(item.finishDepth) ? Number(item.finishDepth) : 0.2, 0.02, item.finish === "emboss" || item.finish === "deboss" ? 1.6 : 0.8)} : {}),
        customTextColor: kind !== "image" && item.customTextColor === true,
        align:
          item.align === "start" || item.align === "end"
            ? item.align
            : "middle",
        arc: item.arc === "top" ? "top" : "bottom",
        image,
        ...(textTexture
          ? {
              textTexture,
              textTextureOpacity: numeric(item.textTextureOpacity, 1, 0, 1),
              textTextureScale: numeric(item.textTextureScale, 100, 25, 400),
            }
          : {}),
        imageFill:
          kind === "image" && typeof item.imageFill === "string"
            ? hex(item.imageFill, "#000000")
            : undefined,
        imageInverted: kind === "image" && item.imageInverted === true,
        imageBarColor:
          kind === "image" && typeof item.imageBarColor === "string"
            ? hex(item.imageBarColor, "#000000")
            : undefined,
        imageBarBackground:
          kind === "image" && typeof item.imageBarBackground === "string"
            ? hex(item.imageBarBackground, "#ffffff")
            : undefined,
        imageBarSource:
          kind === "image" && record(item.imageBarSource)
            ? {
                bars: hex(item.imageBarSource.bars, "#000000"),
                background: hex(item.imageBarSource.background, "#ffffff"),
              }
            : undefined,
        imageRole:
          kind === "image" &&
          (item.imageRole === "barcode" || item.imageRole === "brand-logo")
            ? item.imageRole
            : undefined,
        imageCrop:
          kind === "image" && record(item.imageCrop)
            ? {
                top: numeric(item.imageCrop.top, 0, 0, 45),
                right: numeric(item.imageCrop.right, 0, 0, 45),
                bottom: numeric(item.imageCrop.bottom, 0, 0, 45),
                left: numeric(item.imageCrop.left, 0, 0, 45),
              }
            : undefined,
        imageRatio: numeric(item.imageRatio, 1, 0.05, 20),
        borderRadius: numeric(item.borderRadius, 0, 0, 100),
        opacity: numeric(item.opacity, 1, 0, 1),
        blur: numeric(item.blur, 0, 0, 40),
        fontId: typeof item.fontId === "string" ? item.fontId : undefined,
        variantId:
          typeof item.variantId === "string" ? item.variantId : undefined,
        textEffect:
          kind !== "image" ? parseTextEffect(item.textEffect) : undefined,
        textEffectSettings:
          kind !== "image"
            ? parseTextEffectSettings(item.textEffectSettings)
            : undefined,
        blendMode:
          kind !== "image" && item.blendMode === "difference"
            ? "difference"
            : undefined,
      };
    });
  };
  const diameterMm = numeric(input.diameterMm, 100, 50, 150);
  const legacySleeveLayers =
    input.sleeveLayers === undefined
      ? []
      : Array.isArray(input.sleeveLayers)
        ? side(input.sleeveLayers)
        : null;
  if (!legacySleeveLayers) throw Error("Elementos de sleeve inválidos.");
  const A = side(input.A);
  const B = side(input.B);
  const sleeveA =
    input.sleeveA === undefined
      ? legacySleeveLayers
      : Array.isArray(input.sleeveA)
        ? side(input.sleeveA)
        : null;
  const sleeveB =
    input.sleeveB === undefined
      ? []
      : Array.isArray(input.sleeveB)
        ? side(input.sleeveB)
        : null;
  if (!sleeveA || !sleeveB) throw Error("Elementos de sleeve inválidos.");
  const sleeveImage =
    typeof input.sleeveImage === "string" ? input.sleeveImage : undefined;
  if (
    sleeveImage &&
    (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z\d+/=]+$/.test(sleeveImage) ||
      sleeveImage.length > 7_000_000)
  )
    throw Error("Imagen de sleeve inválida o demasiado grande.");
  return {
    version: 2,
    title:
      typeof input.title === "string"
        ? input.title.slice(0, 120)
        : "Other frequencies",
    A,
    B,
    sleeveA,
    sleeveB,
    sleeveLayers: [],
    paper: hex(input.paper, "#e5e8d9"),
    sleeveColor: hex(input.sleeveColor, "#000000"),
    sleeveWindowA: input.sleeveWindowA !== false,
    sleeveWindowB: input.sleeveWindowB !== false,
    sleeveMaterial: input.sleeveMaterial === "matte" ? "matte" : input.sleeveMaterial === "printed-board-glossy" ? "printed-board-glossy" : "printed-board",
    sleeveImage,
    sleeveZoom: numeric(input.sleeveZoom, 1, 0.1, 5),
    sleeveImageOffsetX: numeric(input.sleeveImageOffsetX, 0, -600, 600),
    sleeveImageOffsetY: numeric(input.sleeveImageOffsetY, 0, -600, 600),
    diameterMm,
    holeMm: numeric(input.holeMm, 7.3, 1, Math.min(40, diameterMm - 10)),
    bleedMm: numeric(input.bleedMm, 3, 0, 10),
    safeMm: numeric(input.safeMm, 3, 0, 10),
    frame: input.frame === true,
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
