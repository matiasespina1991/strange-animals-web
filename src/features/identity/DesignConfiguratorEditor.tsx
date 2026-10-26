import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import packageManifest from "../../../package.json";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpRight,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Disc3,
  Grid2X2,
  Eye,
  EyeOff,
  FileText,
  Focus,
  FolderPlus,
  History,
  Folder,
  Maximize,
  Minimize,
  ImagePlus,
  Layers,
  Spline,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Star,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import { listFontCatalog } from "./font-catalog-repository";
import { LabelArtwork } from "./LabelArtwork";
import { TypographyValueControl } from "./TypographyValueControl";
import { ContentTextControl } from "./ContentTextControl";
import { ImageAppearanceControls } from "./ImageAppearanceControls";
import { TextSurfaceControl } from "./TextSurfaceControl";
import { readBarcodeSourcePalette } from "./barcode-source-palette";
import { TextBlendModeControl, TextEffectControls } from "./TextEffectControls";
import { Sleeve3DPreview } from "./Sleeve3DPreview";
import { ColorSwatches } from "./ColorSwatches";
import { FontPickerPanel, isMobileFontPicker } from "./FontPickerPanel";
import {
  GLOBAL_COLOR_PRESETS,
  INK_COLOR_PRESETS,
} from "./design-configurator-colors";
import { SleeveSurfaceIcon } from "./SleeveSurfaceIcon";
import { MobileCanvasToolbar } from "./MobileCanvasToolbar";
import { LabelTemplatePicker } from "./LabelTemplatePicker";
import { FontStyleTiles } from "./FontStyleTiles";
import { FontSpecimen } from "./FontSpecimen";
import { FontCategoryChips } from "./FontCategoryChips";
import { FontCollectionTabs } from "./FontCollectionTabs";
import { getFontCategoryDisplayName } from "./font-categories";
import {
  pickerCatalog,
  pickerCategories,
  pickerCategory,
  pickerCategoryLabel,
  standardCategoriesFor,
  type FontPickerScope,
} from "./font-picker-catalog";
import {
  familyIsExpanded,
  familyClickAction,
  toggleFamily,
} from "./font-picker-state";
import { GlobalInkControl } from "./GlobalInkControl";
import { AssetLibrary } from "./AssetLibrary";
import { AccountControl } from "./AccountControl";
import { accountAuth } from "./account-auth";
import { createExportDiagnostics } from "./export-diagnostics";
import { createUsedFontDownload } from "./design-configurator-font-download";
import { hasUnsavedProject } from "./project-dirty-state";
import { removeLayers } from "./layer-operations";
import { sanitizeSvgSource, type InsertableAsset } from "./asset-library";
import { ConfirmationDialog } from "./TextColorConfirmation";
import {
  hasCustomTextColors,
  changeLayerTextColors,
  changeGlobalTextColor,
} from "./text-color-model";
import {
  clamp,
  designReducer,
  initialDesign,
  makeLayer,
  parseDesign,
  RECOVERY_KEY,
  safeFilename,
  imageRole,
  getSurfaceLayers,
  updateSurfaceLayers,
  initialImageLayerPosition,
  SLEEVE_SIZE_MM,
  type LabelDesign,
  type LabelLayer,
  type LabelSide,
  type LabelSurface,
} from "./design-configurator-model";
import {
  getGalleryProject,
  getGalleryVersion,
  loadGalleryDesign,
  saveGalleryVersion,
} from "./design-gallery-repository";
import {
  captureLabelPreview,
  createSleeveArtworkSvg,
  createSleeveLabelSvg,
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
import "./design-configurator-mobile.css";
import "./design-configurator-theme.css";
import { ConfiguratorThemeToggle } from "./ConfiguratorThemeToggle";
import { readConfiguratorTheme, saveConfiguratorTheme } from "./configurator-theme";
import { canvasHoleMask } from "./canvas-hole-mask";

const TEMPLATE_WELCOME_KEY = "sa-label-template-welcome-seen-v1";
const RECOVERY_SUCCESS_NOTICE = "Autosave recovered";

function seed() {
  try {
    const value = localStorage.getItem(RECOVERY_KEY);
    if (value)
      return {
        design: parseDesign(JSON.parse(value)),
        recovered: true,
        showTemplateWelcome: false,
      };
  } catch {
    /* Invalid recovery must not block the editor. */
  }
  let showTemplateWelcome = true;
  try {
    showTemplateWelcome =
      !localStorage.getItem(TEMPLATE_WELCOME_KEY) &&
      !localStorage.getItem(DRAFT_KEY);
  } catch {
    // The welcome can still open when browser storage is unavailable.
  }
  return { design: initialDesign, recovered: false, showTemplateWelcome };
}
function Modal({
  title,
  children,
  close,
  wide = false,
  allowBackgroundScroll = false,
  className = "dc-font-picker",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
  allowBackgroundScroll?: boolean;
  className?: string;
}) {
  const reference = useRef<HTMLElement>(null),
    titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    if (!allowBackgroundScroll) document.body.style.overflow = "hidden";
    const root = reference.current;
    (
      root?.querySelector<HTMLElement>('input[type="search"]') ??
      root?.querySelector<HTMLElement>("button,input,select")
    )?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || allowBackgroundScroll) return;
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
      if (!allowBackgroundScroll) document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className={`dc-picker-overlay${wide ? " dc-template-overlay" : ""}${allowBackgroundScroll ? " dc-picker-nonmodal" : ""}`}
      onClick={close}
    >
      <section
        role="dialog"
        className={className}
        aria-modal={allowBackgroundScroll ? undefined : true}
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dc-picker-heading">
          <div>
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
  preview,
  expanded,
  toggleExpanded,
  stylesId,
  star,
}: {
  font: FontCatalogItem;
  sample: string;
  active: boolean;
  favorite: boolean;
  busy: boolean;
  choose: () => void;
  preview: (font: FontCatalogItem | null) => void;
  expanded?: boolean;
  toggleExpanded: () => void;
  stylesId: string;
  star: () => void;
}) {
  return (
    <div className="dc-font-row">
      <button
        disabled={busy}
        onClick={choose}
        aria-pressed={active}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") preview(font);
        }}
        onPointerLeave={() => preview(null)}
        onFocus={() => preview(font)}
        onBlur={() => preview(null)}
      >
        <strong>{font.name}</strong>
        <FontSpecimen font={font} sample={sample} />
        <small>
          {getFontCategoryDisplayName(pickerCategory(font))}
          {font.variantCount > 1 && (
            <>
              {" "}
              · <b>{font.variantCount} styles</b>
            </>
          )}
        </small>
      </button>
      {font.variantCount > 1 && (
        <button
          className="dc-font-expand"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${font.name} styles`}
          aria-expanded={expanded}
          aria-controls={stylesId}
          disabled={busy}
          onClick={toggleExpanded}
        >
          {expanded ? <ChevronDown size={15} /> : <ChevronLeft size={15} />}
        </button>
      )}
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

export function DesignConfiguratorEditor({
  onOpenGallery,
  gallerySelection,
}: {
  onOpenGallery: () => void;
  gallerySelection?: { projectId: string; versionId: string };
}) {
  const sleeveCanvasSizeMm = SLEEVE_SIZE_MM;
  const [initial] = useState(seed);
  const [theme, setTheme] = useState(readConfiguratorTheme);
  useEffect(() => saveConfiguratorTheme(theme), [theme]);
  const [accountUser, setAccountUser] = useState(accountAuth.currentUser);
  useEffect(() => onAuthStateChanged(accountAuth, setAccountUser), []);
  const [history, dispatch] = useReducer(designReducer, {
    past: [],
    present: initial.design,
    future: [],
  });
  const design = history.present;
  const [galleryProjectId, setGalleryProjectId] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get("projectId"),
  );
  const editorRoot = useRef<HTMLElement>(null);
  const projectBarRef = useRef<HTMLDivElement>(null);
  const globalSettingsRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = editorRoot.current;
    const projectBar = projectBarRef.current;
    const globalSettings = globalSettingsRef.current;
    if (!root || !projectBar || !globalSettings) return;
    const updateStickyOffsets = () => {
      const projectBarBounds = projectBar.getBoundingClientRect();
      root.style.setProperty(
        "--dc-project-bar-height",
        `${projectBarBounds.height}px`,
      );
      root.style.setProperty(
        "--dc-global-settings-height",
        `${globalSettings.getBoundingClientRect().height}px`,
      );
    };
    updateStickyOffsets();
    const observer = new ResizeObserver(updateStickyOffsets);
    observer.observe(projectBar);
    observer.observe(globalSettings);
    return () => observer.disconnect();
  }, []);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement === editorRoot.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  useEffect(() => {
    if (!fullscreenFallback) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreenFallback(false);
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", escape);
    };
  }, [fullscreenFallback]);
  const toggleFullscreen = async () => {
    if (fullscreenFallback) {
      setFullscreenFallback(false);
      return;
    }
    if (document.fullscreenElement === editorRoot.current) {
      await document.exitFullscreen();
      return;
    }
    try {
      if (!editorRoot.current?.requestFullscreen) {
        setFullscreenFallback(true);
        return;
      }
      await editorRoot.current.requestFullscreen();
    } catch {
      setFullscreenFallback(true);
    }
  };
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameLocation, setRenameLocation] = useState<"tile" | "heading">(
    "tile",
  );
  const [renameDraft, setRenameDraft] = useState("");
  const [layerPanelWidth, setLayerPanelWidth] = useState(184);
  const [propertiesPanelWidth, setPropertiesPanelWidth] = useState(() =>
    window.innerWidth <= 1100 ? 260 : window.innerWidth >= 1600 ? 320 : 300,
  );
  const [reorderingLayer, setReorderingLayer] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    id: string;
    before: boolean;
  } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const [resetTarget, setResetTarget] = useState<{
    side: LabelSide;
    surface: LabelSurface;
    layer: LabelLayer;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    side: LabelSide;
    surface: LabelSurface;
    layers: LabelLayer[];
  } | null>(null);
  const layerList = useRef<HTMLDivElement>(null);
  const artboardReference = useRef<HTMLDivElement>(null);
  const draggedLayerId = useRef<string | null>(null);
  const layerAutoScrollTimer = useRef<number | null>(null);
  const layerAutoScrollDirection = useRef<-1 | 0 | 1>(0);
  useEffect(
    () => () => {
      if (layerAutoScrollTimer.current !== null)
        window.clearInterval(layerAutoScrollTimer.current);
    },
    [],
  );
  const cancelRenameOnBlur = useRef(false);
  const layerResizePointer = useRef<number | null>(null);
  const propertiesResizePointer = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [panning, setPanning] = useState(false);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [side, setSide] = useState<LabelSide>("A"),
    [surface, setSurface] = useState<"cookie" | "sleeve">("cookie"),
    [selected, setSelected] = useState<string | null>("legal"),
    [guides, setGuides] = useState(true),
    [zoom, setZoom] = useState(100),
    [mobileTab, setMobileTab] = useState("properties"),
    [mobileGlobalSettingsOpen, setMobileGlobalSettingsOpen] = useState(true);
  useEffect(() => {
    const artboard = artboardReference.current;
    if (!artboard) return;
    const handleCanvasWheel = (event: WheelEvent) => {
      const isMobileViewport = window.matchMedia("(max-width: 800px)").matches;
      if ((!event.ctrlKey && isMobileViewport) || !event.deltaY) return;
      event.preventDefault();
      const delta = Math.max(-120, Math.min(120, event.deltaY));
      const sensitivity = event.ctrlKey ? 0.008 : 0.0035;
      setZoom((current) =>
        Math.round(clamp(current * Math.exp(-delta * sensitivity), 60, 1200)),
      );
    };
    artboard.addEventListener("wheel", handleCanvasWheel, { passive: false });
    return () => artboard.removeEventListener("wheel", handleCanvasWheel);
  }, []);
  const [dialog, setDialog] = useState<
    | "fonts"
    | "file"
    | "settings"
    | "export"
    | "new"
    | "assets"
    | "sleeve-preview"
    | null
  >(initial.showTemplateWelcome ? "new" : null);
  const [sleevePreviewLabels, setSleevePreviewLabels] = useState({
    A: "",
    B: "",
    sleeveA: "",
    sleeveB: "",
  });
  const [sleevePreviewBusy, setSleevePreviewBusy] = useState(false);
  const [gallerySaving, setGallerySaving] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuReference = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!saveMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !saveMenuReference.current?.contains(event.target)
      ) {
        setSaveMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSaveMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [saveMenuOpen]);
  useEffect(() => {
    if (!initial.showTemplateWelcome) return;
    try {
      localStorage.setItem(TEMPLATE_WELCOME_KEY, "1");
    } catch {
      // Storage failure must not prevent editing or template selection.
    }
  }, [initial.showTemplateWelcome]);
  const [hoverFamily, setHoverFamily] = useState<string | null>(null);
  const [hoverFontLoading, setHoverFontLoading] = useState(false);
  const [colorPreview, setColorPreview] = useState<{
    target: "text" | "ink" | "paper" | "sleeve";
    color: string;
  } | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<LabelDesign | null>(
    null,
  );
  const hoverRequest = useRef(0);
  useEffect(() => {
    hoverRequest.current += 1;
    setHoverFamily(null);
    setHoverFontLoading(false);
    setColorPreview(null);
  }, [dialog, side, selected]);
  const [expandedFonts, setExpandedFonts] = useState<Set<string>>(
    () => new Set(),
  );
  const [seeAllStyles, setSeeAllStyles] = useState(true);
  const fontResults = useRef<HTMLDivElement>(null);
  const fontScrollPositions = useRef(new Map<string, number>());
  const fontViewLimits = useRef(new Map<string, number>());
  const previewFont = async (
    font: FontCatalogItem | null,
    variantId?: string,
  ) => {
    const request = ++hoverRequest.current;
    setHoverFamily(null);
    setHoverFontLoading(!!font);
    if (!font) return;
    try {
      const resolved = await resolveLabelFont(font, variantId);
      if (request === hoverRequest.current) {
        setHoverFamily(resolved.family);
        setHoverFontLoading(false);
      }
    } catch {
      if (request === hoverRequest.current) setHoverFontLoading(false);
      // Keep the committed font if the temporary preview cannot load.
    }
  };
  const [fonts, setFonts] = useState<FontCatalogItem[]>([]),
    [fontsLoading, setFontsLoading] = useState(true),
    [catalogError, setCatalogError] = useState(""),
    [catalogAttempt, setCatalogAttempt] = useState(0);
  const [scope, setScope] = useState<FontPickerScope>("all");
  const activeLayers = getSurfaceLayers(design, surface, side);
  const sleeveLayers = getSurfaceLayers(design, "sleeve", side);
  const fontContext =
    activeLayers.find((layer) => layer.id === selected)?.kind ?? "text";
  const categoryScopeKey = `${scope}:${fontContext}`;
  const [categoryByScope, setCategoryByScope] = useState<
    Record<string, string | null>
  >({});
  const selectedCategory = categoryByScope[categoryScopeKey] ?? null;
  const [query, setQuery] = useState(""),
    [fontLimit, setFontLimit] = useState(40);
  const openFontPicker = () => {
    const target = activeLayers.find((layer) => layer.id === selected);
    if (!target || target.kind === "image") return;
    setScope("all");
    setQuery("");
    setCategoryByScope((current) => ({
      ...current,
      [`all:${fontContext}`]: null,
    }));
    setDialog("fonts");
  };
  const deferredQuery = useDeferredValue(query);
  const fontScrollKey = JSON.stringify([
    categoryScopeKey,
    deferredQuery,
    selectedCategory,
  ]);
  useLayoutEffect(() => {
    if (dialog === "fonts" && fontResults.current) {
      const limit = fontViewLimits.current.get(fontScrollKey) ?? 40;
      if (fontLimit !== limit) {
        setFontLimit(limit);
        return;
      }
      fontResults.current.scrollTop =
        fontScrollPositions.current.get(fontScrollKey) ?? 0;
    }
  }, [dialog, fontScrollKey, fontLimit, fonts.length]);
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
    [fontErrors, setFontErrors] = useState<Record<string, string>>({});
  const [fontBusy, setFontBusy] = useState(false),
    [usedFontsBusy, setUsedFontsBusy] = useState(false),
    [exportBusy, setExportBusy] = useState(false),
    [notice, setNotice] = useState(
      initial.recovered ? RECOVERY_SUCCESS_NOTICE : "",
    ),
    [storageError, setStorageError] = useState("");
  const [lastSaved, setLastSaved] = useState<string | undefined>(() =>
      JSON.stringify(initial.design),
    ),
    [exportFormat, setExportFormat] = useState("svg"),
    [exportSides, setExportSides] = useState("current"),
    [includeBleed, setIncludeBleed] = useState(false),
    [includeSleeve, setIncludeSleeve] = useState(false),
    [textLength, setTextLength] = useState(0);
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const projectId =
      gallerySelection?.projectId ?? parameters.get("projectId");
    if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return;
    const user = accountUser;
    if (!user) return;
    let active = true;
    void (async () => {
      try {
        const project = await getGalleryProject(user.uid, projectId);
        if (!project) throw Error("This design is not in your gallery.");
        const requestedVersionId =
          gallerySelection?.versionId ?? parameters.get("versionId");
        const versionId = requestedVersionId ?? project.latestVersionId;
        const version = await getGalleryVersion(user.uid, projectId, versionId);
        if (!version) throw Error("This design version could not be found.");
        const loadedDesign = await loadGalleryDesign(version);
        if (!active) return;
        dispatch({ type: "replace", design: loadedDesign });
        setGalleryProjectId(projectId);
        setLastSaved(JSON.stringify(loadedDesign));
        setNotice(`Loaded version ${version.version} from My Gallery.`);
      } catch (cause) {
        if (active) {
          setNotice(
            cause instanceof Error
              ? cause.message
              : "This gallery design could not be loaded.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [accountUser, gallerySelection]);
  const imageInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null);
  const drag = useRef<{
    id: string;
    side: LabelSide;
    surface: LabelSurface;
    x: number;
    y: number;
    layer: LabelLayer;
    changed: boolean;
  }>();
  const sleeveLayerDrag = useRef<{
    pointerId: number;
    id: string;
    side: LabelSide;
    surface: LabelSurface;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const canvasPan = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const prefix = useId().replaceAll(":", "");
  const touchView = useRef({ zoom, viewOffset });
  touchView.current = { zoom, viewOffset };
  useEffect(() => {
    const canvas = artboardReference.current;
    if (!canvas) return;
    let gesture: { distance: number; zoom: number; x: number; y: number; offset: { x: number; y: number } } | null = null;
    let consuming = false;
    const measure = (touches: TouchList) => ({
      distance: Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY),
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      event.preventDefault();
      consuming = true;
      drag.current = undefined;
      sleeveLayerDrag.current = null;
      canvasPan.current = null;
      setDragging(false);
      setPanning(false);
      gesture = { ...measure(event.touches), zoom: touchView.current.zoom, offset: { ...touchView.current.viewOffset } };
    };
    const move = (event: TouchEvent) => {
      if (!gesture || event.touches.length !== 2) return;
      event.preventDefault();
      const next = measure(event.touches);
      const nextZoom = clamp(gesture.zoom * next.distance / Math.max(1, gesture.distance), 60, 1200);
      const ratio = nextZoom / gesture.zoom;
      const bounds = canvas.getBoundingClientRect();
      const originX = bounds.left + bounds.width / 2;
      const originY = bounds.top + bounds.height / 2;
      setZoom(Math.round(nextZoom));
      setViewOffset({
        x: next.x - originX - (gesture.x - originX - gesture.offset.x) * ratio,
        y: next.y - originY - (gesture.y - originY - gesture.offset.y) * ratio,
      });
    };
    const finish = (event: TouchEvent) => {
      if (event.touches.length < 2) gesture = null;
      if (!event.touches.length) consuming = false;
    };
    const blockDrag = (event: PointerEvent) => {
      if (consuming && event.pointerType === "touch") event.stopPropagation();
    };
    canvas.addEventListener("touchstart", start, { passive: false, capture: true });
    canvas.addEventListener("touchmove", move, { passive: false, capture: true });
    canvas.addEventListener("touchend", finish, true);
    canvas.addEventListener("touchcancel", finish, true);
    canvas.addEventListener("pointermove", blockDrag, true);
    return () => {
      canvas.removeEventListener("touchstart", start, true);
      canvas.removeEventListener("touchmove", move, true);
      canvas.removeEventListener("touchend", finish, true);
      canvas.removeEventListener("touchcancel", finish, true);
      canvas.removeEventListener("pointermove", blockDrag, true);
    };
  }, []);
  const layers = activeLayers,
    element =
      layers.find((l) => l.id === selected) ?? layers[0] ?? initialDesign.A[0],
    currentFont = fonts.find((f) => f.id === element.fontId);
  const defaultFontName =
    element.id === "title"
      ? "Berlin Type Bold"
      : "Alte DIN 1451 Mittelschrift geprägt";
  const hasSelection =
    selected !== null && layers.some((layer) => layer.id === selected);
  const selection = new Set(
    !hasSelection ? [] : selectedLayers.length ? selectedLayers : [element.id],
  );
  const selectedTextLayers = layers.filter(
    (layer) => selection.has(layer.id) && layer.kind !== "image",
  );
  const previewColor = (
    target: "text" | "ink" | "paper" | "sleeve",
    color: string | null,
  ) => setColorPreview(color ? { target, color } : null);
  const previewDesign = !colorPreview
    ? design
    : colorPreview.target === "paper"
      ? { ...design, paper: colorPreview.color }
      : colorPreview.target === "sleeve"
        ? { ...design, sleeveColor: colorPreview.color }
        : updateSurfaceLayers(design, surface, side, (layers) =>
            layers.map((layer) =>
              layer.kind !== "image" &&
              (colorPreview.target === "text" || selection.has(layer.id))
                ? { ...layer, color: colorPreview.color }
                : layer,
            ),
          );
  const applyTemplate = (next: LabelDesign) => {
    end();
    change(() => next);
    end();
    setGalleryProjectId(null);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("projectId");
    nextUrl.searchParams.delete("versionId");
    window.history.replaceState(null, "", nextUrl);
    setSelectedLayers([]);
    setSelected("title");
    setSide("A");
    setDialog(null);
    setPendingTemplate(null);
  };
  useEffect(() => {
    setSelectedLayers([]);
  }, [side]);
  useEffect(() => {
    if (selectedLayers.length && !selectedLayers.includes(element.id))
      setSelectedLayers([]);
  }, [element.id, selectedLayers]);
  useEffect(() => {
    if (!hasSelection) return;
    const list = layerList.current;
    const tile = Array.from(
      list?.querySelectorAll<HTMLElement>("[data-layer-tile]") ?? [],
    ).find((node) => node.dataset.layerTile === element.id);
    if (!list || !tile) return;
    const bounds = list.getBoundingClientRect(),
      item = tile.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
    else if (item.bottom > bounds.bottom)
      list.scrollTop += item.bottom - bounds.bottom;
  }, [element.id, side, surface, mobileTab, hasSelection]);
  const change = (
    update: (current: LabelDesign) => LabelDesign,
    group?: string,
  ) => dispatch({ type: "change", change: update, group });
  const patchLayer = (
    s: LabelSide,
    id: string,
    patch: Partial<LabelLayer>,
    group?: string,
    targetSurface: LabelSurface = surface,
  ) =>
    change(
      (current) =>
        updateSurfaceLayers(current, targetSurface, s, (layers) =>
          layers.map((layer) =>
            layer.id === id ? { ...layer, ...patch } : layer,
          ),
        ),
      group,
    );
  const beginLayerRename = (
    layer: LabelLayer,
    location: "tile" | "heading" = "tile",
  ) => {
    selectLayer(layer);
    setRenameDraft(layer.name);
    setRenamingLayerId(layer.id);
    setRenameLocation(location);
  };
  const finishLayerRename = (layer: LabelLayer) => {
    if (cancelRenameOnBlur.current) {
      cancelRenameOnBlur.current = false;
    } else {
      const name = renameDraft.trim();
      if (name && name !== layer.name) {
        patchLayer(side, layer.id, { name }, `name-${layer.id}`);
      }
      dispatch({ type: "end" });
    }
    setRenamingLayerId(null);
    setRenameLocation("tile");
  };
  const update = (patch: Partial<LabelLayer>, group?: string) =>
    patchLayer(side, element.id, patch, group);
  const end = () => dispatch({ type: "end" });
  useEffect(() => {
    let active = true;
    const pending = [
      ...design.A,
      ...design.B,
      ...design.sleeveA,
      ...design.sleeveB,
    ].filter(
      (layer) =>
        layer.kind === "image" &&
        imageRole(layer) === "barcode" &&
        layer.image &&
        !layer.imageBarSource,
    );
    if (!pending.length) return;
    void Promise.all(
      pending.map(async (layer) => {
        try {
          return {
            id: layer.id,
            image: layer.image,
            palette: await readBarcodeSourcePalette(layer.image!),
          };
        } catch (error) {
          console.warn(
            "[Configurator/barcode] Could not detect source palette",
            layer.id,
            error,
          );
          return undefined;
        }
      }),
    ).then((results) => {
      if (!active) return;
      const resolved = results.filter((result) => result !== undefined);
      if (!resolved.length) {
        setNotice(
          "No se pudieron detectar los colores originales del barcode.",
        );
        return;
      }
      dispatch({
        type: "normalize",
        change: (current) => {
          const migrate = (layer: LabelLayer) => {
            const result = resolved.find(
              (item) => item.id === layer.id && item.image === layer.image,
            );
            return result && !layer.imageBarSource
              ? {
                  ...layer,
                  imageRole: "barcode" as const,
                  imageBarSource: result.palette,
                  imageBarColor: layer.imageBarColor ?? "#000000",
                  imageBarBackground: layer.imageBarBackground ?? "#ffffff",
                  imageInverted: false,
                  imageFill: undefined,
                }
              : layer;
          };
          return {
            ...current,
            A: current.A.map(migrate),
            B: current.B.map(migrate),
            sleeveA: current.sleeveA.map(migrate),
            sleeveB: current.sleeveB.map(migrate),
          };
        },
      });
    });
    return () => {
      active = false;
    };
  }, [design.A, design.B, design.sleeveA, design.sleeveB]);
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
    const keys = new Set<string>();
    for (const layer of [
      ...design.A,
      ...design.B,
      ...design.sleeveA,
      ...design.sleeveB,
    ]) {
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
    design.sleeveA,
    design.sleeveB,
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
      targetSurface = surface,
      targetId = element.id;
    setFontBusy(true);
    try {
      const resolved = await resolveLabelFont(font, variantId);
      setFamilies((c) => ({
        ...c,
        [fontKey({ fontId: font.id, variantId: resolved.variant.id })]:
          resolved.family,
      }));
      patchLayer(
        targetSide,
        targetId,
        {
          fontId: font.id,
          variantId: resolved.variant.id,
        },
        undefined,
        targetSurface,
      );
      hoverRequest.current += 1;
      setHoverFamily(null);
      setHoverFontLoading(false);
      if (!isMobileFontPicker()) setDialog(null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "No se pudo cargar la fuente.",
      );
    } finally {
      setFontBusy(false);
    }
  };
  const selectLayer = (layer: LabelLayer) => {
    setSelectedLayers([layer.id]);
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
    if (kind === "circular") layer.name = "New text";
    change((current) =>
      updateSurfaceLayers(current, surface, side, (currentLayers) => [
        ...currentLayers,
        layer,
      ]),
    );
    selectLayer(layer);
  };
  const remove = () => {
    if (!hasSelection) return;
    const selectedForRemoval = layers.filter((layer) =>
      selection.has(layer.id),
    );
    if (selectedForRemoval.length)
      setDeleteTarget({
        side,
        surface,
        layers: selectedForRemoval,
      });
  };
  const insertAsset = (asset: InsertableAsset) => {
    if (layers.length >= 50) {
      setNotice("Máximo de 50 elementos por lado.");
      return;
    }
    const imageLayer = {
      ...makeLayer("image"),
      ...asset,
    };
    const layer = {
      ...imageLayer,
      ...initialImageLayerPosition(surface, imageLayer),
    };
    end();
    change((current) =>
      updateSurfaceLayers(current, surface, side, (currentLayers) => [
        ...currentLayers,
        layer,
      ]),
    );
    end();
    selectLayer(layer);
    setDialog(null);
  };
  const duplicateLayer = (layer: LabelLayer) => {
    if (layers.length >= 50) return;
    const copy = {
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} copy`,
      y: clamp(layer.y + 12, 0, 600),
    };
    change((current) => {
      const currentLayers = getSurfaceLayers(current, surface, side);
      const next = [...currentLayers];
      const index = next.findIndex((item) => item.id === layer.id);
      if (index < 0) return current;
      next.splice(index + 1, 0, copy);
      return updateSurfaceLayers(current, surface, side, () => next);
    });
    selectLayer(copy);
  };
  const deleteLayer = (id: string) => {
    const layer = layers.find((item) => item.id === id);
    if (!layer) return;
    setDeleteTarget({
      side,
      surface,
      layers: [layer],
    });
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    const ids = new Set(deleteTarget.layers.map((layer) => layer.id));
    const deletedSelection = selectedLayers.some((id) => ids.has(id));
    if (deletedSelection) {
      const remainingSelection = selectedLayers.filter((id) => !ids.has(id));
      const currentLayers = getSurfaceLayers(
        design,
        deleteTarget.surface,
        deleteTarget.side,
      );
      const firstRemovedIndex = currentLayers.findIndex((layer) =>
        ids.has(layer.id),
      );
      const nextLayer =
        currentLayers
          .slice(firstRemovedIndex + 1)
          .find((layer) => !ids.has(layer.id)) ??
        [...currentLayers.slice(0, firstRemovedIndex)]
          .reverse()
          .find((layer) => !ids.has(layer.id));
      const nextSelected = remainingSelection[0] ?? nextLayer?.id ?? null;
      setSelectedLayers(
        remainingSelection.length
          ? remainingSelection
          : nextSelected
            ? [nextSelected]
            : [],
      );
      setSelected(nextSelected);
    }
    end();
    change((current) =>
      removeLayers(current, deleteTarget.side, deleteTarget.surface, ids),
    );
    end();
    setDeleteTarget(null);
  };
  const moveLayer = (sourceId: string, targetId: string, before: boolean) =>
    change((current) => {
      const currentLayers = getSurfaceLayers(current, surface, side);
      const next = [...currentLayers];
      const sourceIndex = next.findIndex((layer) => layer.id === sourceId);
      if (sourceIndex < 0 || sourceId === targetId) return current;
      const [moved] = next.splice(sourceIndex, 1);
      const targetIndex = next.findIndex((layer) => layer.id === targetId);
      if (targetIndex < 0) return current;
      next.splice(targetIndex + (before ? 0 : 1), 0, moved);
      if (next.every((layer, index) => layer.id === currentLayers[index]?.id))
        return current;
      return updateSurfaceLayers(current, surface, side, () => next);
    }, "layer-reorder");
  const stopLayerAutoScroll = () => {
    if (layerAutoScrollTimer.current !== null) {
      window.clearInterval(layerAutoScrollTimer.current);
      layerAutoScrollTimer.current = null;
    }
    layerAutoScrollDirection.current = 0;
  };
  const updateLayerAutoScroll = (clientY: number) => {
    const list = layerList.current;
    if (!list || !draggedLayerId.current) {
      stopLayerAutoScroll();
      return;
    }
    const bounds = list.getBoundingClientRect();
    const edgeSize = Math.min(36, bounds.height / 4);
    const direction =
      clientY < bounds.top + edgeSize
        ? -1
        : clientY > bounds.bottom - edgeSize
          ? 1
          : 0;
    if (direction === layerAutoScrollDirection.current) return;
    stopLayerAutoScroll();
    if (!direction || list.scrollHeight <= list.clientHeight) return;
    layerAutoScrollDirection.current = direction;
    layerAutoScrollTimer.current = window.setInterval(() => {
      const currentList = layerList.current;
      if (!currentList || !draggedLayerId.current) {
        stopLayerAutoScroll();
        return;
      }
      const maximumScroll = currentList.scrollHeight - currentList.clientHeight;
      const nextScroll = Math.max(
        0,
        Math.min(
          maximumScroll,
          currentList.scrollTop + layerAutoScrollDirection.current * 8,
        ),
      );
      if (nextScroll === currentList.scrollTop) {
        stopLayerAutoScroll();
        return;
      }
      currentList.scrollTop = nextScroll;
    }, 60);
  };
  const finishLayerDrag = () => {
    stopLayerAutoScroll();
    if (draggedLayerId.current) end();
    draggedLayerId.current = null;
    setReorderingLayer(null);
    setDropIndicator(null);
  };
  const resizeLayerPanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const workspace = event.currentTarget.parentElement;
    if (!workspace) return;
    setLayerPanelWidth(
      clamp(event.clientX - workspace.getBoundingClientRect().left, 176, 360),
    );
  };
  const resizePropertiesPanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const workspace = event.currentTarget.parentElement;
    if (!workspace) return;
    setPropertiesPanelWidth(
      clamp(workspace.getBoundingClientRect().right - event.clientX, 260, 380),
    );
  };
  const saveToGallery = async (asNewProject = false) => {
    if (gallerySaving) return;
    setSaveMenuOpen(false);
    const user = accountUser;
    if (!user) {
      setNotice("Sign in to save designs to My Gallery.");
      return;
    }
    const saveStartedAt = performance.now();
    if (import.meta.env.DEV) {
      console.info("[StudioShelf/save] started", {
        asNewProject,
        hasProject: Boolean(galleryProjectId),
      });
    }
    setGallerySaving(true);
    setSaveMenuOpen(false);
    setNotice("Capturing Cookie and Cookie + Sleeve previews…");
    try {
      if (import.meta.env.DEV) console.info("[StudioShelf/save] capture-start");
      const [markupA, markupB] = await Promise.all([
        createLabelSvg(design, "A", fonts, false),
        createLabelSvg(design, "B", fonts, false),
      ]);
      const [sleeveArtworkA, sleeveArtworkB] = await Promise.all([
        createSleeveArtworkSvg(design, fonts, "A"),
        createSleeveArtworkSvg(design, fonts, "B"),
      ]);
      const [sleeveMarkupA, sleeveMarkupB] = await Promise.all([
        createSleeveLabelSvg(markupA, design, false, sleeveArtworkA),
        createSleeveLabelSvg(markupB, design, false, sleeveArtworkB),
      ]);
      const [captureA, captureB, captureSleeveA, captureSleeveB] =
        await Promise.all([
          captureLabelPreview(markupA),
          captureLabelPreview(markupB),
          captureLabelPreview(sleeveMarkupA),
          captureLabelPreview(sleeveMarkupB),
        ]);
      const [frontPreview, backPreview, frontSleevePreview, backSleevePreview] =
        await Promise.all([
          fetch(captureA).then((response) => response.blob()),
          fetch(captureB).then((response) => response.blob()),
          fetch(captureSleeveA).then((response) => response.blob()),
          fetch(captureSleeveB).then((response) => response.blob()),
        ]);
      if (import.meta.env.DEV) {
        console.info("[StudioShelf/save] captures-ready", {
          frontBytes: frontPreview.size,
          backBytes: backPreview.size,
          frontSleeveBytes: frontSleevePreview.size,
          backSleeveBytes: backSleevePreview.size,
        });
      }
      const saved = await saveGalleryVersion({
        uid: user.uid,
        design,
        frontPreview,
        backPreview,
        frontSleevePreview,
        backSleevePreview,
        projectId: galleryProjectId ?? undefined,
        asNewProject,
      });
      setGalleryProjectId(saved.project.id);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("projectId", saved.project.id);
      nextUrl.searchParams.set("versionId", saved.versionId);
      window.history.replaceState(null, "", nextUrl);
      setLastSaved(JSON.stringify(design));
      setNotice(
        `${asNewProject ? "New project" : "Saved to My Gallery"} · version ${saved.version}.`,
      );
      if (import.meta.env.DEV) {
        console.info("[StudioShelf/save] complete", {
          elapsedMs: Math.round(performance.now() - saveStartedAt),
          projectId: saved.project.id,
          version: saved.version,
        });
      }
    } catch (cause) {
      if (import.meta.env.DEV) {
        console.error("[StudioShelf/save] failed", {
          elapsedMs: Math.round(performance.now() - saveStartedAt),
          cause,
        });
      }
      setNotice(
        cause instanceof Error
          ? `Save failed: ${cause.message}`
          : "The design could not be saved to My Gallery.",
      );
    } finally {
      setGallerySaving(false);
    }
  };
  const saveLocally = () => {
    try {
      const serialized = JSON.stringify(design);
      localStorage.setItem(RECOVERY_KEY, serialized);
      setLastSaved(serialized);
      setNotice(
        "Saved on this device. Sign in to add this design to My Gallery.",
      );
      if (import.meta.env.DEV) {
        console.info("[StudioShelf/save] local-complete", {
          bytes: new Blob([serialized]).size,
        });
      }
    } catch {
      setNotice(
        "Could not save locally. Download the project JSON to keep a copy.",
      );
      if (import.meta.env.DEV) {
        console.error("[StudioShelf/save] local-failed", {
          recoveryKey: RECOVERY_KEY,
        });
      }
    }
  };
  const save = () => {
    if (accountUser) void saveToGallery();
    else saveLocally();
  };
  const load = () => onOpenGallery();
  const exportProject = () =>
    downloadDesignFile(
      new Blob([JSON.stringify(design, null, 2)], { type: "application/json" }),
      `${safeFilename(design.title)}.json`,
    );
  const downloadUsedFonts = async () => {
    if (usedFontsBusy) return;
    setUsedFontsBusy(true);
    try {
      const result = await createUsedFontDownload(design, fonts);
      downloadDesignFile(result.blob, result.fileName);
      setNotice(
        `Downloaded ${result.fontCount} font file${result.fontCount === 1 ? "" : "s"} used in this project.`,
      );
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? cause.message
          : "Could not download the fonts used in this project.",
      );
    } finally {
      setUsedFontsBusy(false);
    }
  };
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
  const importImage = async (
    file?: File,
    dropPosition?: { x: number; y: number },
  ) => {
    if (!file) return;
    if (layers.length >= 50) {
      setNotice("Máximo de 50 elementos por lado.");
      return;
    }
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    if (
      (!isSvg &&
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)) ||
      file.size > 5 * 1024 * 1024
    ) {
      setNotice("Usá SVG, PNG, JPEG o WebP de hasta 5 MB.");
      return;
    }
    const targetSide = side,
      targetSurface = surface;
    try {
      const source = isSvg
        ? new Blob([sanitizeSvgSource(await file.text())], {
            type: "image/svg+xml",
          })
        : file;
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(source);
      });
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
        image.src = data;
      });
      const imageLayer = {
        ...makeLayer("image"),
        name: file.name.slice(0, 80),
        image: data,
        imageRatio: clamp(image.naturalWidth / image.naturalHeight, 0.05, 20),
      };
      const layer = {
        ...imageLayer,
        ...(dropPosition ??
          initialImageLayerPosition(targetSurface, imageLayer)),
      };
      change((current) =>
        updateSurfaceLayers(
          current,
          targetSurface,
          targetSide,
          (currentLayers) => [...currentLayers, layer],
        ),
      );
      selectLayer(layer);
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
      surface,
      x: point.x,
      y: point.y,
      layer,
      changed: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
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
        start.surface,
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
        start.surface,
      );
  };
  const startSleeveLayerDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    layer: LabelLayer,
  ) => {
    if (event.button !== 0) return;
    selectLayer(layer);
    sleeveLayerDrag.current = {
      pointerId: event.pointerId,
      id: layer.id,
      side,
      surface,
      clientX: event.clientX,
      clientY: event.clientY,
      x: layer.x,
      y: layer.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const moveSleeveLayerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = sleeveLayerDrag.current;
    if (
      !start ||
      start.pointerId !== event.pointerId ||
      !event.currentTarget.hasPointerCapture(event.pointerId)
    )
      return;
    const canvas =
      event.currentTarget.closest<HTMLElement>(".dc-sleeve-canvas");
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    patchLayer(
      start.side,
      start.id,
      {
        x: clamp(
          Math.round(
            start.x + ((event.clientX - start.clientX) / bounds.width) * 600,
          ),
          0,
          600,
        ),
        y: clamp(
          Math.round(
            start.y + ((event.clientY - start.clientY) / bounds.height) * 600,
          ),
          0,
          600,
        ),
      },
      "sleeve-drag",
      start.surface,
    );
  };
  const endSleeveLayerDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    sleeveLayerDrag.current = null;
    end();
  };
  const endDrag = (e: ReactPointerEvent<SVGGElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = undefined;
    setDragging(false);
    end();
  };
  const startCanvasPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      e.button !== 0 ||
      (e.target instanceof Element && e.target.closest("[data-layer-id]"))
    )
      return;
    end();
    setSelected(null);
    setSelectedLayers([]);
    canvasPan.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      offsetX: viewOffset.x,
      offsetY: viewOffset.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanning(true);
    e.preventDefault();
  };
  const openSleevePreview = async () => {
    setSleevePreviewBusy(true);
    try {
      const [markupA, markupB, sleeveMarkupA, sleeveMarkupB] =
        await Promise.all([
          createLabelSvg(previewDesign, "A", fonts, false),
          createLabelSvg(previewDesign, "B", fonts, false),
          createSleeveArtworkSvg(previewDesign, fonts, "A"),
          createSleeveArtworkSvg(previewDesign, fonts, "B"),
        ]);
      const [captureA, captureB, sleeveCaptureA, sleeveCaptureB] =
        await Promise.all([
          captureLabelPreview(markupA),
          captureLabelPreview(markupB),
          captureLabelPreview(sleeveMarkupA),
          captureLabelPreview(sleeveMarkupB),
        ]);
      setSleevePreviewLabels({
        A: captureA,
        B: captureB,
        sleeveA: sleeveCaptureA,
        sleeveB: sleeveCaptureB,
      });
      setDialog("sleeve-preview");
    } catch (error) {
      console.error("[Sleeve3DPreview/capture] failed", error);
      setNotice(
        error instanceof Error
          ? error.message
          : "Could not capture the sleeve preview.",
      );
    } finally {
      setSleevePreviewBusy(false);
    }
  };
  const moveCanvasPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = canvasPan.current;
    if (
      !start ||
      start.pointerId !== e.pointerId ||
      !e.currentTarget.hasPointerCapture(e.pointerId)
    )
      return;
    setViewOffset({
      x: start.offsetX + e.clientX - start.clientX,
      y: start.offsetY + e.clientY - start.clientY,
    });
  };
  const endCanvasPan = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = canvasPan.current;
    if (!start || start.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    canvasPan.current = null;
    setPanning(false);
  };
  const doExport = async () => {
    if (exportBusy) return;
    const diagnostics = createExportDiagnostics({
      format: exportFormat,
      side,
      bothSides: exportSides === "both",
      includeBleed,
    });
    const printWindow =
      exportFormat === "pdf" ? window.open("", "_blank") : null;
    if (exportFormat === "pdf" && !printWindow) {
      diagnostics.fail(new Error("Print popup was blocked."));
      setNotice("Permití ventanas emergentes para imprimir/PDF.");
      return;
    }
    setExportBusy(true);
    try {
      const sides: LabelSide[] = exportSides === "both" ? ["A", "B"] : [side],
        labelMm = design.diameterMm + (includeBleed ? design.bleedMm * 2 : 0),
        outputMm = includeSleeve ? 315 : labelMm;
      for (const s of sides) {
        if (exportFormat === "psd") {
          diagnostics.stage("load-psd-module", { side: s });
          const psdModule = await import("./design-configurator-psd");
          const createPsd = includeSleeve
            ? psdModule.createSleeveLabelPsd
            : psdModule.createLabelPsd;
          const blob = await createPsd(design, s, fonts, {
            bleed: includeBleed,
            onProgress: diagnostics.stage,
          });
          diagnostics.stage("download", { side: s, bytes: blob.size });
          downloadDesignFile(
            blob,
            labelExportName(
              design,
              s,
              "psd",
              includeSleeve ? "with-sleeve" : undefined,
            ),
          );
          continue;
        }
        diagnostics.stage("create-svg", { side: s });
        const labelSvg = await createLabelSvg(design, s, fonts, includeBleed);
        const sleeveArtwork = includeSleeve
          ? await createSleeveArtworkSvg(design, fonts, s)
          : undefined;
        const svg = includeSleeve
          ? await createSleeveLabelSvg(
              labelSvg,
              design,
              includeBleed,
              sleeveArtwork,
            )
          : labelSvg;
        if (exportFormat === "pdf" && printWindow) {
          printLabel(printWindow, svg, outputMm);
          break;
        }
        diagnostics.stage("encode-file", { side: s });
        const blob =
          exportFormat === "png"
            ? await exportLabelPng(
                svg,
                outputMm,
                includeSleeve ? 300 : undefined,
              )
            : new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        diagnostics.stage("download", { side: s, bytes: blob.size });
        downloadDesignFile(
          blob,
          labelExportName(
            design,
            s,
            exportFormat,
            includeSleeve ? "with-sleeve" : undefined,
          ),
        );
      }
      diagnostics.complete();
      setNotice(
        exportFormat === "pdf"
          ? "Elegí Guardar como PDF: escala 100%, sin encabezados ni márgenes."
          : "Exportación completada con fuentes incluidas, sin guías del editor.",
      );
    } catch (e) {
      diagnostics.fail(e);
      printWindow?.close();
      setNotice(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setExportBusy(false);
    }
  };
  const visibleFonts = useMemo(
    () =>
      pickerCatalog(fonts, scope, favoriteFonts, deferredQuery, fontContext),
    [fonts, scope, favoriteFonts, deferredQuery, fontContext],
  );
  const collectionCounts = useMemo(
    () => ({
      standard: pickerCatalog(
        fonts,
        "standard",
        favoriteFonts,
        deferredQuery,
        fontContext,
      ).length,
      all: pickerCatalog(
        fonts,
        "all",
        favoriteFonts,
        deferredQuery,
        fontContext,
      ).length,
      favorites: pickerCatalog(
        fonts,
        "favorites",
        favoriteFonts,
        deferredQuery,
        fontContext,
      ).length,
    }),
    [fonts, favoriteFonts, deferredQuery, fontContext],
  );
  const categories = useMemo(
    () =>
      pickerCategories(
        visibleFonts,
        selectedCategory,
        scope === "standard" && !deferredQuery.trim()
          ? standardCategoriesFor(fontContext)
          : undefined,
      ),
    [visibleFonts, selectedCategory, scope, deferredQuery, fontContext],
  );
  const sortedFonts = useMemo(
    () =>
      selectedCategory
        ? visibleFonts.filter(
            (font) => pickerCategory(font) === selectedCategory,
          )
        : visibleFonts,
    [visibleFonts, selectedCategory],
  );
  const index = layers.findIndex((l) => l.id === element.id),
    overflow =
      element.kind === "circular" && textLength > 2 * Math.PI * element.radius;
  const changeCanvasSide = (nextSide: typeof side) => {
    if (nextSide === side) return;
    end();
    setSide(nextSide);
    setSelected(getSurfaceLayers(design, surface, nextSide)[0]?.id ?? null);
    setSelectedLayers([]);
  };
  const changeCanvasSurface = (nextSurface: typeof surface) => {
    if (nextSurface === surface) return;
    end();
    setSurface(nextSurface);
    setSelected(getSurfaceLayers(design, nextSurface, side)[0]?.id ?? null);
    setSelectedLayers([]);
  };
  const canvasContextControls = () => (
    <div className="dc-canvas-context-controls dc-canvas-context-controls-layers">
      <div className="dc-side-switch" role="group" aria-label="Record side">
        {(["A", "B"] as const).map((nextSide) => (
          <button
            key={nextSide}
            type="button"
            aria-pressed={side === nextSide}
            onClick={() => changeCanvasSide(nextSide)}
          >
            Side {nextSide}
          </button>
        ))}
      </div>
      <div
        className="dc-surface-switch"
        role="tablist"
        aria-label="Design surface"
      >
        <button
          type="button"
          role="tab"
          aria-selected={surface === "cookie"}
          onClick={() => changeCanvasSurface("cookie")}
        >
          <Disc3 size={15} aria-hidden="true" />
          Cookie
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={surface === "sleeve"}
          onClick={() => changeCanvasSurface("sleeve")}
        >
          <SleeveSurfaceIcon size={15} />
          Sleeve
        </button>
      </div>
    </div>
  );
  const panelTitle = (title: string) => (
    <div className="dc-panel-title">
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
    key: "radius" | "angle" | "width",
    min: number,
    max: number,
    unit: string,
  ) => {
    const value = element[key] ?? 180;
    const step = key === "angle" ? 15 : 1;
    const changeAngle = (amount: number) => {
      update(
        { angle: clamp(value + amount, min, max) },
        `range-${element.id}-angle`,
      );
      end();
    };
    return (
      <label className="dc-field dc-slider-field">
        <span>
          {label}
          {key === "angle" ? (
            <div className="dc-rotation-value">
              <div
                className="dc-rotation-nudges"
                role="group"
                aria-label="Adjust rotation"
              >
                <button
                  className="dc-capitalize"
                  type="button"
                  aria-label="Rotate 15 degrees counterclockwise"
                  title="Rotate 15 degrees counterclockwise"
                  disabled={value <= min}
                  onClick={() => changeAngle(-15)}
                >
                  <RotateCcw size={12} aria-hidden="true" />
                </button>
                <button
                  className="dc-capitalize"
                  type="button"
                  aria-label="Rotate 15 degrees clockwise"
                  title="Rotate 15 degrees clockwise"
                  disabled={value >= max}
                  onClick={() => changeAngle(15)}
                >
                  <RotateCw size={12} aria-hidden="true" />
                </button>
              </div>
              <output>
                {value} <small>{unit}</small>
              </output>
            </div>
          ) : (
            <output>
              {value} <small>{unit}</small>
            </output>
          )}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
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
  };
  return (
    <main
      ref={editorRoot}
      data-theme={theme}
      className={`design-configurator${dragging ? " dc-is-dragging" : ""}${panning ? " dc-is-panning" : ""}${fullscreenFallback ? " dc-fullscreen-fallback" : ""}`}
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
        if (!hasSelection) return;
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
          <strong>Vinyl Designer Wizard Pro</strong>
          <span className="dc-version">ver {packageManifest.version}</span>
        </div>
        <div className="dc-header-actions">
          <ConfiguratorThemeToggle theme={theme} onToggle={() => setTheme(current => current === "dark" ? "light" : "dark")} />
          <AccountControl />
          <a
            className="dc-back"
            href="/identity/typography/typefaces"
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowUpRight size={15} />
            Typefaces collection
          </a>
        </div>
      </header>
      <div className="dc-project-bar" ref={projectBarRef}>
        <div>
          <label className="dc-project-name">
            <span className="dc-project-title-label">Project title</span>
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
              type="button"
              aria-label="Undo"
              title="Undo (⌘/Ctrl Z)"
              disabled={!history.past.length}
              onClick={() => dispatch({ type: "undo" })}
            >
              <Undo2 size={17} />
            </button>
            <button
              type="button"
              aria-label="Redo"
              title="Redo (⌘/Ctrl Shift Z)"
              disabled={!history.future.length}
              onClick={() => dispatch({ type: "redo" })}
            >
              <Redo2 size={17} />
            </button>
          </div>
          <button className="dc-save" onClick={() => setDialog("file")}>
            <FileText size={15} />
            <span>File</span>
          </button>
          {accountUser && (
            <div className="dc-save-menu-container" ref={saveMenuReference}>
              <button
                className="dc-save dc-save-menu-trigger"
                type="button"
                aria-haspopup="menu"
                aria-expanded={saveMenuOpen}
                aria-label="Save options"
                title="Save options"
                disabled={gallerySaving}
                onClick={() => setSaveMenuOpen((open) => !open)}
              >
                <Save size={15} />
                {gallerySaving ? "Saving…" : "Save..."}
              </button>
              {saveMenuOpen && (
                <div
                  className="dc-save-menu"
                  role="menu"
                  aria-label="Save options"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSaveMenuOpen(false);
                      save();
                    }}
                  >
                    <Save size={15} /> Save
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void saveToGallery(false)}
                  >
                    <History size={15} /> Save as new version
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void saveToGallery(true)}
                  >
                    <FolderPlus size={15} /> Save as new project
                  </button>
                </div>
              )}
            </div>
          )}
          {accountUser && (
            <button
              className="dc-save dc-gallery-link"
              type="button"
              onClick={onOpenGallery}
            >
              <Folder size={15} />
              <span>My Gallery</span>
            </button>
          )}
          <button
            className="dc-save dc-project-settings"
            aria-label="Project settings"
            title="Project settings"
            onClick={() => setDialog("settings")}
          >
            <Settings size={15} />
            <span className="dc-settings-desktop-label">Project settings</span>
            <span className="dc-settings-mobile-label">Settings</span>
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
      <div
        className="dc-workspace"
        style={
          {
            "--dc-layer-panel-width": `${layerPanelWidth}px`,
            "--dc-properties-panel-width": `${propertiesPanelWidth}px`,
          } as CSSProperties
        }
      >
        <section
          className="dc-global-settings"
          data-mobile-collapsed={!mobileGlobalSettingsOpen}
          ref={globalSettingsRef}
          aria-labelledby="dc-global-settings-title"
        >
          <h2
            className="dc-global-settings-title"
            id="dc-global-settings-title"
          >
            Global settings
          </h2>
          <button
            className="dc-mobile-global-toggle"
            type="button"
            aria-expanded={mobileGlobalSettingsOpen}
            onClick={() => setMobileGlobalSettingsOpen((isOpen) => !isOpen)}
          >
            <span>Global settings</span>
            <span>3 color groups</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          <div className="dc-global-settings-controls">
            <GlobalInkControl
              onPreview={(color) => previewColor("text", color)}
              key={`${surface}-${side}`}
              side={side}
              hasCustomColors={hasCustomTextColors(design, side, surface)}
              colors={getSurfaceLayers(design, surface, side)
                .filter((layer) => layer.kind !== "image")
                .map((layer) => layer.color)}
              visibleCount={4}
              onApply={(color) => {
                end();
                change((current) =>
                  changeGlobalTextColor(current, color, side, surface),
                );
              }}
            />
            <div className="dc-preview-stock">
              <span>Label</span>
              <label className="dc-custom-paper">
                <span className="sr-only">Custom label color</span>
                <input
                  type="color"
                  value={design.paper}
                  onChange={(event) =>
                    change(
                      (current) => ({ ...current, paper: event.target.value }),
                      "paper",
                    )
                  }
                  onBlur={end}
                />
              </label>
              <ColorSwatches
                colors={GLOBAL_COLOR_PRESETS}
                onPreview={(color) => previewColor("paper", color)}
                value={design.paper}
                label="Label"
                visibleCount={4}
                onChoose={(color) =>
                  change((current) => ({ ...current, paper: color }))
                }
              />
            </div>
            <div className="dc-preview-stock">
              <span>Sleeve</span>
              <label className="dc-custom-paper">
                <span className="sr-only">Custom sleeve color</span>
                <input
                  type="color"
                  value={design.sleeveColor}
                  onChange={(event) =>
                    change(
                      (current) => ({
                        ...current,
                        sleeveColor: event.target.value,
                      }),
                      "sleeve-color",
                    )
                  }
                  onBlur={end}
                />
              </label>
              <ColorSwatches
                colors={GLOBAL_COLOR_PRESETS}
                onPreview={(color) => previewColor("sleeve", color)}
                value={design.sleeveColor}
                label="Sleeve color"
                visibleCount={4}
                onChoose={(color) =>
                  change((current) => ({ ...current, sleeveColor: color }))
                }
              />
            </div>
          </div>
        </section>
        <aside
          className={`dc-layers ${mobileTab === "layers" ? "dc-mobile-visible" : ""}`}
          onDragOver={(event) => {
            if (!draggedLayerId.current) return;
            event.preventDefault();
            updateLayerAutoScroll(event.clientY);
          }}
          onDragLeave={(event) => {
            const nextTarget = event.relatedTarget;
            if (
              nextTarget instanceof Node &&
              event.currentTarget.contains(nextTarget)
            )
              return;
            stopLayerAutoScroll();
          }}
        >
          {panelTitle(`Side ${side} elements`)}
          {canvasContextControls()}
          <div className="dc-add-controls">
            <button onClick={() => add("text")}>
              <Type size={14} />
              Text
            </button>
            <button onClick={() => add("image")}>
              <ImagePlus size={14} />
              Image
            </button>
            <button onClick={() => add("circular")}>
              <Spline size={14} />
              Arc text
            </button>
            <button onClick={() => setDialog("assets")}>
              <Layers size={14} />
              Assets
            </button>
          </div>
          {deleteTarget && (
            <ConfirmationDialog
              title={
                deleteTarget.layers.length === 1
                  ? "Delete this layer?"
                  : `Delete ${deleteTarget.layers.length} layers?`
              }
              description={
                deleteTarget.layers.length === 1
                  ? `Are you sure you want to delete “${deleteTarget.layers[0].name}”? You can undo this change.`
                  : `Are you sure you want to delete ${deleteTarget.layers.length} selected layers? You can undo this change.`
              }
              confirmLabel="Delete"
              onCancel={() => setDeleteTarget(null)}
              onConfirm={confirmDelete}
            />
          )}
          <div
            className="dc-layer-list"
            ref={layerList}
            onDrop={(event) => {
              event.preventDefault();
              finishLayerDrag();
            }}
          >
            {layers.map((layer, i) => (
              <motion.div
                key={layer.id}
                data-layer-tile={layer.id}
                layout="position"
                transition={
                  prefersReducedMotion
                    ? { layout: { duration: 0 } }
                    : {
                        layout: {
                          type: "spring",
                          stiffness: 520,
                          damping: 38,
                        },
                      }
                }
                draggable
                aria-grabbed={reorderingLayer === layer.id}
                className={`dc-layer ${selection.has(layer.id) ? "is-selected" : ""} ${reorderingLayer === layer.id ? "is-dragging" : ""} ${dropIndicator?.id === layer.id ? (dropIndicator.before ? "drop-before" : "drop-after") : ""}`}
                onDragStart={(event) => {
                  const target = event.target as Element;
                  if (
                    target.closest(
                      ".dc-layer-inline-actions, .dc-visibility, .dc-layer-rename-input",
                    )
                  ) {
                    event.preventDefault();
                    return;
                  }
                  draggedLayerId.current = layer.id;
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", layer.id);
                  const dragImage = document.createElement("canvas");
                  dragImage.width = 1;
                  dragImage.height = 1;
                  dragImage.style.position = "fixed";
                  dragImage.style.left = "-1px";
                  dragImage.style.top = "-1px";
                  document.body.append(dragImage);
                  event.dataTransfer.setDragImage(dragImage, 0, 0);
                  requestAnimationFrame(() => dragImage.remove());
                  setReorderingLayer(layer.id);
                }}
                onDragOver={(event) => {
                  const sourceId = draggedLayerId.current;
                  if (!sourceId || sourceId === layer.id) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  const bounds = event.currentTarget.getBoundingClientRect();
                  const before = event.clientY < bounds.top + bounds.height / 2;
                  setDropIndicator((current) =>
                    current?.id === layer.id && current.before === before
                      ? current
                      : { id: layer.id, before },
                  );
                  moveLayer(sourceId, layer.id, before);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  finishLayerDrag();
                }}
                onDragEnd={finishLayerDrag}
              >
                {renamingLayerId === layer.id && renameLocation === "tile" ? (
                  <div className="dc-layer-select dc-layer-rename">
                    <span className="dc-layer-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {layer.kind === "circular" ? (
                      <Spline size={15} />
                    ) : layer.kind === "image" ? (
                      <ImagePlus size={15} />
                    ) : (
                      <Type size={15} />
                    )}
                    <input
                      className="dc-layer-rename-input"
                      autoFocus
                      maxLength={80}
                      aria-label={`Element name for ${layer.name}`}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={() => finishLayerRename(layer)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          cancelRenameOnBlur.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  </div>
                ) : (
                  <button
                    className="dc-layer-select"
                    aria-pressed={selection.has(layer.id)}
                    onClick={(event) => {
                      if (event.shiftKey) {
                        const anchor = layers.findIndex(
                          (item) => item.id === element.id,
                        );
                        const range = layers
                          .slice(Math.min(anchor, i), Math.max(anchor, i) + 1)
                          .map((item) => item.id);
                        setSelectedLayers(
                          event.metaKey || event.ctrlKey
                            ? [...new Set([...selection, ...range])]
                            : range,
                        );
                        setSelected(layer.id);
                      } else if (event.metaKey || event.ctrlKey) {
                        const next = new Set(selection);
                        if (next.has(layer.id)) next.delete(layer.id);
                        else next.add(layer.id);
                        if (!next.size) return;
                        setSelectedLayers([...next]);
                        setSelected(
                          next.has(layer.id) ? layer.id : [...next][0],
                        );
                      } else selectLayer(layer);
                    }}
                    onDoubleClick={(event) => {
                      event.preventDefault();
                      beginLayerRename(layer);
                    }}
                  >
                    <span className="dc-layer-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {layer.kind === "circular" ? (
                      <Spline size={15} />
                    ) : layer.kind === "image" ? (
                      <ImagePlus size={15} />
                    ) : (
                      <Type size={15} />
                    )}
                    <span className="dc-layer-copy">
                      <span className="dc-layer-name">{layer.name}</span>
                      <small>
                        {layer.kind === "circular"
                          ? "Text arc"
                          : layer.kind === "image"
                            ? "Image / logo"
                            : "Text layer"}
                      </small>
                    </span>
                  </button>
                )}
                <div className="dc-layer-inline-actions">
                  <button
                    aria-label={`Duplicate ${layer.name}`}
                    title={`Duplicate ${layer.name}`}
                    disabled={layers.length >= 50}
                    onClick={() => duplicateLayer(layer)}
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    aria-label={`Delete ${layer.name}`}
                    title={`Delete ${layer.name}`}
                    onClick={() => deleteLayer(layer.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <button
                  className="dc-visibility"
                  aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                  onClick={() =>
                    patchLayer(side, layer.id, { visible: !layer.visible })
                  }
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>
              </motion.div>
            ))}
          </div>
        </aside>
        <div
          className="dc-layer-resize"
          role="separator"
          aria-label="Resize layers panel"
          aria-orientation="vertical"
          aria-valuemin={176}
          aria-valuemax={360}
          aria-valuenow={layerPanelWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault();
            layerResizePointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (layerResizePointer.current === event.pointerId)
              resizeLayerPanel(event);
          }}
          onPointerUp={(event) => {
            if (layerResizePointer.current !== event.pointerId) return;
            layerResizePointer.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            layerResizePointer.current = null;
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 20 : 8;
            const nextWidth =
              event.key === "ArrowLeft"
                ? layerPanelWidth - step
                : event.key === "ArrowRight"
                  ? layerPanelWidth + step
                  : event.key === "Home"
                    ? 176
                    : event.key === "End"
                      ? 360
                      : null;
            if (nextWidth === null) return;
            event.preventDefault();
            setLayerPanelWidth(clamp(nextWidth, 176, 360));
          }}
        />
        <section className="dc-stage" aria-label="Vinyl label preview">
          <div className="dc-stage-top">
            <MobileCanvasToolbar
              surface={surface}
              side={side}
              guides={guides}
              previewBusy={sleevePreviewBusy}
              onSurfaceChange={changeCanvasSurface}
              onSideChange={changeCanvasSide}
              onToggleGuides={() => setGuides((current) => !current)}
              onOpenPreview={() => void openSleevePreview()}
            />
            <span>
              <span className="dc-live-dot" />
              {surface === "cookie"
                ? `COOKIE · SIDE ${side}`
                : "SLEEVE · FRONT / BACK"}{" "}
              / PREVIEW
            </span>
            <button
              className="dc-preview-3d-button"
              aria-label="Open 3D sleeve preview"
              data-tooltip="3D sleeve preview"
              disabled={sleevePreviewBusy}
              onClick={() => void openSleevePreview()}
            >
              <span className="dc-preview-3d-icon" aria-hidden="true">
                <Box size={17} />
                <span>3D</span>
              </span>
            </button>
            <div className="dc-preview-controls">
              <div className="dc-guides-control">
                <Grid2X2 size={14} aria-hidden="true" />
                <span id={`${prefix}-guides-label`}>Guides</span>
                <button
                  className="dc-guides-switch"
                  role="switch"
                  aria-checked={guides}
                  aria-labelledby={`${prefix}-guides-label`}
                  onClick={() => setGuides(!guides)}
                >
                  <span
                    className={!guides ? "is-active" : ""}
                    aria-hidden="true"
                  >
                    OFF
                  </span>
                  <span
                    className={guides ? "is-active" : ""}
                    aria-hidden="true"
                  >
                    ON
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div
            className="dc-artboard"
            ref={artboardReference}
            onDragOver={(event) => {
              if (draggedLayerId.current) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                return;
              }
              if (Array.from(event.dataTransfer.types).includes("Files")) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(event) => {
              if (draggedLayerId.current) {
                event.preventDefault();
                finishLayerDrag();
                return;
              }
              if (!Array.from(event.dataTransfer.types).includes("Files"))
                return;
              event.preventDefault();
              const file = event.dataTransfer.files[0];
              if (!file) return;
              const canvas = event.currentTarget.querySelector<HTMLElement>(
                ".dc-sleeve-design-canvas",
              );
              const bounds = canvas?.getBoundingClientRect();
              const dropPosition =
                bounds?.width && bounds.height
                  ? {
                      x: clamp(
                        ((event.clientX - bounds.left) / bounds.width) * 600,
                        0,
                        600,
                      ),
                      y: clamp(
                        ((event.clientY - bounds.top) / bounds.height) * 600,
                        0,
                        600,
                      ),
                    }
                  : undefined;
              void importImage(file, dropPosition);
            }}
            onPointerDown={startCanvasPan}
            onPointerMove={moveCanvasPan}
            onPointerUp={endCanvasPan}
            onPointerCancel={endCanvasPan}
            onLostPointerCapture={endCanvasPan}
            style={{
              color:
                parseInt(design.sleeveColor.slice(1, 3), 16) * 0.299 +
                  parseInt(design.sleeveColor.slice(3, 5), 16) * 0.587 +
                  parseInt(design.sleeveColor.slice(5, 7), 16) * 0.114 <
                140
                  ? "#d9ddcd"
                  : "#4c5740",
            }}
          >
            <div
              className="dc-artboard-content"
              style={{
                transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${zoom / 100})`,
              }}
            >
              <div
                className="dc-sleeve-canvas dc-sleeve-design-canvas"
                data-editing-surface={surface}
                style={
                  {
                    backgroundColor: previewDesign.sleeveColor,
                    "--dc-label-scale": sleeveCanvasSizeMm / design.diameterMm,
                    maskImage: surface === "cookie" ? canvasHoleMask(design.holeMm, sleeveCanvasSizeMm) : undefined,
                    WebkitMaskImage: surface === "cookie" ? canvasHoleMask(design.holeMm, sleeveCanvasSizeMm) : undefined,
                    maskSize: "100% 100%",
                    WebkitMaskSize: "100% 100%",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    "--dc-label-diameter": `${(design.diameterMm / sleeveCanvasSizeMm) * 100}%`,
                  } as CSSProperties
                }
              >
                {design.sleeveImage && (
                  <div aria-hidden="true" className="dc-sleeve-image-frame">
                    <div
                      className="dc-sleeve-background"
                      style={{
                        backgroundImage: `url("${design.sleeveImage}")`,
                        transform: `translate(${design.sleeveImageOffsetX / 6}%, ${design.sleeveImageOffsetY / 6}%) scale(${design.sleeveZoom})`,
                      }}
                    />
                  </div>
                )}
                <div
                  className={`dc-sleeve-elements${surface === "sleeve" ? " is-editing" : ""}`}
                  aria-label="Sleeve artwork layers"
                >
                  {sleeveLayers
                    .filter((layer) => layer.visible)
                    .map((layer) => (
                      <div
                        key={layer.id}
                        data-layer-id={layer.id}
                        className={`dc-sleeve-element${surface === "sleeve" && selected === layer.id ? " is-selected" : ""}`}
                        style={{
                          left: `${layer.x / 6}%`,
                          top: `${layer.y / 6}%`,
                          width: `${layer.width / 6}%`,
                          color: layer.color,
                          fontFamily: familyFor(layer),
                          fontSize: `${layer.size}px`,
                          fontWeight: layer.size > 40 ? 700 : 400,
                          opacity: layer.opacity ?? 1,
                          textAlign:
                            layer.align === "middle" ? "center" : layer.align,
                          transform: `translate(-50%, -50%) rotate(${layer.angle}deg)`,
                        }}
                        onPointerDown={
                          surface === "sleeve"
                            ? (event) => startSleeveLayerDrag(event, layer)
                            : undefined
                        }
                        onPointerMove={
                          surface === "sleeve" ? moveSleeveLayerDrag : undefined
                        }
                        onPointerUp={
                          surface === "sleeve" ? endSleeveLayerDrag : undefined
                        }
                        onPointerCancel={
                          surface === "sleeve" ? endSleeveLayerDrag : undefined
                        }
                        onClick={
                          surface === "sleeve"
                            ? () => selectLayer(layer)
                            : undefined
                        }
                      >
                        {layer.kind === "image" && layer.image ? (
                          <img
                            src={layer.image}
                            alt={layer.name}
                            draggable={false}
                            style={
                              layer.imageFill ||
                              (imageRole(layer) === "brand-logo" &&
                                layer.imageInverted) ||
                              imageRole(layer) === "barcode"
                                ? {
                                    filter: `url(#${prefix}-sleeve-image-color-${layer.id})`,
                                  }
                                : undefined
                            }
                          />
                        ) : (
                          layer.text
                        )}
                      </div>
                    ))}
                </div>
                <LabelArtwork
                  design={previewDesign}
                  hiddenTextId={
                    surface === "cookie" &&
                    dialog === "fonts" &&
                    hoverFontLoading
                      ? element.id
                      : undefined
                  }
                  side={side}
                  prefix={prefix}
                  fontFamily={(layer) =>
                    surface === "cookie" &&
                    dialog === "fonts" &&
                    layer.id === element.id &&
                    hoverFamily
                      ? hoverFamily
                      : familyFor(layer)
                  }
                  selected={
                    surface === "cookie" && hasSelection
                      ? element.id
                      : undefined
                  }
                  selectedIds={surface === "cookie" ? selection : undefined}
                  guides={guides}
                  cutCenter={surface !== "cookie"}
                  innerShadow
                  onSelect={surface === "cookie" ? selectLayer : undefined}
                  onPointerDown={surface === "cookie" ? startDrag : undefined}
                  onPointerMove={surface === "cookie" ? moveDrag : undefined}
                  onPointerUp={surface === "cookie" ? endDrag : undefined}
                />
              </div>
            </div>
          </div>
          <div className="dc-canvas-footer">
            <span className="dc-measure dc-measure-bottom">
              {surface === "cookie" ? (
                <>
                  <span>SIDE {side}</span>Ø {design.holeMm} mm center hole
                </>
              ) : (
                <>
                  <span>SLEEVE</span>Artwork surface
                </>
              )}
            </span>
            <div className="dc-zoom">
              <button
                aria-label="Zoom out"
                disabled={zoom <= 60}
                onClick={() => setZoom(Math.max(60, zoom - 30))}
              >
                <Minus size={14} />
              </button>
              <output>{zoom}%</output>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 1200}
                onClick={() => setZoom(Math.min(1200, zoom + 30))}
              >
                <Plus size={14} />
              </button>
              <button
                aria-label="Fit to canvas"
                onClick={() => {
                  setZoom(100);
                  setViewOffset({ x: 0, y: 0 });
                }}
              >
                <Focus size={16} />
              </button>
              <button
                aria-label={
                  fullscreen || fullscreenFallback
                    ? "Exit fullscreen"
                    : "Enter fullscreen"
                }
                aria-pressed={fullscreen || fullscreenFallback}
                onClick={() => void toggleFullscreen()}
              >
                {fullscreen || fullscreenFallback ? (
                  <Minimize size={16} />
                ) : (
                  <Maximize size={16} />
                )}
              </button>
            </div>
          </div>
        </section>
        <div
          className="dc-properties-resize"
          role="separator"
          aria-label="Resize properties panel"
          aria-orientation="vertical"
          aria-valuemin={260}
          aria-valuemax={380}
          aria-valuenow={propertiesPanelWidth}
          tabIndex={0}
          onPointerDown={(event) => {
            event.preventDefault();
            propertiesResizePointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (propertiesResizePointer.current === event.pointerId)
              resizePropertiesPanel(event);
          }}
          onPointerUp={(event) => {
            if (propertiesResizePointer.current !== event.pointerId) return;
            propertiesResizePointer.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            propertiesResizePointer.current = null;
          }}
          onKeyDown={(event) => {
            const step = event.shiftKey ? 20 : 8;
            const nextWidth =
              event.key === "ArrowRight"
                ? propertiesPanelWidth + step
                : event.key === "ArrowLeft"
                  ? propertiesPanelWidth - step
                  : event.key === "Home"
                    ? 260
                    : event.key === "End"
                      ? 380
                      : null;
            if (nextWidth === null) return;
            event.preventDefault();
            event.stopPropagation();
            setPropertiesPanelWidth(clamp(nextWidth, 260, 380));
          }}
        />
        <aside
          className={`dc-properties ${mobileTab === "properties" ? "dc-mobile-visible" : ""}`}
        >
          <div className="dc-panel-title dc-properties-heading">
            <h2>Properties</h2>
            {hasSelection && (
              <button
                className="dc-reset"
                onClick={() =>
                  setResetTarget({
                    side,
                    surface,
                    layer: element,
                  })
                }
              >
                <RotateCcw size={13} />
                Reset this element
              </button>
            )}
          </div>
          {resetTarget && (
            <ConfirmationDialog
              title="Reset this element?"
              description={`Are you sure you want to reset “${resetTarget.layer.name}”? You can undo this change.`}
              onCancel={() => setResetTarget(null)}
              onConfirm={() => {
                const {
                  side: targetSide,
                  surface: targetSurface,
                  layer,
                } = resetTarget;
                const defaults =
                  getSurfaceLayers(
                    initialDesign,
                    targetSurface,
                    targetSide,
                  ).find((item) => item.id === layer.id) ??
                  makeLayer(layer.kind, layer.id);
                end();
                patchLayer(
                  targetSide,
                  layer.id,
                  {
                    ...defaults,
                    fontId: defaults.fontId,
                    variantId: defaults.variantId,
                    inkBleed: defaults.inkBleed ?? 0,
                    textEffect: defaults.textEffect,
                    textEffectSettings: defaults.textEffectSettings,
                    image: layer.kind === "image" ? layer.image : undefined,
                    imageRatio:
                      layer.kind === "image" ? layer.imageRatio : undefined,
                  },
                  undefined,
                  targetSurface,
                );
                end();
                setResetTarget(null);
              }}
            />
          )}
          {!hasSelection ? (
            <p className="dc-font-explanation">
              Select a layer to edit its properties.
            </p>
          ) : (
            <>
              <div className="dc-selected-heading">
                <div>
                  {element.kind === "circular" ? (
                    <Spline size={17} />
                  ) : element.kind === "image" ? (
                    <ImagePlus size={17} />
                  ) : (
                    <Type size={17} />
                  )}
                  {renamingLayerId === element.id &&
                  renameLocation === "heading" ? (
                    <input
                      className="dc-selected-name-input"
                      autoFocus
                      maxLength={80}
                      aria-label={`Element name for ${element.name}`}
                      value={renameDraft}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onBlur={() => finishLayerRename(element)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.blur();
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          cancelRenameOnBlur.current = true;
                          event.currentTarget.blur();
                        }
                      }}
                      onFocus={(event) => event.currentTarget.select()}
                    />
                  ) : (
                    <h3
                      tabIndex={0}
                      title="Double-click to rename layer"
                      onDoubleClick={() => beginLayerRename(element, "heading")}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          beginLayerRename(element, "heading");
                        }
                      }}
                    >
                      {element.name}
                    </h3>
                  )}
                </div>
              </div>
              {element.kind !== "image" && (
                <>
                  <ContentTextControl
                    text={element.text}
                    onChange={(text) => update({ text }, `text-${element.id}`)}
                    onTransform={(text) => {
                      end();
                      update({ text });
                      end();
                    }}
                    onCommit={end}
                  />
                  <section className="dc-property-section dc-typography-section">
                    <div className="dc-section-caption">Typography</div>
                    <label className="dc-field">
                      <span>Font family</span>
                      <button
                        className="dc-font-trigger"
                        disabled={fontBusy}
                        onClick={openFontPicker}
                      >
                        <span>
                          {currentFont?.name ??
                            (element.fontId
                              ? "Font unavailable"
                              : defaultFontName)}
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
                    {selectedTextLayers.length > 0 && (
                      <div className="dc-ink dc-ink-priority">
                        <span>
                          Ink color
                          {selectedTextLayers.length > 1
                            ? ` · ${selectedTextLayers.length} text layers`
                            : ""}
                        </span>
                        <div className="dc-preview-stock dc-layer-ink-controls">
                          <label className="dc-custom-paper">
                            <input
                              aria-label="Selected text ink color"
                              type="color"
                              value={selectedTextLayers[0].color}
                              onChange={(event) => {
                                const color = event.target.value;
                                const ids = new Set(
                                  selectedTextLayers.map((layer) => layer.id),
                                );
                                change(
                                  (current) =>
                                    changeLayerTextColors(
                                      current,
                                      side,
                                      ids,
                                      color,
                                      surface,
                                    ),
                                  `ink-${[...ids].join("-")}`,
                                );
                              }}
                              onBlur={end}
                            />
                          </label>
                          <ColorSwatches
                            colors={INK_COLOR_PRESETS}
                            visibleCount={propertiesPanelWidth <= 300 ? 4 : 5}
                            label="Ink color"
                            onPreview={(color) => previewColor("ink", color)}
                            value={
                              selectedTextLayers.some(
                                (layer) =>
                                  layer.color !== selectedTextLayers[0].color,
                              )
                                ? undefined
                                : selectedTextLayers[0].color
                            }
                            onChoose={(color) => {
                              end();
                              const ids = new Set(
                                selectedTextLayers.map((layer) => layer.id),
                              );
                              change((current) =>
                                changeLayerTextColors(
                                  current,
                                  side,
                                  ids,
                                  color,
                                  surface,
                                ),
                              );
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="dc-compact-text-controls">
                      <TextBlendModeControl
                        value={element.blendMode}
                        onChange={(blendMode) => {
                          end();
                          update({ blendMode });
                        }}
                      />
                      <TextSurfaceControl
                        layerId={element.id}
                        image={element.textTexture}
                        opacity={element.textTextureOpacity}
                        scale={element.textTextureScale}
                        onChange={(patch, group) => {
                          if (!group) end();
                          update(
                            patch,
                            group ? `${group}-${element.id}` : undefined,
                          );
                        }}
                        onCommit={end}
                        onError={setNotice}
                      />
                      <div className="dc-field-pair dc-compact-text-fields">
                        <TypographyValueControl
                          label="Size"
                          unit="PX"
                          value={element.size}
                          min={3}
                          max={3000}
                          sliderMax={250}
                          expandSlider
                          step={0.5}
                          onChange={(size) =>
                            update({ size }, `size-${element.id}`)
                          }
                          onCommit={end}
                        />
                        {element.kind === "text" ? (
                          <TypographyValueControl
                            label="Line height"
                            value={element.lineHeight ?? 1.1}
                            min={0}
                            max={3}
                            step={0.05}
                            onChange={(lineHeight) =>
                              update(
                                { lineHeight },
                                `line-height-${element.id}`,
                              )
                            }
                            onCommit={end}
                          />
                        ) : (
                          <div />
                        )}
                      </div>
                      <div className="dc-field-pair dc-compact-text-fields">
                        <TypographyValueControl
                          label="Tracking"
                          unit="PX"
                          value={element.spacing}
                          min={-10}
                          max={90}
                          step={0.1}
                          onChange={(spacing) =>
                            update({ spacing }, `spacing-${element.id}`)
                          }
                          onCommit={end}
                        />
                        <TypographyValueControl
                          label="Ink bleed"
                          unit="PX"
                          value={element.inkBleed ?? 0}
                          min={0}
                          max={30}
                          step={0.05}
                          onChange={(inkBleed) =>
                            update({ inkBleed }, `ink-bleed-${element.id}`)
                          }
                          onCommit={end}
                        />
                      </div>
                    </div>
                    <div className="dc-alignment">
                      <span>Anchor</span>
                      <div>
                        {(["start", "middle", "end"] as const).map(
                          (value, i) => {
                            const Icon = [AlignLeft, AlignCenter, AlignRight][
                              i
                            ];
                            return (
                              <button
                                key={value}
                                aria-label={
                                  [
                                    "Start anchor",
                                    "Center anchor",
                                    "End anchor",
                                  ][i]
                                }
                                aria-pressed={element.align === value}
                                onClick={() => update({ align: value })}
                              >
                                <Icon size={16} />
                              </button>
                            );
                          },
                        )}
                      </div>
                    </div>
                    <TypographyValueControl
                      label="Opacity"
                      unit="%"
                      value={Math.round((element.opacity ?? 1) * 100)}
                      min={0}
                      max={100}
                      step={1}
                      onChange={(opacity) =>
                        update(
                          { opacity: opacity / 100 },
                          `opacity-${element.id}`,
                        )
                      }
                      onCommit={end}
                    />
                    <TextEffectControls
                      effect={element.textEffect}
                      settings={element.textEffectSettings}
                      onChange={(textEffect, group, textEffectSettings) => {
                        if (!group) end();
                        update(
                          { textEffect, textEffectSettings },
                          group ? `${group}-${element.id}` : undefined,
                        );
                      }}
                      onCommit={end}
                    />
                  </section>
                </>
              )}
              <section className="dc-property-section dc-position-section">
                <div className="dc-section-caption">
                  {element.kind === "circular"
                    ? "Circular path"
                    : "Position & size"}
                </div>
                {element.kind === "circular" ? (
                  <>
                    {slider("Radius", "radius", 30, 295, "PX")}
                    {slider("Rotation", "angle", -180, 180, "°")}
                    {overflow && (
                      <p className="dc-warning" role="status">
                        El texto supera la circunferencia. Aumentá el radio o
                        reducí tamaño/espaciado. No se achica automáticamente.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    {element.kind === "image" &&
                      slider("Width", "width", 10, 500, "PX")}
                    {element.kind === "image" && (
                      <ImageAppearanceControls
                        layer={element}
                        onChange={update}
                        onCommit={end}
                      />
                    )}
                    {element.kind === "image" && (
                      <TypographyValueControl
                        label="Border radius"
                        unit="PX"
                        value={element.borderRadius ?? 0}
                        min={0}
                        max={100}
                        step={1}
                        onChange={(borderRadius) =>
                          update(
                            { borderRadius },
                            `border-radius-${element.id}`,
                          )
                        }
                        onCommit={end}
                      />
                    )}
                    {element.kind === "image" && (
                      <label className="dc-field dc-slider-field">
                        <span>
                          Opacity
                          <output>
                            {Math.round((element.opacity ?? 1) * 100)}{" "}
                            <small>%</small>
                          </output>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          aria-label="Image opacity"
                          value={Math.round((element.opacity ?? 1) * 100)}
                          onChange={(event) =>
                            update(
                              { opacity: Number(event.target.value) / 100 },
                              `opacity-${element.id}`,
                            )
                          }
                          onPointerUp={end}
                          onBlur={end}
                        />
                      </label>
                    )}
                    <div className="dc-field-pair">
                      {number("Horizontal", "x", 0, 600, "PX")}
                      {number("Vertical", "y", 0, 600, "PX")}
                    </div>
                    {slider("Rotation", "angle", -180, 180, "°")}
                  </>
                )}
              </section>
              <section className="dc-property-section dc-focus-section">
                <div className="dc-section-caption">Focus</div>
                <TypographyValueControl
                  label="Blur"
                  unit="PX"
                  value={element.blur ?? 0}
                  min={0}
                  max={40}
                  step={0.1}
                  zeroLabel="Zero"
                  onChange={(blur) => update({ blur }, `blur-${element.id}`)}
                  onCommit={end}
                />
                <p className="dc-blur-hint">
                  0 keeps edges sharp. Increase to soften this element.
                </p>
              </section>
            </>
          )}
        </aside>
        <nav className="dc-mobile-tabs" aria-label="Editor panels">
          <button
            type="button"
            aria-pressed={mobileTab === "layers"}
            onClick={() => setMobileTab("layers")}
          >
            <Layers size={16} />
            Elements
          </button>
          <button
            type="button"
            aria-pressed={mobileTab === "properties"}
            onClick={() => setMobileTab("properties")}
          >
            <SlidersHorizontal size={16} />
            Properties
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            disabled={!hasSelection || element.kind === "image"}
            onClick={openFontPicker}
          >
            <Type size={16} />
            Fonts
          </button>
        </nav>
      </div>
      <input
        hidden
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
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
        <FontPickerPanel
          targetName={element.name}
          close={() => setDialog(null)}
        >
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
          <FontCollectionTabs
            scope={scope}
            counts={collectionCounts}
            loading={fontsLoading}
            onSelect={setScope}
          />
          <div className="dc-font-category-label">
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>Filter by category</span>
          </div>
          <FontCategoryChips
            categories={categories}
            selected={selectedCategory}
            scope={scope}
            labelFor={(category) =>
              pickerCategoryLabel(category, scope, fontContext)
            }
            onSelect={(category) =>
              setCategoryByScope((current) => ({
                ...current,
                [categoryScopeKey]: category,
              }))
            }
          />
          <div className="dc-font-result-options">
            <span role="status">
              {fontsLoading
                ? "Loading families…"
                : `${sortedFonts.length.toLocaleString("en-US")} families`}
            </span>
            <label className="dc-all-styles">
              <input
                type="checkbox"
                checked={seeAllStyles}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setSeeAllStyles(enabled);
                  if (!enabled) setExpandedFonts(new Set());
                }}
              />
              See all substyles
            </label>
          </div>
          <div
            className="dc-font-results"
            ref={fontResults}
            onScroll={(event) =>
              fontScrollPositions.current.set(
                fontScrollKey,
                event.currentTarget.scrollTop,
              )
            }
          >
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
                {(i === 0 ||
                  pickerCategory(sortedFonts[i - 1]) !==
                    pickerCategory(font)) && (
                  <h3 className="dc-font-group">
                    {pickerCategoryLabel(
                      pickerCategory(font),
                      scope,
                      fontContext,
                    )}
                  </h3>
                )}
                <FontRow
                  font={font}
                  sample={element.text}
                  active={element.fontId === font.id}
                  favorite={favoriteFonts.includes(font.id)}
                  busy={fontBusy}
                  expanded={
                    font.variantCount > 1
                      ? familyIsExpanded(font, expandedFonts, seeAllStyles)
                      : undefined
                  }
                  stylesId={`${prefix}-styles-${font.id}`}
                  toggleExpanded={() => {
                    setSeeAllStyles(false);
                    setExpandedFonts(
                      toggleFamily(
                        font,
                        expandedFonts,
                        seeAllStyles,
                        sortedFonts,
                      ),
                    );
                  }}
                  choose={() => {
                    if (
                      familyClickAction(font, expandedFonts, seeAllStyles) ===
                      "expand"
                    )
                      setExpandedFonts(
                        (current) => new Set([...current, font.id]),
                      );
                    else void selectFont(font);
                  }}
                  preview={(font) => void previewFont(font)}
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
                {familyIsExpanded(font, expandedFonts, seeAllStyles) && (
                  <FontStyleTiles
                    font={font}
                    sample={element.text}
                    busy={fontBusy}
                    id={`${prefix}-styles-${font.id}`}
                    selected={
                      element.fontId === font.id ? element.variantId : undefined
                    }
                    preview={(family, variantId) =>
                      void previewFont(family, variantId)
                    }
                    choose={(variantId) => void selectFont(font, variantId)}
                  />
                )}
              </div>
            ))}
            {sortedFonts.length > fontLimit && (
              <button
                className="dc-more-fonts"
                onClick={() =>
                  setFontLimit((n) => {
                    fontViewLimits.current.set(fontScrollKey, n + 40);
                    return n + 40;
                  })
                }
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
        </FontPickerPanel>
      )}
      {dialog === "sleeve-preview" && (
        <Modal
          title="3D sleeve + label preview"
          wide
          className="dc-3d-preview-dialog"
          close={() => setDialog(null)}
        >
          <Sleeve3DPreview
            labelCapture={sleevePreviewLabels.A}
            labelCaptureBack={sleevePreviewLabels.B}
            side={side}
            sleeveColor={design.sleeveColor}
            sleeveImage={design.sleeveImage}
            sleeveCaptureFront={sleevePreviewLabels.sleeveA}
            sleeveCaptureBack={sleevePreviewLabels.sleeveB}
            sleeveZoom={design.sleeveZoom}
            sleeveImageOffsetX={design.sleeveImageOffsetX}
            sleeveImageOffsetY={design.sleeveImageOffsetY}
            labelDiameterMm={design.diameterMm}
            labelHoleMm={design.holeMm}
          />
        </Modal>
      )}
      {dialog === "file" && (
        <Modal title="File" close={() => setDialog(null)}>
          <div className="dc-dialog-scroll">
            <p className="dc-font-explanation">
              My Gallery keeps each saved design and its versions with your
              account.
            </p>
            <div className="dc-project-files">
              <button onClick={() => setDialog("new")}>
                <Plus size={16} />
                New project
              </button>
              <button onClick={load}>
                <FileText size={16} />
                Open My Gallery
              </button>
              <button onClick={exportProject}>
                <ArrowDownToLine size={16} />
                Download project (JSON)
              </button>
              <button onClick={() => projectInput.current?.click()}>
                <Upload size={16} />
                Import project (JSON)
              </button>
            </div>
            <hr className="dc-project-files-divider" />
            <button
              className="dc-download-used-fonts"
              disabled={usedFontsBusy || fontsLoading}
              onClick={() => void downloadUsedFonts()}
            >
              <ArrowDownToLine size={16} />
              {usedFontsBusy ? "Preparing fonts…" : "Download fonts in use"}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "settings" && (
        <Modal title="Project settings" close={() => setDialog(null)}>
          <div className="dc-dialog-scroll">
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
      {dialog === "assets" && (
        <Modal title="Assets" close={() => setDialog(null)}>
          <AssetLibrary onInsert={insertAsset} />
        </Modal>
      )}
      {dialog === "new" && (
        <Modal
          title="New project"
          wide
          className="dc-font-picker dc-template-dialog"
          close={() => setDialog(null)}
        >
          <p className="dc-font-explanation">Choose a template to start.</p>
          <LabelTemplatePicker
            onChoose={(next) => {
              if (hasUnsavedProject(design, lastSaved))
                setPendingTemplate(next);
              else applyTemplate(next);
            }}
          />
          {pendingTemplate && (
            <ConfirmationDialog
              title="Replace current project?"
              description="Your current project has unsaved changes. Replace it with this template? You can undo this change."
              onCancel={() => setPendingTemplate(null)}
              onConfirm={() => applyTemplate(pendingTemplate)}
            />
          )}
          <div className="dc-picker-footer">
            <button onClick={() => setDialog(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {dialog === "export" && (
        <Modal
          title="Export"
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
                  const nextFormat = e.target.value;
                  setExportFormat(nextFormat);
                  if (nextFormat === "pdf") setExportSides("current");
                  if (nextFormat === "png") setIncludeSleeve(true);
                }}
              >
                <option value="svg">
                  SVG — editable vector, embedded fonts
                </option>
                <option value="png">PNG — 600 ppi</option>
                <option value="psd">
                  Photoshop PSD — 600 ppi, layers, outlined text
                </option>
                <option value="pdf">Print / Save as PDF — current side</option>
              </select>
            </label>
            {exportFormat === "psd" && (
              <p className="dc-font-explanation">
                Text without 3D effects or blur is converted to editable vector
                shapes, not live type. 3D and blurred layers are rasterized to
                preserve their appearance. OTF, TTF and WOFF sources supported;
                contextual scripts are not supported yet. Ink bleed keeps a
                separate appearance layer and hidden vector source.
              </p>
            )}
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
            <label className="dc-field">
              <span>Artwork</span>
              <select
                value={includeSleeve ? "sleeve" : "label"}
                disabled={exportBusy}
                onChange={(event) =>
                  setIncludeSleeve(event.target.value === "sleeve")
                }
              >
                <option value="label">Record label only</option>
                <option value="sleeve">Record label + sleeve</option>
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
                {includeSleeve
                  ? 315
                  : design.diameterMm + (includeBleed ? design.bleedMm * 2 : 0)}
                {" × "}
                {includeSleeve
                  ? 315
                  : design.diameterMm +
                    (includeBleed ? design.bleedMm * 2 : 0)}{" "}
                mm
              </strong>
              <span>
                {includeSleeve
                  ? "RGB · centered label over sleeve · 300 ppi"
                  : "RGB · transparent center hole · 600 ppi"}
              </span>
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
        <div
          className={
            notice === RECOVERY_SUCCESS_NOTICE
              ? "dc-toast dc-toast-success"
              : "dc-toast"
          }
          role="status"
        >
          {notice === RECOVERY_SUCCESS_NOTICE && (
            <Check size={15} aria-hidden="true" />
          )}
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </main>
  );
}
