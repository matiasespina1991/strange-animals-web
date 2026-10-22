import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RetroScrollbar } from "@/components/RetroScrollbar";
import { InkBleedFilter } from "./InkBleedFilter";
import { FontLoadingProgress } from "./FontLoadingProgress";
import type { FontDownloadProgress } from "./font-download-progress";
import { fontVisualPriority } from "./font-visual-priority";
import { TypewriterText } from "@/components/TypewriterText";
import { smoothWindowScrollTo } from "@/lib/smooth-scroll";
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
  Copy,
  ImageIcon,
  Menu,
  Minus,
  Moon,
  Pin,
  Plus,
  Settings,
  Sun,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  deleteFontCatalogItem,
  duplicateFontFamily,
  renameFontFamily,
  deleteFontVariant,
  downloadFontFamily,
  listFontCatalog,
  listFontVariants,
  loadFontVariant,
  reserveFontLoad,
  refreshFontLoadPriorities,
  updateFontEnabled,
  updateFontParentCategory,
  updateFontVariantPreviewEnabled,
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

import {
  FONT_PARENT_CATEGORIES,
  UNCATEGORIZED_LABEL,
  getFontCategoryDisplayName,
  compareCategoryNames,
  compareFontFilterCategoryLabels,
  compareFontSectionCategoryLabels,
} from "./font-categories";
import { getFontPreviewText } from "./font-preview-text";
import { traceFontLoad } from "./font-load-diagnostics";
import { canUseLocalFontUseCase, LOCAL_FONT_USE_CASE } from "./local-font-use-case";
const SHOW_FONT_DELETE_CONTROLS = import.meta.env.DEV;

const FONT_USE_CASES = ["CD Print", "Clothing", "Vinyl print", ...(canUseLocalFontUseCase() ? [LOCAL_FONT_USE_CASE] : [])] as const;
const UNASSIGNED_USE_CASE_LABEL = "Unassigned";
const VARIANTS_PER_PAGE = 3;
const LOADING_CATEGORY_PLACEHOLDER_COUNT = 14;
const LOADING_SPECIMEN_PLACEHOLDER_COUNT = 4;
const MAX_BACKGROUND_IMAGE_SIZE = 15 * 1024 * 1024;
const DEFAULT_LINE_HEIGHT = 1;
const DEFAULT_LETTER_SPACING = 0;
const MOBILE_FONT_SIZE_DEFAULT = 31;
const DESKTOP_FONT_SIZE_DEFAULT = 31;
const MOBILE_FONT_SIZE_MAX = 125;
const COLOR_FAVORITES_STORAGE_KEY =
  "strange-animals.identity-font-color-favorites.v1";
const DEFAULT_COLOR_FAVORITES = ["#ffffff", "#000000", "#56bcce", "#FA8AA6"];
const IDENTITY_THEME_STORAGE_KEY = "strange-animals.identity-theme.v1";
const IDENTITY_FONTS_ONBOARDING_STORAGE_KEY =
  "strange-animals.identity-fonts-onboarding-dismissed.v1";

const DESKTOP_FONT_SIZE_MAX = 125;
const FONT_TOOLBAR_GRID_CLASS =
  "grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:gap-x-4 md:gap-y-3";
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

type BackgroundTextAnchor = {
  x: number;
  y: number;
};

const DEFAULT_BACKGROUND_TEXT_ANCHOR: BackgroundTextAnchor = { x: 12, y: 82 };

type TextAlignment = "left" | "center" | "right";
type TextCasing = "lower" | "mixed" | "upper";
type FontWeight = "normal" | 800;

function getImageTextTransform(alignment: TextAlignment) {
  const horizontal =
    alignment === "center" ? "-50%" : alignment === "right" ? "-100%" : "0%";
  return `translate(${horizontal}, -50%)`;
}

function getPreviewLineHeight(
  fontSize: string,
  lineHeight: number,
  font: FontCatalogItem,
) {
  const effectiveLineHeight = lineHeight + (font.previewLineHeightExtra ?? 0);
  const extraRem = font.previewLineHeightExtraRem ?? 0;
  return extraRem > 0
    ? `calc(${fontSize} * ${effectiveLineHeight} + ${extraRem}rem)`
    : effectiveLineHeight;
}

function applyTextCasing(value: string, casing: TextCasing) {
  if (casing === "lower") return value.toLocaleLowerCase();
  if (casing === "upper") return value.toLocaleUpperCase();
  return value;
}

function getPreviewFontWeight(fontWeight: FontWeight) {
  return fontWeight === "normal" ? 400 : fontWeight;
}

function getOpaqueHex(color: string) {
  const value = color.trim();
  if (/^#[\da-f]{8}$/i.test(value)) return value.slice(0, 7);
  if (/^#[\da-f]{3,4}$/i.test(value)) {
    return `#${value
      .slice(1, 4)
      .split("")
      .map((channel) => channel.repeat(2))
      .join("")}`;
  }
  if (value.toLowerCase() === "transparent") return "#000000";
  const rgb = value.match(/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/i);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((channel) =>
        Math.min(255, Number(channel)).toString(16).padStart(2, "0"),
      )
      .join("")}`;
  }
  return value;
}

function getColorOpacity(color: string) {
  if (!/^#[\da-f]{8}$/i.test(color)) return 1;

  return Number.parseInt(color.slice(7), 16) / 255;
}

function setColorOpacity(color: string, opacity: number) {
  const hex = getOpaqueHex(color);

  if (!/^#[\da-f]{6}$/i.test(hex)) return color;

  return `${hex}${Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, "0")}`;
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

function getToolbarPlacementClass(floating: boolean) {
  return floating
    ? "fixed right-3 bottom-[0.7rem] left-[1.05rem] z-[10000] border border-white/45 bg-black p-3 pb-[0.95rem] md:top-4 md:right-4 md:bottom-auto md:left-[18rem] md:p-4 2xl:left-[max(18rem,calc((100vw-92rem)/4+16rem))]"
    : "xl:mt-[1.8rem]";
}

function getToolbarPopoverPlacementClass(floating: boolean) {
  // A floating toolbar lives at the bottom only on small screens. Its popovers
  // open upward there to stay above the browser chrome; from `md` onward the
  // toolbar is pinned at the top and its popovers must open downward.
  return floating
    ? "bottom-full mb-1 md:top-full md:bottom-auto md:mt-2 md:mb-0"
    : "top-full mt-2";
}

function getToolbarMinimizeButtonClass(floating: boolean) {
  return floating
    ? "absolute top-1 right-1 z-30 flex size-7 cursor-pointer items-center justify-center text-white/70"
    : "hidden";
}

function isToolbarLauncherVisible(floating: boolean, minimized: boolean) {
  return floating && minimized;
}

function FloatingToolbarBrand({
  lightMode,
  visible,
}: {
  lightMode: boolean;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-3 left-5 z-[10000] flex w-48 flex-col items-end sm:top-5 sm:left-8 sm:w-59 lg:left-10 2xl:left-[max(1.25rem,calc((100vw-92rem)/4))]"
    >
      <img
        alt=""
        className={`pointer-events-auto h-auto w-full select-none opacity-90 transition-opacity duration-200 hover:opacity-100 motion-reduce:transition-none ${lightMode ? "invert" : ""}`}
        decoding="async"
        draggable={false}
        src="/media/images/logos/sa-logo.png"
      />
      <span className="mt-1 mr-[2px] text-[0.65rem] font-normal tracking-[0.02em] text-white/85 lowercase">
        identity &gt; typography
      </span>
    </div>
  );
}

function ColorFavorites({
  activeColor,
  onAddCurrent,
  onSelect,
  values,
}: {
  activeColor: string;
  onAddCurrent: () => void;
  onSelect: (color: string) => void;
  values: string[];
}) {
  return (
    <div className="mt-4 border-t border-white/15 pt-3">
      <div className="flex items-center justify-end">
        <button
          className="cursor-pointer text-[0.5625rem] tracking-[0.08em] text-white/65 uppercase hover:text-white"
          type="button"
          onClick={onAddCurrent}
        >
          Save current
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((color) => (
          <button
            key={color}
            aria-label={`Use ${color}`}
            aria-pressed={color.toLowerCase() === activeColor.toLowerCase()}
            className="size-6 cursor-pointer border border-white/35 outline-none hover:border-white/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
            style={{ backgroundColor: color }}
            type="button"
            onClick={() => {
              onSelect(color);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ColorTransparencyControl({
  color,
  onChange,
}: {
  color: string;
  onChange: (color: string) => void;
}) {
  const opacity = getColorOpacity(color);

  return (
    <div className="mt-3">
      <label className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-[0.625rem] text-white/75 uppercase">
          Opacity
        </span>
        <input
          aria-label="Color opacity"
          className="identity-font-size-slider min-w-0 flex-1"
          max="100"
          min="0"
          step="1"
          type="range"
          value={Math.round(opacity * 100)}
          onChange={(event) => {
            onChange(setColorOpacity(color, Number(event.target.value) / 100));
          }}
        />
        <output className="w-8 text-right text-[0.625rem] text-white/75 tabular-nums">
          {Math.round(opacity * 100)}%
        </output>
      </label>
    </div>
  );
}

function jumpRangeToPointer(
  event: ReactPointerEvent<HTMLInputElement>,
  onValueChange: (value: number) => void,
) {
  const input = event.currentTarget;
  if (event.type === "pointerdown") {
    if (event.button !== 0) return;
    event.preventDefault();
    input.focus();
    input.setPointerCapture(event.pointerId);
  } else if (!input.hasPointerCapture(event.pointerId)) {
    return;
  }
  const bounds = input.getBoundingClientRect();
  const thumbSize =
    input.classList.contains("identity-font-size-control-slider") &&
    window.innerWidth < 768
      ? 18
      : 12;
  const ratio = Math.min(
    1,
    Math.max(
      0,
      (event.clientX - bounds.left - thumbSize / 2) /
        Math.max(1, bounds.width - thumbSize),
    ),
  );
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const step = Number(input.step || 1);
  const value = Math.min(
    max,
    Math.max(
      min,
      Number(
        (min + Math.round((ratio * (max - min)) / step) * step).toFixed(6),
      ),
    ),
  );
  input.value = String(value);
  onValueChange(value);
}

function DesktopFontSizeControl({
  value,
  onCommit,
  onPreview,
}: {
  value: number;
  onCommit: (value: number) => void;
  onPreview: (value: number | null) => void;
}) {
  const [localValue, setLocalValue] = useState(value);
  const [showValue, setShowValue] = useState(false);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commit = (nextValue: number) => {
    const clampedValue = Math.min(
      DESKTOP_FONT_SIZE_MAX,
      Math.max(3, nextValue),
    );
    setLocalValue(clampedValue);
    onCommit(clampedValue);
    onPreview(null);
  };

  return (
    <div className="flex w-40 flex-col gap-2 text-white/70">
      <span className="text-[0.625rem] tracking-[0.02em] sm:text-[0.75rem]">
        Font size
      </span>
      <div className="flex h-10 items-center gap-2">
        <button
          aria-label="Decrease font size"
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center bg-transparent text-base leading-none outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
          type="button"
          onClick={() => {
            commit(localValue - 1);
          }}
        >
          −
        </button>
        <span className="relative flex flex-1 items-center">
          {showValue ? (
            <span className="pointer-events-none absolute -top-[1.5625rem] left-1/2 z-0 -translate-x-1/2 border border-white/35 bg-black px-2.5 py-px text-[0.625rem] leading-none tracking-[0.08em] text-white/70 uppercase">
              {localValue}px
            </span>
          ) : null}
          <input
            aria-label="Text size"
            className="identity-font-size-control-slider identity-font-size-slider relative z-0 w-full"
            max={DESKTOP_FONT_SIZE_MAX}
            min="3"
            step="1"
            type="range"
            value={localValue}
            onBlur={(event) => {
              commit(Number(event.currentTarget.value));
              setShowValue(false);
            }}
            onChange={(event) => {
              setLocalValue(Number(event.currentTarget.value));
              onPreview(Number(event.currentTarget.value));
            }}
            onFocus={() => {
              setShowValue(true);
            }}
            onKeyUp={(event) => {
              commit(Number(event.currentTarget.value));
            }}
            onPointerDown={(event) => {
              setShowValue(true);
              jumpRangeToPointer(event, (value) => {
                setLocalValue(value);
                onPreview(value);
              });
            }}
            onPointerMove={(event) =>
              jumpRangeToPointer(event, (value) => {
                setLocalValue(value);
                onPreview(value);
              })
            }
            onPointerCancel={() => {
              onPreview(null);
              setLocalValue(value);
              setShowValue(false);
            }}
            onPointerUp={(event) => {
              commit(Number(event.currentTarget.value));
              setShowValue(false);
            }}
          />
        </span>
        <button
          aria-label="Increase font size"
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center bg-transparent text-base leading-none outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
          type="button"
          onClick={() => {
            commit(localValue + 1);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ScrollControls({ lightMode }: { lightMode: boolean }) {
  const scrollAnimationReference = useRef<number>();
  const scrollToTopCancelReference = useRef<() => void>();
  const [activeDirection, setActiveDirection] = useState<
    "top" | "up" | "down"
  >();
  const [hoveredDirection, setHoveredDirection] = useState<
    "top" | "up" | "down"
  >();
  const [keyboardDirection, setKeyboardDirection] = useState<"up" | "down">();

  const stopScrolling = () => {
    if (scrollAnimationReference.current !== undefined) {
      window.cancelAnimationFrame(scrollAnimationReference.current);
      scrollAnimationReference.current = undefined;
    }

    scrollToTopCancelReference.current?.();
    scrollToTopCancelReference.current = undefined;

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
      scrollAnimationReference.current =
        window.requestAnimationFrame(scrollStep);
    };

    scrollAnimationReference.current = window.requestAnimationFrame(scrollStep);
  };

  useEffect(() => stopScrolling, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      Boolean(
        target.closest("input, textarea, select, [contenteditable='true']"),
      );

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

  const isButtonHighlighted = (direction: "top" | "up" | "down") =>
    activeDirection === direction ||
    keyboardDirection === direction ||
    hoveredDirection === direction;
  const buttonClass = (direction: "top" | "up" | "down") =>
    `flex h-7 w-12 cursor-pointer items-center justify-center rounded-sm border bg-black/90 backdrop-blur-[3px] outline-none transition-[border-color,background-color] duration-200 focus:outline-none focus-visible:outline-none motion-reduce:transition-none ${isButtonHighlighted(direction) ? "border-white/35 bg-[#111111]" : "border-white/25"}`;
  const buttonStyle = (direction: "top" | "up" | "down") => ({
    color: lightMode
      ? isButtonHighlighted(direction)
        ? "rgb(23 23 23 / 0.78)"
        : "rgb(23 23 23 / 0.58)"
      : isButtonHighlighted(direction)
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
      className="fixed right-5 bottom-20 z-[10000] flex flex-col gap-[7px] max-md:[&>button:not(:first-child)]:hidden md:right-6 md:bottom-7 2xl:right-[max(1.25rem,calc((100vw-92rem)/4-1.5rem))]"
    >
      <button
        aria-label="Scroll to top"
        className={`identity-scroll-top ${buttonClass("top")} text-white/85 md:hover:text-white max-md:!h-[3.25rem] max-md:!w-[3.25rem] max-md:!rounded-full max-md:!backdrop-blur-none`}
        title="Scroll to top"
        type="button"
        onClick={() => {
          stopScrolling();
          setActiveDirection("top");
          scrollToTopCancelReference.current = smoothWindowScrollTo({
            duration: 900,
            top: 0,
          });
          window.setTimeout(() => {
            setActiveDirection(undefined);
            scrollToTopCancelReference.current = undefined;
          }, 900);
        }}
        onPointerEnter={() => {
          setHoveredDirection("top");
        }}
        onPointerLeave={handlePointerLeave}
      >
        <span
          aria-hidden="true"
          className="flex flex-col -space-y-4 md:-space-y-2"
        >
          <ChevronUp className="size-[1.375rem] md:size-3" />
          <ChevronUp className="size-[1.375rem] md:size-3" />
        </span>
      </button>
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

    return (
      window.localStorage.getItem(IDENTITY_FONTS_ONBOARDING_STORAGE_KEY) !==
      "true"
    );
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
      window.localStorage.setItem(
        IDENTITY_FONTS_ONBOARDING_STORAGE_KEY,
        "true",
      );
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
      className="group fixed right-5 bottom-5 z-[10000] flex size-[3.25rem] cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black text-white/85 outline-none transition-[border-color,color] duration-150 hover:border-white/45 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-white md:size-12 md:top-5 md:right-6 md:bottom-auto 2xl:right-[max(1.25rem,calc((100vw-92rem)/4-1.5rem))]"
      title="Restore toolbar"
      type="button"
      onClick={onRestore}
    >
      <span
        aria-hidden="true"
        className="relative flex size-[1.625rem] items-center justify-center md:size-6"
      >
        <Menu className="size-[1.375rem] md:size-5" />
        <Settings className="absolute -right-0.5 -bottom-0.5 size-[0.8125rem] rounded-full bg-black p-[1px] text-white/80 transition-colors duration-150 group-hover:text-white motion-reduce:transition-none md:size-3" />
      </span>
    </button>
  );
}

type CategoryRailItem = {
  active: boolean;
  name: string;
  sectionKey?: string;
};

function ActiveCategoryRail({
  categories,
  label,
  onCategorySelect,
}: {
  categories: CategoryRailItem[];
  label?: string;
  onCategorySelect: (sectionKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const railReference = useRef<HTMLElement>(null);
  const categoryName = label?.startsWith("category: ")
    ? label.slice("category: ".length)
    : undefined;

  useEffect(() => {
    if (!open) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !railReference.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnKeyDown);

    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [open]);

  if (!categoryName) return null;

  return (
    <aside
      ref={railReference}
      className="identity-font-toolbar-fade-in fixed bottom-5 left-2.5 z-20 flex -translate-x-1/2 sm:left-4 md:bottom-6 lg:left-5 2xl:left-[max(1.25rem,calc((100vw-92rem)/4))]"
    >
      <span className="rotate-180 text-[clamp(0.7rem,0.7vw,1rem)] leading-none tracking-[0.1em] whitespace-nowrap text-white/70 [writing-mode:vertical-rl]">
        <button
          aria-controls="active-category-menu"
          aria-expanded={open}
          className="group cursor-pointer border-0 bg-transparent p-0 font-inherit text-inherit outline-none"
          type="button"
          onClick={() => {
            setOpen((current) => !current);
          }}
        >
          <span className="transition-colors duration-150 group-hover:text-white group-focus-visible:text-white motion-reduce:transition-none">
            category
          </span>
        </button>
        :{" "}
        <strong className="font-bold text-white">
          {categoryName.toLocaleUpperCase()}
        </strong>
      </span>

      {open ? (
        <div
          className="absolute bottom-0 left-full ml-3 w-48 border border-white/25 bg-black p-1"
          id="active-category-menu"
        >
          <p className="px-1 py-1 text-left text-[0.55rem] tracking-[0.1em] text-white/75">
            Jump to:
          </p>
          <RetroScrollbar className="flex max-h-[calc(50vh-1.75rem)] flex-col gap-px">
            {categories.map((category) => {
              const selected = category.name === categoryName;

              return (
                <button
                  key={category.name}
                  aria-current={selected ? "true" : undefined}
                  className={`min-h-8 border px-2 py-1 text-left text-[0.55rem] leading-tight tracking-[0.06em] uppercase outline-none transition-colors duration-150 motion-reduce:transition-none ${
                    category.active
                      ? `cursor-pointer border-white/15 text-white/65 hover:border-white/35 hover:bg-white/10 hover:text-white focus-visible:border-white/50 focus-visible:bg-white/10 focus-visible:text-white ${selected ? "bg-white/10 text-white" : ""}`
                      : "cursor-not-allowed border-white/10 text-white/20"
                  }`}
                  disabled={!category.active}
                  type="button"
                  onClick={() => {
                    if (!category.sectionKey) return;

                    onCategorySelect(category.sectionKey);
                    setOpen(false);
                  }}
                >
                  {category.name}
                </button>
              );
            })}
          </RetroScrollbar>
        </div>
      ) : null}
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

      if (!boundary) return;

      const nextFloating =
        window.scrollY > 0 && boundary.getBoundingClientRect().top < 0;
      // Hide the overlay synchronously, before React updates the font catalog.
      // This also guards against an in-flight render during smooth scrolling.
      document.documentElement.toggleAttribute(
        "data-font-toolbar-floating",
        nextFloating,
      );
      const layer = document.querySelector<HTMLElement>(
        ".identity-floating-layer",
      );
      if (layer)
        layer.style.setProperty(
          "display",
          nextFloating ? "contents" : "none",
          "important",
        );
      setFloating(nextFloating);
    };

    updateFloatingState();
    window.addEventListener("scroll", updateFloatingState, { passive: true });
    window.addEventListener("resize", updateFloatingState);

    return () => {
      window.removeEventListener("scroll", updateFloatingState);
      window.removeEventListener("resize", updateFloatingState);
      document.documentElement.removeAttribute("data-font-toolbar-floating");
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
  backgroundTextAnchor,
  font,
  fontColor,
  fontSize,
  fontWeight,
  letterSpacing: baseLetterSpacing,
  lineHeight,
  textAlignment,
  textCasing,
  textShadow,
  deleting,
  categoryUpdating,
  visibilityUpdating,
  useCasesUpdating,
  favorite,
  pinned,
  preferenceControlsEnabled,
  onDelete,
  onCatalogChanged,
  onFamilyError,
  onFavoriteChange,
  onEnabledChange,
  onParentCategoryChange,
  onUseCasesChange,
  onPinnedChange,
  onBackgroundTextAnchorChange,
  specimen,
}: {
  backgroundColor: string;
  backgroundImageUrl?: string;
  backgroundTextAnchor: BackgroundTextAnchor;
  font: FontCatalogItem;
  fontColor: string;
  fontSize: number;
  fontWeight: FontWeight;
  letterSpacing: number;
  lineHeight: number;
  textAlignment: TextAlignment;
  textCasing: TextCasing;
  textShadow: TextShadowSettings;
  deleting: boolean;
  categoryUpdating: boolean;
  visibilityUpdating: boolean;
  useCasesUpdating: boolean;
  favorite: boolean;
  pinned: boolean;
  preferenceControlsEnabled: boolean;
  onDelete: (font: FontCatalogItem) => void;
  onCatalogChanged: () => Promise<void>;
  onFamilyError: (message: string) => void;
  onFavoriteChange: (font: FontCatalogItem) => void;
  onEnabledChange: (font: FontCatalogItem, enabled: boolean) => void;
  onParentCategoryChange: (
    font: FontCatalogItem,
    parentCategory: string | null,
  ) => void;
  onUseCasesChange: (font: FontCatalogItem, useCases: string[]) => void;
  onPinnedChange: (font: FontCatalogItem) => void;
  onBackgroundTextAnchorChange: (anchor: BackgroundTextAnchor) => void;
  specimen: string;
}) {
  const letterSpacing =
    baseLetterSpacing + (font.previewLetterSpacingExtraEm ?? 0);
  const cardReference = useRef<HTMLElement>(null);
  const variantElements = useRef(new Map<string, HTMLDivElement>());
  const releaseLoadReservation = useRef<(() => void) | undefined>();
  const getLoadPriority = useCallback((variantId?: string) => {
    const element =
      (variantId ? variantElements.current.get(variantId) : undefined) ??
      cardReference.current;
    return element
      ? fontVisualPriority(
          element.getBoundingClientRect(),
          window.innerHeight,
          window.innerWidth,
        )
      : Infinity;
  }, []);
  const [variants, setVariants] = useState<FontVariant[]>([]);
  const [variantsLoaded, setVariantsLoaded] = useState(false);
  const [variantsError, setVariantsError] = useState(false);
  const [variantProgress, setVariantProgress] = useState<
    Record<string, FontDownloadProgress>
  >({});
  const [failedVariantIds, setFailedVariantIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [loadedVariants, setLoadedVariants] = useState<
    Record<string, LoadedFontVariant>
  >({});
  const [previewUpdatingVariantIds, setPreviewUpdatingVariantIds] = useState<
    Set<string>
  >(new Set());
  const [deletingVariantIds, setDeletingVariantIds] = useState<Set<string>>(
    new Set(),
  );
  const [downloading, setDownloading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(font.name);
  const [familySaving, setFamilySaving] = useState(false);

  const saveFamilyName = async () => {
    if (!import.meta.env.DEV || familySaving) return;
    setFamilySaving(true);
    try {
      await renameFontFamily(font, nameDraft);
      await onCatalogChanged();
      setEditingName(false);
    } catch (error) {
      console.error("Could not rename font family", error);
      onFamilyError(
        error instanceof Error ? error.message : "Could not rename family",
      );
    } finally {
      setFamilySaving(false);
    }
  };
  const [draggingPreviewText, setDraggingPreviewText] = useState(false);
  const previewTextDragReference = useRef<{ x: number; y: number }>();

  const updateBackgroundTextAnchor = (
    element: HTMLElement,
    clientX: number,
    clientY: number,
  ) => {
    const bounds = element.getBoundingClientRect();

    if (bounds.width === 0 || bounds.height === 0) return;

    onBackgroundTextAnchorChange({
      x: Math.min(
        100,
        Math.max(0, ((clientX - bounds.left) / bounds.width) * 100),
      ),
      y: Math.min(
        100,
        Math.max(0, ((clientY - bounds.top) / bounds.height) * 100),
      ),
    });
  };

  const startPreviewTextDrag = (
    event: ReactPointerEvent<HTMLParagraphElement>,
  ) => {
    const canvas = event.currentTarget.parentElement;

    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    previewTextDragReference.current = {
      x:
        event.clientX -
        (bounds.left + (bounds.width * backgroundTextAnchor.x) / 100),
      y:
        event.clientY -
        (bounds.top + (bounds.height * backgroundTextAnchor.y) / 100),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingPreviewText(true);
    event.preventDefault();
  };

  const movePreviewText = (event: ReactPointerEvent<HTMLParagraphElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;

    const canvas = event.currentTarget.parentElement;
    const dragOffset = previewTextDragReference.current;

    if (!canvas || !dragOffset) return;

    updateBackgroundTextAnchor(
      canvas,
      event.clientX - dragOffset.x,
      event.clientY - dragOffset.y,
    );
  };

  const stopPreviewTextDrag = (
    event: ReactPointerEvent<HTMLParagraphElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    previewTextDragReference.current = undefined;
    setDraggingPreviewText(false);
  };

  useEffect(() => {
    const card = cardReference.current;

    if (!card || !font.preview) return;

    let active = true;
    let started = false;
    let metadataTrace: ReturnType<typeof traceFontLoad> | undefined;

    const load = () => {
      if (started) return;
      started = true;
      metadataTrace = traceFontLoad({ fontId: font.id, fontName: font.name, kind: "metadata" });
      metadataTrace.event("metadata:request");
      releaseLoadReservation.current = reserveFontLoad(() => getLoadPriority());
      setVariantsLoaded(false);
      setVariantsError(false);

      listFontVariants(font)
        .then((nextVariants) => {
          if (!active) return;
          metadataTrace?.event("metadata:received", { variants: nextVariants.length });
          metadataTrace?.finish("ready");
          setVariants(nextVariants);
          setCurrentPage(0);
          setVariantsLoaded(true);
          if (!nextVariants.length) {
            releaseLoadReservation.current?.();
            releaseLoadReservation.current = undefined;
          }
        })
        .catch((error) => {
          if (!active) return;
          metadataTrace?.finish("failed", error);
          setVariantsError(true);
          releaseLoadReservation.current?.();
          releaseLoadReservation.current = undefined;
          console.error(
            "[Typography] Could not load font variants",
            { fontId: font.id },
            error,
          );
        });
    };

    if (!("IntersectionObserver" in window)) {
      load();
      return () => {
        active = false;
        metadataTrace?.finish("cancelled");
        releaseLoadReservation.current?.();
        releaseLoadReservation.current = undefined;
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
      metadataTrace?.finish("cancelled");
      observer.disconnect();
      releaseLoadReservation.current?.();
      releaseLoadReservation.current = undefined;
    };
  }, [font, getLoadPriority]);

  const variantTotal = variantsLoaded ? variants.length : font.variantCount;
  const pageTotal = Math.ceil(variantTotal / VARIANTS_PER_PAGE);
  const pageStart = currentPage * VARIANTS_PER_PAGE;
  const visibleVariants = useMemo(
    () => variants.slice(pageStart, pageStart + VARIANTS_PER_PAGE),
    [pageStart, variants],
  );
  const previewVariants =
    visibleVariants.length > 0
      ? visibleVariants
      : !variantsLoaded && font.preview
        ? [
            {
              id: `${font.id}-preview-placeholder-${currentPage}`,
              fileName: font.preview.fileName,
              previewEnabled: true,
            },
          ]
        : [];

  useEffect(() => {
    if (visibleVariants.length === 0) return;

    let active = true;
    const controller = new AbortController();
    setFailedVariantIds((current) => {
      const next = new Set(current);
      for (const variant of visibleVariants) next.delete(variant.id);
      return next.size === current.size ? current : next;
    });

    void Promise.all(
      visibleVariants.map(async (variant) =>
        loadFontVariant(
          font,
          variant,
          controller.signal,
          (progress) => {
            if (!active) return;
            setVariantProgress((current) => ({
              ...current,
              [variant.id]: progress,
            }));
          },
          () => getLoadPriority(variant.id),
        )
          .then((loadedVariant) => {
            if (!active) return;
            setLoadedVariants((current) => ({
              ...current,
              [variant.id]: loadedVariant,
            }));
          })
          .catch((error) => {
            if (!active || controller.signal.aborted) return;
            setFailedVariantIds((current) => new Set(current).add(variant.id));
            console.error(
              "[Typography] Could not load font preview",
              { fontId: font.id, variantId: variant.id },
              error,
            );
          }),
      ),
    );
    // Keep earlier families reserved until their actual variants are enqueued.
    // A faster metadata response from a lower card must not jump the queue.
    releaseLoadReservation.current?.();
    releaseLoadReservation.current = undefined;

    return () => {
      active = false;
      controller.abort();
    };
  }, [font, visibleVariants, getLoadPriority]);

  const downloadFamily = () => {
    setDownloading(true);
    void downloadFontFamily(font)
      .catch(() => undefined)
      .finally(() => {
        setDownloading(false);
      });
  };

  const changeVariantPreviewVisibility = (
    variant: FontVariant,
    previewEnabled: boolean,
  ) => {
    const previousValue = variant.previewEnabled;

    setPreviewUpdatingVariantIds((current) => new Set(current).add(variant.id));
    setVariants((current) =>
      current.map((item) =>
        item.id === variant.id ? { ...item, previewEnabled } : item,
      ),
    );

    void updateFontVariantPreviewEnabled(font, variant, previewEnabled)
      .catch(() => {
        setVariants((current) =>
          current.map((item) =>
            item.id === variant.id
              ? { ...item, previewEnabled: previousValue }
              : item,
          ),
        );
      })
      .finally(() => {
        setPreviewUpdatingVariantIds((current) => {
          const next = new Set(current);
          next.delete(variant.id);
          return next;
        });
      });
  };

  const deleteVariant = (variant: FontVariant) => {
    setDeletingVariantIds((current) => new Set(current).add(variant.id));

    void deleteFontVariant(font, variant)
      .then(() => {
        setVariants((current) =>
          current.filter((item) => item.id !== variant.id),
        );
        setLoadedVariants((current) => {
          const { [variant.id]: _, ...next } = current;
          return next;
        });
      })
      .finally(() => {
        setDeletingVariantIds((current) => {
          const next = new Set(current);
          next.delete(variant.id);
          return next;
        });
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
          {SHOW_FONT_DELETE_CONTROLS && editingName ? (
            <form
              className="min-w-0"
              onSubmit={(event) => {
                event.preventDefault();
                void saveFamilyName();
              }}
            >
              <input
                aria-label="Family name"
                autoFocus
                className="w-full min-w-0 border-b border-white/50 bg-transparent text-white outline-none"
                value={nameDraft}
                disabled={familySaving}
                onChange={(event) => setNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditingName(false);
                }}
              />
            </form>
          ) : (
            <h2 className="min-w-0 truncate font-normal text-white/80">
              {SHOW_FONT_DELETE_CONTROLS ? (
                <button
                  type="button"
                  className="cursor-pointer truncate text-left"
                  title="Rename family"
                  disabled={familySaving}
                  onClick={() => {
                    setNameDraft(font.name);
                    setEditingName(true);
                  }}
                >
                  {font.name}
                </button>
              ) : (
                font.name
              )}
            </h2>
          )}
          {SHOW_FONT_DELETE_CONTROLS ? (
            <button
              aria-label={`Duplicate ${font.name}`}
              title="Duplicate family"
              type="button"
              className="shrink-0 cursor-pointer text-white/60 hover:text-white disabled:opacity-40"
              disabled={familySaving}
              onClick={async () => {
                setFamilySaving(true);
                try {
                  await duplicateFontFamily(font);
                  await onCatalogChanged();
                } catch (error) {
                  console.error("Could not duplicate font family", error);
                  onFamilyError(
                    error instanceof Error
                      ? error.message
                      : "Could not duplicate family",
                  );
                } finally {
                  setFamilySaving(false);
                }
              }}
            >
              <Copy className="size-3" />
            </button>
          ) : null}
          {SHOW_FONT_DELETE_CONTROLS ? (
            <button
              aria-checked={font.enabled}
              aria-label={`${font.enabled ? "Hide" : "Show"} ${font.name} in production`}
              className={`flex shrink-0 cursor-pointer items-center gap-1.5 bg-transparent text-[0.5rem] tracking-[0.08em] normal-case outline-none hover:text-white/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-35 ${font.enabled ? "text-white/40" : "text-red-400"}`}
              disabled={visibilityUpdating}
              role="switch"
              title={`${font.enabled ? "Visible" : "Hidden"} in production`}
              type="button"
              onClick={() => {
                onEnabledChange(font, !font.enabled);
              }}
            >
              <span className={font.enabled ? "" : "text-red-400"}>off</span>
              <span
                className={`relative h-3 w-6 border ${font.enabled ? "border-white/30" : "border-red-400/70"}`}
              >
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
                    {getFontCategoryDisplayName(font.parentCategory)}
                  </option>
                ) : null}
                {FONT_PARENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {getFontCategoryDisplayName(category)}
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
          const previewError =
            variantsError || failedVariantIds.has(variant.id);
          const previewText = applyTextCasing(
            getFontPreviewText(font, specimen),
            textCasing,
          );
          const variantName = variant.fileName
            .replace(/\.[^/.]+$/, "")
            .replaceAll("-", " ")
            .replace(/\s+/g, " ")
            .trim();
          const isStoredVariant = "relativePath" in variant;

          return (
            <div
              key={variant.id}
              className="relative"
              ref={(element) => {
                if (element) variantElements.current.set(variant.id, element);
                else variantElements.current.delete(variant.id);
              }}
            >
              {!familyName &&
                (variant.previewEnabled || SHOW_FONT_DELETE_CONTROLS) && (
                  <span
                    role="status"
                    aria-label={
                      previewError
                        ? `Could not load ${font.name}`
                        : `Loading ${font.name}`
                    }
                    className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                  >
                    {previewError ? (
                      <span className="text-xs text-white/65">
                        Preview unavailable
                      </span>
                    ) : (
                      <FontLoadingProgress
                        progress={variantProgress[variant.id]}
                        name={font.name}
                        color={fontColor}
                      />
                    )}
                  </span>
                )}
              {variant.previewEnabled || SHOW_FONT_DELETE_CONTROLS ? (
                backgroundImageUrl ? (
                  <div
                    aria-busy={!familyName && !previewError}
                    aria-label="Background image preview. Drag the demo text to position it."
                    className="relative mx-auto min-w-0 max-w-full overflow-hidden bg-black outline-none focus-visible:ring-1 focus-visible:ring-white/80"
                    role="group"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      const step = event.shiftKey ? 5 : 1;
                      const horizontal =
                        event.key === "ArrowLeft"
                          ? -step
                          : event.key === "ArrowRight"
                            ? step
                            : 0;
                      const vertical =
                        event.key === "ArrowUp"
                          ? -step
                          : event.key === "ArrowDown"
                            ? step
                            : 0;

                      if (!horizontal && !vertical) return;

                      event.preventDefault();
                      onBackgroundTextAnchorChange({
                        x: Math.min(
                          100,
                          Math.max(0, backgroundTextAnchor.x + horizontal),
                        ),
                        y: Math.min(
                          100,
                          Math.max(0, backgroundTextAnchor.y + vertical),
                        ),
                      });
                    }}
                  >
                    <img
                      alt=""
                      className="pointer-events-none block h-auto max-h-[min(80svh,52rem)] w-full max-w-full select-none object-contain"
                      draggable={false}
                      src={backgroundImageUrl}
                    />
                    <p
                      aria-hidden="true"
                      className={`absolute min-w-max max-w-none touch-none leading-normal whitespace-pre-wrap transition-[filter,opacity] duration-700 ease-in-out motion-reduce:transition-none ${familyName ? "pointer-events-none opacity-0 blur-[3px]" : `${draggingPreviewText ? "cursor-grabbing" : "cursor-grab"} opacity-80 blur-[3px]`}`}
                      style={{
                        color: fontColor,
                        fontSize: `${fontSize}px`,
                        fontWeight: getPreviewFontWeight(fontWeight),
                        letterSpacing: `${letterSpacing}em`,
                        lineHeight: getPreviewLineHeight(
                          `${fontSize}px`,
                          lineHeight,
                          font,
                        ),
                        textAlign: textAlignment,
                        left: `${backgroundTextAnchor.x}%`,
                        top: `${backgroundTextAnchor.y}%`,
                        transform: getImageTextTransform(textAlignment),
                        textShadow: textShadow.enabled
                          ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                          : undefined,
                      }}
                      onPointerCancel={stopPreviewTextDrag}
                      onPointerDown={startPreviewTextDrag}
                      onPointerMove={movePreviewText}
                      onPointerUp={stopPreviewTextDrag}
                    >
                      {previewText}
                    </p>
                    <p
                      className={`identity-font-committed-preview absolute min-w-max max-w-none touch-none leading-normal whitespace-pre-wrap transition-[filter,opacity] duration-700 ease-in-out motion-reduce:transition-none ${familyName ? `${draggingPreviewText ? "cursor-grabbing" : "cursor-grab"} opacity-100 blur-0` : "pointer-events-none opacity-0 blur-[1px]"}`}
                      style={{
                        color: fontColor,
                        fontFamily: familyName,
                        fontSize: `${fontSize}px`,
                        fontWeight: getPreviewFontWeight(fontWeight),
                        letterSpacing: `${letterSpacing}em`,
                        lineHeight: getPreviewLineHeight(
                          `${fontSize}px`,
                          lineHeight,
                          font,
                        ),
                        textAlign: textAlignment,
                        left: `${backgroundTextAnchor.x}%`,
                        top: `${backgroundTextAnchor.y}%`,
                        transform: getImageTextTransform(textAlignment),
                        textShadow: textShadow.enabled
                          ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                          : undefined,
                      }}
                      onPointerCancel={stopPreviewTextDrag}
                      onPointerDown={startPreviewTextDrag}
                      onPointerMove={movePreviewText}
                      onPointerUp={stopPreviewTextDrag}
                    >
                      {previewText}
                    </p>
                    <p
                      aria-hidden="true"
                      className="identity-font-ghost-preview pointer-events-none absolute min-w-max max-w-none whitespace-pre-wrap"
                      style={{
                        color: fontColor,
                        fontFamily: familyName,
                        fontSize: "var(--identity-ghost-font-size)",
                        fontWeight: getPreviewFontWeight(fontWeight),
                        letterSpacing: `${letterSpacing}em`,
                        lineHeight: getPreviewLineHeight(
                          "var(--identity-ghost-font-size)",
                          lineHeight,
                          font,
                        ),
                        textAlign: textAlignment,
                        left: `${backgroundTextAnchor.x}%`,
                        top: `${backgroundTextAnchor.y}%`,
                        transform: getImageTextTransform(textAlignment),
                        textShadow: textShadow.enabled
                          ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                          : undefined,
                      }}
                    >
                      {previewText}
                    </p>
                  </div>
                ) : (
                  <div
                    aria-busy={!familyName && !previewError}
                    className="relative min-w-0 overflow-hidden"
                    style={{ backgroundColor }}
                  >
                    <p
                      aria-hidden="true"
                      className={`min-w-0 max-w-full px-4 py-8 leading-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${familyName ? "absolute inset-0 pointer-events-none opacity-0" : "opacity-80 blur-[3px]"}`}
                      style={{
                        color: fontColor,
                        fontSize: `${fontSize}px`,
                        fontWeight: getPreviewFontWeight(fontWeight),
                        letterSpacing: `${letterSpacing}em`,
                        lineHeight: getPreviewLineHeight(
                          `${fontSize}px`,
                          lineHeight,
                          font,
                        ),
                        textAlign: textAlignment,
                        textShadow: textShadow.enabled
                          ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                          : undefined,
                      }}
                    >
                      {previewText}
                    </p>
                    <p
                      className={`identity-font-committed-preview min-w-0 max-w-full px-4 py-8 leading-normal whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${familyName ? "opacity-100" : "absolute inset-0 pointer-events-none opacity-0"}`}
                      style={{
                        color: fontColor,
                        fontFamily: familyName,
                        fontSize: `${fontSize}px`,
                        fontWeight: getPreviewFontWeight(fontWeight),
                        letterSpacing: `${letterSpacing}em`,
                        lineHeight: getPreviewLineHeight(
                          `${fontSize}px`,
                          lineHeight,
                          font,
                        ),
                        textAlign: textAlignment,
                        textShadow: textShadow.enabled
                          ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                          : undefined,
                      }}
                    >
                      {previewText}
                    </p>
                    <p
                      aria-hidden="true"
                      className="identity-font-ghost-preview pointer-events-none absolute inset-0 min-w-0 max-w-full px-4 py-8 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                      style={{
                        color: fontColor,
                        fontFamily: familyName,
                        fontSize: "var(--identity-ghost-font-size)",
                        fontWeight: getPreviewFontWeight(fontWeight),
                        letterSpacing: `${letterSpacing}em`,
                        lineHeight: getPreviewLineHeight(
                          "var(--identity-ghost-font-size)",
                          lineHeight,
                          font,
                        ),
                        textAlign: textAlignment,
                        textShadow: textShadow.enabled
                          ? `${textShadow.offsetX}px ${textShadow.offsetY}px ${textShadow.blur}px rgb(0 0 0 / ${textShadow.opacity})`
                          : undefined,
                      }}
                    >
                      {previewText}
                    </p>
                  </div>
                )
              ) : null}
              {variantTotal > 1 || SHOW_FONT_DELETE_CONTROLS ? (
                <div className="mt-2 flex min-w-0 justify-end text-[0.625rem] tracking-[0.08em] uppercase">
                  <span
                    className="min-w-0 overflow-hidden text-right text-white/70 text-ellipsis whitespace-nowrap"
                    title={variantName}
                  >
                    {variantName}
                  </span>
                  {SHOW_FONT_DELETE_CONTROLS && isStoredVariant ? (
                    <>
                      <button
                        aria-checked={variant.previewEnabled}
                        aria-label={`${variant.previewEnabled ? "Hide" : "Show"} ${variantName} preview`}
                        className={`ml-3 flex shrink-0 cursor-pointer items-center gap-1.5 bg-transparent text-[0.5rem] tracking-[0.08em] normal-case outline-none hover:text-white/70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-35 ${variant.previewEnabled ? "text-white/40" : "text-red-400"}`}
                        disabled={previewUpdatingVariantIds.has(variant.id)}
                        role="switch"
                        type="button"
                        onClick={() => {
                          changeVariantPreviewVisibility(
                            variant,
                            !variant.previewEnabled,
                          );
                        }}
                      >
                        <span
                          className={
                            variant.previewEnabled ? "" : "text-red-400"
                          }
                        >
                          off
                        </span>
                        <span
                          className={`relative h-3 w-6 border ${variant.previewEnabled ? "border-white/30" : "border-red-400/70"}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute top-1/2 left-0.5 size-2 -translate-y-1/2 bg-white transition-transform duration-150 motion-reduce:transition-none ${variant.previewEnabled ? "translate-x-3" : "translate-x-0"}`}
                          />
                        </span>
                        <span
                          className={
                            variant.previewEnabled ? "text-white/80" : ""
                          }
                        >
                          on
                        </span>
                      </button>
                      <button
                        aria-label={`Delete ${variantName}`}
                        className="ml-2 flex size-5 shrink-0 cursor-pointer items-center justify-center text-white/40 outline-none transition-colors duration-150 hover:text-red-400 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:text-white/20"
                        disabled={deletingVariantIds.has(variant.id)}
                        title={`Delete ${variantName}`}
                        type="button"
                        onClick={() => {
                          deleteVariant(variant);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-3" />
                      </button>
                    </>
                  ) : null}
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

function NumericStepper({
  ariaLabel,
  max,
  min,
  onChange,
  precision = 0,
  step,
  unit = "",
  value,
}: {
  ariaLabel: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  precision?: number;
  step: number;
  unit?: string;
  value: number;
}) {
  const [draftValue, setDraftValue] = useState<string>();
  const formatValue = `${value.toFixed(precision)}${unit}`;
  const updateValue = (direction: -1 | 1) => {
    const nextValue = Math.min(max, Math.max(min, value + step * direction));
    onChange(Number(nextValue.toFixed(precision)));
  };
  const commitDraftValue = () => {
    if (draftValue === undefined) return;

    const parsedValue = Number.parseFloat(draftValue);

    if (Number.isFinite(parsedValue)) {
      const nextValue = Math.min(max, Math.max(min, parsedValue));
      onChange(Number(nextValue.toFixed(precision)));
    }

    setDraftValue(undefined);
  };

  return (
    <div
      aria-label={ariaLabel}
      className="identity-numeric-stepper inline-grid h-9 shrink-0 grid-cols-[2rem_minmax(3.5rem,auto)_2rem] border border-white/35 text-[0.625rem] text-white/75"
      role="group"
    >
      <button
        aria-label={`Decrease ${ariaLabel}`}
        className="flex cursor-pointer items-center justify-center border-r border-white/35 text-white/65 outline-none transition-colors duration-150 md:hover:bg-white md:hover:text-black focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35"
        disabled={value <= min}
        type="button"
        onClick={() => {
          updateValue(-1);
        }}
      >
        <Minus aria-hidden="true" className="size-3" />
      </button>
      <label className="relative flex min-w-0 items-center justify-center px-2 tabular-nums text-white">
        <span className="sr-only">{ariaLabel}</span>
        <output className="pointer-events-none truncate text-white">
          {draftValue === undefined ? formatValue : `${draftValue}${unit}`}
        </output>
        <input
          aria-label={ariaLabel}
          className="absolute inset-0 h-full w-full cursor-text select-text bg-transparent opacity-0 outline-none"
          inputMode={precision > 0 ? "decimal" : "numeric"}
          value={draftValue ?? value.toFixed(precision)}
          onBlur={commitDraftValue}
          onChange={(event) => {
            const nextDraftValue = event.target.value;
            const parsedValue = Number.parseFloat(nextDraftValue);

            setDraftValue(nextDraftValue);

            if (
              Number.isFinite(parsedValue) &&
              parsedValue >= min &&
              parsedValue <= max
            ) {
              onChange(Number(parsedValue.toFixed(precision)));
            }
          }}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </label>
      <button
        aria-label={`Increase ${ariaLabel}`}
        className="flex cursor-pointer items-center justify-center border-l border-white/35 text-white/65 outline-none transition-colors duration-150 md:hover:bg-white md:hover:text-black focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35"
        disabled={value >= max}
        type="button"
        onClick={() => {
          updateValue(1);
        }}
      >
        <Plus aria-hidden="true" className="size-3" />
      </button>
    </div>
  );
}

export function IdentityFontsPage() {
  const [lightMode, setLightMode] = useState(() => {
    if (typeof window === "undefined") return false;

    return window.localStorage.getItem(IDENTITY_THEME_STORAGE_KEY) === "light";
  });
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
  const [inkBleed, setInkBleed] = useState(0);
  const [textAlignment, setTextAlignment] = useState<TextAlignment>("left");
  const [textCasing, setTextCasing] = useState<TextCasing>("mixed");
  const [textShadow, setTextShadow] =
    useState<TextShadowSettings>(DEFAULT_TEXT_SHADOW);
  const [typographySettingsOpen, setTypographySettingsOpen] = useState(false);
  const [fontColor, setFontColor] = useState(() =>
    lightMode ? "#000000" : "#ffffff",
  );
  const [fontColorCustomized, setFontColorCustomized] = useState(false);
  const [favoriteColors, setFavoriteColors] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_COLOR_FAVORITES;

    try {
      const savedColors = JSON.parse(
        window.localStorage.getItem(COLOR_FAVORITES_STORAGE_KEY) ?? "[]",
      );

      if (
        Array.isArray(savedColors) &&
        savedColors.every((color) => typeof color === "string")
      ) {
        return Array.from(
          new Set([...DEFAULT_COLOR_FAVORITES, ...savedColors]),
        );
      }
    } catch {
      // Fall back to the built-in swatches when a stored value is malformed.
    }

    return DEFAULT_COLOR_FAVORITES;
  });
  const [fontColorSettingsOpen, setFontColorSettingsOpen] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState(() =>
    lightMode ? "#ffffff00" : "#00000000",
  );
  const [backgroundMode, setBackgroundMode] = useState<"color" | "image">(
    "color",
  );
  const [backgroundImage, setBackgroundImage] = useState<BackgroundImage>();
  const [backgroundTextAnchor, setBackgroundTextAnchor] =
    useState<BackgroundTextAnchor>(DEFAULT_BACKGROUND_TEXT_ANCHOR);
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
  const [expandedCategoryKeys, setExpandedCategoryKeys] = useState<Set<string>>(
    new Set(),
  );
  const defaultCategoriesOpenedReference = useRef(false);
  const manuallyClosedCategoriesReference = useRef(new Set<string>());
  const [searchCollapsedCategoryKeys, setSearchCollapsedCategoryKeys] =
    useState(new Set<string>());
  const [hiddenCategoryLabels, setHiddenCategoryLabels] = useState<Set<string>>(
    new Set(),
  );
  const [categorySelectionPristine, setCategorySelectionPristine] =
    useState(true);
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
  useEffect(() => {
    setSearchCollapsedCategoryKeys(new Set());
  }, [deferredSearch]);
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
  const categoryNavigationCleanupReference = useRef<() => void>();
  const fontPreferencesReference = useRef(fontPreferences);
  const snackbarTimeoutReference = useRef<number>();
  const { toolbarBoundaryReference, toolbarFloating, toolbarReference } =
    useFloatingToolbar();

  useLayoutEffect(() => {
    setToolbarMinimized(toolbarFloating);
  }, [toolbarFloating]);

  useEffect(() => {
    window.localStorage.setItem(
      IDENTITY_THEME_STORAGE_KEY,
      lightMode ? "light" : "dark",
    );
  }, [lightMode]);

  useLayoutEffect(() => {
    const backgroundColor = lightMode ? "#fff" : "#000";
    const textColor = lightMode ? "#171717" : "#fff";
    const root = document.documentElement;

    document.getElementById("identity-bright-initial-theme")?.remove();
    root.style.backgroundColor = backgroundColor;
    root.style.color = textColor;
    document.body.style.backgroundColor = backgroundColor;
    document.body.style.color = textColor;

    return () => {
      root.style.removeProperty("background-color");
      root.style.removeProperty("color");
      document.body.style.removeProperty("background-color");
      document.body.style.removeProperty("color");
    };
  }, [lightMode]);

  useEffect(() => {
    window.localStorage.setItem(
      COLOR_FAVORITES_STORAGE_KEY,
      JSON.stringify(favoriteColors),
    );
  }, [favoriteColors]);

  useEffect(() => {
    return () => {
      categoryNavigationCleanupReference.current?.();
    };
  }, []);

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

  const commitFontSize = (nextFontSize: number) => {
    setFontSize(
      Math.min(
        isSmallViewport ? MOBILE_FONT_SIZE_MAX : DESKTOP_FONT_SIZE_MAX,
        Math.max(3, nextFontSize),
      ),
    );
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
    window.addEventListener("scroll", refreshFontLoadPriorities, {
      passive: true,
    });
    window.addEventListener("resize", refreshFontLoadPriorities);
    return () => {
      window.removeEventListener("scroll", refreshFontLoadPriorities);
      window.removeEventListener("resize", refreshFontLoadPriorities);
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

    if (isSmallViewport) {
      specimenInput.style.height = "40px";
      specimenInput.style.overflowY = "auto";
      return;
    }

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
  }, [specimen, isSmallViewport, toolbarFloating]);

  const categoriesInUse = useMemo(() => {
    const labels = new Set<string>();

    // Keep the script category discoverable while its first families are being
    // published to the remote catalog.
    labels.add("Non-Latin Script");

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
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch = (font: FontCatalogItem) =>
      !term ||
      `${font.name} ${font.formats.join(" ")}`
        .toLocaleLowerCase()
        .includes(term);
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
          isVisibleUseCase(font) &&
          matchesSearch(font),
      );
    const visibleFonts = fonts.filter(
      (font) =>
        !pinnedFontIds.has(font.id) &&
        isEligible(font) &&
        isVisibleCategory(font) &&
        isVisibleUseCase(font) &&
        matchesSearch(font),
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
    search,
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
  }, [expandedCategoryKeys, fontSections]);

  useEffect(() => {
    if (
      loading ||
      search.trim() ||
      defaultCategoriesOpenedReference.current ||
      fontSections.length === 0
    )
      return;
    defaultCategoriesOpenedReference.current = true;
    const defaults = fontSections
      .filter((section) => section.label.startsWith("category: "))
      .slice(0, 2);
    setExpandedCategoryKeys(
      (current) =>
        new Set([...current, ...defaults.map((section) => section.key)]),
    );
  }, [loading, search, fontSections]);

  useEffect(() => {
    if (loading || search.trim() || !defaultCategoriesOpenedReference.current)
      return;
    const nextSection = fontSections.find(
      (section) =>
        !expandedCategoryKeys.has(section.key) &&
        !manuallyClosedCategoriesReference.current.has(section.key),
    );
    if (!nextSection) return;
    const header = document.getElementById(`font-category-${nextSection.key}`);
    if (!header) return;
    let opened = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          !entry?.isIntersecting ||
          opened ||
          manuallyClosedCategoriesReference.current.has(nextSection.key)
        )
          return;
        opened = true;
        observer.disconnect();
        setExpandedCategoryKeys((current) =>
          new Set(current).add(nextSection.key),
        );
      },
      { rootMargin: "250px 0px" },
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, [loading, search, fontSections, expandedCategoryKeys]);

  const displayedFontCount = useMemo(
    () =>
      fontSections.reduce((total, section) => total + section.fonts.length, 0),
    [fontSections],
  );

  const categoryRailItems = useMemo(() => {
    const visibleSectionKeys = new Map(
      fontSections
        .filter((section) => section.label.startsWith("category: "))
        .map((section) => [section.name, section.key]),
    );

    return categoriesInUse.map((name) => ({
      active: visibleSectionKeys.has(name),
      name,
      sectionKey: visibleSectionKeys.get(name),
    }));
  }, [categoriesInUse, fontSections]);

  const selectCategoryFromRail = (sectionKey: string) => {
    categoryNavigationCleanupReference.current?.();
    setExpandedCategoryKeys((current) => new Set(current).add(sectionKey));

    const categoryHeader = document.getElementById(
      `font-category-${sectionKey}`,
    );

    if (!categoryHeader) return;

    const rootFontSize = Number.parseFloat(
      window.getComputedStyle(document.documentElement).fontSize,
    );
    const topOffset = rootFontSize * 5;
    let disposed = false;
    let initialAnimationFrame: number | undefined;
    let realignTimeout: number | undefined;
    let cancelScrollAnimation: (() => void) | undefined;
    let requestedTop: number | undefined;

    const alignToCategory = () => {
      if (disposed) return;

      const nextTop = Math.max(
        categoryHeader.getBoundingClientRect().top + window.scrollY - topOffset,
        0,
      );

      if (requestedTop !== undefined && Math.abs(requestedTop - nextTop) < 2) {
        return;
      }

      cancelScrollAnimation?.();
      requestedTop = nextTop;
      cancelScrollAnimation = smoothWindowScrollTo({ top: nextTop });
    };
    const scheduleRealignment = () => {
      if (disposed) return;

      if (realignTimeout !== undefined) {
        window.clearTimeout(realignTimeout);
      }

      realignTimeout = window.setTimeout(alignToCategory, 180);
    };

    initialAnimationFrame = window.requestAnimationFrame(alignToCategory);

    const catalog = fontCatalogReference.current;
    const resizeObserver =
      catalog && "ResizeObserver" in window
        ? new ResizeObserver(scheduleRealignment)
        : undefined;

    if (catalog && resizeObserver) resizeObserver.observe(catalog);

    const verificationTimeouts = [700, 1400, 2400].map((delay) =>
      window.setTimeout(scheduleRealignment, delay),
    );
    let cleanupTimeout: number | undefined;
    const cleanup = () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (initialAnimationFrame !== undefined) {
        window.cancelAnimationFrame(initialAnimationFrame);
      }
      cancelScrollAnimation?.();
      if (realignTimeout !== undefined) window.clearTimeout(realignTimeout);
      verificationTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      if (cleanupTimeout !== undefined) window.clearTimeout(cleanupTimeout);

      if (categoryNavigationCleanupReference.current === cleanup) {
        categoryNavigationCleanupReference.current = undefined;
      }
    };

    categoryNavigationCleanupReference.current = cleanup;
    cleanupTimeout = window.setTimeout(cleanup, 3000);
  };

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

  const saveFavoriteColor = (color: string) => {
    setFavoriteColors((current) =>
      current.some((favorite) => favorite.toLowerCase() === color.toLowerCase())
        ? current
        : [...current, color],
    );
  };

  const setUserFontColor = (color: string) => {
    setFontColorCustomized(true);
    setFontColor(color);
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
        backgroundTextAnchor,
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
    setFontColorCustomized(true);
    setFontColor(selectedSavedSet.fontColor);
    setBackgroundColor(selectedSavedSet.background.color);
    setBackgroundTextAnchor(selectedSavedSet.background.textAnchor);
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

  const reportFamilyError = (message: string) => {
    if (snackbarTimeoutReference.current !== undefined) {
      window.clearTimeout(snackbarTimeoutReference.current);
    }
    setSnackbarMessage(message);
    snackbarTimeoutReference.current = window.setTimeout(() => {
      setSnackbarMessage(undefined);
      snackbarTimeoutReference.current = undefined;
    }, 6000);
  };

  const renderToolbar = (floating: boolean) => (
    <div
      ref={floating ? undefined : toolbarReference}
      className={`${FONT_TOOLBAR_GRID_CLASS} select-none [&_input]:select-text [&_textarea]:select-text ${getToolbarPlacementClass(floating)}`}
      id={floating ? "font-toolbar-floating" : "font-toolbar"}
    >
      <button
        aria-label="Minimize font toolbar"
        className={getToolbarMinimizeButtonClass(floating)}
        disabled={!floating}
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

      <div className="col-span-2 block md:col-span-1">
        <label
          htmlFor={`font-demo-text-${floating ? "floating" : "main"}`}
          className="mb-2 block text-[0.75rem] tracking-[0.02em] text-white/85"
        >
          Demo text
        </label>
        <span className="relative block">
          <textarea
            id={`font-demo-text-${floating ? "floating" : "main"}`}
            ref={
              floating === toolbarFloating ? specimenInputReference : undefined
            }
            className="identity-font-text-input overflow-y-clip block h-10 w-full resize-none overflow-y-auto rounded-none border border-white/35 bg-black py-[7px] pl-3 pr-10 text-xs leading-normal text-white outline-none placeholder:text-white/35 md:py-[0.7rem]"
            rows={1}
            value={specimen}
            onChange={(event) => {
              setSpecimen(event.target.value);
            }}
          />
          {specimen !== "" && (
            <button
              aria-label="Clear demo text"
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center text-white/65 hover:text-white"
              type="button"
              onClick={(event) => {
                setSpecimen("");
                event.currentTarget.parentElement
                  ?.querySelector("textarea")
                  ?.focus();
              }}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </span>
      </div>

      <div className="col-span-2 block md:col-span-1">
        <label
          htmlFor={`font-search-${floating ? "floating" : "main"}`}
          className="mb-2 block text-[0.75rem] tracking-[0.02em] text-white/85"
        >
          Search fonts
        </label>
        <span className="relative block">
          <input
            id={`font-search-${floating ? "floating" : "main"}`}
            className="identity-font-text-input 
            overflow-y-clip h-10 w-full rounded-none border border-white/35 bg-black pl-3 pr-10 text-xs text-white outline-none placeholder:text-white/35 [&::-webkit-search-cancel-button]:appearance-none"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
          {search !== "" && (
            <button
              aria-label="Clear search fonts"
              className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center text-white/65 hover:text-white"
              type="button"
              onClick={(event) => {
                setSearch("");
                event.currentTarget.parentElement
                  ?.querySelector("input")
                  ?.focus();
              }}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </span>
      </div>

      <div className="col-span-1 flex min-w-0 flex-nowrap items-start justify-center gap-1.5 sm:gap-3">
        <div
          ref={
            floating === toolbarFloating
              ? fontColorSettingsReference
              : undefined
          }
          className="relative block w-[3.75rem] shrink-0 sm:w-[5.25rem]"
        >
          <span className="mb-1 block whitespace-nowrap text-center text-[0.625rem] tracking-[0.02em] text-white/85 sm:mb-2 sm:text-[0.75rem]">
            <span className="sm:hidden">Font</span>
            <span className="hidden sm:inline">Font color</span>
          </span>
          <span className="flex h-9 items-center justify-center sm:h-10">
            <button
              ref={
                floating === toolbarFloating
                  ? fontColorSettingsButtonReference
                  : undefined
              }
              aria-controls={
                floating
                  ? "font-color-settings-floating"
                  : "font-color-settings"
              }
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

          {fontColorSettingsOpen && floating === toolbarFloating ? (
            <div
              aria-labelledby={
                floating
                  ? "font-color-settings-title-floating"
                  : "font-color-settings-title"
              }
              className={`absolute right-auto left-0 z-50 w-64 max-w-[calc(100vw-5rem)] border border-white/45 bg-black p-4 md:max-w-[calc(100vw-2.5rem)] ${getToolbarPopoverPlacementClass(floating)}`}
              id={
                floating
                  ? "font-color-settings-floating"
                  : "font-color-settings"
              }
            >
              <h2
                className="text-[0.625rem] font-normal text-white/70"
                id={
                  floating
                    ? "font-color-settings-title-floating"
                    : "font-color-settings-title"
                }
              >
                Font color
              </h2>
              <label className="mt-5 flex items-center gap-3">
                <span className="text-[0.625rem] text-white/75 uppercase">
                  {getOpaqueHex(fontColor)}
                </span>
                <input
                  aria-label="Choose font color"
                  className="identity-color-picker"
                  type="color"
                  value={getOpaqueHex(fontColor)}
                  onChange={(event) => {
                    setUserFontColor(
                      setColorOpacity(
                        event.target.value,
                        getColorOpacity(fontColor),
                      ),
                    );
                  }}
                />
              </label>
              <ColorTransparencyControl
                color={fontColor}
                onChange={setUserFontColor}
              />
              <ColorFavorites
                activeColor={fontColor}
                values={favoriteColors}
                onAddCurrent={() => {
                  saveFavoriteColor(fontColor);
                }}
                onSelect={setUserFontColor}
              />
            </div>
          ) : null}
        </div>

        <div className="shrink-0 self-start">
          <span
            aria-hidden="true"
            className="invisible mb-1 block text-[0.625rem] tracking-[0.02em] sm:mb-2 sm:text-[0.75rem]"
          >
            Swap
          </span>
          <span className="flex h-9 items-center justify-center sm:h-10">
            <button
              aria-label="Swap font and background colors"
              className="flex h-5 w-6 cursor-pointer items-center justify-center border border-white/35 text-white/65 outline-none hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white"
              title="Swap colors"
              type="button"
              onClick={() => {
                // Font receives RGB only: background alpha must never carry over.
                setUserFontColor(getOpaqueHex(backgroundColor));
                setBackgroundColor(fontColor);
              }}
            >
              <ArrowLeftRight aria-hidden="true" className="size-[0.8rem]" />
            </button>
          </span>
        </div>

        <div
          ref={
            floating === toolbarFloating
              ? backgroundSettingsReference
              : undefined
          }
          className="relative w-[3.75rem] shrink-0 self-start sm:w-[5.25rem]"
        >
          <span className="mb-1 block whitespace-nowrap text-center text-[0.625rem] tracking-[0.02em] text-white/85 sm:mb-2 sm:text-[0.75rem]">
            <span>Background</span>
          </span>
          <span className="flex h-9 items-center justify-center sm:h-10">
            <button
              ref={
                floating === toolbarFloating
                  ? backgroundSettingsButtonReference
                  : undefined
              }
              aria-controls={
                floating
                  ? "background-settings-floating"
                  : "background-settings"
              }
              aria-expanded={backgroundSettingsOpen}
              aria-label="Background settings"
              className={`size-6 cursor-pointer border border-white/35 bg-transparent bg-cover bg-center outline-none focus:outline-none focus-visible:outline-none ${backgroundMode === "color" && getColorOpacity(backgroundColor) === 0 ? "identity-transparent-color-swatch" : ""}`}
              style={{
                backgroundColor:
                  backgroundMode === "color" ? backgroundColor : "#000000",
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

          {backgroundSettingsOpen && floating === toolbarFloating ? (
            <div
              aria-labelledby={
                floating
                  ? "background-settings-title-floating"
                  : "background-settings-title"
              }
              className={`absolute right-0 left-auto z-50 w-72 max-w-[calc(100vw-2.5rem)] border border-white/45 bg-black p-4 md:right-auto md:left-0 ${getToolbarPopoverPlacementClass(floating)}`}
              id={
                floating
                  ? "background-settings-floating"
                  : "background-settings"
              }
            >
              <h2
                className="mb-4 text-[0.625rem] font-normal text-white/70"
                id={
                  floating
                    ? "background-settings-title-floating"
                    : "background-settings-title"
                }
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
                <>
                  <label className="mt-5 flex items-center gap-3">
                    <span className="text-[0.625rem] tracking-[0.08em] text-white/75 uppercase">
                      {getOpaqueHex(backgroundColor)}
                    </span>
                    <input
                      aria-label="Choose background color"
                      className="identity-color-picker"
                      type="color"
                      value={getOpaqueHex(backgroundColor)}
                      onChange={(event) => {
                        setBackgroundColor(
                          setColorOpacity(
                            event.target.value,
                            getColorOpacity(backgroundColor),
                          ),
                        );
                      }}
                    />
                  </label>
                  <ColorTransparencyControl
                    color={backgroundColor}
                    onChange={setBackgroundColor}
                  />
                  <ColorFavorites
                    activeColor={backgroundColor}
                    values={favoriteColors}
                    onAddCurrent={() => {
                      saveFavoriteColor(backgroundColor);
                    }}
                    onSelect={setBackgroundColor}
                  />
                </>
              ) : (
                <div className="mt-5">
                  <input
                    ref={
                      floating === toolbarFloating
                        ? backgroundImageInputReference
                        : undefined
                    }
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
                        className="flex h-24 items-center justify-center overflow-hidden border border-white/35 bg-black"
                        role="img"
                      >
                        <img
                          alt=""
                          className="size-full object-contain"
                          src={backgroundImage.url}
                        />
                      </div>
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
                        selectBackgroundImage(event.dataTransfer.files[0]);
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
        ref={
          floating === toolbarFloating ? typographySettingsReference : undefined
        }
        className="relative col-span-1 flex min-w-0 items-start self-start justify-self-end md:justify-self-auto"
      >
        {isSmallViewport ? (
          <div className="flex flex-col gap-2 text-white/70">
            <span className="text-[0.625rem] tracking-[0.02em] text-white/85">
              Font size
            </span>
            <NumericStepper
              ariaLabel="Text size"
              max={MOBILE_FONT_SIZE_MAX}
              min={3}
              step={2}
              unit="px"
              value={fontSize}
              onChange={commitFontSize}
            />
          </div>
        ) : (
          <DesktopFontSizeControl
            value={fontSize}
            onCommit={commitFontSize}
            onPreview={(size) => {
              const page = document.querySelector<HTMLElement>(
                ".identity-fonts-page",
              );
              if (!page) return;
              page.toggleAttribute("data-font-size-preview", size !== null);
              if (size !== null)
                page.style.setProperty(
                  "--identity-ghost-font-size",
                  `${size}px`,
                );
            }}
          />
        )}

        <button
          ref={
            floating === toolbarFloating
              ? typographySettingsButtonReference
              : undefined
          }
          aria-controls={
            floating ? "typography-settings-floating" : "typography-settings"
          }
          aria-expanded={typographySettingsOpen}
          aria-label="Typography settings"
          className="ml-2 flex size-9 shrink-0 self-end cursor-pointer items-center justify-center bg-transparent text-white/75 shadow-none outline-none hover:text-white focus:outline-none focus-visible:outline-none md:-translate-y-1"
          type="button"
          onClick={() => {
            setTypographySettingsOpen((open) => !open);
            setFontColorSettingsOpen(false);
            setBackgroundSettingsOpen(false);
          }}
        >
          <Settings aria-hidden="true" className="size-4" />
        </button>

        {typographySettingsOpen && floating === toolbarFloating ? (
          <div
            className={`${floating ? "fixed right-6 bottom-[4.5rem] md:absolute md:right-0 md:top-full md:bottom-auto md:mt-2" : "absolute right-0 top-full mt-2"} z-[10001] max-h-[35dvh] w-[calc(100vw-3rem)] max-w-[20rem] overflow-y-auto overscroll-contain border border-white/45 bg-black p-3 [&_*]:!tracking-normal md:max-h-[calc(100dvh-3rem)] md:w-[24rem] md:max-w-[calc(100vw-3rem)] md:p-3`}
            id={
              floating ? "typography-settings-floating" : "typography-settings"
            }
          >
            <div className="mb-3 flex items-center justify-between gap-4">
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
                  setTextCasing("mixed");
                  setFontWeight("normal");
                  setTextShadow(DEFAULT_TEXT_SHADOW);
                  setInkBleed(0);
                }}
              >
                Reset
              </button>
            </div>

            <div className="md:grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:items-start md:gap-4">
              <div className="min-w-0 md:order-2 [&>div]:!mb-3 [&>div:last-child]:!mb-0 [&_[role=group]_button]:!size-7">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
                    Casing
                  </span>
                  <div
                    aria-label="Text casing"
                    className="grid shrink-0 grid-cols-3 border border-white/35"
                    role="group"
                  >
                    {(
                      [
                        ["lower", "aa", "Lowercase"],
                        ["mixed", "Aa", "Original casing"],
                        ["upper", "AA", "Uppercase"],
                      ] as const
                    ).map(([value, label, title], index) => (
                      <button
                        key={value}
                        aria-label={title}
                        aria-pressed={textCasing === value}
                        className={`flex size-8 cursor-pointer items-center justify-center text-[0.6875rem] outline-none hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-3px] focus-visible:outline-white ${index < 2 ? "border-r border-white/35" : ""} ${textCasing === value ? "bg-white text-black hover:text-black" : "bg-black text-white/55"}`}
                        title={title}
                        type="button"
                        onClick={() => {
                          setTextCasing(value);
                        }}
                      >
                        <span aria-hidden="true">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

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
                        className="identity-settings-switch-track absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-white/35"
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
              </div>
              <div className="min-w-0 md:order-1 [&>label]:!mt-3 [&>label:first-child]:!mt-0 [&>label>span]:!mb-2">
                {isSmallViewport ? (
                  <div className="mt-4 grid grid-cols-2 gap-3 pt-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
                        Line height
                      </span>
                      <NumericStepper
                        ariaLabel="Line height"
                        max={2.5}
                        min={0.8}
                        precision={2}
                        step={0.05}
                        value={lineHeight}
                        onChange={setLineHeight}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
                        Letter spacing
                      </span>
                      <NumericStepper
                        ariaLabel="Letter spacing"
                        max={0.5}
                        min={-0.5}
                        precision={2}
                        step={0.01}
                        unit=" em"
                        value={letterSpacing}
                        onChange={setLetterSpacing}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-[0.625rem] tracking-[0.08em] text-white/65">
                        Ink bleed
                      </span>
                      <NumericStepper
                        ariaLabel="Ink bleed"
                        max={8}
                        min={0}
                        precision={2}
                        step={0.05}
                        unit=" px"
                        value={inkBleed}
                        onChange={setInkBleed}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-3 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                        <span>Line height</span>
                        <span>{lineHeight.toFixed(2)}</span>
                      </span>
                      <input
                        aria-label="Line height"
                        className="identity-font-size-slider block w-full"
                        max="2.5"
                        min="0.8"
                        step="0.05"
                        type="range"
                        value={lineHeight}
                        onPointerDown={(event) =>
                          jumpRangeToPointer(event, setLineHeight)
                        }
                        onPointerMove={(event) =>
                          jumpRangeToPointer(event, setLineHeight)
                        }
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
                        aria-label="Letter spacing"
                        className="identity-font-size-slider block w-full"
                        max="0.5"
                        min="-0.5"
                        step="0.01"
                        type="range"
                        value={letterSpacing}
                        onPointerDown={(event) =>
                          jumpRangeToPointer(event, setLetterSpacing)
                        }
                        onPointerMove={(event) =>
                          jumpRangeToPointer(event, setLetterSpacing)
                        }
                        onChange={(event) => {
                          setLetterSpacing(Number(event.target.value));
                        }}
                      />
                    </label>
                    <label className="mt-6 block">
                      <span className="mb-3 flex items-center justify-between gap-4 text-[0.625rem] tracking-[0.08em] text-white/65">
                        <span>Ink bleed</span>
                        <span>
                          {inkBleed === 0 ? "Off" : `${inkBleed.toFixed(2)} px`}
                        </span>
                      </span>
                      <input
                        aria-label="Ink bleed"
                        className="identity-font-size-slider block w-full"
                        min={0}
                        max={8}
                        step={0.05}
                        type="range"
                        value={inkBleed}
                        onPointerDown={(event) =>
                          jumpRangeToPointer(event, setInkBleed)
                        }
                        onPointerMove={(event) =>
                          jumpRangeToPointer(event, setInkBleed)
                        }
                        onChange={(event) =>
                          setInkBleed(Number(event.target.value))
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <main
      data-native-cursor-surface
      data-ink-bleed={inkBleed > 0 ? "true" : undefined}
      className={`identity-fonts-page min-h-[100dvh] touch-manipulation overflow-x-clip bg-black px-5 py-5 text-white sm:px-8 sm:py-7 lg:px-10 ${lightMode ? "identity-fonts-page--light" : ""}`}
      style={{
        fontFamily: "'Berlin Type Office', Futura, sans-serif",
        fontWeight: 700,
      }}
    >
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        className="absolute pointer-events-none"
      >
        <defs>
          <InkBleedFilter id="collection-ink-bleed" amount={inkBleed} />
        </defs>
      </svg>
      {inkBleed > 0 && (
        <style>{`.identity-fonts-page[data-ink-bleed=true] .identity-font-committed-preview { filter:url(#collection-ink-bleed); }`}</style>
      )}
      <ActiveCategoryRail
        categories={categoryRailItems}
        label={activeCategoryLabel}
        onCategorySelect={selectCategoryFromRail}
      />
      <ScrollControls lightMode={lightMode} />
      <IdentityFontsOnboarding />

      <div className="mx-auto max-w-[92rem]">
        <header className="relative border-b border-white/50 bg-black pb-4">
          <button
            aria-label={
              lightMode ? "Switch to dark mode" : "Switch to light mode"
            }
            className="absolute top-0 right-0 z-20 flex size-9 cursor-pointer items-center justify-center bg-transparent text-white/85 outline-none transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none"
            title={lightMode ? "Dark mode" : "Light mode"}
            type="button"
            onClick={() => {
              const nextLightMode = !lightMode;

              setLightMode(nextLightMode);
              if (!fontColorCustomized) {
                setFontColor(nextLightMode ? "#000000" : "#ffffff");
              }
            }}
          >
            {lightMode ? (
              <Moon aria-hidden="true" className="size-4" />
            ) : (
              <Sun aria-hidden="true" className="size-4" />
            )}
          </button>
          <div className="flex items-baseline justify-between gap-6 mb-[1.4rem]">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center text-[0.82rem] font-normal tracking-[0.02em] text-white/85 lowercase"
            >
              <img
                alt="Strange Animals"
                className={`h-auto w-32 opacity-80 ${lightMode ? "invert" : ""}`}
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

          {renderToolbar(false)}
        </header>
        <span
          ref={toolbarBoundaryReference}
          aria-hidden="true"
          className="pointer-events-none block h-px"
        />
        {categoriesInUse.length > 0 || loading ? (
          <div>
            <div className="flex items-center gap-6 py-3">
              <button
                aria-controls="font-category-filters"
                aria-expanded={categoryFiltersOpen}
                className="identity-filter-toggle flex cursor-pointer items-center gap-2 text-left text-[0.75rem] tracking-[0.02em] text-white outline-none hover:text-white"
                type="button"
                onClick={() => {
                  if (loading) return;

                  setCategoryFiltersOpen((open) => !open);
                }}
              >
                <ChevronRight
                  aria-hidden="true"
                  className={`size-3 transition-transform duration-150 motion-reduce:transition-none ${categoryFiltersOpen ? "rotate-90" : ""}`}
                />
                <span>Categories</span>
              </button>
              {loading ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-10 animate-pulse rounded-sm bg-white/10"
                />
              ) : (
                <label className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.6875rem] tracking-[0.02em] text-white hover:text-white">
                  <input
                    checked={allCategoriesSelected}
                    className="size-3 accent-white outline-none"
                    type="checkbox"
                    onChange={() => {
                      setCategorySelectionPristine(false);
                      setHiddenCategoryLabels(
                        allCategoriesSelected
                          ? new Set(categoriesInUse)
                          : new Set(),
                      );
                    }}
                  />
                  <span className="font-bold normal-case">Show All</span>
                </label>
              )}
            </div>
            <div
              className={`grid grid-cols-2 items-center gap-x-0 gap-y-[0.3rem] pb-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 min-[1200px]:grid-cols-7 2xl:grid-cols-9 ${categoryFiltersOpen ? "" : "hidden"}`}
              id="font-category-filters"
            >
              {loading
                ? Array.from({
                    length: LOADING_CATEGORY_PLACEHOLDER_COUNT,
                  }).map((_, index) => (
                    <span
                      key={`category-placeholder-${index}`}
                      aria-hidden="true"
                      className="h-4 w-16 animate-pulse rounded-sm bg-white/10"
                    />
                  ))
                : categoriesInUse.map((categoryLabel) => {
                    const checked = !hiddenCategoryLabels.has(categoryLabel);

                    return (
                      <label
                        key={categoryLabel}
                        className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.6875rem] font-semibold tracking-[0.02em] text-white uppercase hover:text-white"
                      >
                        <input
                          aria-checked={
                            allCategoriesSelected && categorySelectionPristine
                              ? "mixed"
                              : checked
                          }
                          checked={checked}
                          className="size-3 accent-white outline-none"
                          ref={(element) => {
                            if (element) {
                              element.indeterminate =
                                allCategoriesSelected &&
                                categorySelectionPristine;
                            }
                          }}
                          type="checkbox"
                          onChange={() => {
                            setCategorySelectionPristine(false);
                            setHiddenCategoryLabels((current) => {
                              if (current.size === 0) {
                                return new Set(
                                  categoriesInUse.filter(
                                    (label) => label !== categoryLabel,
                                  ),
                                );
                              }

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
                        <span>{getFontCategoryDisplayName(categoryLabel)}</span>
                      </label>
                    );
                  })}
            </div>
          </div>
        ) : null}
        <div className="border-y border-white/20">
          <button
            aria-controls="font-use-case-filters"
            aria-expanded={useCaseFiltersOpen}
            className="identity-filter-toggle flex w-full cursor-pointer items-center gap-2 py-3 text-left text-[0.75rem] tracking-[0.02em] text-white outline-none hover:text-white"
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
                  className="flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.6875rem] font-semibold tracking-[0.02em] text-white uppercase hover:text-white"
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
            <label className="ml-2 flex cursor-pointer items-center gap-2 px-1 py-1 text-[0.6875rem] tracking-[0.02em] text-white hover:text-white">
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
              <span className="font-semibold uppercase">All</span>
            </label>
          </div>
        </div>
        {errorMessage ? (
          <p className="border-b border-white/25 py-6 text-xs text-white/65">
            {errorMessage}
          </p>
        ) : loading ? (
          <section
            aria-label="Loading font catalog"
            className="min-h-[55vh] pb-20 lg:pb-0"
          >
            <p className="py-6 text-xs text-white/50">loading catalog...</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {Array.from({ length: LOADING_SPECIMEN_PLACEHOLDER_COUNT }).map(
                (_, index) => (
                  <article
                    key={`specimen-placeholder-${index}`}
                    aria-hidden="true"
                    className="border border-white/10 p-4"
                  >
                    <div className="mb-4 h-3 w-40 animate-pulse rounded bg-white/12" />
                    <div className="mb-3 h-10 w-full animate-pulse rounded bg-white/8" />
                    <div className="mb-3 h-10 w-5/6 animate-pulse rounded bg-white/8" />
                    <div className="h-8 w-28 animate-pulse rounded bg-white/12" />
                  </article>
                ),
              )}
            </div>
          </section>
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
              const collapsed = search.trim()
                ? searchCollapsedCategoryKeys.has(section.key)
                : !expandedCategoryKeys.has(section.key);
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
                    id={
                      section.key === "pinned"
                        ? undefined
                        : `font-category-${section.key}`
                    }
                  >
                    <button
                      aria-controls={contentId}
                      aria-expanded={!collapsed}
                      className={`flex shrink-0 cursor-pointer items-center gap-2 font-normal text-white outline-none ${section.label.startsWith("category: ") ? "text-[calc(0.7rem+1px)] tracking-normal hover:text-white" : "text-[0.625rem] tracking-[0.12em] hover:text-white/75"}`}
                      type="button"
                      onClick={() => {
                        if (search.trim()) {
                          setSearchCollapsedCategoryKeys((current) => {
                            const next = new Set(current);
                            collapsed
                              ? next.delete(section.key)
                              : next.add(section.key);
                            return next;
                          });
                          return;
                        }
                        if (collapsed) {
                          manuallyClosedCategoriesReference.current.delete(
                            section.key,
                          );
                        } else {
                          manuallyClosedCategoriesReference.current.add(
                            section.key,
                          );
                        }
                        setExpandedCategoryKeys((current) => {
                          const next = new Set(current);
                          collapsed
                            ? next.add(section.key)
                            : next.delete(section.key);
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
                              {getFontCategoryDisplayName(
                                section.label.slice("category: ".length),
                              )}
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
                    {!collapsed ? (
                      <div className="grid gap-x-8 lg:grid-cols-2 [&>article:first-child]:border-t-0 lg:[&>article:nth-child(2)]:border-t-0">
                        {section.fonts.map((font) => (
                          <FontSpecimen
                            key={font.id}
                            onCatalogChanged={async () => {
                              setFonts(await listFontCatalog());
                            }}
                            onFamilyError={reportFamilyError}
                            backgroundColor={backgroundColor}
                            backgroundImageUrl={
                              backgroundMode === "image"
                                ? backgroundImage?.url
                                : undefined
                            }
                            backgroundTextAnchor={backgroundTextAnchor}
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
                            textCasing={textCasing}
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
                              void changeParentCategory(
                                nextFont,
                                parentCategory,
                              );
                            }}
                            onUseCasesChange={(nextFont, useCases) => {
                              void changeUseCases(nextFont, useCases);
                            }}
                            onBackgroundTextAnchorChange={
                              setBackgroundTextAnchor
                            }
                            onPinnedChange={togglePinned}
                            specimen={specimen}
                          />
                        ))}
                      </div>
                    ) : null}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-20 hidden w-[2.5px] -translate-x-1/2 lg:block"
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

      <div className="identity-floating-layer">
        <FloatingToolbarBrand lightMode={lightMode} visible={toolbarFloating} />
        {toolbarFloating && !toolbarMinimized ? renderToolbar(true) : null}
        <FloatingToolbarRestoreButton
          visible={isToolbarLauncherVisible(toolbarFloating, toolbarMinimized)}
          onRestore={() => {
            setToolbarMinimized(false);
            setTypographySettingsOpen(false);
          }}
        />
      </div>

      {savedSetsOpen ? (
        <div
          aria-labelledby="saved-sets-title"
          aria-modal="true"
          className="identity-font-modal-backdrop fixed inset-0 z-[10001] flex items-center justify-center px-5"
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
          className="identity-font-modal-backdrop fixed inset-0 z-[10002] flex items-center justify-center px-5"
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
          className="identity-font-modal-backdrop fixed inset-0 z-[10001] flex items-center justify-center px-5"
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
