import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TypewriterText } from "@/components/TypewriterText";
import {
  ArrowLeftRight,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ImageIcon,
  Menu,
  Minus,
  Pin,
  Settings,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteFontCatalogItem,
  downloadFontFamily,
  listFontCatalog,
  listFontVariants,
  loadFontVariant,
  updateFontEnabled,
  updateFontParentCategory,
  updateFontUseCases,
  type FontCatalogItem,
  type LoadedFontVariant,
  type FontVariant,
} from "./font-catalog-repository";
import {
  DEFAULT_TEXT_SHADOW,
  listIdentityFontSets,
  saveIdentityFontSet,
  type IdentityFontSet,
  type TextShadowSettings,
} from "./identity-font-sets-repository";
import {
  EMPTY_IDENTITY_FONT_PREFERENCES,
  getIdentityBrowserId,
  loadIdentityFontPreferences,
  saveIdentityFontPreferences,
  type IdentityFontPreferences,
} from "./identity-font-preferences";

const SHOW_FONT_DELETE_CONTROLS = import.meta.env.DEV;
const FONT_PARENT_CATEGORIES = [
  "Abstract",
  "Cyber",
  "Dotted",
  "Goth",
  "Grunge",
  "Handwritten",
  "LCD Display",
  "Ornamental",
  "Outlined",
  "Paragraph / Standard",
  "Pixel",
  "Playful",
  "Semi-Abstract",
  "Serif",
  "Squared / Tech",
  "3D",
  "Title / Bold",
  "Vintage",
  "Wide",
] as const;

function getSupportedPreviewText(
  value: string,
  supportedCodePoints: ReadonlySet<number> | null | undefined,
) {
  if (!supportedCodePoints) return value;

  return Array.from(value)
    .filter((character) => {
      const codePoint = character.codePointAt(0);

      return (
        codePoint === undefined ||
        /\s/u.test(character) ||
        supportedCodePoints.has(codePoint)
      );
    })
    .join("");
}

function SupportedPreviewText({
  supportedCodePoints,
  value,
}: {
  supportedCodePoints: ReadonlySet<number> | null | undefined;
  value: string;
}) {
  const previewText = useMemo(
    () => getSupportedPreviewText(value, supportedCodePoints),
    [supportedCodePoints, value],
  );

  return previewText;
}
const FONT_CATEGORY_BOTTOM_ORDER = [
  "Pixel",
  "Handwritten",
  "Paragraph / Standard",
];
const UNCATEGORIZED_LABEL = "Uncategorized";
const FONT_USE_CASES = ["CD Print", "Clothing", "Vinyl print"] as const;
const UNASSIGNED_USE_CASE_LABEL = "Unassigned";
const VARIANTS_PER_PAGE = 3;
const MAX_BACKGROUND_IMAGE_SIZE = 15 * 1024 * 1024;
const DEFAULT_LINE_HEIGHT = 1;
const DEFAULT_LETTER_SPACING = 0;
const MOBILE_FONT_SIZE_DEFAULT = 31;
const DESKTOP_FONT_SIZE_DEFAULT = 31;
const MOBILE_FONT_SIZE_MAX = 96;
const IDENTITY_FONTS_ONBOARDING_STORAGE_KEY =
  "strange-animals.identity-fonts-onboarding-dismissed.v1";

function compareCategoryNames(left: string, right: string) {
  if (left === "3D") {
    return right.localeCompare("Squared / Tech", undefined, {
      sensitivity: "base",
    }) <= 0
      ? 1
      : -1;
  }

  if (right === "3D") {
    return left.localeCompare("Squared / Tech", undefined, {
      sensitivity: "base",
    }) <= 0
      ? -1
      : 1;
  }

  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareFontFilterCategoryLabels(left: string, right: string) {
  if (left === UNCATEGORIZED_LABEL) return 1;
  if (right === UNCATEGORIZED_LABEL) return -1;

  return compareCategoryNames(left, right);
}

function compareFontSectionCategoryLabels(left: string, right: string) {
  const leftBottomIndex = FONT_CATEGORY_BOTTOM_ORDER.indexOf(left);
  const rightBottomIndex = FONT_CATEGORY_BOTTOM_ORDER.indexOf(right);

  if (leftBottomIndex !== -1 && rightBottomIndex !== -1) {
    return leftBottomIndex - rightBottomIndex;
  }

  if (leftBottomIndex !== -1) return 1;
  if (rightBottomIndex !== -1) return -1;

  return compareCategoryNames(left, right);
}
const DESKTOP_FONT_SIZE_MAX = 140;
const FONT_TOOLBAR_GRID_CLASS =
  "grid grid-cols-2 gap-5 md:grid-cols-2 md:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto_auto_auto_auto]";
const ACCEPTED_BACKGROUND_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type BackgroundImage = {
  file?: File;
  name: string;
  source: "local" | "remote";
  storagePath?: string;
  url: string;
};

type TextAlignment = "left" | "center" | "right";
type FontWeight = "normal" | 800;

function getPreviewFontWeight(fontWeight: FontWeight) {
  return fontWeight === "normal" ? undefined : fontWeight;
}

function readFontWeight(value: string): FontWeight {
  if (value === "800") return 800;

  return "normal";
}

function serializeFontWeight(fontWeight: FontWeight): "normal" | "800" {
  if (fontWeight === 800) return "800";
  return "normal";
}

function formatSavedSetTime(value: Date | null) {
  if (!value) return "just now";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getEmptyCatalogMessage(fontCount: number, showOnlyFavorites: boolean) {
  if (fontCount === 0) return "The catalog is empty.";
  if (showOnlyFavorites) return "No favorite fonts yet.";

  return "No matching fonts. Try a shorter name or format.";
}

function getToolbarPlacementClass(floating: boolean, minimized: boolean) {
  if (!floating) return "xl:mt-[1.8rem]";

  return minimized
    ? "identity-font-toolbar-minimized"
    : "identity-font-toolbar-fade-in fixed top-4 right-4 left-4 z-[10000] border border-white/45 bg-black p-4";
}

function getToolbarPopoverPlacementClass() {
  return "top-full mt-2";
}

function getToolbarMinimizeButtonClass(floating: boolean) {
  return floating
    ? "absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center text-white/60 outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
    : "hidden";
}

function isToolbarLauncherVisible(floating: boolean, minimized: boolean) {
  return floating && minimized;
}

function FloatingToolbarBrand({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="identity-font-toolbar-fade-in pointer-events-none fixed top-3 left-5 z-[10000] flex w-48 flex-col items-end sm:top-5 sm:left-8 sm:w-59 lg:left-10 2xl:left-[max(1.25rem,calc((100vw-92rem)/4))]"
    >
      <img
        alt=""
        className="pointer-events-auto h-auto w-full select-none opacity-90 transition-opacity duration-200 hover:opacity-100 motion-reduce:transition-none"
        decoding="async"
        draggable={false}
        src="/media/images/logos/sa-logo.png"
      />
      <span className="mt-1 mr-[2px] text-[0.5rem] font-normal tracking-[0.04em] lowercase">
        identity &gt; typography
      </span>
    </div>
  );
}

function ScrollControls() {
  const scrollAnimationReference = useRef<number>();
  const [activeDirection, setActiveDirection] = useState<"up" | "down">();
  const [hoveredDirection, setHoveredDirection] = useState<"up" | "down">();
  const [keyboardDirection, setKeyboardDirection] = useState<
    "up" | "down"
  >();

  const stopScrolling = () => {
    if (scrollAnimationReference.current !== undefined) {
      window.cancelAnimationFrame(scrollAnimationReference.current);
      scrollAnimationReference.current = undefined;
    }

    setActiveDirection(undefined);
  };

  const startScrolling = (direction: "up" | "down") => {
    stopScrolling();
    setActiveDirection(direction);

    const scrollStep = () => {
      window.scrollBy({
        top: direction === "up" ? -8 : 8,
        behavior: "auto",
      });
      scrollAnimationReference.current = window.requestAnimationFrame(scrollStep);
    };

    scrollAnimationReference.current = window.requestAnimationFrame(scrollStep);
  };

  useEffect(() => stopScrolling, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(target.closest("input, textarea, select, [contenteditable='true']"));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target)) return;

      if (event.key === "ArrowUp") {
        setKeyboardDirection("up");
      } else if (event.key === "ArrowDown") {
        setKeyboardDirection("down");
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        setKeyboardDirection(undefined);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const isButtonHighlighted = (direction: "up" | "down") =>
    activeDirection === direction ||
    keyboardDirection === direction ||
    hoveredDirection === direction;
  const buttonClass = (direction: "up" | "down") =>
    `flex h-7 w-12 cursor-pointer items-center justify-center rounded-sm border bg-black/90 backdrop-blur-[3px] outline-none transition-[border-color,background-color] duration-200 focus:outline-none focus-visible:outline-none motion-reduce:transition-none ${isButtonHighlighted(direction) ? "border-white/35 bg-[#111111]" : "border-white/25"}`;
  const buttonStyle = (direction: "up" | "down") => ({
    color: isButtonHighlighted(direction)
      ? "rgb(255 255 255 / 0.65)"
      : "rgb(255 255 255 / 0.25)",
  });
  const handlePointerLeave = () => {
    setHoveredDirection(undefined);
    stopScrolling();
  };

  return (
    <nav
      aria-label="Page scroll controls"
      className="fixed right-6 bottom-5 z-[10000] flex flex-col gap-[7px] sm:bottom-7 2xl:right-[max(1.25rem,calc((100vw-92rem)/4-1.5rem))]"
    >
      <button
        aria-label="Scroll up"
        className={buttonClass("up")}
        style={buttonStyle("up")}
        title="Scroll up"
        type="button"
        onPointerCancel={stopScrolling}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          startScrolling("up");
        }}
        onPointerEnter={() => {
          setHoveredDirection("up");
        }}
        onPointerLeave={handlePointerLeave}
        onPointerUp={stopScrolling}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          startScrolling("up");
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") stopScrolling();
        }}
      >
        <ChevronUp aria-hidden="true" className="size-4" />
      </button>
      <button
        aria-label="Scroll down"
        className={buttonClass("down")}
        style={buttonStyle("down")}
        title="Scroll down"
        type="button"
        onPointerCancel={stopScrolling}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          startScrolling("down");
        }}
        onPointerEnter={() => {
          setHoveredDirection("down");
        }}
        onPointerLeave={handlePointerLeave}
        onPointerUp={stopScrolling}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          startScrolling("down");
        }}
        onKeyUp={(event) => {
          if (event.key === "Enter" || event.key === " ") stopScrolling();
        }}
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
    </nav>
  );
}

function IdentityFontsOnboarding() {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [open, setOpen] = useState(() => {
    if (!import.meta.env.DEV || typeof window === "undefined") return false;

    return window.localStorage.getItem(IDENTITY_FONTS_ONBOARDING_STORAGE_KEY) !== "true";
  });
  const pages = [
    {
      eyebrow: "Typography as a voice",
      title: "An evolving type library.",
      body: "This space is a working collection of typefaces. Browse the families, test your own text, and use the controls to refine the view.",
    },
    {
      eyebrow: "How it works",
      title: "Make the collection yours.",
      body: "Filter by category or use case, save a set while developing, and keep exploring. Previews load as they enter the page so the library stays light.",
    },
  ];
  const currentPage = pages[step];
  const isLastStep = step === pages.length - 1;

  const close = () => {
    if (dontShowAgain) {
      window.localStorage.setItem(IDENTITY_FONTS_ONBOARDING_STORAGE_KEY, "true");
    }

    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dontShowAgain, open]);

  if (!open) return null;

  return (
    <div
      aria-labelledby="identity-fonts-onboarding-title"
      aria-modal="true"
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-transparent p-5 sm:p-8"
      role="dialog"
    >
      <section
        className="relative w-full max-w-lg border border-white/25 bg-black p-5 shadow-none sm:p-6"
        style={{ fontFamily: "'Departure Mono', 'Courier New', monospace" }}
      >
        <div className="absolute top-4 right-14 flex h-7 items-center text-[0.625rem] tracking-[0.08em] text-white/45">
          {step + 1} / {pages.length}
        </div>
        <button
          aria-label="Close introduction"
          className="absolute top-4 right-4 flex size-7 cursor-pointer items-center justify-center text-white/55 outline-none transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
          type="button"
          onClick={close}
        >
          <X aria-hidden="true" className="size-4" />
        </button>

        <div className="pr-10">
          <p className="text-[0.625rem] tracking-[0.12em] text-white/55 uppercase">
            {currentPage.eyebrow}
          </p>
          <h2
            id="identity-fonts-onboarding-title"
            className="mt-4 text-[calc(1.125rem-1px)] font-medium tracking-normal text-white"
          >
            {currentPage.title}
          </h2>
          <TypewriterText
            className="mt-4 block max-w-md text-[0.75rem] leading-relaxed tracking-normal text-white/70"
            text={currentPage.body}
          />
        </div>

        <footer className="mt-6 flex items-center justify-between gap-4 border-t border-white/20 pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-[0.625rem] tracking-normal text-white/65">
            <input
              checked={dontShowAgain}
              className="size-3 cursor-pointer accent-white"
              type="checkbox"
              onChange={(event) => {
                setDontShowAgain(event.target.checked);
              }}
            />
            <span>Don&apos;t show this again</span>
          </label>
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <button
                className="h-8 cursor-pointer border border-white/30 px-3 text-[0.625rem] tracking-[0.08em] text-white/65 outline-none transition-colors duration-150 hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
                type="button"
                onClick={() => {
                  setStep((current) => Math.max(current - 1, 0));
                }}
              >
                Back
              </button>
            ) : (
              <button
                className="h-8 cursor-pointer border border-white/30 px-3 text-[0.625rem] tracking-[0.08em] text-white/65 outline-none transition-colors duration-150 hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
                type="button"
                onClick={close}
              >
                Close
              </button>
            )}
            <button
              className="h-8 cursor-pointer bg-white px-3 text-[0.625rem] font-bold tracking-[0.08em] text-black outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
              type="button"
              onClick={() => {
                if (isLastStep) {
                  close();
                } else {
                  setStep((current) => current + 1);
                }
              }}
            >
              {isLastStep ? "Finish" : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function FloatingToolbarRestoreButton({
  visible,
  onRestore,
}: {
  visible: boolean;
  onRestore: () => void;
}) {
  if (!visible) return null;

  return (
    <button
      aria-controls="font-toolbar"
      aria-label="Restore font toolbar"
      className="group identity-font-toolbar-fade-in fixed top-3 right-6 z-[10000] flex size-12 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black text-white/50 outline-none transition-[border-color,color] duration-150 hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white sm:top-5 2xl:right-[max(1.25rem,calc((100vw-92rem)/4-1.5rem))]"
      title="Restore toolbar"
      type="button"
      onClick={onRestore}
    >
      <span
        aria-hidden="true"
        className="relative flex size-6 items-center justify-center"
      >
        <Menu className="size-5" />
        <Settings className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full bg-black p-[1px] text-white/45 transition-colors duration-150 group-hover:text-white/80 motion-reduce:transition-none" />
      </span>
    </button>
  );
}

function ActiveCategoryRail({ label }: { label?: string }) {
  if (!label) return null;

  return (
    <aside
      key={label}
      aria-hidden="true"
      className="identity-font-toolbar-fade-in pointer-events-none fixed bottom-6 left-2.5 z-20 flex -translate-x-1/2 sm:left-4 lg:left-5 2xl:left-[max(1.25rem,calc((100vw-92rem)/4))]"
    >
      <span className="rotate-180 text-[clamp(0.7rem,0.7vw,1rem)] leading-none tracking-[0.1em] whitespace-nowrap text-white/70 [writing-mode:vertical-rl]">
        {label.startsWith("category: ") ? (
          <>
            category:{" "}
            <strong className="font-bold">
              {label.slice("category: ".length).toLocaleUpperCase()}
            </strong>
          </>
        ) : (
          label
        )}
      </span>
    </aside>
  );
}

function useFloatingToolbar() {
  const [floating, setFloating] = useState(false);
  const [height, setHeight] = useState(0);
  const toolbarReference = useRef<HTMLDivElement>(null);
  const boundaryReference = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (floating) return;

    const toolbar = toolbarReference.current;

    if (!toolbar) return;

    const updateHeight = () => {
      setHeight(toolbar.offsetHeight);
    };

    updateHeight();

    if (!("ResizeObserver" in window)) {
      window.addEventListener("resize", updateHeight);
      return () => {
        window.removeEventListener("resize", updateHeight);
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(toolbar);

    return () => {
      observer.disconnect();
    };
  }, [floating]);

  useEffect(() => {
    const updateFloatingState = () => {
      const boundary = boundaryReference.current;

      if (boundary) setFloating(boundary.getBoundingClientRect().top <= 0);
    };

    updateFloatingState();
    window.addEventListener("scroll", updateFloatingState, { passive: true });
    window.addEventListener("resize", updateFloatingState);

    return () => {
      window.removeEventListener("scroll", updateFloatingState);
      window.removeEventListener("resize", updateFloatingState);
    };
  }, []);

  return {
    toolbarBoundaryReference: boundaryReference,
    toolbarFloating: floating,
    toolbarHeight: height,
    toolbarReference,
  };
}

function FontSpecimen({
  backgroundColor,
  backgroundImageUrl,
  font,
  fontColor,
  fontSize,
  fontWeight,
  letterSpacing,
  lineHeight,
  textAlignment,
  textShadow,
  deleting,
  categoryUpdating,
  visibilityUpdating,
  useCasesUpdating,
  favorite,
  pinned,
  preferenceControlsEnabled,
  onDelete,
  onFavoriteChange,
  onEnabledChange,
  onParentCategoryChange,
  onUseCasesChange,
  onPinnedChange,
  specimen,
}: {
  backgroundColor: string;
  backgroundImageUrl?: string;
  font: FontCatalogItem;
  fontColor: string;
  fontSize: number;
  fontWeight: FontWeight;
  letterSpacing: number;
  lineHeight: number;
  textAlignment: TextAlignment;
  textShadow: TextShadowSettings;
  deleting: boolean;
  categoryUpdating: boolean;
  visibilityUpdating: boolean;
  useCasesUpdating: boolean;
  favorite: boolean;
  pinned: boolean;
  preferenceControlsEnabled: boolean;
  onDelete: (font: FontCatalogItem) => void;
  onFavoriteChange: (font: FontCatalogItem) => void;
  onEnabledChange: (font: FontCatalogItem, enabled: boolean) => void;
  onParentCategoryChange: (
    font: FontCatalogItem,
    parentCategory: string | null,
  ) => void;
  onUseCasesChange: (font: FontCatalogItem, useCases: string[]) => void;
  onPinnedChange: (font: FontCatalogItem) => void;
  specimen: string;
}) {
  const cardReference = useRef<HTMLElement>(null);
  const [variants, setVariants] = useState<FontVariant[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadedVariants, setLoadedVariants] = useState<
    Record<string, LoadedFontVariant>
  >({});
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const card = cardReference.current;

    if (!card || !font.preview) return;

    let active = true;
    let started = false;

    const load = () => {
      if (started) return;
      started = true;

      listFontVariants(font)
        .then((nextVariants) => {
          if (!active) return;

          setVariants(nextVariants);
          setCurrentPage(0);
        })
        .catch(() => undefined);
    };

    if (!("IntersectionObserver" in window)) {
      load();
      return () => {
        active = false;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          load();
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(card);

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [font]);

  const variantTotal =
    variants.length > 0 ? variants.length : font.variantCount;
  const pageTotal = Math.ceil(variantTotal / VARIANTS_PER_PAGE);
  const pageStart = currentPage * VARIANTS_PER_PAGE;
  const visibleVariants = useMemo(
    () => variants.slice(pageStart, pageStart + VARIANTS_PER_PAGE),
    [pageStart, variants],
  );
  const previewVariants =
    visibleVariants.length > 0
      ? visibleVariants
      : font.preview
        ? [
            {
              id: `${font.id}-preview-placeholder-${currentPage}`,
              fileName: font.preview.fileName,
            },
          ]
        : [];

  useEffect(() => {
    if (visibleVariants.length === 0) return;

    let active = true;

    void Promise.all(
      visibleVariants.map(async (variant) =>
        loadFontVariant(font, variant)
          .then((loadedVariant) => {
            if (!active) return;
            setLoadedVariants((current) => ({
              ...current,
              [variant.id]: loadedVariant,
            }));
          })
          .catch(() => undefined),
      ),
    );

    return () => {
      active = false;
    };
  }, [font, visibleVariants]);

  const downloadFamily = () => {
    setDownloading(true);
    void downloadFontFamily(font)
      .catch(() => undefined)
      .finally(() => {
        setDownloading(false);
      });
  };

  return (
    <article
      ref={cardReference}
      className="group/font-card min-w-0 overflow-x-clip flex min-h-60 flex-col border-t border-white/25 py-4 sm:min-h-[15rem] sm:py-5"
    >
      <div className="flex min-w-0 items-start justify-between gap-4 text-[0.625rem] leading-none tracking-[0.12em] text-white/55 uppercase">
        <div className="flex min-w-0 max-w-[45%] items-center gap-2">
          {SHOW_FONT_DELETE_CONTROLS ? (
            <button
              aria-label={`Delete ${font.name}`}
              className="shrink-0 text-white/40 hover:text-white disabled:cursor-wait disabled:text-white/20"
              disabled={deleting}
              title={`Delete ${font.name}`}
              type="button"
              onClick={() => {
                onDelete(font);
              }}
            >
              <Trash2 aria-hidden="true" className="size-[0.7rem]" />
            </button>
          ) : null}
          <h2 className="min-w-0 truncate font-normal text-white/80">
            {font.name}
          </h2>
          {SHOW_FONT_DELETE_CONTROLS ? (
            <button
              aria-checked={font.enabled}
              aria-label={`${font.enabled ? "Hide" : "Show"} ${font.name} in production`}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 bg-transparent text-[0.5rem] tracking-[0.08em] text-white/40 normal-case outline-none hover:text-white/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-35"
              disabled={visibilityUpdating}
              role="switch"
              title={`${font.enabled ? "Visible" : "Hidden"} in production`}
              type="button"
              onClick={() => {
                onEnabledChange(font, !font.enabled);
              }}
            >
              <span className={font.enabled ? "" : "text-white/80"}>off</span>
              <span className="relative h-3 w-6 border border-white/30">
                <span
                  aria-hidden="true"
                  className={`absolute top-1/2 left-0.5 size-2 -translate-y-1/2 bg-white transition-transform duration-150 motion-reduce:transition-none ${font.enabled ? "translate-x-3" : "translate-x-0"}`}
                />
              </span>
              <span className={font.enabled ? "text-white/80" : ""}>on</span>
            </button>
          ) : null}
          <div className="flex shrink-0 items-center gap-1">
            <button
              aria-label={
                favorite
                  ? `Remove ${font.name} from favorites`
                  : `Add ${font.name} to favorites`
              }
              aria-pressed={favorite}
              className={`flex size-5 cursor-pointer items-center justify-center bg-transparent outline-none transition-[color,opacity] duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white ${pinned ? "order-2" : "order-1"} ${favorite ? "text-[#d4af37] opacity-100" : "text-white/50 opacity-0 hover:text-white group-hover/font-card:opacity-100 focus-visible:opacity-100"}`}
              disabled={!preferenceControlsEnabled}
              title={favorite ? "Remove from favorites" : "Add to favorites"}
              type="button"
              onClick={() => {
                onFavoriteChange(font);
              }}
            >
              <Star
                aria-hidden="true"
                className={`size-3 ${favorite ? "fill-current" : "fill-white/10"}`}
              />
            </button>
            <button
              aria-label={pinned ? `Unpin ${font.name}` : `Pin ${font.name}`}
              aria-pressed={pinned}
              className={`flex size-5 cursor-pointer items-center justify-center bg-transparent outline-none transition-[color,opacity] duration-150 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white ${pinned ? "order-1 text-[#2563eb] opacity-100" : "order-2 text-white/50 opacity-0 hover:text-white group-hover/font-card:opacity-100 focus-visible:opacity-100"}`}
              disabled={!preferenceControlsEnabled}
              title={pinned ? "Unpin font" : "Pin font"}
              type="button"
              onClick={() => {
                onPinnedChange(font);
              }}
            >
              <Pin
                aria-hidden="true"
                className={`size-3 rotate-[25deg] ${pinned ? "fill-current" : "fill-white/10"}`}
              />
            </button>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          {SHOW_FONT_DELETE_CONTROLS ? (
            <div className="flex min-w-0 items-center gap-2">
              <select
                aria-label={`Parent category for ${font.name}`}
                className="h-6 w-20 cursor-pointer rounded-none border border-white/25 bg-black px-1 text-[0.5625rem] tracking-[0.08em] text-white/60 normal-case shadow-none outline-none focus:border-white/55 focus:outline-none disabled:cursor-wait disabled:opacity-40 sm:w-28"
                disabled={categoryUpdating}
                title={`Parent category for ${font.name}`}
                value={font.parentCategory ?? ""}
                onChange={(event) => {
                  onParentCategoryChange(font, event.target.value || null);
                }}
              >
                <option value="">—</option>
                {font.parentCategory &&
                !FONT_PARENT_CATEGORIES.includes(
                  font.parentCategory as (typeof FONT_PARENT_CATEGORIES)[number],
                ) ? (
                  <option value={font.parentCategory}>
                    {font.parentCategory}
                  </option>
                ) : null}
                {FONT_PARENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <details className="group/use-cases relative w-20 sm:w-28">
                <summary
                  aria-label={`Use cases for ${font.name}`}
                  aria-disabled={useCasesUpdating}
                  className={`flex h-6 list-none items-center justify-between gap-1 rounded-none border border-white/25 bg-black px-1 text-[0.5625rem] tracking-[0.08em] text-white/60 normal-case shadow-none outline-none [&::-webkit-details-marker]:hidden ${useCasesUpdating ? "cursor-wait opacity-40" : "cursor-pointer hover:border-white/45"}`}
                  title={
                    font.useCases.length > 0
                      ? font.useCases.join(", ")
                      : `Use cases for ${font.name}`
                  }
                  onClick={(event) => {
                    if (useCasesUpdating) event.preventDefault();
                  }}
                >
                  <span className="truncate">
                    {font.useCases.length === 0
                      ? "—"
                      : font.useCases.join(", ")}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="size-3 shrink-0 transition-transform duration-150 group-open/use-cases:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <fieldset
                  aria-label={`Select use cases for ${font.name}`}
                  className="absolute top-[calc(100%+0.25rem)] right-0 z-30 m-0 grid min-w-36 gap-0 border border-white/35 bg-black p-1 shadow-none"
                >
                  {FONT_USE_CASES.map((useCase) => {
                    const checked = font.useCases.includes(useCase);

                    return (
                      <label
                        key={useCase}
                        className="flex min-h-7 cursor-pointer items-center gap-2 px-1.5 text-[0.5625rem] tracking-[0.08em] text-white/65 normal-case hover:bg-white/10 hover:text-white"
                      >
                        <input
                          checked={checked}
                          className="size-3 shrink-0 cursor-pointer accent-white"
                          disabled={useCasesUpdating}
                          type="checkbox"
                          onChange={() => {
                            onUseCasesChange(
                              font,
                              checked
                                ? font.useCases.filter(
                                    (currentUseCase) =>
                                      currentUseCase !== useCase,
                                  )
                                : [...font.useCases, useCase],
                            );
                          }}
                        />
                        <span>{useCase}</span>
                      </label>
                    );
                  })}
                </fieldset>
              </details>
            </div>
          ) : null}
          {pageTotal > 1 ? (
            <>
              <button
                aria-label={`Previous variant page of ${font.name}`}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center border border-white/35 bg-transparent text-white/60 shadow-none outline-none hover:border-white/60 hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-default disabled:border-white/15 disabled:text-white/20"
                disabled={currentPage === 0}
                type="button"
                onClick={() => {
                  setCurrentPage((page) => Math.max(page - 1, 0));
                }}
              >
                <ChevronLeft aria-hidden="true" className="size-3" />
              </button>
              <span aria-live="polite" className="w-10 text-center">
                {currentPage + 1}/{pageTotal}
              </span>
              <button
                aria-label={`Next variant page of ${font.name}`}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center border border-white/35 bg-transparent text-white/60 shadow-none outline-none hover:border-white/60 hover:text-white focus:outline-none focus-visible:outline-none disabled:cursor-default disabled:border-white/15 disabled:text-white/20"
                disabled={currentPage === pageTotal - 1}
                type="button"
                onClick={() => {
                  setCurrentPage((page) => Math.min(page + 1, pageTotal - 1));
                }}
              >
                <ChevronRight aria-hidden="true" className="size-3" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-8 mb-[1.4rem] min-w-0 space-y-6">
        {previewVariants.map((variant) => {
          const loadedVariant = loadedVariants[variant.id];
          const familyName = loadedVariant?.familyName;
          const previewText = specimen || font.name;
          const variantName = variant.fileName
            .replace(/\.[^/.]+$/, "")
            .replaceAll("-", " ")
            .replace(/\s+/g, " ")
            .trim();

          return (
            <div key={variant.id}>
              <div
                aria-busy={!familyName}
                className="relative min-w-0 overflow-hidden"
                style={{
                  backgroundColor,
                  backgroundImage: backgroundImageUrl
                    ? `url(${backgroundImageUrl})`
                    : undefined,
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                }}
              >
                <p
                  aria-hidden="true"
                  className={`min-w-0 max-w-full px-4 py-8 leading-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-white transition-[filter,opacity] duration-700 ease-in-out motion-reduce:transition-none ${familyName ? "pointer-events-none opacity-0 blur-[3px]" : "opacity-80 blur-[3px]"}`}
                  style={{
                    color: fontColor,
                    fontSize: `${fontSize}px`,
                    fontWeight: getPreviewFontWeight(fontWeight),
                    letterSpacing: `${letterSpacing}em`,
                    lineHeight,
                    textAlign: textAlignment,
                    textShadow: textShadow.enabled
                      ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                      : undefined,
                  }}
                >
                  {previewText}
                </p>
                <p
                  className={`absolute inset-0 min-w-0 max-w-full px-4 py-8 leading-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-white transition-[filter,opacity] duration-700 ease-in-out motion-reduce:transition-none ${familyName ? "opacity-100 blur-0" : "pointer-events-none opacity-0 blur-[1px]"}`}
                  style={{
                  color: fontColor,
                  fontFamily: familyName,
                  fontSize: `${fontSize}px`,
                  fontWeight: getPreviewFontWeight(fontWeight),
                  letterSpacing: `${letterSpacing}em`,
                  lineHeight,
                  textAlign: textAlignment,
                  textShadow: textShadow.enabled
                    ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                    : undefined,
                }}
              >
                <SupportedPreviewText
                  supportedCodePoints={loadedVariant?.supportedCodePoints}
                  value={previewText}
                />
              </p>
              </div>
              {variantTotal > 1 ? (
                <div className="mt-2 flex min-w-0 justify-end text-[0.625rem] tracking-[0.08em] uppercase">
                  <span
                    className="min-w-0 overflow-hidden text-right text-white/70 text-ellipsis whitespace-nowrap"
                    title={variantName}
                  >
                    {variantName}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex min-w-0 justify-end overflow-x-hidden">
        <button
          aria-busy={downloading}
          className="flex h-6 max-w-full shrink-0 cursor-pointer items-center gap-2 bg-white px-2 text-[0.625rem] tracking-[0.08em] text-black uppercase transition-colors duration-150 hover:bg-white/80 disabled:cursor-wait disabled:opacity-50"
          disabled={downloading || font.fileCount === 0}
          type="button"
          onClick={downloadFamily}
        >
          <Download aria-hidden="true" className="size-3" />
          Download
        </button>
      </div>
    </article>
  );
}

function FontWeightControl({
  value,
  onChange,
}: {
  value: FontWeight;
  onChange: (fontWeight: FontWeight) => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
        Font weight
      </span>
      <div
        aria-label="Font weight"
        className="grid shrink-0 grid-cols-2 border border-white/35"
        role="group"
      >
        <button
          aria-label="Normal font weight"
          aria-pressed={value === "normal"}
          className={`flex size-8 cursor-pointer items-center justify-center border-r border-white/35 text-sm outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${value === "normal" ? "bg-white text-black hover:text-black" : "bg-black text-white/55"}`}
          style={{ fontWeight: 100 }}
          title="Normal"
          type="button"
          onClick={() => {
            onChange("normal");
          }}
        >
          <span aria-hidden="true">B</span>
        </button>
        <button
          aria-label="Bold font weight"
          aria-pressed={value === 800}
          className={`flex size-8 cursor-pointer items-center justify-center text-sm outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${value === 800 ? "bg-white text-black hover:text-black" : "bg-black text-white/55"}`}
          style={{ fontWeight: 900 }}
          title="Bold"
          type="button"
          onClick={() => {
            onChange(800);
          }}
        >
          <span aria-hidden="true">B</span>
        </button>
      </div>
    </div>
  );
}

function FavoriteFilterControl({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean;
  value: boolean;
  onChange: (showOnlyFavorites: boolean) => void;
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
        Show only favorites
      </span>
      <button
        aria-checked={value}
        aria-label="Show only favorite fonts"
        className="relative h-5 w-10 shrink-0 cursor-pointer bg-transparent outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-40"
        disabled={disabled}
        role="switch"
        type="button"
        onClick={() => {
          onChange(!value);
        }}
      >
        <span
          aria-hidden="true"
          className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-white/35"
        />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 left-1 size-2.5 -translate-y-1/2 rounded-full bg-white transition-transform duration-150 ${value ? "translate-x-[1.375rem]" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

export function IdentityFontsPage() {
  const [fonts, setFonts] = useState<FontCatalogItem[]>([]);
  const [search, setSearch] = useState("");
  const [specimen, setSpecimen] = useState("");
  const [fontSize, setFontSize] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
      ? MOBILE_FONT_SIZE_DEFAULT
      : DESKTOP_FONT_SIZE_DEFAULT,
  );
  const [isSmallViewport, setIsSmallViewport] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );
  const [fontWeight, setFontWeight] = useState<FontWeight>("normal");
  const [lineHeight, setLineHeight] = useState(DEFAULT_LINE_HEIGHT);
  const [letterSpacing, setLetterSpacing] = useState(DEFAULT_LETTER_SPACING);
  const [showFontSizeValue, setShowFontSizeValue] = useState(false);
  const [pendingFontSize, setPendingFontSize] = useState<number>();
  const [textAlignment, setTextAlignment] = useState<TextAlignment>("left");
  const [textShadow, setTextShadow] =
    useState<TextShadowSettings>(DEFAULT_TEXT_SHADOW);
  const [typographySettingsOpen, setTypographySettingsOpen] = useState(false);
  const [fontColor, setFontColor] = useState("#ffffff");
  const [fontColorSettingsOpen, setFontColorSettingsOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [backgroundMode, setBackgroundMode] = useState<"color" | "image">(
    "color",
  );
  const [backgroundImage, setBackgroundImage] = useState<BackgroundImage>();
  const [backgroundSettingsOpen, setBackgroundSettingsOpen] = useState(false);
  const [backgroundImageError, setBackgroundImageError] = useState<string>();
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [savedSetsOpen, setSavedSetsOpen] = useState(false);
  const [savedSets, setSavedSets] = useState<IdentityFontSet[]>([]);
  const [savedSetsLoading, setSavedSetsLoading] = useState(false);
  const [selectedSavedSetId, setSelectedSavedSetId] = useState<string>();
  const [loadSetConfirmationOpen, setLoadSetConfirmationOpen] = useState(false);
  const [setActionMessage, setSetActionMessage] = useState<string>();
  const [setActionError, setSetActionError] = useState<string>();
  const [savingSet, setSavingSet] = useState(false);
  const [fontPendingDeletion, setFontPendingDeletion] =
    useState<FontCatalogItem>();
  const [deletingFontIds, setDeletingFontIds] = useState<Set<string>>(
    new Set(),
  );
  const [updatingCategoryIds, setUpdatingCategoryIds] = useState<Set<string>>(
    new Set(),
  );
  const [updatingVisibilityIds, setUpdatingVisibilityIds] = useState<
    Set<string>
  >(new Set());
  const [updatingUseCasesIds, setUpdatingUseCasesIds] = useState<Set<string>>(
    new Set(),
  );
  const [categoryFiltersOpen, setCategoryFiltersOpen] = useState(true);
  const [useCaseFiltersOpen, setUseCaseFiltersOpen] = useState(false);
  const [collapsedCategoryKeys, setCollapsedCategoryKeys] = useState<
    Set<string>
  >(new Set());
  const [hiddenCategoryLabels, setHiddenCategoryLabels] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenUseCaseLabels, setHiddenUseCaseLabels] = useState<Set<string>>(
    new Set(),
  );
  const [activeCategoryLabel, setActiveCategoryLabel] = useState<string>();
  const [toolbarMinimized, setToolbarMinimized] = useState(false);
  const [fontPreferences, setFontPreferences] =
    useState<IdentityFontPreferences>(EMPTY_IDENTITY_FONT_PREFERENCES);
  const [fontPreferencesReady, setFontPreferencesReady] = useState(false);
  const [fontPreferenceError, setFontPreferenceError] = useState<string>();
  const [snackbarMessage, setSnackbarMessage] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const deferredSearch = useDeferredValue(search);
  const typographySettingsReference = useRef<HTMLDivElement>(null);
  const typographySettingsButtonReference = useRef<HTMLButtonElement>(null);
  const fontColorSettingsReference = useRef<HTMLDivElement>(null);
  const fontColorSettingsButtonReference = useRef<HTMLButtonElement>(null);
  const backgroundSettingsReference = useRef<HTMLDivElement>(null);
  const backgroundSettingsButtonReference = useRef<HTMLButtonElement>(null);
  const backgroundImageInputReference = useRef<HTMLInputElement>(null);
  const specimenInputReference = useRef<HTMLTextAreaElement>(null);
  const fileMenuReference = useRef<HTMLDivElement>(null);
  const fileMenuButtonReference = useRef<HTMLButtonElement>(null);
  const fontCatalogReference = useRef<HTMLElement>(null);
  const fontSizeValueTimeoutReference = useRef<number>();
  const fontPreferencesReference = useRef(fontPreferences);
  const snackbarTimeoutReference = useRef<number>();
  const {
    toolbarBoundaryReference,
    toolbarFloating,
    toolbarHeight,
    toolbarReference,
  } = useFloatingToolbar();

  useEffect(() => {
    setToolbarMinimized(toolbarFloating);
  }, [toolbarFloating]);

  useEffect(() => {
    const clearSnackbarTimeout = () => {
      if (snackbarTimeoutReference.current === undefined) return;

      window.clearTimeout(snackbarTimeoutReference.current);
      snackbarTimeoutReference.current = undefined;
    };

    if (!fontPreferenceError && !setActionError && !setActionMessage) {
      return clearSnackbarTimeout;
    }

    const message = fontPreferenceError ?? setActionError ?? setActionMessage;

    if (!message) return clearSnackbarTimeout;

    setSnackbarMessage(message);
    clearSnackbarTimeout();
    snackbarTimeoutReference.current = window.setTimeout(() => {
      setSnackbarMessage(undefined);
      snackbarTimeoutReference.current = undefined;
    }, 2600);

    return clearSnackbarTimeout;
  }, [fontPreferenceError, setActionError, setActionMessage]);

  useEffect(() => {
    const onResize = () => {
      setIsSmallViewport(window.innerWidth < 768);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (fontSizeValueTimeoutReference.current !== undefined) {
        window.clearTimeout(fontSizeValueTimeoutReference.current);
      }
    };
  }, []);

  const clearFontSizeValueTimeout = () => {
    if (fontSizeValueTimeoutReference.current === undefined) return;

    window.clearTimeout(fontSizeValueTimeoutReference.current);
    fontSizeValueTimeoutReference.current = undefined;
  };

  const scheduleHideFontSizeValue = (delay = 900) => {
    clearFontSizeValueTimeout();
    fontSizeValueTimeoutReference.current = window.setTimeout(() => {
      setShowFontSizeValue(false);
      fontSizeValueTimeoutReference.current = undefined;
    }, delay);
  };

  const commitFontSize = (nextFontSize: number) => {
    setFontSize(nextFontSize);
    setPendingFontSize(undefined);
  };

  useEffect(() => {
    if (!isSmallViewport) return;
    if (fontSize <= MOBILE_FONT_SIZE_MAX) return;

    setFontSize(MOBILE_FONT_SIZE_MAX);
  }, [fontSize, isSmallViewport]);

  useEffect(() => {
    let active = true;

    listFontCatalog()
      .then((catalog) => {
        if (active) setFonts(catalog);
      })
      .catch(() => {
        if (active) setErrorMessage("Could not load the private font catalog.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    loadIdentityFontPreferences()
      .then((preferences) => {
        if (!active) return;

        fontPreferencesReference.current = preferences;
        setFontPreferences(preferences);
      })
      .catch(() => {
        if (active) {
          setFontPreferenceError(
            "Could not load saved pins and favorites. Changes may not persist.",
          );
        }
      })
      .finally(() => {
        if (active) setFontPreferencesReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const commitFontPreferences = (
    update: (current: IdentityFontPreferences) => IdentityFontPreferences,
  ) => {
    const previous = fontPreferencesReference.current;
    const next = update(previous);

    fontPreferencesReference.current = next;
    setFontPreferences(next);
    setFontPreferenceError(undefined);

    void saveIdentityFontPreferences(next).catch(() => {
      if (fontPreferencesReference.current === next) {
        fontPreferencesReference.current = previous;
        setFontPreferences(previous);
      }

      setFontPreferenceError("Could not save pins and favorites. Try again.");
    });
  };

  const toggleFavorite = (font: FontCatalogItem) => {
    commitFontPreferences((current) => {
      const favoriteFontIds = current.favoriteFontIds.includes(font.id)
        ? current.favoriteFontIds.filter((fontId) => fontId !== font.id)
        : [...current.favoriteFontIds, font.id];

      return { ...current, favoriteFontIds };
    });
  };

  const togglePinned = (font: FontCatalogItem) => {
    commitFontPreferences((current) => {
      const pinnedFontIds = current.pinnedFontIds.includes(font.id)
        ? current.pinnedFontIds.filter((fontId) => fontId !== font.id)
        : [...current.pinnedFontIds, font.id];

      return { ...current, pinnedFontIds };
    });
  };

  useEffect(() => {
    if (!typographySettingsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !typographySettingsReference.current?.contains(event.target)
      ) {
        setTypographySettingsOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setTypographySettingsOpen(false);
      typographySettingsButtonReference.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [typographySettingsOpen]);

  useEffect(() => {
    if (!fontColorSettingsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !fontColorSettingsReference.current?.contains(event.target)
      ) {
        setFontColorSettingsOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFontColorSettingsOpen(false);
      fontColorSettingsButtonReference.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [fontColorSettingsOpen]);

  useEffect(() => {
    if (!backgroundSettingsOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !backgroundSettingsReference.current?.contains(event.target)
      ) {
        setBackgroundSettingsOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setBackgroundSettingsOpen(false);
      backgroundSettingsButtonReference.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [backgroundSettingsOpen]);

  useEffect(() => {
    if (!fileMenuOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !fileMenuReference.current?.contains(event.target)
      ) {
        setFileMenuOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFileMenuOpen(false);
      fileMenuButtonReference.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [fileMenuOpen]);

  useEffect(() => {
    const imageUrl =
      backgroundImage?.source === "local" ? backgroundImage.url : undefined;

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [backgroundImage?.source, backgroundImage?.url]);

  useLayoutEffect(() => {
    const specimenInput = specimenInputReference.current;

    if (!specimenInput) return;

    specimenInput.style.height = "auto";

    const styles = window.getComputedStyle(specimenInput);
    const fontSize = Number.parseFloat(styles.fontSize);
    const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.2;
    const verticalPadding =
      Number.parseFloat(styles.paddingTop) +
      Number.parseFloat(styles.paddingBottom);
    const verticalBorder =
      Number.parseFloat(styles.borderTopWidth) +
      Number.parseFloat(styles.borderBottomWidth);
    const maximumHeight = lineHeight * 3 + verticalPadding + verticalBorder;
    const nextHeight = Math.min(specimenInput.scrollHeight, maximumHeight);

    specimenInput.style.height = `${nextHeight}px`;
    specimenInput.style.overflowY =
      specimenInput.scrollHeight > maximumHeight ? "auto" : "hidden";
  }, [specimen]);

  const categoriesInUse = useMemo(() => {
    const labels = new Set<string>();

    for (const font of fonts) {
      labels.add(font.parentCategory ?? UNCATEGORIZED_LABEL);
    }

    const entries = [...labels];

    return entries.sort(compareFontFilterCategoryLabels);
  }, [fonts]);
  const allCategoriesSelected =
    categoriesInUse.length > 0 && hiddenCategoryLabels.size === 0;
  const useCasesInUse = useMemo(() => {
    const labels = new Set<string>(FONT_USE_CASES);

    for (const font of fonts) {
      if (font.useCases.length === 0) {
        labels.add(UNASSIGNED_USE_CASE_LABEL);
      } else {
        for (const useCase of font.useCases) labels.add(useCase);
      }
    }

    return [...labels].sort((left, right) => {
      if (left === UNASSIGNED_USE_CASE_LABEL) return 1;
      if (right === UNASSIGNED_USE_CASE_LABEL) return -1;

      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });
  }, [fonts]);
  const allUseCasesSelected =
    useCasesInUse.length > 0 && hiddenUseCaseLabels.size === 0;

  const fontSections = useMemo(() => {
    const term = deferredSearch.trim().toLocaleLowerCase();
    const favoriteFontIds = new Set(fontPreferences.favoriteFontIds);
    const pinnedFontIds = new Set(fontPreferences.pinnedFontIds);
    const fontsById = new Map(fonts.map((font) => [font.id, font]));
    const getFontCategoryLabel = (font: FontCatalogItem) =>
      font.parentCategory ?? UNCATEGORIZED_LABEL;
    const getFontUseCaseLabels = (font: FontCatalogItem) =>
      font.useCases.length > 0 ? font.useCases : [UNASSIGNED_USE_CASE_LABEL];
    const isEligible = (font: FontCatalogItem) =>
      !fontPreferences.showOnlyFavorites || favoriteFontIds.has(font.id);
    const isVisibleCategory = (font: FontCatalogItem) =>
      !hiddenCategoryLabels.has(getFontCategoryLabel(font));
    const isVisibleUseCase = (font: FontCatalogItem) =>
      getFontUseCaseLabels(font).some(
        (useCaseLabel) => !hiddenUseCaseLabels.has(useCaseLabel),
      );
    const pinnedFonts = fontPreferences.pinnedFontIds
      .map((fontId) => fontsById.get(fontId))
      .filter(
        (font): font is FontCatalogItem =>
          font !== undefined &&
          isEligible(font) &&
          isVisibleCategory(font) &&
          isVisibleUseCase(font),
      );
    const visibleFonts = fonts.filter(
      (font) =>
        !pinnedFontIds.has(font.id) &&
        isEligible(font) &&
        isVisibleCategory(font) &&
        isVisibleUseCase(font) &&
        (!term ||
          `${font.name} ${font.formats.join(" ")}`
            .toLocaleLowerCase()
            .includes(term)),
    );
    const categorizedFonts = new Map<string, FontCatalogItem[]>();
    const uncategorizedFonts: FontCatalogItem[] = [];

    for (const font of visibleFonts) {
      if (!font.parentCategory) {
        uncategorizedFonts.push(font);
        continue;
      }

      const categoryFonts = categorizedFonts.get(font.parentCategory) ?? [];
      categoryFonts.push(font);
      categorizedFonts.set(font.parentCategory, categoryFonts);
    }

    const sections = [...categorizedFonts.entries()]
      .sort(([leftCategory], [rightCategory]) =>
        compareFontSectionCategoryLabels(leftCategory, rightCategory),
      )
      .map(([name, sectionFonts]) => ({
        key: `category-${name}`,
        label: `category: ${name}`,
        name,
        fonts: sectionFonts,
      }));

    if (pinnedFonts.length > 0) {
      sections.unshift({
        key: "pinned",
        label: "pinned fonts",
        name: "Pinned",
        fonts: pinnedFonts,
      });
    }

    if (uncategorizedFonts.length > 0) {
      sections.push({
        key: "uncategorized",
        label: "category: Uncategorized",
        name: "Uncategorized",
        fonts: uncategorizedFonts,
      });
    }

    return sections;
  }, [
    deferredSearch,
    fontPreferences,
    fonts,
    hiddenCategoryLabels,
    hiddenUseCaseLabels,
  ]);

  useEffect(() => {
    let animationFrame = 0;

    const updateActiveCategory = () => {
      animationFrame = 0;

      const categoryHeaders =
        fontCatalogReference.current?.querySelectorAll<HTMLElement>(
          "[data-font-category-label]",
        );
      const firstCategoryHeader = categoryHeaders?.item(0);

      if (
        !firstCategoryHeader ||
        firstCategoryHeader.getBoundingClientRect().bottom > 0
      ) {
        setActiveCategoryLabel(undefined);
        return;
      }

      const viewportMiddle = window.innerHeight / 2;
      let nextCategoryLabel: string | undefined;

      for (const categoryHeader of categoryHeaders ?? []) {
        if (categoryHeader.getBoundingClientRect().top > viewportMiddle) break;

        nextCategoryLabel = categoryHeader.dataset.fontCategoryLabel;
      }

      setActiveCategoryLabel(nextCategoryLabel);
    };

    const scheduleUpdate = () => {
      if (animationFrame !== 0) return;

      animationFrame = window.requestAnimationFrame(updateActiveCategory);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    const catalog = fontCatalogReference.current;

    if (catalog) resizeObserver.observe(catalog);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
    };
  }, [collapsedCategoryKeys, fontSections]);

  const displayedFontCount = useMemo(
    () =>
      fontSections.reduce((total, section) => total + section.fonts.length, 0),
    [fontSections],
  );

  const changeParentCategory = async (
    font: FontCatalogItem,
    parentCategory: string | null,
  ) => {
    const previousCategory = font.parentCategory;

    setErrorMessage(undefined);
    setUpdatingCategoryIds((current) => new Set(current).add(font.id));
    setFonts((current) =>
      current.map((item) =>
        item.id === font.id ? { ...item, parentCategory } : item,
      ),
    );

    try {
      await updateFontParentCategory(font, parentCategory);
    } catch {
      setFonts((current) =>
        current.map((item) =>
          item.id === font.id
            ? { ...item, parentCategory: previousCategory }
            : item,
        ),
      );
      setErrorMessage(`Could not update “${font.name}”. Try again.`);
    } finally {
      setUpdatingCategoryIds((current) => {
        const next = new Set(current);
        next.delete(font.id);
        return next;
      });
    }
  };

  const changeFontVisibility = async (
    font: FontCatalogItem,
    enabled: boolean,
  ) => {
    const previousEnabled = font.enabled;

    setErrorMessage(undefined);
    setUpdatingVisibilityIds((current) => new Set(current).add(font.id));
    setFonts((current) =>
      current.map((item) =>
        item.id === font.id ? { ...item, enabled } : item,
      ),
    );

    try {
      await updateFontEnabled(font, enabled);
    } catch {
      setFonts((current) =>
        current.map((item) =>
          item.id === font.id ? { ...item, enabled: previousEnabled } : item,
        ),
      );
      setErrorMessage(
        `Could not update production visibility for “${font.name}”. Try again.`,
      );
    } finally {
      setUpdatingVisibilityIds((current) => {
        const next = new Set(current);
        next.delete(font.id);
        return next;
      });
    }
  };

  const changeUseCases = async (font: FontCatalogItem, useCases: string[]) => {
    const previousUseCases = font.useCases;

    setErrorMessage(undefined);
    setUpdatingUseCasesIds((current) => new Set(current).add(font.id));
    setFonts((current) =>
      current.map((item) =>
        item.id === font.id ? { ...item, useCases } : item,
      ),
    );

    try {
      await updateFontUseCases(font, useCases);
    } catch {
      setFonts((current) =>
        current.map((item) =>
          item.id === font.id ? { ...item, useCases: previousUseCases } : item,
        ),
      );
      setErrorMessage(`Could not update “${font.name}”. Try again.`);
    } finally {
      setUpdatingUseCasesIds((current) => {
        const next = new Set(current);
        next.delete(font.id);
        return next;
      });
    }
  };

  const deleteFont = async (font: FontCatalogItem) => {
    setFontPendingDeletion(undefined);
    setErrorMessage(undefined);
    setDeletingFontIds((current) => new Set(current).add(font.id));

    try {
      await deleteFontCatalogItem(font);
      setFonts((current) => current.filter((item) => item.id !== font.id));
    } catch {
      setErrorMessage(`Could not delete “${font.name}”. Try again.`);
    } finally {
      setDeletingFontIds((current) => {
        const next = new Set(current);
        next.delete(font.id);
        return next;
      });
    }
  };

  const selectBackgroundImage = (file?: File) => {
    if (!file) return;

    if (!ACCEPTED_BACKGROUND_IMAGE_TYPES.has(file.type)) {
      setBackgroundImageError("Choose a JPG, PNG or WEBP image.");
      return;
    }

    if (file.size > MAX_BACKGROUND_IMAGE_SIZE) {
      setBackgroundImageError("Image must be 15 MB or smaller.");
      return;
    }

    setBackgroundImageError(undefined);
    setBackgroundImage({
      file,
      name: file.name,
      source: "local",
      url: URL.createObjectURL(file),
    });
    setBackgroundMode("image");
  };

  const loadSavedSets = async () => {
    setSavedSetsLoading(true);
    setSetActionError(undefined);

    try {
      const browserId = getIdentityBrowserId();
      const nextSavedSets = await listIdentityFontSets(browserId);
      setSavedSets(nextSavedSets);
      setSelectedSavedSetId((currentSelection) => {
        if (
          currentSelection &&
          nextSavedSets.some((set) => set.id === currentSelection)
        ) {
          return currentSelection;
        }

        return nextSavedSets[0]?.id;
      });
    } catch {
      setSetActionError("Could not load saved sets. Try again.");
    } finally {
      setSavedSetsLoading(false);
    }
  };

  const saveCurrentSet = async () => {
    setSavingSet(true);
    setSetActionMessage(undefined);
    setSetActionError(undefined);

    try {
      const browserId = getIdentityBrowserId();

      await saveIdentityFontSet({
        backgroundColor,
        backgroundImageFile:
          backgroundImage?.source === "local"
            ? backgroundImage.file
            : undefined,
        backgroundImageName: backgroundImage?.name,
        backgroundImageStoragePath:
          backgroundImage?.source === "remote"
            ? backgroundImage.storagePath
            : undefined,
        backgroundMode,
        browserId,
        favoriteFontIds: fontPreferences.favoriteFontIds,
        fontColor,
        fontSize,
        fontWeight: serializeFontWeight(fontWeight),
        letterSpacing,
        lineHeight,
        pinnedFontIds: fontPreferences.pinnedFontIds,
        search,
        showOnlyFavorites: fontPreferences.showOnlyFavorites,
        specimen,
        textAlignment,
        textShadow,
      });

      setSetActionMessage("Set saved.");
      if (savedSetsOpen) {
        await loadSavedSets();
      }
    } catch {
      setSetActionError("Could not save this set. Try again.");
    } finally {
      setSavingSet(false);
      setFileMenuOpen(false);
    }
  };

  const selectedSavedSet = savedSets.find(
    (set) => set.id === selectedSavedSetId,
  );

  const applySelectedSet = () => {
    if (!selectedSavedSet) return;

    const loadedPreferences: IdentityFontPreferences = {
      favoriteFontIds: selectedSavedSet.favoriteFontIds,
      pinnedFontIds: selectedSavedSet.pinnedFontIds,
      showOnlyFavorites: selectedSavedSet.showOnlyFavorites,
    };

    setSpecimen(selectedSavedSet.specimen);
    setSearch(selectedSavedSet.search);
    setFontColor(selectedSavedSet.fontColor);
    setBackgroundColor(selectedSavedSet.background.color);
    setFontSize(selectedSavedSet.fontSize);
    setFontWeight(readFontWeight(selectedSavedSet.fontWeight));
    setLineHeight(selectedSavedSet.lineHeight);
    setLetterSpacing(selectedSavedSet.letterSpacing);
    setTextAlignment(selectedSavedSet.textAlignment);
    setTextShadow(selectedSavedSet.textShadow);

    if (
      selectedSavedSet.background.mode === "image" &&
      selectedSavedSet.background.imageUrl
    ) {
      setBackgroundImage({
        name: selectedSavedSet.background.imageName ?? "Saved image",
        source: "remote",
        storagePath: selectedSavedSet.background.imageStoragePath,
        url: selectedSavedSet.background.imageUrl,
      });
      setBackgroundMode("image");
      setBackgroundImageError(undefined);
    } else {
      setBackgroundImage(undefined);
      setBackgroundMode("color");
      setBackgroundImageError(undefined);
    }

    // Loaded sets must apply immediately in UI even if persistence fails.
    fontPreferencesReference.current = loadedPreferences;
    setFontPreferences(loadedPreferences);
    setFontPreferenceError(undefined);
    void saveIdentityFontPreferences(loadedPreferences).catch(() => {
      setFontPreferenceError("Could not save pins and favorites. Try again.");
    });

    setLoadSetConfirmationOpen(false);
    setSavedSetsOpen(false);
    setSetActionError(undefined);
    setSetActionMessage("Set loaded.");
  };

  return (
    <main
      className="min-h-[100dvh] overflow-x-hidden bg-black px-5 py-5 text-white sm:px-8 sm:py-7 lg:px-10"
      style={{ fontFamily: "'Departure Mono', 'Courier New', monospace" }}
    >
      <ActiveCategoryRail label={activeCategoryLabel} />
      <ScrollControls />
      <IdentityFontsOnboarding />

      <div className="mx-auto max-w-[92rem]">
        <header className="relative border-b border-white/50 pb-0">
          <div className="flex items-baseline justify-between gap-6">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center text-[0.7rem] font-normal tracking-[0.02em] text-white/70 lowercase"
            >
              <img
                alt="Strange Animals"
                className="h-auto w-32 opacity-80"
                decoding="async"
                src="/media/images/logos/sa-logo.png"
              />
              <span
                aria-hidden="true"
                className="ml-[9px] mr-[7px] text-white/45"
              >
                |
              </span>
              <span>identity</span>
              <span aria-hidden="true" className="mx-2 text-white/45">
                &gt;
              </span>
              <h1 className="inline font-normal">typography</h1>
            </nav>
          </div>

          {SHOW_FONT_DELETE_CONTROLS ? (
            <div className="mt-4 flex items-center gap-4">
              <div ref={fileMenuReference} className="relative">
                <button
                  ref={fileMenuButtonReference}
                  aria-controls="identity-file-menu"
                  aria-expanded={fileMenuOpen}
                  className="flex h-8 cursor-pointer items-center gap-2 px-1 text-[0.625rem] tracking-[0.12em] text-white/70 underline-offset-4 hover:text-white hover:underline"
                  type="button"
                  onClick={() => {
                    setFileMenuOpen((open) => !open);
                    setFontColorSettingsOpen(false);
                    setBackgroundSettingsOpen(false);
                    setTypographySettingsOpen(false);
                  }}
                >
                  File
                  <ChevronDown aria-hidden="true" className="size-3" />
                </button>

                {fileMenuOpen ? (
                  <div
                    className="absolute top-full left-0 z-50 mt-2 w-52 border border-white/45 bg-black py-2"
                    id="identity-file-menu"
                  >
                    <button
                      className="flex h-9 w-full cursor-pointer items-center px-3 text-left text-[0.625rem] tracking-[0.1em] text-white/70 hover:bg-white hover:text-black disabled:cursor-wait disabled:opacity-45"
                      disabled={savingSet}
                      type="button"
                      onClick={() => {
                        void saveCurrentSet();
                      }}
                    >
                      Save set
                    </button>
                    <button
                      className="flex h-9 w-full cursor-pointer items-center px-3 text-left text-[0.625rem] tracking-[0.1em] text-white/70 hover:bg-white hover:text-black"
                      type="button"
                      onClick={() => {
                        setSavedSetsOpen(true);
                        setLoadSetConfirmationOpen(false);
                        setFileMenuOpen(false);
                        void loadSavedSets();
                      }}
                    >
                      View Saved Sets
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            hidden={!toolbarFloating}
            aria-hidden="true"
            className="mt-10"
            style={{ height: `${toolbarHeight}px` }}
          />

          <div
            ref={toolbarReference}
            className={`${FONT_TOOLBAR_GRID_CLASS} [&_*]:!tracking-normal ${getToolbarPlacementClass(toolbarFloating, toolbarMinimized)}`}
            id="font-toolbar"
          >
            <button
              aria-label="Minimize font toolbar"
              className={getToolbarMinimizeButtonClass(toolbarFloating)}
              disabled={!toolbarFloating}
              title="Minimize toolbar"
              type="button"
              onClick={() => {
                setBackgroundSettingsOpen(false);
                setFontColorSettingsOpen(false);
                setTypographySettingsOpen(false);
                setToolbarMinimized(true);
              }}
            >
              <Minus aria-hidden="true" className="size-4" />
            </button>

            <label className="col-span-2 block md:col-span-1">
              <span className="mb-2 block text-[0.625rem] tracking-[0.12em] text-white/75">
                Demo text
              </span>
              <textarea
                ref={specimenInputReference}
                className="block w-full resize-none overflow-y-auto rounded-none border border-white/35 bg-black px-3 py-[0.7rem] text-xs leading-normal text-white outline-none placeholder:text-white/35"
                rows={1}
                value={specimen}
                onChange={(event) => {
                  setSpecimen(event.target.value);
                }}
              />
            </label>

            <label className="col-span-2 block md:col-span-1">
              <span className="mb-2 block text-[0.625rem] tracking-[0.12em] text-white/75">
                Search fonts
              </span>
              <input
                className="h-10 w-full rounded-none border border-white/35 bg-black px-3 text-xs text-white outline-none placeholder:text-white/35"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
              />
            </label>

            <div className="col-span-2 flex flex-nowrap items-start justify-center gap-3 xl:justify-start">
              <div
                ref={fontColorSettingsReference}
                className="relative block w-[5.25rem] shrink-0 sm:w-[7rem] xl:-mr-4"
              >
                <span className="mb-2 block whitespace-nowrap text-center text-[0.625rem] tracking-[0.12em] text-white/75 xl:text-left">
                  Font color
                </span>
                <span className="flex h-10 items-center justify-center xl:justify-start">
                  <button
                    ref={fontColorSettingsButtonReference}
                    aria-controls="font-color-settings"
                    aria-expanded={fontColorSettingsOpen}
                    aria-label="Font color settings"
                    className="size-6 cursor-pointer border border-white/35 outline-none focus:outline-none focus-visible:outline-none"
                    style={{ backgroundColor: fontColor }}
                    type="button"
                    onClick={() => {
                      setFontColorSettingsOpen((open) => !open);
                      setBackgroundSettingsOpen(false);
                      setTypographySettingsOpen(false);
                    }}
                  />
                </span>

                {fontColorSettingsOpen ? (
                  <div
                    aria-labelledby="font-color-settings-title"
                    className={`absolute right-0 left-auto z-50 w-64 max-w-[calc(100vw-2.5rem)] border border-white/45 bg-black p-4 md:right-auto md:left-0 ${getToolbarPopoverPlacementClass()}`}
                    id="font-color-settings"
                  >
                    <h2
                      className="text-[0.625rem] font-normal text-white/70"
                      id="font-color-settings-title"
                    >
                      Font color
                    </h2>
                    <label className="mt-5 flex items-center justify-between gap-4">
                      <span className="text-[0.625rem] text-white/60">
                        Fill color
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-[0.625rem] text-white/55">
                          {fontColor}
                        </span>
                        <input
                          aria-label="Choose font color"
                          className="identity-color-picker"
                          type="color"
                          value={fontColor}
                          onChange={(event) => {
                            setFontColor(event.target.value);
                          }}
                        />
                      </span>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 self-start xl:-mr-4 xl:-translate-x-10">
                <span
                  aria-hidden="true"
                  className="mb-2 block text-[0.625rem] tracking-[0.12em] text-transparent uppercase"
                >
                  Swap
                </span>
                <span className="flex h-10 items-center justify-center">
                  <button
                    aria-label="Swap font and background colors"
                    className="flex h-5 w-6 cursor-pointer items-center justify-center border border-white/35 text-white/65 outline-none hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
                    title="Swap colors"
                    type="button"
                    onClick={() => {
                      setFontColor(backgroundColor);
                      setBackgroundColor(fontColor);
                    }}
                  >
                    <ArrowLeftRight
                      aria-hidden="true"
                      className="size-[0.8rem]"
                    />
                  </button>
                </span>
              </div>

              <div
                ref={backgroundSettingsReference}
                className="relative w-[5.25rem] shrink-0 self-start sm:w-[7rem] xl:-mr-2"
              >
                <span className="mb-2 block whitespace-nowrap text-center text-[0.625rem] tracking-[0.12em] text-white/75 xl:text-left">
                  Background
                </span>
                <span className="flex h-10 items-center justify-center xl:justify-start">
                  <button
                    ref={backgroundSettingsButtonReference}
                    aria-controls="background-settings"
                    aria-expanded={backgroundSettingsOpen}
                    aria-label="Background settings"
                    className="size-6 cursor-pointer border border-white/35 bg-transparent bg-cover bg-center outline-none focus:outline-none focus-visible:outline-none"
                    style={{
                      backgroundColor:
                        backgroundMode === "color"
                          ? backgroundColor
                          : "#000000",
                      backgroundImage:
                        backgroundMode === "image" && backgroundImage
                          ? `url(${backgroundImage.url})`
                          : undefined,
                    }}
                    type="button"
                    onClick={() => {
                      setBackgroundSettingsOpen((open) => !open);
                      setFontColorSettingsOpen(false);
                      setTypographySettingsOpen(false);
                    }}
                  />
                </span>

                {backgroundSettingsOpen ? (
                  <div
                    aria-labelledby="background-settings-title"
                    className={`absolute right-0 left-auto z-50 w-72 max-w-[calc(100vw-2.5rem)] border border-white/45 bg-black p-4 md:right-auto md:left-0 ${getToolbarPopoverPlacementClass()}`}
                    id="background-settings"
                  >
                    <h2
                      className="mb-4 text-[0.625rem] font-normal text-white/70"
                      id="background-settings-title"
                    >
                      Background
                    </h2>
                    <div
                      aria-label="Background type"
                      className="grid grid-cols-2 border border-white/35"
                      role="group"
                    >
                      <button
                        aria-pressed={backgroundMode === "color"}
                        className={`h-8 cursor-pointer text-[0.625rem] tracking-[0.1em] uppercase ${backgroundMode === "color" ? "bg-white text-black" : "bg-black text-white/60 hover:text-white"}`}
                        type="button"
                        onClick={() => {
                          setBackgroundMode("color");
                        }}
                      >
                        Color
                      </button>
                      <button
                        aria-pressed={backgroundMode === "image"}
                        className={`h-8 cursor-pointer border-l border-white/35 text-[0.625rem] tracking-[0.1em] uppercase ${backgroundMode === "image" ? "bg-white text-black" : "bg-black text-white/60 hover:text-white"}`}
                        type="button"
                        onClick={() => {
                          setBackgroundMode("image");
                        }}
                      >
                        Image
                      </button>
                    </div>

                    {backgroundMode === "color" ? (
                      <label className="mt-5 flex items-center justify-between gap-4">
                        <span className="text-[0.625rem] tracking-[0.08em] text-white/60 uppercase">
                          Fill color
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-[0.625rem] text-white/55 uppercase">
                            {backgroundColor}
                          </span>
                          <input
                            className="identity-color-picker"
                            type="color"
                            value={backgroundColor}
                            onChange={(event) => {
                              setBackgroundColor(event.target.value);
                            }}
                          />
                        </span>
                      </label>
                    ) : (
                      <div className="mt-5">
                        <input
                          ref={backgroundImageInputReference}
                          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                          className="sr-only"
                          type="file"
                          onChange={(event) => {
                            selectBackgroundImage(event.target.files?.[0]);
                            event.currentTarget.value = "";
                          }}
                        />

                        {backgroundImage ? (
                          <>
                            <div
                              aria-label={`Selected background image: ${backgroundImage.name}`}
                              className="h-24 border border-white/35 bg-cover bg-center"
                              role="img"
                              style={{
                                backgroundImage: `url(${backgroundImage.url})`,
                              }}
                            />
                            <p
                              className="mt-2 overflow-hidden text-[0.625rem] text-white/60 text-ellipsis whitespace-nowrap"
                              title={backgroundImage.name}
                            >
                              {backgroundImage.name}
                            </p>
                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <button
                                className="flex h-8 cursor-pointer items-center justify-center gap-2 border border-white/35 text-[0.625rem] text-white/65 uppercase hover:border-white/60 hover:text-white"
                                type="button"
                                onClick={() => {
                                  backgroundImageInputReference.current?.click();
                                }}
                              >
                                <Upload aria-hidden="true" className="size-3" />
                                Replace
                              </button>
                              <button
                                className="flex h-8 cursor-pointer items-center justify-center gap-2 border border-white/35 text-[0.625rem] text-white/65 uppercase hover:border-white/60 hover:text-white"
                                type="button"
                                onClick={() => {
                                  setBackgroundImage(undefined);
                                  setBackgroundImageError(undefined);
                                  setBackgroundMode("color");
                                }}
                              >
                                <X aria-hidden="true" className="size-3" />
                                Remove
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            className="flex min-h-28 w-full cursor-pointer flex-col items-center justify-center gap-3 border border-white/35 px-4 text-center text-white/60 hover:border-white/60 hover:text-white"
                            type="button"
                            onClick={() => {
                              backgroundImageInputReference.current?.click();
                            }}
                            onDragOver={(event) => {
                              event.preventDefault();
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              selectBackgroundImage(
                                event.dataTransfer.files[0],
                              );
                            }}
                          >
                            <ImageIcon aria-hidden="true" className="size-5" />
                            <span className="text-[0.625rem] tracking-[0.08em] uppercase">
                              Choose or drop image
                            </span>
                            <span className="text-[0.5625rem] text-white/40 uppercase">
                              JPG, PNG or WEBP · max 15 MB
                            </span>
                          </button>
                        )}

                        {backgroundImageError ? (
                          <p
                            className="mt-3 text-[0.625rem] text-white/65"
                            role="alert"
                          >
                            {backgroundImageError}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            <div
              ref={typographySettingsReference}
              className="relative col-span-2 flex items-start self-start gap-6 justify-self-center pt-0 xl:justify-self-start xl:pt-[1.125rem] xl:-ml-4 xl:col-span-1"
            >
              <label className="flex h-11 w-52 items-center gap-3 text-white/70 md:h-10 md:w-40">
                <span aria-hidden="true" className="text-sm">
                  A
                </span>
                <span className="sr-only">Text size</span>
                <span className="relative flex flex-1 items-center">
                  {showFontSizeValue ? (
                    <span className="pointer-events-none absolute -top-[1.5625rem] left-1/2 z-0 -translate-x-1/2 border border-white/35 bg-black px-2.5 py-px text-[0.625rem] leading-none tracking-[0.08em] text-white/70 uppercase">
                      {pendingFontSize ?? fontSize}px
                    </span>
                  ) : null}
                  <input
                    aria-label="Text size"
                    className="identity-font-size-control-slider identity-font-size-slider relative z-10 w-full"
                    max={
                      isSmallViewport
                        ? MOBILE_FONT_SIZE_MAX
                        : DESKTOP_FONT_SIZE_MAX
                    }
                    min="8"
                    step="1"
                    type="range"
                    value={pendingFontSize ?? fontSize}
                    onBlur={() => {
                      commitFontSize(pendingFontSize ?? fontSize);
                      scheduleHideFontSizeValue(250);
                    }}
                    onChange={(event) => {
                      setShowFontSizeValue(true);
                      setPendingFontSize(Number(event.target.value));
                    }}
                    onFocus={() => {
                      setShowFontSizeValue(true);
                    }}
                    onKeyUp={(event) => {
                      commitFontSize(Number(event.currentTarget.value));
                    }}
                    onPointerEnter={() => {
                      setShowFontSizeValue(true);
                      clearFontSizeValueTimeout();
                    }}
                    onPointerLeave={() => {
                      scheduleHideFontSizeValue(250);
                    }}
                    onPointerDown={() => {
                      setShowFontSizeValue(true);
                      clearFontSizeValueTimeout();
                    }}
                    onPointerUp={(event) => {
                      commitFontSize(Number(event.currentTarget.value));
                      scheduleHideFontSizeValue(250);
                    }}
                  />
                </span>
                <span aria-hidden="true" className="text-2xl leading-none">
                  A
                </span>
              </label>

              <button
                ref={typographySettingsButtonReference}
                aria-controls="typography-settings"
                aria-expanded={typographySettingsOpen}
                aria-label="Typography settings"
                className="flex size-10 shrink-0 cursor-pointer items-center justify-center bg-transparent text-white/65 shadow-none outline-none hover:text-white focus:outline-none focus-visible:outline-none"
                type="button"
                onClick={() => {
                  setTypographySettingsOpen((open) => !open);
                  setFontColorSettingsOpen(false);
                  setBackgroundSettingsOpen(false);
                }}
              >
                <Settings aria-hidden="true" className="size-4" />
              </button>

              {typographySettingsOpen ? (
                <div
                  className={`absolute right-0 z-50 w-64 border border-white/45 bg-black p-4 ${getToolbarPopoverPlacementClass()}`}
                  id="typography-settings"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <span className="text-[0.625rem] tracking-[0.12em] text-white/55">
                      Typography
                    </span>
                    <button
                      className="cursor-pointer text-[0.625rem] tracking-[0.08em] text-white/55 hover:text-white"
                      type="button"
                      onClick={() => {
                        setLineHeight(DEFAULT_LINE_HEIGHT);
                        setLetterSpacing(DEFAULT_LETTER_SPACING);
                        setTextAlignment("left");
                        setFontWeight("normal");
                        setTextShadow(DEFAULT_TEXT_SHADOW);
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <FavoriteFilterControl
                    disabled={!fontPreferencesReady}
                    value={fontPreferences.showOnlyFavorites}
                    onChange={(showOnlyFavorites) => {
                      commitFontPreferences((current) => ({
                        ...current,
                        showOnlyFavorites,
                      }));
                    }}
                  />

                  <div className="mb-6 flex items-center justify-between gap-4">
                    <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
                      Alignment
                    </span>
                    <div
                      aria-label="Text alignment"
                      className="grid shrink-0 grid-cols-3 border border-white/35"
                      role="group"
                    >
                      <button
                        aria-label="Align text left"
                        aria-pressed={textAlignment === "left"}
                        className={`flex size-8 cursor-pointer items-center justify-center border-r border-white/35 outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${textAlignment === "left" ? "bg-white text-black hover:text-black" : "bg-black text-white/55"}`}
                        title="Align left"
                        type="button"
                        onClick={() => {
                          setTextAlignment("left");
                        }}
                      >
                        <AlignLeft aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label="Align text center"
                        aria-pressed={textAlignment === "center"}
                        className={`flex size-8 cursor-pointer items-center justify-center border-r border-white/35 outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${textAlignment === "center" ? "bg-white text-black hover:text-black" : "bg-black text-white/55"}`}
                        title="Align center"
                        type="button"
                        onClick={() => {
                          setTextAlignment("center");
                        }}
                      >
                        <AlignCenter aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        aria-label="Align text right"
                        aria-pressed={textAlignment === "right"}
                        className={`flex size-8 cursor-pointer items-center justify-center outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${textAlignment === "right" ? "bg-white text-black hover:text-black" : "bg-black text-white/55"}`}
                        title="Align right"
                        type="button"
                        onClick={() => {
                          setTextAlignment("right");
                        }}
                      >
                        <AlignRight aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  </div>

                  <FontWeightControl
                    value={fontWeight}
                    onChange={setFontWeight}
                  />

                  <div className="mb-6">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
                        Text shadow
                      </span>
                      <button
                        aria-checked={textShadow.enabled}
                        aria-label="Toggle text shadow"
                        className="relative h-5 w-10 shrink-0 cursor-pointer bg-transparent outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
                        role="switch"
                        type="button"
                        onClick={() => {
                          setTextShadow((current) => ({
                            ...current,
                            enabled: !current.enabled,
                          }));
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-white/35"
                        />
                        <span
                          aria-hidden="true"
                          className={`absolute top-1/2 left-1 size-2.5 -translate-y-1/2 rounded-full bg-white transition-transform duration-150 ${textShadow.enabled ? "translate-x-[1.375rem]" : "translate-x-0"}`}
                        />
                      </button>
                    </div>

                    {textShadow.enabled ? (
                      <div className="mt-4 space-y-4 border-t border-white/15 pt-4">
                        <label className="block">
                          <span className="mb-2 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                            <span>X offset</span>
                            <span>{textShadow.offsetX}px</span>
                          </span>
                          <input
                            className="identity-font-size-slider block w-full"
                            max="20"
                            min="-20"
                            step="1"
                            type="range"
                            value={textShadow.offsetX}
                            onChange={(event) => {
                              setTextShadow((current) => ({
                                ...current,
                                offsetX: Number(event.target.value),
                              }));
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                            <span>Y offset</span>
                            <span>{textShadow.offsetY}px</span>
                          </span>
                          <input
                            className="identity-font-size-slider block w-full"
                            max="20"
                            min="-20"
                            step="1"
                            type="range"
                            value={textShadow.offsetY}
                            onChange={(event) => {
                              setTextShadow((current) => ({
                                ...current,
                                offsetY: Number(event.target.value),
                              }));
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                            <span>Blur</span>
                            <span>{textShadow.blur}px</span>
                          </span>
                          <input
                            className="identity-font-size-slider block w-full"
                            max="20"
                            min="0"
                            step="1"
                            type="range"
                            value={textShadow.blur}
                            onChange={(event) => {
                              setTextShadow((current) => ({
                                ...current,
                                blur: Number(event.target.value),
                              }));
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                            <span>Opacity</span>
                            <span>{Math.round(textShadow.opacity * 100)}%</span>
                          </span>
                          <input
                            className="identity-font-size-slider block w-full"
                            max="1"
                            min="0"
                            step="0.05"
                            type="range"
                            value={textShadow.opacity}
                            onChange={(event) => {
                              setTextShadow((current) => ({
                                ...current,
                                opacity: Number(event.target.value),
                              }));
                            }}
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="mb-3 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                      <span>Line height</span>
                      <span>{lineHeight.toFixed(2)}</span>
                    </span>
                    <input
                      className="identity-font-size-slider block w-full"
                      max="2.5"
                      min="0.8"
                      step="0.05"
                      type="range"
                      value={lineHeight}
                      onChange={(event) => {
                        setLineHeight(Number(event.target.value));
                      }}
                    />
                  </label>

                  <label className="mt-6 block">
                    <span className="mb-3 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                      <span>Letter spacing</span>
                      <span>{letterSpacing.toFixed(2)} em</span>
                    </span>
                    <input
                      className="identity-font-size-slider block w-full"
                      max="0.5"
                      min="-0.1"
                      step="0.01"
                      type="range"
                      value={letterSpacing}
                      onChange={(event) => {
                        setLetterSpacing(Number(event.target.value));
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </div>
          {categoriesInUse.length > 0 ? (
            <div className="mt-4 border-t border-white/20">
              <button
                aria-controls="font-category-filters"
                aria-expanded={categoryFiltersOpen}
                className="flex w-full cursor-pointer items-center gap-2 py-3 text-left text-[0.625rem] tracking-normal text-white/75 outline-none hover:text-white"
                type="button"
                onClick={() => {
                  setCategoryFiltersOpen((open) => !open);
                }}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={`size-3 transition-transform duration-150 motion-reduce:transition-none ${categoryFiltersOpen ? "rotate-90" : ""}`}
                />
                <span>Categories</span>
              </button>
              <div
                className={`flex flex-wrap items-center gap-2 pb-3 ${categoryFiltersOpen ? "" : "hidden"}`}
                id="font-category-filters"
              >
                {categoriesInUse.map((categoryLabel) => {
                  const checked = !hiddenCategoryLabels.has(categoryLabel);

                  return (
                    <label
                      key={categoryLabel}
                      className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.55rem] font-semibold tracking-[0.1em] text-white/70 uppercase hover:text-white"
                    >
                      <input
                        checked={checked}
                        className="size-3 accent-white outline-none"
                        type="checkbox"
                        onChange={() => {
                          setHiddenCategoryLabels((current) => {
                            const next = new Set(current);

                            if (checked) {
                              next.add(categoryLabel);
                            } else {
                              next.delete(categoryLabel);
                            }

                            return next;
                          });
                        }}
                      />
                      <span>{categoryLabel}</span>
                    </label>
                  );
                })}
                <label className="ml-2 flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.55rem] tracking-[0.08em] text-white/70 hover:text-white">
                  <input
                    checked={allCategoriesSelected}
                    className="size-3 accent-white outline-none"
                    type="checkbox"
                    onChange={() => {
                      setHiddenCategoryLabels((current) =>
                        current.size === 0
                          ? new Set(categoriesInUse)
                          : new Set(),
                      );
                    }}
                  />
                  <span className="font-bold uppercase">All</span>
                </label>
              </div>
            </div>
          ) : null}
          <div className="border-t border-white/20">
            <button
              aria-controls="font-use-case-filters"
              aria-expanded={useCaseFiltersOpen}
              className="flex w-full cursor-pointer items-center gap-2 py-3 text-left text-[0.625rem] tracking-normal text-white/75 outline-none hover:text-white"
              type="button"
              onClick={() => {
                setUseCaseFiltersOpen((open) => !open);
              }}
            >
              <ChevronRight
                aria-hidden="true"
                className={`size-3 transition-transform duration-150 motion-reduce:transition-none ${useCaseFiltersOpen ? "rotate-90" : ""}`}
              />
              <span>Use cases</span>
            </button>
            <div
              className={`flex flex-wrap items-center gap-2 pb-3 ${useCaseFiltersOpen ? "" : "hidden"}`}
              id="font-use-case-filters"
            >
              {useCasesInUse.map((useCaseLabel) => {
                const checked = !hiddenUseCaseLabels.has(useCaseLabel);

                return (
                  <label
                    key={useCaseLabel}
                    className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.55rem] font-semibold tracking-[0.1em] text-white/70 uppercase hover:text-white"
                  >
                    <input
                      checked={checked}
                      className="size-3 accent-white outline-none"
                      type="checkbox"
                      onChange={() => {
                        setHiddenUseCaseLabels((current) => {
                          const next = new Set(current);

                          if (checked) {
                            next.add(useCaseLabel);
                          } else {
                            next.delete(useCaseLabel);
                          }

                          return next;
                        });
                      }}
                    />
                    <span>{useCaseLabel}</span>
                  </label>
                );
              })}
              <label className="ml-2 flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.55rem] tracking-[0.08em] text-white/70 hover:text-white">
                <input
                  checked={allUseCasesSelected}
                  className="size-3 accent-white outline-none"
                  type="checkbox"
                  onChange={() => {
                    setHiddenUseCaseLabels((current) =>
                      current.size === 0 ? new Set(useCasesInUse) : new Set(),
                    );
                  }}
                />
                <span className="font-semibold tracking-[0.1em] uppercase">
                  All
                </span>
              </label>
            </div>
          </div>
          <span
            ref={toolbarBoundaryReference}
            aria-hidden="true"
            className="pointer-events-none absolute right-0 bottom-0 left-0 h-px"
          />
        </header>

        {errorMessage ? (
          <p className="border-b border-white/25 py-6 text-xs text-white/65">
            {errorMessage}
          </p>
        ) : loading ? (
          <p className="py-6 text-xs text-white/50">loading catalog...</p>
        ) : displayedFontCount === 0 ? (
          <p className="py-6 text-xs text-white/50">
            {getEmptyCatalogMessage(
              fonts.length,
              fontPreferences.showOnlyFavorites,
            )}
          </p>
        ) : (
          <section
            ref={fontCatalogReference}
            aria-label="Font catalog"
            className="pb-20 lg:pb-0"
          >
            {fontSections.map((section) => {
              const collapsed = collapsedCategoryKeys.has(section.key);
              const contentId = `font-section-${section.key
                .toLocaleLowerCase()
                .replace(/[^a-z\d]+/g, "-")}`;

              return (
                <section
                  key={section.key}
                  aria-label={`${section.name} fonts`}
                  className="pt-2"
                >
                  <header
                    className={`flex items-center gap-4 ${collapsed ? "" : "mb-2"}`}
                    data-font-category-label={
                      section.key === "pinned" ? undefined : section.label
                    }
                  >
                    <button
                      aria-controls={contentId}
                      aria-expanded={!collapsed}
                      className={`flex shrink-0 cursor-pointer items-center gap-2 font-normal text-white outline-none ${section.label.startsWith("category: ") ? "text-[calc(0.7rem+1px)] tracking-normal hover:text-white" : "text-[0.625rem] tracking-[0.12em] hover:text-white/75"}`}
                      type="button"
                      onClick={() => {
                        setCollapsedCategoryKeys((current) => {
                          const next = new Set(current);

                          if (next.has(section.key)) {
                            next.delete(section.key);
                          } else {
                            next.add(section.key);
                          }

                          return next;
                        });
                      }}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={`size-3 ${collapsed ? "" : "rotate-90"}`}
                      />
                      <span>
                        {section.label.startsWith("category: ") ? (
                          <>
                            <strong className="font-medium">Category:</strong>{" "}
                            <strong className="font-bold uppercase">
                              {section.label.slice("category: ".length)}
                            </strong>
                          </>
                        ) : (
                          <span className="uppercase">{section.label}</span>
                        )}
                      </span>
                    </button>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-white/35"
                    />
                  </header>
                  <div
                    className={collapsed ? "hidden" : "relative"}
                    id={contentId}
                  >
                    <div className="grid gap-x-8 lg:grid-cols-2">
                      {section.fonts.map((font) => (
                        <FontSpecimen
                          key={font.id}
                          backgroundColor={backgroundColor}
                          backgroundImageUrl={
                            backgroundMode === "image"
                              ? backgroundImage?.url
                              : undefined
                          }
                          categoryUpdating={updatingCategoryIds.has(font.id)}
                          visibilityUpdating={updatingVisibilityIds.has(
                            font.id,
                          )}
                          useCasesUpdating={updatingUseCasesIds.has(font.id)}
                          deleting={deletingFontIds.has(font.id)}
                          favorite={fontPreferences.favoriteFontIds.includes(
                            font.id,
                          )}
                          font={font}
                          fontColor={fontColor}
                          fontSize={fontSize}
                          fontWeight={fontWeight}
                          letterSpacing={letterSpacing}
                          lineHeight={lineHeight}
                          pinned={fontPreferences.pinnedFontIds.includes(
                            font.id,
                          )}
                          preferenceControlsEnabled={fontPreferencesReady}
                          textAlignment={textAlignment}
                          textShadow={textShadow}
                          onDelete={setFontPendingDeletion}
                          onFavoriteChange={toggleFavorite}
                          onEnabledChange={(nextFont, enabled) => {
                            void changeFontVisibility(nextFont, enabled);
                          }}
                          onParentCategoryChange={(
                            nextFont,
                            parentCategory,
                          ) => {
                            void changeParentCategory(nextFont, parentCategory);
                          }}
                          onUseCasesChange={(nextFont, useCases) => {
                            void changeUseCases(nextFont, useCases);
                          }}
                          onPinnedChange={togglePinned}
                          specimen={specimen}
                        />
                      ))}
                    </div>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-20 hidden w-[3px] -translate-x-1/2 lg:block"
                      style={{ backgroundColor: "rgb(255 255 255 / 0.17)" }}
                    />
                  </div>
                </section>
              );
            })}
          </section>
        )}
      </div>

      {snackbarMessage ? (
        <div
          aria-live="polite"
          className="pointer-events-none fixed right-4 bottom-4 left-4 z-[10003] flex justify-center"
          role="status"
        >
          <div className="max-w-[42rem] border border-white/45 bg-black/95 px-4 py-2 text-[0.625rem] tracking-[0.08em] text-white/75 uppercase">
            {snackbarMessage}
          </div>
        </div>
      ) : null}

      <FloatingToolbarBrand
        visible={isToolbarLauncherVisible(toolbarFloating, toolbarMinimized)}
      />
      <FloatingToolbarRestoreButton
        visible={isToolbarLauncherVisible(toolbarFloating, toolbarMinimized)}
        onRestore={() => {
          setToolbarMinimized(false);
        }}
      />

      {savedSetsOpen ? (
        <div
          aria-labelledby="saved-sets-title"
          aria-modal="true"
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 px-5"
          role="dialog"
        >
          <div className="w-full max-w-4xl border border-white/55 bg-black p-5">
            <div className="flex items-start justify-between gap-4">
              <h2
                className="text-xs font-normal text-white"
                id="saved-sets-title"
              >
                Saved sets
              </h2>
              <button
                aria-label="Close saved sets"
                className="flex size-7 cursor-pointer items-center justify-center text-white/60 hover:text-white"
                type="button"
                onClick={() => {
                  setSavedSetsOpen(false);
                  setLoadSetConfirmationOpen(false);
                }}
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-auto border border-white/30">
              {savedSetsLoading ? (
                <p className="px-4 py-5 text-[0.625rem] text-white/60 uppercase">
                  Loading saved sets...
                </p>
              ) : savedSets.length === 0 ? (
                <p className="px-4 py-5 text-[0.625rem] text-white/60 uppercase">
                  No saved sets yet.
                </p>
              ) : (
                <div className="divide-y divide-white/25">
                  {savedSets.map((savedSet) => {
                    const selected = savedSet.id === selectedSavedSetId;

                    return (
                      <button
                        key={savedSet.id}
                        aria-pressed={selected}
                        className={`flex w-full cursor-pointer items-start justify-between gap-4 px-4 py-3 text-left ${selected ? "bg-white/10" : "bg-transparent hover:bg-white/5"}`}
                        type="button"
                        onClick={() => {
                          setSelectedSavedSetId(savedSet.id);
                          setLoadSetConfirmationOpen(false);
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="overflow-hidden text-[0.7rem] tracking-[0.04em] text-white text-ellipsis whitespace-nowrap"
                            title={savedSet.label}
                          >
                            {savedSet.label}
                          </p>
                          <p
                            className="mt-1 overflow-hidden text-xs text-white/70 text-ellipsis whitespace-nowrap"
                            title={savedSet.specimen || "Empty demo text"}
                          >
                            {savedSet.specimen || "Empty demo text"}
                          </p>
                          <p className="mt-1 text-[0.625rem] text-white/45">
                            {formatSavedSetTime(
                              savedSet.updatedAt ?? savedSet.createdAt,
                            )}
                          </p>
                        </div>

                        <div className="w-52 shrink-0 border border-white/25 p-2">
                          <div
                            className="mb-2 h-9 border border-white/30 bg-cover bg-center px-2 py-1 text-[0.625rem] leading-4"
                            style={{
                              backgroundColor: savedSet.background.color,
                              backgroundImage:
                                savedSet.background.mode === "image" &&
                                savedSet.background.imageUrl
                                  ? `url(${savedSet.background.imageUrl})`
                                  : undefined,
                              color: savedSet.fontColor,
                            }}
                          >
                            Aa
                          </div>
                          <p className="flex items-center justify-between gap-3 text-[0.5625rem] tracking-[0.06em] text-white/65">
                            <span>Font</span>
                            <span className="text-right">
                              {savedSet.fontColor}
                            </span>
                          </p>
                          <p className="mt-1 flex items-center justify-between gap-3 text-[0.5625rem] tracking-[0.06em] text-white/65">
                            <span>Background</span>
                            <span className="text-right">
                              {savedSet.background.mode === "image"
                                ? "image"
                                : savedSet.background.color}
                            </span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="h-9 border border-white/35 px-4 text-[0.625rem] text-white/65 uppercase"
                type="button"
                onClick={() => {
                  setSavedSetsOpen(false);
                  setLoadSetConfirmationOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="flex h-9 items-center gap-2 border border-white bg-white px-4 text-[0.625rem] text-black uppercase disabled:cursor-default disabled:border-white/30 disabled:bg-white/40 disabled:text-black/60"
                disabled={!selectedSavedSet}
                type="button"
                onClick={() => {
                  setLoadSetConfirmationOpen(true);
                }}
              >
                <Check aria-hidden="true" className="size-3" />
                Load set
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loadSetConfirmationOpen && selectedSavedSet ? (
        <div
          aria-labelledby="load-set-title"
          aria-modal="true"
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/90 px-5"
          role="dialog"
        >
          <div className="w-full max-w-md border border-white/55 bg-black p-5">
            <h2 className="text-xs font-normal text-white" id="load-set-title">
              Are you sure you want to load this set?
            </h2>
            <p
              className="mt-3 overflow-hidden text-[0.625rem] text-white/55 text-ellipsis whitespace-nowrap uppercase"
              title={selectedSavedSet.label}
            >
              {selectedSavedSet.label}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="h-9 border border-white/35 px-4 text-[0.625rem] text-white/65 uppercase"
                type="button"
                onClick={() => {
                  setLoadSetConfirmationOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                className="h-9 border border-white bg-white px-4 text-[0.625rem] text-black uppercase"
                type="button"
                onClick={applySelectedSet}
              >
                Load set
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {SHOW_FONT_DELETE_CONTROLS && fontPendingDeletion ? (
        <div
          aria-labelledby="delete-font-title"
          aria-modal="true"
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/85 px-5"
          role="dialog"
        >
          <div className="w-full max-w-md border border-white/55 bg-black p-5">
            <h2
              className="text-xs font-normal text-white"
              id="delete-font-title"
            >
              Delete “{fontPendingDeletion.name}”?
            </h2>
            <p className="mt-3 text-[0.625rem] leading-relaxed text-white/50 uppercase">
              This permanently removes its Firestore documents and Storage
              files.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="h-9 border border-white/35 px-4 text-[0.625rem] text-white/65 uppercase"
                type="button"
                onClick={() => {
                  setFontPendingDeletion(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="h-9 border border-white bg-white px-4 text-[0.625rem] text-black uppercase"
                type="button"
                onClick={() => {
                  void deleteFont(fontPendingDeletion);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
