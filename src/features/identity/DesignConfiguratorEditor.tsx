import {
  useDeferredValue,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Focus,
  Grid2X2,
  ImagePlus,
  Layers,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Settings2,
  SlidersHorizontal,
  Star,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  listFontCatalog,
  listFontVariants,
  type FontCatalogItem,
  type FontVariant,
} from "./font-catalog-repository";
import { LabelArtwork } from "./LabelArtwork";
import {
  clamp,
  designReducer,
  DRAFT_KEY,
  initialDesign,
  makeLayer,
  parseDesign,
  RECOVERY_KEY,
  safeFilename,
  type LabelDesign,
  type LabelLayer,
  type LabelSide,
} from "./design-configurator-model";
import {
  createLabelSvg,
  defaultLabelFont,
  downloadDesignFile,
  exportLabelPng,
  fontKey,
  labelExportName,
  printLabel,
  resolveLabelFont,
} from "./design-configurator-export";
import "./design-configurator.css";

const recommended = new Set(["Paragraph / Standard", "Condensed / Narrow"]);
const normalize = (text: string) =>
  text.toLocaleLowerCase().replace(/[\s_-]+/g, "");
function seed() {
  try {
    const value = localStorage.getItem(RECOVERY_KEY);
    if (value)
      return { design: parseDesign(JSON.parse(value)), recovered: true };
  } catch {
    /* Invalid recovery must not block the editor. */
  }
  return { design: initialDesign, recovered: false };
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const reference = useRef<HTMLElement>(null),
    titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = reference.current;
    (
      root?.querySelector<HTMLElement>('input[type="search"]') ??
      root?.querySelector<HTMLElement>("button,input,select")
    )?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(
        root?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],textarea",
        ) ?? [],
      );
      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
        e.preventDefault();
        nodes[0]?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div className="dc-picker-overlay" onClick={close}>
      <section
        className="dc-font-picker"
        ref={reference}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dc-picker-heading">
          <div>
            <span className="dc-eyebrow">STRANGE ANIMALS / DESIGN STUDIO</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function FontRow({
  font,
  sample,
  active,
  favorite,
  busy,
  choose,
  star,
}: {
  font: FontCatalogItem;
  sample: string;
  active: boolean;
  favorite: boolean;
  busy: boolean;
  choose: () => void;
  star: () => void;
}) {
  const reference = useRef<HTMLDivElement>(null);
  const [family, setFamily] = useState<string>();
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const observer = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        observer.disconnect();
        resolveLabelFont(font)
          .then((v) => {
            if (active) setFamily(v.family);
          })
          .catch(() => {
            if (active) setError(true);
          });
      },
      { rootMargin: "80px" },
    );
    if (reference.current) observer.observe(reference.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [font]);
  return (
    <div className="dc-font-row" ref={reference}>
      <button disabled={busy} onClick={choose} aria-pressed={active}>
        <strong>{font.name}</strong>
        <span
          className="dc-font-specimen"
          style={{ fontFamily: family ?? "Alte DIN Input" }}
        >
          {sample.replace(/\n/g, " ").slice(0, 65) || "Other frequencies"}
        </span>
        <small>
          {font.parentCategory ?? "Uncategorized"} · {font.variantCount} styles{" "}
          {error ? "· preview unavailable" : !family ? "· loading…" : ""}
        </small>
      </button>
      <button
        className="dc-font-star"
        aria-label={`${favorite ? "Unfavorite" : "Favorite"} ${font.name}`}
        aria-pressed={favorite}
        onClick={star}
      >
        {active ? (
          <Check size={15} />
        ) : (
          <Star size={15} fill={favorite ? "currentColor" : "none"} />
        )}
      </button>
    </div>
  );
}

export function DesignConfiguratorEditor() {
  const [initial] = useState(seed);
  const [history, dispatch] = useReducer(designReducer, {
    past: [],
    present: initial.design,
    future: [],
  });
  const design = history.present;
  const [side, setSide] = useState<LabelSide>("A"),
    [selected, setSelected] = useState("legal"),
    [guides, setGuides] = useState(true),
    [zoom, setZoom] = useState(100),
    [mobileTab, setMobileTab] = useState("properties");
  const [dialog, setDialog] = useState<
    "fonts" | "settings" | "export" | "new" | null
  >(null);
  const [fonts, setFonts] = useState<FontCatalogItem[]>([]),
    [fontsLoading, setFontsLoading] = useState(true),
    [catalogError, setCatalogError] = useState(""),
    [catalogAttempt, setCatalogAttempt] = useState(0);
  const [scope, setScope] = useState("recommended"),
    [query, setQuery] = useState(""),
    [fontLimit, setFontLimit] = useState(40);
  const deferredQuery = useDeferredValue(query);
  const [favoriteFonts, setFavoriteFonts] = useState<string[]>(() => {
    try {
      const d = JSON.parse(
        localStorage.getItem("sa-label-font-favorites") ?? "[]",
      );
      return Array.isArray(d) ? d.filter((v) => typeof v === "string") : [];
    } catch {
      return [];
    }
  });
  const [families, setFamilies] = useState<Record<string, string>>({}),
    [fontErrors, setFontErrors] = useState<Record<string, string>>({}),
    [variants, setVariants] = useState<FontVariant[]>([]);
  const [fontBusy, setFontBusy] = useState(false),
    [exportBusy, setExportBusy] = useState(false),
    [notice, setNotice] = useState(
      initial.recovered
        ? "Tu diseño anterior fue recuperado automáticamente."
        : "",
    ),
    [storageError, setStorageError] = useState("");
  const [lastSaved, setLastSaved] = useState<string>(),
    [exportFormat, setExportFormat] = useState("svg"),
    [exportSides, setExportSides] = useState("current"),
    [includeBleed, setIncludeBleed] = useState(false),
    [textLength, setTextLength] = useState(0);
  const imageInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    id: string;
    side: LabelSide;
    x: number;
    y: number;
    layer: LabelLayer;
    changed: boolean;
  }>();
  const prefix = useId().replaceAll(":", "");
  const layers = design[side],
    element = layers.find((l) => l.id === selected) ?? layers[0],
    currentFont = fonts.find((f) => f.id === element.fontId);
  const change = (
    update: (current: LabelDesign) => LabelDesign,
    group?: string,
  ) => dispatch({ type: "change", change: update, group });
  const patchLayer = (
    s: LabelSide,
    id: string,
    patch: Partial<LabelLayer>,
    group?: string,
  ) =>
    change(
      (current) => ({
        ...current,
        [s]: current[s].map((l) => (l.id === id ? { ...l, ...patch } : l)),
      }),
      group,
    );
  const update = (patch: Partial<LabelLayer>, group?: string) =>
    patchLayer(side, element.id, patch, group);
  const end = () => dispatch({ type: "end" });
  const familyFor = (layer: LabelLayer) =>
    families[fontKey(layer)] ?? defaultLabelFont(layer);
  useEffect(() => {
    let active = true;
    setFontsLoading(true);
    setCatalogError("");
    listFontCatalog()
      .then((data) => {
        if (active) setFonts(data.filter((f) => f.enabled));
      })
      .catch(() => {
        if (active)
          setCatalogError("No se pudo cargar el catálogo de fuentes.");
      })
      .finally(() => {
        if (active) setFontsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogAttempt]);
  useEffect(() => {
    let active = true;
    setVariants([]);
    if (currentFont)
      listFontVariants(currentFont)
        .then((data) => {
          if (active) setVariants(data);
        })
        .catch(() => {
          if (active) setNotice("No se pudieron cargar las variantes.");
        });
    return () => {
      active = false;
    };
  }, [currentFont]);
  useEffect(() => {
    let active = true;
    const keys = new Set<string>();
    for (const layer of [...design.A, ...design.B]) {
      if (!layer.fontId) continue;
      const key = fontKey(layer);
      if (keys.has(key) || families[key] || fontErrors[key]) continue;
      keys.add(key);
      const font = fonts.find((f) => f.id === layer.fontId);
      if (!font) {
        if (!fontsLoading && !catalogError)
          setFontErrors((c) => ({
            ...c,
            [key]: "Fuente no disponible. Elegí otra.",
          }));
        continue;
      }
      resolveLabelFont(font, layer.variantId)
        .then((v) => {
          if (active) setFamilies((c) => ({ ...c, [key]: v.family }));
        })
        .catch(() => {
          if (active)
            setFontErrors((c) => ({
              ...c,
              [key]: "No se pudo cargar esta fuente. Probá otra variante.",
            }));
        });
    }
    return () => {
      active = false;
    };
  }, [
    design.A,
    design.B,
    fonts,
    fontsLoading,
    catalogError,
    families,
    fontErrors,
  ]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(RECOVERY_KEY, JSON.stringify(design));
        setStorageError("");
      } catch {
        setStorageError(
          "No hay espacio para recuperación automática. Descargá el proyecto JSON para conservarlo.",
        );
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [design]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => setFontLimit(40), [deferredQuery, scope]);
  useEffect(() => {
    if (element.kind !== "circular") {
      setTextLength(0);
      return;
    }
    const context = document.createElement("canvas").getContext("2d");
    if (context) {
      context.font = `${element.size}px ${JSON.stringify(familyFor(element))}`;
      setTextLength(
        context.measureText(element.text.replace(/\n/g, " ")).width +
          Math.max(0, element.text.length - 1) * element.spacing,
      );
    }
  }, [element, families]);
  const selectFont = async (font: FontCatalogItem, variantId?: string) => {
    const targetSide = side,
      targetId = element.id;
    setFontBusy(true);
    try {
      const resolved = await resolveLabelFont(font, variantId);
      setFamilies((c) => ({
        ...c,
        [fontKey({ fontId: font.id, variantId: resolved.variant.id })]:
          resolved.family,
      }));
      patchLayer(targetSide, targetId, {
        fontId: font.id,
        variantId: resolved.variant.id,
      });
      setDialog(null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo cargar la fuente.",
      );
    } finally {
      setFontBusy(false);
    }
  };
  const selectLayer = (layer: LabelLayer) => {
    setSelected(layer.id);
    setMobileTab("properties");
  };
  const add = (kind: LabelLayer["kind"]) => {
    if (layers.length >= 50) {
      setNotice("Máximo de 50 elementos por lado.");
      return;
    }
    if (kind === "image") {
      imageInput.current?.click();
      return;
    }
    const layer = makeLayer(kind);
    change((c) => ({ ...c, [side]: [...c[side], layer] }));
    selectLayer(layer);
  };
  const remove = () => {
    if (layers.length <= 1) return;
    const remaining = layers.filter((l) => l.id !== element.id);
    change((c) => ({
      ...c,
      [side]: c[side].filter((l) => l.id !== element.id),
    }));
    setSelected(remaining[0].id);
  };
  const duplicate = () => {
    if (layers.length >= 50) return;
    const copy = {
      ...element,
      id: crypto.randomUUID(),
      name: `${element.name} copy`,
      y: clamp(element.y + 12, 0, 600),
    };
    change((c) => ({ ...c, [side]: [...c[side], copy] }));
    selectLayer(copy);
  };
  const reorder = (direction: number) =>
    change((c) => {
      const next = [...c[side]],
        i = next.findIndex((l) => l.id === element.id),
        target = i + direction;
      if (i < 0 || target < 0 || target >= next.length) return c;
      [next[i], next[target]] = [next[target], next[i]];
      return { ...c, [side]: next };
    });
  const save = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(design));
      setLastSaved(JSON.stringify(design));
      setNotice(
        "Proyecto guardado en este navegador. Descargá JSON para tener un respaldo.",
      );
    } catch {
      setNotice("No hay espacio para guardar. Usá Download project (JSON).");
    }
  };
  const load = () => {
    try {
      const value = localStorage.getItem(DRAFT_KEY);
      if (!value) {
        setNotice("Todavía no hay un proyecto guardado.");
        return;
      }
      const parsed = parseDesign(JSON.parse(value));
      change(() => parsed);
      setLastSaved(JSON.stringify(parsed));
      setDialog(null);
      setNotice("Proyecto abierto. Las fuentes se restauran automáticamente.");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "No se pudo abrir el proyecto.",
      );
    }
  };
  const exportProject = () =>
    downloadDesignFile(
      new Blob([JSON.stringify(design, null, 2)], { type: "application/json" }),
      `${safeFilename(design.title)}.json`,
    );
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("El proyecto supera 20 MB.");
      const parsed = parseDesign(JSON.parse(await file.text()));
      change(() => parsed);
      setDialog(null);
      setNotice(
        "Proyecto importado. Las fuentes se restauran automáticamente.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Proyecto inválido.");
    }
  };
  const importImage = async (file?: File) => {
    if (!file) return;
    if (layers.length >= 50) {
      setNotice("Máximo de 50 elementos por lado.");
      return;
    }
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setNotice("Usá PNG, JPEG o WebP de hasta 5 MB.");
      return;
    }
    const targetSide = side;
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = data;
      });
      const layer = {
        ...makeLayer("image"),
        name: file.name.slice(0, 80),
        image: data,
        imageRatio: clamp(image.naturalWidth / image.naturalHeight, 0.05, 20),
        x: 300,
        y: 300,
      };
      change((c) => ({ ...c, [targetSide]: [...c[targetSide], layer] }));
      if (targetSide === side) selectLayer(layer);
    } catch {
      setNotice("No se pudo leer la imagen.");
    }
  };
  const svgPoint = (e: ReactPointerEvent<SVGGElement>) => {
    const matrix = e.currentTarget.ownerSVGElement?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const startDrag = (e: ReactPointerEvent<SVGGElement>) => {
    if (e.button !== 0) return;
    const layer = layers.find((l) => l.id === e.currentTarget.dataset.layerId),
      point = svgPoint(e);
    if (!layer || !point) return;
    end();
    selectLayer(layer);
    drag.current = {
      id: layer.id,
      side,
      x: point.x,
      y: point.y,
      layer,
      changed: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const moveDrag = (e: ReactPointerEvent<SVGGElement>) => {
    const start = drag.current,
      p = svgPoint(e);
    if (!start || !p || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
    if (Math.hypot(p.x - start.x, p.y - start.y) < 1 && !start.changed) return;
    start.changed = true;
    if (start.layer.kind === "circular") {
      const difference =
        ((Math.atan2(p.y - 300, p.x - 300) -
          Math.atan2(start.y - 300, start.x - 300)) *
          180) /
        Math.PI;
      patchLayer(
        start.side,
        start.id,
        {
          angle: Math.round(
            ((start.layer.angle + difference + 540) % 360) - 180,
          ),
        },
        "drag",
      );
    } else
      patchLayer(
        start.side,
        start.id,
        {
          x: clamp(Math.round(start.layer.x + p.x - start.x), 0, 600),
          y: clamp(Math.round(start.layer.y + p.y - start.y), 0, 600),
        },
        "drag",
      );
  };
  const endDrag = (e: ReactPointerEvent<SVGGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = undefined;
    end();
  };
  const doExport = async () => {
    if (exportBusy) return;
    const printWindow =
      exportFormat === "pdf" ? window.open("", "_blank") : null;
    if (exportFormat === "pdf" && !printWindow) {
      setNotice("Permití ventanas emergentes para imprimir/PDF.");
      return;
    }
    setExportBusy(true);
    try {
      const sides: LabelSide[] = exportSides === "both" ? ["A", "B"] : [side],
        mm = design.diameterMm + (includeBleed ? design.bleedMm * 2 : 0);
      for (const s of sides) {
        const svg = await createLabelSvg(design, s, fonts, includeBleed);
        if (exportFormat === "pdf" && printWindow) {
          printLabel(printWindow, svg, mm);
          break;
        }
        const blob =
          exportFormat === "png"
            ? await exportLabelPng(svg, mm)
            : new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        downloadDesignFile(blob, labelExportName(design, s, exportFormat));
      }
      setNotice(
        exportFormat === "pdf"
          ? "Elegí Guardar como PDF: escala 100%, sin encabezados ni márgenes."
          : "Exportación completada con fuentes incluidas, sin guías del editor.",
      );
    } catch (e) {
      printWindow?.close();
      setNotice(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setExportBusy(false);
    }
  };
  const visibleFonts = fonts.filter((f) =>
    deferredQuery.trim()
      ? normalize(f.name).includes(normalize(deferredQuery))
      : scope === "all"
        ? true
        : scope === "favorites"
          ? favoriteFonts.includes(f.id)
          : recommended.has(f.parentCategory ?? ""),
  );
  const sortedFonts =
    scope === "recommended" && !deferredQuery.trim()
      ? [...visibleFonts].sort(
          (a, b) =>
            (a.parentCategory ?? "").localeCompare(b.parentCategory ?? "") ||
            a.name.localeCompare(b.name),
        )
      : visibleFonts;
  const index = layers.findIndex((l) => l.id === element.id),
    overflow =
      element.kind === "circular" &&
      textLength >
        (Math.PI * element.radius * (element.arcDegrees ?? 180)) / 180;
  const panelTitle = (n: string, title: string) => (
    <div className="dc-panel-title">
      <span>{n}</span>
      <h2>{title}</h2>
    </div>
  );
  const number = (
    label: string,
    key: "size" | "spacing" | "x" | "y",
    min: number,
    max: number,
    unit: string,
    step = 1,
  ) => (
    <label className="dc-field">
      <span>
        {label}
        <small>{unit}</small>
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={element[key]}
        onChange={(e) =>
          update(
            { [key]: clamp(Number(e.target.value), min, max) },
            `number-${element.id}-${key}`,
          )
        }
        onBlur={end}
      />
    </label>
  );
  const slider = (
    label: string,
    key: "radius" | "angle" | "width" | "arcDegrees",
    min: number,
    max: number,
    unit: string,
  ) => (
    <label className="dc-field dc-slider-field">
      <span>
        {label}
        <output>
          {element[key] ?? 180} <small>{unit}</small>
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={element[key] ?? 180}
        onChange={(e) =>
          update(
            { [key]: Number(e.target.value) },
            `range-${element.id}-${key}`,
          )
        }
        onPointerUp={end}
        onPointerCancel={end}
        onBlur={end}
      />
    </label>
  );
  return (
    <main
      className="design-configurator"
      data-native-cursor-surface
      onKeyDown={(e) => {
        const editable =
          e.target instanceof HTMLElement &&
          !!e.target.closest("input,textarea,select,[contenteditable=true]");
        if (
          e.target instanceof HTMLElement &&
          e.target.closest('[role="dialog"]')
        )
          return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          save();
          return;
        }
        if (
          !editable &&
          (e.metaKey || e.ctrlKey) &&
          e.key.toLowerCase() === "z"
        ) {
          e.preventDefault();
          dispatch({ type: e.shiftKey ? "redo" : "undo" });
          return;
        }
        if (
          editable ||
          (e.target instanceof HTMLElement && e.target.closest("button,a"))
        )
          return;
        const movements: Record<string, [number, number]> = {
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
        };
        if (movements[e.key]) {
          e.preventDefault();
          const [x, y] = movements[e.key],
            step = e.shiftKey ? 10 : 1;
          if (element.kind === "circular")
            update({
              angle: clamp(element.angle + (x || y) * step, -180, 180),
            });
          else
            update({
              x: clamp(element.x + x * step, 0, 600),
              y: clamp(element.y + y * step, 0, 600),
            });
        }
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          remove();
        }
      }}
    >
      <header className="dc-header">
        <a className="dc-brand" href="/identity/typography/typefaces">
          <img src="/media/images/logos/sa-logo.png" alt="Strange Animals" />
        </a>
        <div className="dc-breadcrumb">
          <span>identity</span>
          <ChevronRight size={12} />
          <strong>design configurator</strong>
          <span className="dc-draft-tag">STUDIO</span>
        </div>
        <a className="dc-back" href="/identity/typography/typefaces">
          <ArrowUpRight size={15} />
          Typefaces
        </a>
      </header>
      <div className="dc-project-bar">
        <div>
          <span className="dc-eyebrow">
            VINYL LABEL /{" "}
            {lastSaved === JSON.stringify(design)
              ? "SAVED LOCALLY"
              : "AUTORECOVERY ON"}
          </span>
          <label className="dc-project-name">
            <span className="sr-only">Project name</span>
            <input
              maxLength={120}
              value={design.title}
              onChange={(e) =>
                change(
                  (c) => ({ ...c, title: e.target.value }),
                  "project-title",
                )
              }
              onBlur={end}
            />
          </label>
        </div>
        <div className="dc-project-actions">
          <div className="dc-history">
            <button
              aria-label="Undo"
              title="Undo (⌘/Ctrl Z)"
              disabled={!history.past.length}
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="Redo"
              title="Redo (⌘/Ctrl Shift Z)"
              disabled={!history.future.length}
              onClick={() => dispatch({ type: "redo" })}
            >
              <Redo2 size={17} />
            </button>
          </div>
          <button className="dc-save" onClick={() => setDialog("settings")}>
            <Settings2 size={15} />
            <span>Project</span>
          </button>
          <button className="dc-save" onClick={save}>
            <Save size={15} />
            Save
          </button>
          <button className="dc-export" onClick={() => setDialog("export")}>
            <ArrowDownToLine size={15} />
            Export
          </button>
        </div>
      </div>
      {storageError && (
        <div className="dc-storage-warning" role="alert">
          {storageError}
          <button onClick={exportProject}>Download JSON</button>
        </div>
      )}
      <div className="dc-workspace">
        <aside
          className={`dc-layers ${mobileTab === "layers" ? "dc-mobile-visible" : ""}`}
        >
          {panelTitle("01", "Elements")}
          <div className="dc-side-switch" aria-label="Record side">
            {(["A", "B"] as const).map((s) => (
              <button
                key={s}
                aria-pressed={side === s}
                onClick={() => {
                  end();
                  setSide(s);
                }}
              >
                Side {s}
                <span>{design[s].length} elements</span>
              </button>
            ))}
          </div>
          <div className="dc-add-controls">
            <button onClick={() => add("text")}>
              <Type size={14} />
              Text
            </button>
            <button onClick={() => add("circular")}>
              <Circle size={14} />
              Legal / arc
            </button>
            <button onClick={() => add("image")}>
              <ImagePlus size={14} />
              Image
            </button>
          </div>
          <div className="dc-layer-list">
            {layers.map((layer, i) => (
              <div
                key={layer.id}
                className={`dc-layer ${element.id === layer.id ? "is-selected" : ""}`}
              >
                <button
                  className="dc-layer-select"
                  aria-pressed={element.id === layer.id}
                  onClick={() => selectLayer(layer)}
                >
                  <span className="dc-layer-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {layer.kind === "circular" ? (
                    <Circle size={15} />
                  ) : layer.kind === "image" ? (
                    <ImagePlus size={15} />
                  ) : (
                    <Type size={15} />
                  )}
                  <span>
                    {layer.name}
                    <small>
                      {layer.kind === "circular"
                        ? "Text on a circle"
                        : layer.kind === "image"
                          ? "Image / logo"
                          : "Text layer"}
                    </small>
                  </span>
                </button>
                <button
                  className="dc-visibility"
                  aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                  onClick={() =>
                    patchLayer(side, layer.id, { visible: !layer.visible })
                  }
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </div>
            ))}
          </div>
          <div className="dc-layer-actions">
            <button
              aria-label="Move element toward back"
              disabled={index <= 0}
              onClick={() => reorder(-1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              aria-label="Move element toward front"
              disabled={index >= layers.length - 1}
              onClick={() => reorder(1)}
            >
              <ArrowDown size={15} />
            </button>
            <button
              aria-label="Duplicate element"
              disabled={layers.length >= 50}
              onClick={duplicate}
            >
              <Copy size={15} />
            </button>
            <button
              aria-label="Delete element"
              disabled={layers.length <= 1}
              onClick={remove}
            >
              <Trash2 size={15} />
            </button>
          </div>
          <div className="dc-paper">
            <div className="dc-section-caption">
              Label stock
              <label className="dc-custom-paper">
                <span className="sr-only">Custom label color</span>
                <input
                  type="color"
                  value={design.paper}
                  onChange={(e) =>
                    change((c) => ({ ...c, paper: e.target.value }), "paper")
                  }
                  onBlur={end}
                />
              </label>
            </div>
            <div className="dc-paper-options">
              {["#e5e8d9", "#f1eadc", "#e0e7ec", "#efcfc3", "#f7f6f0"].map(
                (c) => (
                  <button
                    key={c}
                    aria-label={`Label color ${c}`}
                    aria-pressed={design.paper === c}
                    style={{ backgroundColor: c }}
                    onClick={() =>
                      change((current) => ({ ...current, paper: c }))
                    }
                  >
                    {design.paper === c && <Check size={14} />}
                  </button>
                ),
              )}
            </div>
            <span>
              {design.diameterMm} mm · {design.holeMm} mm center hole
            </span>
          </div>
          <button className="dc-load" onClick={() => setDialog("settings")}>
            <FileText size={15} />
            Projects & dimensions
            <ArrowUpRight size={13} />
          </button>
        </aside>
        <section className="dc-stage" aria-label="Vinyl label preview">
          <div className="dc-stage-top">
            <span>
              <span className="dc-live-dot" />
              SIDE {side} / LIVE PREVIEW
            </span>
            <button aria-pressed={guides} onClick={() => setGuides(!guides)}>
              <Grid2X2 size={14} />
              Guides<span>{guides ? "ON" : "OFF"}</span>
            </button>
          </div>
          <div className="dc-artboard">
            <span className="dc-measure dc-measure-top">
              {design.diameterMm} mm <span>LABEL DIAMETER</span>
            </span>
            <div className="dc-disc-wrap" style={{ width: `${zoom}%` }}>
              <LabelArtwork
                design={design}
                side={side}
                prefix={prefix}
                fontFamily={familyFor}
                selected={element.id}
                guides={guides}
                onSelect={selectLayer}
                onPointerDown={startDrag}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
              />
            </div>
            <span className="dc-measure dc-measure-bottom">
              <span>SIDE {side}</span>Ø {design.holeMm} mm center hole
            </span>
          </div>
          <div className="dc-canvas-footer">
            <span>
              Drag text to position it. Drag circular text to rotate. Arrow keys
              for fine adjustments.
            </span>
            <div className="dc-zoom">
              <button
                aria-label="Zoom out"
                disabled={zoom <= 50}
                onClick={() => setZoom(Math.max(50, zoom - 10))}
              >
                <Minus size={14} />
              </button>
              <output>{zoom}%</output>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 180}
                onClick={() => setZoom(Math.min(180, zoom + 10))}
              >
                <Plus size={14} />
              </button>
              <button aria-label="Fit to canvas" onClick={() => setZoom(100)}>
                <Focus size={16} />
              </button>
            </div>
          </div>
        </section>
        <aside
          className={`dc-properties ${mobileTab === "properties" ? "dc-mobile-visible" : ""}`}
        >
          {panelTitle("02", "Properties")}
          <div className="dc-selected-heading">
            <div>
              {element.kind === "circular" ? (
                <Circle size={17} />
              ) : element.kind === "image" ? (
                <ImagePlus size={17} />
              ) : (
                <Type size={17} />
              )}
              <h3>{element.name}</h3>
            </div>
            <span>{element.kind.toUpperCase()}</span>
          </div>
          <label className="dc-field">
            <span>Element name</span>
            <input
              maxLength={80}
              value={element.name}
              onChange={(e) =>
                update({ name: e.target.value }, `name-${element.id}`)
              }
              onBlur={end}
            />
          </label>
          {element.kind !== "image" && (
            <>
              <label className="dc-field dc-text-field">
                <span>
                  Content<span>{element.text.length} characters</span>
                </span>
                <textarea
                  maxLength={3000}
                  rows={4}
                  value={element.text}
                  onChange={(e) =>
                    update({ text: e.target.value }, `text-${element.id}`)
                  }
                  onBlur={end}
                />
              </label>
              <section className="dc-property-section">
                <div className="dc-section-caption">
                  Typography<span>01</span>
                </div>
                <label className="dc-field">
                  <span>Font family</span>
                  <button
                    className="dc-font-trigger"
                    disabled={fontBusy}
                    onClick={() => {
                      setDialog("fonts");
                      setQuery("");
                    }}
                  >
                    <span>
                      {currentFont?.name ??
                        (element.fontId
                          ? "Font unavailable"
                          : "Studio default")}
                      <small>
                        {currentFont
                          ? (currentFont.parentCategory ?? "Uncategorized")
                          : "Browse your typeface library"}
                      </small>
                    </span>
                    <ChevronDown size={15} />
                  </button>
                </label>
                {fontErrors[fontKey(element)] && (
                  <p className="dc-warning" role="alert">
                    {fontErrors[fontKey(element)]}
                  </p>
                )}
                {element.fontId && (
                  <button
                    className="dc-reset"
                    onClick={() =>
                      update({ fontId: undefined, variantId: undefined })
                    }
                  >
                    Use studio default
                  </button>
                )}
                <label className="dc-field">
                  <span>Style</span>
                  <select
                    disabled={!currentFont || fontBusy || !variants.length}
                    value={element.variantId ?? ""}
                    onChange={(e) => {
                      if (currentFont)
                        void selectFont(currentFont, e.target.value);
                    }}
                  >
                    <option value="">
                      {currentFont
                        ? "Choose variant"
                        : "Regular — studio default"}
                    </option>
                    {variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.fileName.replace(/\.(otf|ttf|woff2?)$/i, "")}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="dc-field-pair">
                  {number("Size", "size", 3, 125, "PX", 0.5)}
                  {number("Tracking", "spacing", -10, 30, "PX", 0.1)}
                </div>
                <div className="dc-alignment">
                  <span>Anchor</span>
                  <div>
                    {(["start", "middle", "end"] as const).map((value, i) => {
                      const Icon = [AlignLeft, AlignCenter, AlignRight][i];
                      return (
                        <button
                          key={value}
                          aria-label={
                            ["Start anchor", "Center anchor", "End anchor"][i]
                          }
                          aria-pressed={element.align === value}
                          onClick={() => update({ align: value })}
                        >
                          <Icon size={16} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>
            </>
          )}
          <section className="dc-property-section">
            <div className="dc-section-caption">
              {element.kind === "circular"
                ? "Circular path"
                : "Position & size"}
              <span>02</span>
            </div>
            {element.kind === "circular" ? (
              <>
                <div className="dc-segments">
                  {(["top", "bottom"] as const).map((arc) => (
                    <button
                      key={arc}
                      aria-pressed={element.arc === arc}
                      onClick={() => update({ arc })}
                    >
                      {arc === "top" ? "Upper arc" : "Lower arc"}
                    </button>
                  ))}
                </div>
                {slider("Radius", "radius", 30, 295, "PX")}
                {slider("Arc length", "arcDegrees", 30, 350, "°")}
                {slider("Rotation", "angle", -180, 180, "°")}
                <p className="dc-anchor-note">
                  <Circle size={13} />
                  Type size changes. The circle stays put.
                </p>
                {overflow && (
                  <p className="dc-warning" role="status">
                    El texto supera el arco. Aumentá el arco/radio o reducí
                    tamaño/espaciado. No se achica automáticamente.
                  </p>
                )}
              </>
            ) : (
              <>
                {element.kind === "image" &&
                  slider("Width", "width", 10, 600, "PX")}
                <div className="dc-field-pair">
                  {number("Horizontal", "x", 0, 600, "PX")}
                  {number("Vertical", "y", 0, 600, "PX")}
                </div>
                {slider("Rotation", "angle", -180, 180, "°")}
              </>
            )}
          </section>
          {element.kind !== "image" && (
            <div className="dc-ink">
              <span>Ink color</span>
              <label>
                <input
                  aria-label="Text ink color"
                  type="color"
                  value={element.color}
                  onChange={(e) =>
                    update({ color: e.target.value }, `ink-${element.id}`)
                  }
                  onBlur={end}
                />
                <span>{element.color.toUpperCase()}</span>
              </label>
            </div>
          )}
          <button
            className="dc-reset"
            onClick={() => {
              const defaults =
                initialDesign[side].find((l) => l.id === element.id) ??
                makeLayer(element.kind, element.id);
              update({
                ...defaults,
                fontId: defaults.fontId,
                variantId: defaults.variantId,
                image: element.kind === "image" ? element.image : undefined,
                imageRatio:
                  element.kind === "image" ? element.imageRatio : undefined,
              });
            }}
          >
            <RotateCcw size={13} />
            Reset this element
          </button>
        </aside>
      </div>
      <footer className="dc-statusbar">
        <span>
          <span className="dc-live-dot" />
          LOCAL PROJECT / AUTORECOVERY
        </span>
        <span>
          VINYL LABEL / SIDE {side} / {layers.length} ELEMENTS
        </span>
        <span>MADE TO BE PLAYED.</span>
      </footer>
      <nav className="dc-mobile-tabs" aria-label="Editor panels">
        <button
          aria-pressed={mobileTab === "layers"}
          onClick={() => setMobileTab("layers")}
        >
          <Layers size={16} />
          Elements
        </button>
        <button
          aria-pressed={mobileTab === "properties"}
          onClick={() => setMobileTab("properties")}
        >
          <SlidersHorizontal size={16} />
          Properties
        </button>
        <button
          onClick={() => {
            setDialog("fonts");
            setQuery("");
          }}
        >
          <Type size={16} />
          Fonts
        </button>
      </nav>
      <input
        hidden
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          void importImage(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <input
        hidden
        ref={projectInput}
        type="file"
        accept=".json,application/json"
        onChange={(e) => {
          void importProject(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      {dialog === "fonts" && (
        <Modal title="Find the right voice." close={() => setDialog(null)}>
          <label className="dc-font-search">
            <Search size={17} />
            <span className="sr-only">Search all fonts</span>
            <input
              type="search"
              placeholder="Search all available fonts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="dc-font-scopes">
            {[
              ["recommended", "Recommended"],
              ["all", "All"],
              ["favorites", "Favorites"],
            ].map(([key, title]) => (
              <button
                key={key}
                aria-pressed={scope === key}
                onClick={() => setScope(key)}
              >
                {title}
              </button>
            ))}
            <span>{sortedFonts.length} families</span>
          </div>
          <p className="dc-font-explanation">
            {query
              ? "Searching your entire catalog."
              : scope === "recommended"
                ? "Paragraph / Standard + Condensed / Narrow. Search to discover other categories."
                : scope === "favorites"
                  ? "Your favorites in this configurator."
                  : "All enabled families. Samples use the selected element’s text."}
          </p>
          <div className="dc-font-results">
            {fontsLoading && <p role="status">Loading your library…</p>}
            {catalogError && (
              <p role="alert">
                {catalogError}
                <button onClick={() => setCatalogAttempt((n) => n + 1)}>
                  Retry
                </button>
              </p>
            )}
            {!fontsLoading && !catalogError && !sortedFonts.length && (
              <p>No fonts found. Try another search.</p>
            )}
            {sortedFonts.slice(0, fontLimit).map((font, i) => (
              <div key={font.id}>
                {scope === "recommended" &&
                  !query &&
                  (i === 0 ||
                    sortedFonts[i - 1].parentCategory !==
                      font.parentCategory) && (
                    <h3 className="dc-font-group">{font.parentCategory}</h3>
                  )}
                <FontRow
                  font={font}
                  sample={element.text}
                  active={element.fontId === font.id}
                  favorite={favoriteFonts.includes(font.id)}
                  busy={fontBusy}
                  choose={() => void selectFont(font)}
                  star={() => {
                    const next = favoriteFonts.includes(font.id)
                      ? favoriteFonts.filter((id) => id !== font.id)
                      : [...favoriteFonts, font.id];
                    setFavoriteFonts(next);
                    try {
                      localStorage.setItem(
                        "sa-label-font-favorites",
                        JSON.stringify(next),
                      );
                    } catch {
                      setNotice("No se pudieron guardar los favoritos.");
                    }
                  }}
                />
              </div>
            ))}
            {sortedFonts.length > fontLimit && (
              <button
                className="dc-more-fonts"
                onClick={() => setFontLimit((n) => n + 40)}
              >
                Load more · {sortedFonts.length - fontLimit} remaining
              </button>
            )}
          </div>
          <div className="dc-picker-footer">
            <span>
              {fontBusy
                ? "Loading font…"
                : "Select a family to apply it to this element."}
            </span>
            <a href="/identity/typography/typefaces">
              Full catalog
              <ArrowUpRight size={13} />
            </a>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="Project & dimensions." close={() => setDialog(null)}>
          <div className="dc-dialog-scroll">
            <p className="dc-font-explanation">
              Projects live in this browser. Download JSON to transfer or back
              them up. Use your printer’s template for final dimensions.
            </p>
            <div className="dc-project-files">
              <button onClick={load}>
                <FileText size={16} />
                Open saved project
              </button>
              <button onClick={exportProject}>
                <ArrowDownToLine size={16} />
                Download project (JSON)
              </button>
              <button onClick={() => projectInput.current?.click()}>
                <Upload size={16} />
                Import project (JSON)
              </button>
              <button onClick={() => setDialog("new")}>
                <Plus size={16} />
                New project
              </button>
            </div>
            <section className="dc-property-section">
              <div className="dc-section-caption">
                Print dimensions<span>MM</span>
              </div>
              {(
                [
                  ["diameterMm", "Label diameter", 50, 150],
                  ["holeMm", "Center hole", 1, 40],
                  ["bleedMm", "Bleed per edge", 0, 10],
                  ["safeMm", "Safe margin", 0, 10],
                ] as const
              ).map(([key, label, min, max]) => (
                <label className="dc-field" key={key}>
                  <span>
                    {label}
                    <small>MM</small>
                  </span>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={0.1}
                    value={design[key]}
                    onChange={(e) =>
                      change(
                        (c) => ({
                          ...c,
                          [key]: clamp(Number(e.target.value), min, max),
                        }),
                        `dimension-${key}`,
                      )
                    }
                    onBlur={end}
                  />
                </label>
              ))}
            </section>
            <section className="dc-property-section">
              <div className="dc-section-caption">Template details</div>
              <label className="dc-check">
                <input
                  type="checkbox"
                  checked={design.frame}
                  onChange={(e) =>
                    change((c) => ({ ...c, frame: e.target.checked }))
                  }
                />
                Decorative border
              </label>
              <label className="dc-check">
                <input
                  type="checkbox"
                  checked={design.mark}
                  onChange={(e) =>
                    change((c) => ({ ...c, mark: e.target.checked }))
                  }
                />
                Studio symbol
              </label>
              <p className="dc-font-explanation">
                Guides never export. The center hole stays transparent. Colors
                are RGB, not a CMYK press proof.
              </p>
            </section>
          </div>
        </Modal>
      )}
      {dialog === "new" && (
        <Modal title="Start a new label?" close={() => setDialog(null)}>
          <p className="dc-font-explanation">
            Download your current project first to keep a separate backup.
            Starting over can also be undone.
          </p>
          <div className="dc-project-files">
            <button onClick={exportProject}>Download current JSON</button>
            <button
              onClick={() => {
                change(() => structuredClone(initialDesign));
                setSelected("legal");
                setSide("A");
                setDialog(null);
              }}
            >
              Start new project
            </button>
            <button onClick={() => setDialog(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {dialog === "export" && (
        <Modal
          title="Ready to leave the studio."
          close={() => {
            if (!exportBusy) setDialog(null);
          }}
        >
          <div className="dc-dialog-scroll">
            <p className="dc-font-explanation">
              Visible artwork and embedded fonts, without selection or print
              guides. Check your printer’s dimensions and font embedding
              licenses.
            </p>
            <label className="dc-field">
              <span>Format</span>
              <select
                value={exportFormat}
                disabled={exportBusy}
                onChange={(e) => {
                  setExportFormat(e.target.value);
                  if (e.target.value === "pdf") setExportSides("current");
                }}
              >
                <option value="svg">
                  SVG — editable vector, embedded fonts
                </option>
                <option value="png">PNG — 300 dpi equivalent pixel size</option>
                <option value="pdf">Print / Save as PDF — current side</option>
              </select>
            </label>
            <label className="dc-field">
              <span>Sides</span>
              <select
                value={exportSides}
                disabled={exportBusy || exportFormat === "pdf"}
                onChange={(e) => setExportSides(e.target.value)}
              >
                <option value="current">Current side ({side})</option>
                <option value="both">Both sides — separate files</option>
              </select>
            </label>
            <label className="dc-check">
              <input
                type="checkbox"
                checked={includeBleed}
                disabled={exportBusy}
                onChange={(e) => setIncludeBleed(e.target.checked)}
              />
              Include {design.bleedMm} mm bleed per edge
            </label>
            <div className="dc-export-summary">
              <span>Output dimensions</span>
              <strong>
                {design.diameterMm + (includeBleed ? design.bleedMm * 2 : 0)} ×{" "}
                {design.diameterMm + (includeBleed ? design.bleedMm * 2 : 0)} mm
              </strong>
              <span>RGB · transparent center hole</span>
            </div>
            <button
              className="dc-export-confirm"
              disabled={exportBusy}
              onClick={() => void doExport()}
            >
              <ArrowDownToLine size={16} />
              {exportBusy
                ? "Preparing fonts & artwork…"
                : exportFormat === "pdf"
                  ? "Open print / PDF"
                  : "Download artwork"}
            </button>
            <p className="dc-font-explanation">
              PDF uses your browser’s print dialog. Choose 100% scale, disable
              headers/footers and margins. SVG text remains editable, not
              outlined. Your printer may require outlines or a separate CMYK
              conversion.
            </p>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="dc-toast" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
